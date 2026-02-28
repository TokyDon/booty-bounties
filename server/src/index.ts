import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@booty-bounties/shared';
import { PrismaClient } from '@prisma/client';
import { authRouter } from './routes/auth.js';
import { GameManager } from './game/GameManager.js';
import { registerSocketHandlers } from './socket/socketHandlers.js';

const PORT = parseInt(process.env.PORT ?? '3000', 10);

export const prisma = new PrismaClient();
export const gameManager = new GameManager();

// ─── Express ─────────────────────────────────────────────────────────────────

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

app.use('/api/auth', authRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: Date.now() }));

// ─── HTTP + Socket.io ─────────────────────────────────────────────────────────

const httpServer = http.createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: '*' },
  transports: ['websocket'],
});

registerSocketHandlers(io, gameManager, prisma);

// ─── Start ────────────────────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log(`\n⚓  Booty & Bounties server listening on :${PORT}\n`);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
