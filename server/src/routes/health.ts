import { Router } from 'express';
import { prisma } from '../db';

const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.json({ ok: true });
});

healthRouter.get('/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch (error) {
    console.error('[readiness] database check failed', error);
    res.status(503).json({ ok: false });
  }
});

export default healthRouter;
