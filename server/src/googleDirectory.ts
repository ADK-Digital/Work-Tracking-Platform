import fs from 'node:fs';

const getGoogleApis = (): any => {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const req = eval('require');
  return req('googleapis');
};

type CacheEntry = {
  isMember: boolean;
  expiresAt: number;
};

export type DirectoryPerson = {
  googleId: string;
  email: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
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

const getDirectoryClient = async (): Promise<any | null> => {
  const impersonateAdminEmail = process.env.GOOGLE_IMPERSONATE_ADMIN_EMAIL;
  const authSource = parseServiceAccountCredentials();

  if (!impersonateAdminEmail || !authSource) {
    return null;
  }

  const { google } = getGoogleApis();

  const auth = new google.auth.GoogleAuth({
    ...(authSource.credentials ? { credentials: authSource.credentials } : {}),
    ...(authSource.keyFile ? { keyFile: authSource.keyFile } : {}),
    clientOptions: {
      subject: impersonateAdminEmail,
    },
    scopes: [
      'https://www.googleapis.com/auth/admin.directory.group.member.readonly',
      'https://www.googleapis.com/auth/admin.directory.user.readonly',
    ],
  });

  const authClient = await auth.getClient();
  return google.admin({ version: 'directory_v1', auth: authClient });
};

const toDirectoryPerson = (member: any): DirectoryPerson | null => {
  const email = typeof member?.email === 'string' ? member.email.toLowerCase() : '';
  const googleId = typeof member?.id === 'string' ? member.id : '';

  if (!email || !googleId) {
    return null;
  }

  const displayNameCandidate =
    typeof member?.name?.fullName === 'string' && member.name.fullName.trim().length > 0
      ? member.name.fullName.trim()
      : email;

  return {
    googleId,
    email,
    displayName: displayNameCandidate,
  };
};

const comparePeople = (a: DirectoryPerson, b: DirectoryPerson): number => {
  const byName = a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' });
  if (byName !== 0) {
    return byName;
  }

  return a.email.localeCompare(b.email, undefined, { sensitivity: 'base' });
};

const resolvePersonName = async (directory: any, person: DirectoryPerson): Promise<DirectoryPerson> => {
  try {
    const response = await directory.users.get({
      userKey: person.email,
      projection: 'basic',
      fields: 'id,name(fullName,givenName,familyName),primaryEmail',
    });

    const googleId = typeof response?.data?.id === 'string' && response.data.id.trim().length > 0 ? response.data.id : person.googleId;
    const fullName = typeof response?.data?.name?.fullName === 'string' && response.data.name.fullName.trim().length > 0
      ? response.data.name.fullName.trim()
      : null;
    const firstName = typeof response?.data?.name?.givenName === 'string' && response.data.name.givenName.trim().length > 0
      ? response.data.name.givenName.trim()
      : undefined;
    const lastName = typeof response?.data?.name?.familyName === 'string' && response.data.name.familyName.trim().length > 0
      ? response.data.name.familyName.trim()
      : undefined;

    return {
      ...person,
      googleId,
      displayName: fullName ?? person.displayName,
      firstName,
      lastName,
    };
  } catch (error) {
    console.warn(`Google Directory user lookup failed for ${person.email}; falling back to membership data`, error);
    return person;
  }
};

export const listGroupMembers = async (groupEmail: string): Promise<DirectoryPerson[] | null> => {
  const directory = await getDirectoryClient();

  if (!directory) {
    return null;
  }

  try {
    const peopleByEmail = new Map<string, DirectoryPerson>();
    let pageToken: string | undefined;

    do {
      const response = await directory.members.list({
        groupKey: groupEmail,
        maxResults: 200,
        pageToken,
      });

      const members = Array.isArray(response.data.members) ? response.data.members : [];
      for (const member of members) {
        const person = toDirectoryPerson(member);
        if (!person) {
          continue;
        }

        peopleByEmail.set(person.email, person);
      }

      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);

    const members = [...peopleByEmail.values()];
    const enrichedMembers = await Promise.all(members.map((person) => resolvePersonName(directory, person)));

    return enrichedMembers.sort(comparePeople);
  } catch (error) {
    console.error(`Google Directory member listing failed for ${groupEmail}`, error);
    return [];
  }
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
