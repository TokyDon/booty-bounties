import express from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../index.js';

export const authRouter = express.Router();

authRouter.post('/register', async (req, res) => {
  try {
    const { pirateName, password } = req.body as { pirateName: string; password: string };
    if (!pirateName || !password) {
      res.status(400).json({ success: false, error: 'pirateName and password required' });
      return;
    }

    const existing = await prisma.player.findUnique({ where: { pirateName } });
    if (existing) {
      res.status(409).json({ success: false, error: 'That name is already taken, landlubber!' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const player = await prisma.player.create({
      data: { pirateName, passwordHash },
    });

    res.json({ success: true, playerId: player.id, pirateName: player.pirateName });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

authRouter.post('/login', async (req, res) => {
  try {
    const { pirateName, password } = req.body as { pirateName: string; password: string };
    const player = await prisma.player.findUnique({ where: { pirateName } });
    if (!player) {
      res.status(401).json({ success: false, error: 'Unknown pirate' });
      return;
    }

    const valid = await bcrypt.compare(password, player.passwordHash);
    if (!valid) {
      res.status(401).json({ success: false, error: 'Wrong password, scoundrel!' });
      return;
    }

    res.json({ success: true, playerId: player.id, pirateName: player.pirateName });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});
