import { admin_directory_v1, google } from 'googleapis';
import fs from 'node:fs';

type CacheEntry = {
  isMember: boolean;
  expiresAt: number;
};

const membershipCache = new Map<string, CacheEntry>();
const MEMBERSHIP_TTL_MS = 5 * 60 * 1000;

const cacheKey = (email: string, groupEmail: string) => `${email.toLowerCase()}::${groupEmail.toLowerCase()}`;

const getCachedMembership = (email: string, groupEmail: string): boolean | null => {
  const key = cacheKey(email, groupEmail);
  const cached = membershipCache.get(key);

  if (!cached) {
    return null;
  }

  if (cached.expiresAt < Date.now()) {
    membershipCache.delete(key);
    return null;
  }

  return cached.isMember;
};

const setCachedMembership = (email: string, groupEmail: string, isMember: boolean) => {
  const key = cacheKey(email, groupEmail);
  membershipCache.set(key, {
    isMember,
    expiresAt: Date.now() + MEMBERSHIP_TTL_MS,
  });
};

const parseServiceAccountCredentials = (): { credentials?: Record<string, unknown>; keyFile?: string } | null => {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();

  if (!raw) {
    return null;
  }

  if (raw.startsWith('{')) {
    return { credentials: JSON.parse(raw) };
  }

  if (fs.existsSync(raw)) {
    return { keyFile: raw };
  }

  throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON must be a JSON string or a valid file path.');
};

const getDirectoryClient = async (): Promise<admin_directory_v1.Admin | null> => {
  const impersonateAdminEmail = process.env.GOOGLE_IMPERSONATE_ADMIN_EMAIL;
  const authSource = parseServiceAccountCredentials();

  if (!impersonateAdminEmail || !authSource) {
    return null;
  }

  const auth = new google.auth.GoogleAuth({
    ...(authSource.credentials ? { credentials: authSource.credentials } : {}),
    ...(authSource.keyFile ? { keyFile: authSource.keyFile } : {}),
    clientOptions: {
      subject: impersonateAdminEmail,
    },
    scopes: ['https://www.googleapis.com/auth/admin.directory.group.member.readonly'],
  });

  const authClient = await auth.getClient();
  return google.admin({ version: 'directory_v1', auth: authClient });
};

export const isMember = async (email: string, groupEmail: string): Promise<boolean> => {
  const cached = getCachedMembership(email, groupEmail);

  if (cached !== null) {
    return cached;
  }

  const directory = await getDirectoryClient();

  if (!directory) {
    return false;
  }

  try {
    const response = await directory.members.hasMember({
      groupKey: groupEmail,
      memberKey: email,
    });
    const member = Boolean(response.data.isMember);
    setCachedMembership(email, groupEmail, member);
    return member;
  } catch (error) {
    console.error(`Google Directory membership check failed for ${email} in ${groupEmail}`, error);
    setCachedMembership(email, groupEmail, false);
    return false;
  }
};

