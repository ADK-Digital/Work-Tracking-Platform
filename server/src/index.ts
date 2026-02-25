import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { prisma } from './db';
import healthRouter from './routes/health';
import workItemsRouter from './routes/workItems';

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 3001);

app.use(
  cors({
    origin: 'http://localhost:5173',
  }),
);
app.use(express.json());

app.use('/api', healthRouter);
app.use('/api', workItemsRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});

const shutdown = async () => {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
