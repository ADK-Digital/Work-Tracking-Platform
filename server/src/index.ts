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
import ownersRouter from './routes/owners';

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 3001);
const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
const isProd = process.env.NODE_ENV === 'production';
const parseAllowedOrigins = (): Set<string> => {
  const configured = (process.env.CORS_ALLOWED_ORIGINS ?? frontendUrl)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return new Set(configured);
};
const allowedOrigins = parseAllowedOrigins();
const parseTrustProxyHops = (): number => {
  const trustProxyValue = process.env.TRUST_PROXY;
  if (!trustProxyValue) {
    return isProd ? 1 : 0;
  }

  if (trustProxyValue === 'true') {
    return 1;
  }

  if (trustProxyValue === 'false') {
    return 0;
  }

  const hops = Number(trustProxyValue);
  return Number.isFinite(hops) && hops >= 0 ? hops : isProd ? 1 : 0;
};

const trustProxyHops = parseTrustProxyHops();
const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000);
const rateLimitMax = Number(process.env.RATE_LIMIT_MAX ?? 100);
const apiRateBuckets = new Map<string, { count: number; resetAt: number }>();
const isAttachmentPath = (method: string, path: string): boolean => {
  if (method === 'POST' && /^\/work-items\/[^/]+\/attachments$/.test(path)) {
    return true;
  }

  if (method === 'GET' && /^\/attachments\/[^/]+\/download$/.test(path)) {
    return true;
  }

  return false;
};
const apiRateLimiter: express.RequestHandler = (req, res, next) => {
  if (isAttachmentPath(req.method, req.path)) {
    return next();
  }

  const now = Date.now();
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const bucket = apiRateBuckets.get(clientIp);

  if (!bucket || now >= bucket.resetAt) {
    apiRateBuckets.set(clientIp, { count: 1, resetAt: now + rateLimitWindowMs });
    return next();
  }

  if (bucket.count >= rateLimitMax) {
    const resetAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);
    res.setHeader('Retry-After', String(Math.max(resetAfterSeconds, 1)));
    return res.status(429).json({ error: 'Too many requests, please try again later.' });
  }

  bucket.count += 1;
  return next();
};
const cleanupIntervalMs = Math.max(rateLimitWindowMs, 60_000);
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of apiRateBuckets.entries()) {
    if (now >= bucket.resetAt) {
      apiRateBuckets.delete(key);
    }
  }
}, cleanupIntervalMs).unref();

app.set('trust proxy', trustProxyHops);

const sessionPool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
  }),
);
app.use(
  (_req, res, next) => {
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Download-Options', 'noopen');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    next();
  },
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
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
app.get('/api/auth/login', passport.authenticate('google'));
app.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: `${frontendUrl}/?auth=failed`, session: true }),
  (_req, res) => {
    res.redirect(frontendUrl);
  },
);
app.get(
  '/api/auth/callback',
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
app.use('/api', apiRateLimiter);
app.use('/api', requireAuth);
app.use('/api', requireAllowedUser);
const serializeCurrentUser = async (req: express.Request) => {
  const { email, name, googleSub } = req.user!;
  const role = await getUserRole(req);

  return {
    email,
    name,
    role: role ?? 'user',
    googleId: googleSub,
    displayName: name,
  };
};

app.get('/api/auth/me', async (req, res, next) => {
  try {
    res.json(await serializeCurrentUser(req));
  } catch (error) {
    next(error);
  }
});
app.get('/api/me', async (req, res, next) => {
  try {
    res.json(await serializeCurrentUser(req));
  } catch (error) {
    next(error);
  }
});
app.use('/api', ownersRouter);
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
      googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL,
      allowedOrigins: [...allowedOrigins],
      allowedDomains: [...parseAllowedDomains()],
      trustProxyHops,
      rateLimitWindowMs,
      rateLimitMax,
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
