import { randomUUID } from 'crypto';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
const passport = require('passport');
const { Pool } = require('pg');
import { parseAllowedDomains, requireAuth, setupAuth } from './auth';
import { getUserRole, requireAllowedUser } from './authorization';
import { prisma } from './db';
import healthRouter from './routes/health';
import attachmentsRouter from './routes/attachments';
import workItemsRouter from './routes/workItems';

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 3001);
const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
const isProd = process.env.NODE_ENV === 'production';
const trustProxyEnabled = isProd || process.env.TRUST_PROXY === 'true';

if (trustProxyEnabled) {
  app.set('trust proxy', 1);
}

const sessionPool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;

app.use(
  cors({
    origin: frontendUrl,
    credentials: true,
  }),
);
app.use(express.json());
app.use((req, res, next) => {
  const startedAt = process.hrtime.bigint();
  const requestId = req.header('x-request-id') || randomUUID();
  res.setHeader('X-Request-Id', requestId);

  res.on('finish', () => {
    const elapsedNs = Number(process.hrtime.bigint() - startedAt);
    const durationMs = (elapsedNs / 1_000_000).toFixed(1);
    console.info(`[http] request_id=${requestId} method=${req.method} path=${req.originalUrl} status=${res.statusCode} duration_ms=${durationMs}`);
  });

  next();
});

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
  req.logout((logoutError: unknown) => {
    if (logoutError) {
      return next(logoutError);
    }

    req.session.destroy((sessionError: unknown) => {
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
app.use('/api', attachmentsRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
  console.log(
    '[startup] config',
    JSON.stringify({
      nodeEnv: process.env.NODE_ENV ?? 'development',
      frontendUrl,
      googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:3001/auth/google/callback',
      allowedDomains: [...parseAllowedDomains()],
      trustProxyEnabled,
    }),
  );
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
