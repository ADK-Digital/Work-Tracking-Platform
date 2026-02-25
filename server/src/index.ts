import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import passport from 'passport';
import { Pool } from 'pg';
import { requireAuth, setupAuth } from './auth';
import { getUserRole, requireAllowedUser } from './authorization';
import { prisma } from './db';
import healthRouter from './routes/health';
import workItemsRouter from './routes/workItems';

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 3001);
const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';

const sessionPool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;

app.use(
  cors({
    origin: frontendUrl,
    credentials: true,
  }),
);
app.use(express.json());

setupAuth(app, { pgPool: sessionPool });

app.get('/auth/google', passport.authenticate('google'));
app.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: `${frontendUrl}/?auth=failed`, session: true }),
  (_req, res) => {
    res.redirect(frontendUrl);
  },
);

app.post('/auth/logout', (req, res, next) => {
  req.logout((logoutError) => {
    if (logoutError) {
      return next(logoutError);
    }

    req.session.destroy((sessionError) => {
      if (sessionError) {
        return next(sessionError);
      }

      res.clearCookie('connect.sid');
      return res.status(204).send();
    });
  });
});

app.use('/api', healthRouter);
app.use('/api', requireAuth);
app.use('/api', requireAllowedUser);
app.get('/api/me', async (req, res, next) => {
  try {
    const { email, name } = req.user!;
    const role = await getUserRole(req);
    res.json({ email, name, role: role ?? 'user' });
  } catch (error) {
    next(error);
  }
});
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
    if (sessionPool) {
      await sessionPool.end();
    }
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
