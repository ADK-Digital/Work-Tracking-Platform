import { Router } from 'express';
import { requireRole } from '../authorization';
import { prisma } from '../db';

const taskProjectOptionsRouter = Router();

const normalizeProjectName = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
};

taskProjectOptionsRouter.get('/task-project-options', async (_req, res) => {
  const options = await prisma.taskProjectOption.findMany({
    orderBy: { name: 'asc' },
  });

  return res.json(options);
});

taskProjectOptionsRouter.post('/task-project-options', requireRole('admin'), async (req, res) => {
  const name = normalizeProjectName((req.body as { name?: unknown }).name);

  if (!name) {
    return res.status(400).json({ error: 'Project name is required.' });
  }

  const existing = await prisma.taskProjectOption.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
  });

  if (existing) {
    return res.json(existing);
  }

  const created = await prisma.taskProjectOption.create({ data: { name } });
  return res.status(201).json(created);
});

export default taskProjectOptionsRouter;
