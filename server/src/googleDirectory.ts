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

type OwnerEnrichmentDebug = {
  email: string;
  initialDisplayName: string;
  usersGetAttempted: boolean;
  usersGetSucceeded: boolean;
  usersGetError?: string;
  fullName?: string;
  givenName?: string;
  familyName?: string;
  finalDisplayName: string;
};

const membershipCache = new Map<string, CacheEntry>();
const MEMBERSHIP_TTL_MS = 5 * 60 * 1000;
const ownerDirectoryDebugEnabled = process.env.OWNER_DIRECTORY_DEBUG === 'true';

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
    scopes: ['https://www.googleapis.com/auth/admin.directory.group.member.readonly', 'https://www.googleapis.com/auth/admin.directory.user.readonly'],
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
    firstName: typeof member?.name?.givenName === 'string' ? member.name.givenName : undefined,
    lastName: typeof member?.name?.familyName === 'string' ? member.name.familyName : undefined,
  };
};

const logOwnerEnrichmentDebug = (debug: OwnerEnrichmentDebug) => {
  if (!ownerDirectoryDebugEnabled) {
    return;
  }

  console.info('[owner-directory-debug] enrichment', JSON.stringify(debug));
};

const enrichPersonName = async (directory: any, person: DirectoryPerson): Promise<DirectoryPerson> => {
  const initialDisplayName = person.displayName;
  const displayNameLooksLikeEmail = initialDisplayName.toLowerCase() === person.email;

  if (!displayNameLooksLikeEmail) {
    return person;
  }

  const debugPayload: OwnerEnrichmentDebug = {
    email: person.email,
    initialDisplayName,
    usersGetAttempted: true,
    usersGetSucceeded: false,
    finalDisplayName: person.displayName,
  };

  try {
    const userResponse = await directory.users.get({
      userKey: person.email,
      projection: 'basic',
    });

    const fullName = typeof userResponse?.data?.name?.fullName === 'string' ? userResponse.data.name.fullName.trim() : '';
    const givenName = typeof userResponse?.data?.name?.givenName === 'string' ? userResponse.data.name.givenName.trim() : '';
    const familyName = typeof userResponse?.data?.name?.familyName === 'string' ? userResponse.data.name.familyName.trim() : '';
    const fallbackFullName = [givenName, familyName].filter(Boolean).join(' ').trim();
    const enrichedDisplayName = fullName || fallbackFullName || person.displayName;

    const enrichedPerson: DirectoryPerson = {
      ...person,
      displayName: enrichedDisplayName,
      firstName: givenName || person.firstName,
      lastName: familyName || person.lastName,
    };

    debugPayload.usersGetSucceeded = true;
    debugPayload.fullName = fullName || undefined;
    debugPayload.givenName = givenName || undefined;
    debugPayload.familyName = familyName || undefined;
    debugPayload.finalDisplayName = enrichedPerson.displayName;
    logOwnerEnrichmentDebug(debugPayload);
    return enrichedPerson;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    debugPayload.usersGetError = message;
    debugPayload.finalDisplayName = person.displayName;
    logOwnerEnrichmentDebug(debugPayload);
    console.warn(`[owner-directory-debug] users.get failed for ${person.email}`, error);
    return person;
  }
};

const comparePeople = (a: DirectoryPerson, b: DirectoryPerson): number => {
  const byName = a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' });
  if (byName !== 0) {
    return byName;
  }

  return a.email.localeCompare(b.email, undefined, { sensitivity: 'base' });
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

        const enrichedPerson = await enrichPersonName(directory, person);
        peopleByEmail.set(enrichedPerson.email, enrichedPerson);
      }

      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);

    return [...peopleByEmail.values()].sort(comparePeople);
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
