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

const getEnv = (...names: string[]): string | undefined => {
  for (const name of names) {
    const value = process.env[name];
    if (value) {
      return value;
    }
  }

  return undefined;
};

const buildMinioEndpoint = (): string | undefined => {
  const configuredEndpoint = getEnv('MINIO_ENDPOINT');
  if (!configuredEndpoint) {
    return undefined;
  }

  if (/^https?:\/\//i.test(configuredEndpoint)) {
    return configuredEndpoint;
  }

  const protocol = (getEnv('MINIO_USE_SSL') ?? 'false') === 'true' ? 'https' : 'http';
  const port = getEnv('MINIO_PORT');
  return port ? `${protocol}://${configuredEndpoint}:${port}` : `${protocol}://${configuredEndpoint}`;
};

const getS3Endpoint = (): string => requiredEnv('S3_ENDPOINT', buildMinioEndpoint() ?? 'http://minio:9000');
const getS3Region = (): string => getEnv('S3_REGION') ?? 'us-east-1';
const getS3AccessKey = (): string => requiredEnv('S3_ACCESS_KEY', getEnv('MINIO_ACCESS_KEY', 'MINIO_ROOT_USER'));
const getS3SecretKey = (): string => requiredEnv('S3_SECRET_KEY', getEnv('MINIO_SECRET_KEY', 'MINIO_ROOT_PASSWORD'));
const getBucket = (): string => requiredEnv('S3_BUCKET', getEnv('MINIO_BUCKET_ATTACHMENTS') ?? 'attachments');
const isS3Configured = (): boolean =>
  Boolean(
    (getEnv('S3_ACCESS_KEY') && getEnv('S3_SECRET_KEY')) ||
      (getEnv('MINIO_ACCESS_KEY') && getEnv('MINIO_SECRET_KEY')) ||
      (getEnv('MINIO_ROOT_USER') && getEnv('MINIO_ROOT_PASSWORD')),
  );

const getClient = (): any => {
  if (cachedClient) {
    return cachedClient;
  }

  const { S3Client } = getS3Lib();
  cachedClient = new S3Client({
    endpoint: getS3Endpoint(),
    region: getS3Region(),
    credentials: {
      accessKeyId: getS3AccessKey(),
      secretAccessKey: getS3SecretKey(),
    },
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? 'true') === 'true',
  });

  return cachedClient;
};

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
