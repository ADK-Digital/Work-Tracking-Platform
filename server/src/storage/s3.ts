import { Readable } from 'stream';

let cachedClient: any;

const requiredEnv = (name: string, fallback?: string): string => {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required storage env var: ${name}`);
  }
  return value;
};

const getS3Lib = (): any => {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const req = eval('require');
  return req('@aws-sdk/client-s3');
};

const isS3Configured = (): boolean => Boolean(process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY);

const getClient = (): any => {
  if (cachedClient) {
    return cachedClient;
  }

  const { S3Client } = getS3Lib();
  cachedClient = new S3Client({
    endpoint: requiredEnv('S3_ENDPOINT', 'http://minio:9000'),
    region: requiredEnv('S3_REGION', 'us-east-1'),
    credentials: {
      accessKeyId: requiredEnv('S3_ACCESS_KEY'),
      secretAccessKey: requiredEnv('S3_SECRET_KEY'),
    },
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? 'true') === 'true',
  });

  return cachedClient;
};

const getBucket = (): string => requiredEnv('S3_BUCKET', 'attachments');

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

export const checkS3BucketReadiness = async (
  timeoutMs: number,
): Promise<{ ok: boolean; status: string; error?: string }> => {
  if (!isS3Configured()) {
    return { ok: true, status: 'disabled by config' };
  }

  try {
    const { HeadBucketCommand } = getS3Lib();
    await withTimeout(
      getClient().send(
        new HeadBucketCommand({
          Bucket: getBucket(),
        }),
      ),
      timeoutMs,
      'minio check timed out',
    );
    return { ok: true, status: 'reachable' };
  } catch (error) {
    console.error('[readiness] minio bucket check failed', error);
    return {
      ok: false,
      status: 'unreachable',
      error: error instanceof Error ? error.message : 'minio check failed',
    };
  }
};

export const putObject = async (key: string, buffer: Buffer, contentType: string): Promise<void> => {
  const { PutObjectCommand } = getS3Lib();
  await getClient().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );
};

export const getObjectStream = async (key: string): Promise<Readable> => {
  const { GetObjectCommand } = getS3Lib();
  const response = await getClient().send(
    new GetObjectCommand({
      Bucket: getBucket(),
      Key: key,
    }),
  );

  if (!response.Body || !(response.Body instanceof Readable)) {
    throw new Error('Attachment body stream is unavailable');
  }

  return response.Body;
};

export const deleteObject = async (key: string): Promise<void> => {
  const { DeleteObjectCommand } = getS3Lib();
  await getClient().send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: key,
    }),
  );
};
