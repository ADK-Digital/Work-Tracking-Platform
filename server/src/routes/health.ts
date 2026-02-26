import { Router } from 'express';
import { prisma } from '../db';
import { checkS3BucketReadiness } from '../storage/s3';

const healthRouter = Router();

const READINESS_TIMEOUT_MS = Number(process.env.READINESS_TIMEOUT_MS ?? 2500);
const READINESS_CACHE_TTL_MS = Number(process.env.READINESS_CACHE_TTL_MS ?? 5000);

type DependencyCheckResult = {
  ok: boolean;
  status: string;
  error?: string;
};

type ReadinessResponse = {
  ok: boolean;
  checks: {
    database: DependencyCheckResult;
    minio: DependencyCheckResult;
  };
};

let cachedReadiness: { expiresAt: number; response: ReadinessResponse } | null = null;

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
  let timeoutHandle: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
};

const runReadinessChecks = async (): Promise<ReadinessResponse> => {
  const database: DependencyCheckResult = { ok: true, status: 'reachable' };
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, READINESS_TIMEOUT_MS, 'database check timed out');
  } catch (error) {
    console.error('[readiness] database check failed', error);
    database.ok = false;
    database.status = 'unreachable';
    database.error = error instanceof Error ? error.message : 'database check failed';
  }

  const minio = await checkS3BucketReadiness(READINESS_TIMEOUT_MS);

  return {
    ok: database.ok && minio.ok,
    checks: {
      database,
      minio,
    },
  };
};

healthRouter.get('/health', (_req, res) => {
  res.json({ ok: true });
});

healthRouter.get('/ready', async (_req, res) => {
  const now = Date.now();
  if (cachedReadiness && cachedReadiness.expiresAt > now) {
    return res.status(cachedReadiness.response.ok ? 200 : 503).json(cachedReadiness.response);
  }

  const response = await runReadinessChecks();
  cachedReadiness = {
    expiresAt: Date.now() + READINESS_CACHE_TTL_MS,
    response,
  };

  return res.status(response.ok ? 200 : 503).json(response);
});

export default healthRouter;
