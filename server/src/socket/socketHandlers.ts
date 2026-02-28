import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@booty-bounties/shared';
import type { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import type { GameManager } from '../game/GameManager.js';

type IOServer = Server<ClientToServerEvents, ServerToClientEvents>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// Per-connection session
interface Session {
  playerId?: string;
  pirateName?: string;
  gameId?: string;
}

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Simple in-memory limiter: max AUTH_MAX_ATTEMPTS attempts per AUTH_WINDOW_MS
const AUTH_MAX_ATTEMPTS = 5;
const AUTH_WINDOW_MS    = 60_000; // 1 minute

const authAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(socketId: string): boolean {
  const now = Date.now();
  let entry = authAttempts.get(socketId);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + AUTH_WINDOW_MS };
    authAttempts.set(socketId, entry);
  }
  entry.count += 1;
  return entry.count <= AUTH_MAX_ATTEMPTS;
}

function resetRateLimit(socketId: string): void {
  authAttempts.delete(socketId);
}

// ── Input validation ──────────────────────────────────────────────────────────
const NAME_RE = /^[a-zA-Z0-9 _\-'!.]+$/;

function validatePirateName(name: unknown): string | null {
  if (typeof name !== 'string') return 'Pirate name must be a string.';
  const trimmed = name.trim();
  if (trimmed.length < 2)  return 'Pirate name must be at least 2 characters.';
  if (trimmed.length > 30) return 'Pirate name is too long (max 30 characters).';
  if (!NAME_RE.test(trimmed)) return 'Pirate name contains illegal characters.';
  return null;
}

function validatePassword(pass: unknown): string | null {
  if (typeof pass !== 'string') return 'Password must be a string.';
  if (pass.length < 4)   return 'Password must be at least 4 characters.';
  if (pass.length > 128) return 'Password is too long (max 128 characters).';
  return null;
}

// ── Handler registration ──────────────────────────────────────────────────────

export function registerSocketHandlers(
  io: IOServer,
  gameManager: GameManager,
  prisma: PrismaClient,
): void {
  io.on('connection', (socket: IOSocket) => {
    const session: Session = {};
    console.log(`[Socket] Connect: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`[Socket] Disconnect: ${socket.id}`);
      resetRateLimit(socket.id);
    });

    // ── Auth ──────────────────────────────────────────────────────────────────

    socket.on('auth:login', async ({ pirateName, password }, ack) => {
      // Rate limit
      if (!checkRateLimit(socket.id)) {
        ack({ success: false, error: 'Too many attempts. Please wait a minute, scoundrel!' });
        return;
      }

      // Validate inputs
      const nameErr = validatePirateName(pirateName);
      if (nameErr) { ack({ success: false, error: nameErr }); return; }

      const passErr = validatePassword(password);
      if (passErr) { ack({ success: false, error: passErr }); return; }

      const trimmedName = (pirateName as string).trim();

      try {
        let player = await prisma.player.findUnique({ where: { pirateName: trimmedName } });

        if (!player) {
          // New pirate — register
          const hash = await bcrypt.hash(password, 10);
          player = await prisma.player.create({
            data: { pirateName: trimmedName, passwordHash: hash },
          });
        } else {
          // Existing pirate — verify password
          const valid = await bcrypt.compare(password, player.passwordHash);
          if (!valid) {
            ack({ success: false, error: 'Wrong password, scoundrel!' });
            return;
          }
        }

        session.playerId  = player.id;
        session.pirateName = player.pirateName;

        // Rejoin active game if any
        const existingGameId = gameManager.getPlayerGame(player.id);
        if (existingGameId) {
          session.gameId = existingGameId;
          await socket.join(existingGameId);
        }

        // Successful auth resets rate limit
        resetRateLimit(socket.id);
        ack({ success: true, playerId: player.id, pirateName: player.pirateName });
      } catch (err) {
        console.error('[Auth] Database error:', err);
        ack({ success: false, error: 'A server storm hit! Try again shortly.' });
      }
    });

    // ── Game ──────────────────────────────────────────────────────────────────

    socket.on('game:create', (ack) => {
      if (!session.playerId) { ack({ success: false, error: 'Not logged in' }); return; }
      const state = gameManager.createGame();
      const player = gameManager.addPlayer(state.id, session.playerId, session.pirateName!);
      if (!player) { ack({ success: false, error: 'Could not join game' }); return; }
      session.gameId = state.id;
      void socket.join(state.id);
      ack({ success: true, gameId: state.id });
    });

    socket.on('game:join', ({ gameId }, ack) => {
      if (!session.playerId) { ack({ success: false, error: 'Not logged in' }); return; }
      if (typeof gameId !== 'string' || gameId.length > 64) {
        ack({ success: false, error: 'Invalid game ID' }); return;
      }
      const player = gameManager.addPlayer(gameId, session.playerId, session.pirateName!);
      if (!player) { ack({ success: false, error: 'Could not join game' }); return; }
      session.gameId = gameId;
      void socket.join(gameId);
      const state = gameManager.getGame(gameId)!;
      ack({ success: true, gameId, state });
    });

    socket.on('game:ready', () => {
      if (!session.playerId || !session.gameId) return;
      const started = gameManager.setReady(session.gameId, session.playerId);
      if (started) {
        const state = gameManager.getGame(session.gameId);
        if (state) {
          io.to(session.gameId).emit('game:stateSync', state);
          const tm = gameManager.getTurnManager(session.gameId);
          if (tm) {
            tm.onStateUpdate = (gId, st) => {
              io.to(gId).emit('game:stateSync', st);
              io.to(gId).emit('game:turnAdvanced', st.turn);
            };
            tm.onGameOver = (gId, winnerId, st) => {
              io.to(gId).emit('game:over', winnerId, st);
            };
          }
        }
      }
    });

    socket.on('game:action', (action, ack) => {
      if (!session.playerId || !session.gameId) {
        ack({ success: false, error: 'Not in a game' }); return;
      }
      const tm = gameManager.getTurnManager(session.gameId);
      if (!tm) { ack({ success: false, error: 'Game not started' }); return; }

      const result = tm.processAction(session.playerId, action);
      ack(result);

      if (result.success) {
        const state = gameManager.getGame(session.gameId);
        if (state) io.to(session.gameId).emit('game:stateSync', state);
      }
    });

    socket.on('game:requestState', (ack) => {
      if (!session.gameId) return;
      const state = gameManager.getGame(session.gameId);
      if (state) ack(state);
    });
  });
}
