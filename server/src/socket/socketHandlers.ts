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

export function registerSocketHandlers(
  io: IOServer,
  gameManager: GameManager,
  prisma: PrismaClient,
): void {
  io.on('connection', (socket: IOSocket) => {
    const session: Session = {};
    console.log(`[Socket] Connect: ${socket.id}`);

    // ── Auth ──────────────────────────────────────────────────────────────────

    socket.on('auth:login', async ({ pirateName, password }, ack) => {
      try {
        let player = await prisma.player.findUnique({ where: { pirateName } });

        if (!player) {
          // Auto-register
          const hash = await bcrypt.hash(password, 10);
          player = await prisma.player.create({ data: { pirateName, passwordHash: hash } });
        } else {
          const valid = await bcrypt.compare(password, player.passwordHash);
          if (!valid) {
            ack({ success: false, error: 'Wrong password, scoundrel!' });
            return;
          }
        }

        session.playerId = player.id;
        session.pirateName = player.pirateName;

        // Rejoin active game if any
        const existingGameId = gameManager.getPlayerGame(player.id);
        if (existingGameId) {
          session.gameId = existingGameId;
          await socket.join(existingGameId);
        }

        ack({ success: true, playerId: player.id, pirateName: player.pirateName });
      } catch (err) {
        console.error(err);
        ack({ success: false, error: 'Server error' });
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
          // Wire up TurnManager callbacks
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
        ack({ success: false, error: 'Not in a game' });
        return;
      }
      const tm = gameManager.getTurnManager(session.gameId);
      if (!tm) { ack({ success: false, error: 'Game not started' }); return; }

      const result = tm.processAction(session.playerId, action);
      ack(result);

      if (result.success) {
        const state = gameManager.getGame(session.gameId);
        if (state) {
          io.to(session.gameId).emit('game:stateSync', state);
        }
      }
    });

    socket.on('game:requestState', (ack) => {
      if (!session.gameId) return;
      const state = gameManager.getGame(session.gameId);
      if (state) ack(state);
    });

    // ── Disconnect ────────────────────────────────────────────────────────────

    socket.on('disconnect', () => {
      console.log(`[Socket] Disconnect: ${socket.id}`);
    });
  });
}
