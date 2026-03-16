import { Router } from 'express';
import type { DirectoryPerson } from '../googleDirectory';
import { listGroupMembers } from '../googleDirectory';
import { resolveOwnerDirectoryGroup } from '../ownerDirectoryGroup';

const ownersRouter = Router();

const compareOwners = (a: DirectoryPerson, b: DirectoryPerson): number => {
  const byName = a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' });
  if (byName !== 0) {
    return byName;
  }

  return a.email.localeCompare(b.email, undefined, { sensitivity: 'base' });
};

const parseMockOwners = (): DirectoryPerson[] => {
  const raw = process.env.OWNER_DIRECTORY_MOCK_JSON?.trim();
  if (!raw) {
    return [
      {
        googleId: 'mock-owner-001',
        email: 'alex.kim@example.org',
        displayName: 'alex.kim@example.org',
      },
      {
        googleId: 'mock-owner-002',
        email: 'morgan.lee@example.org',
        displayName: 'morgan.lee@example.org',
      },
      {
        googleId: 'mock-owner-003',
        email: 'chris.nguyen@example.org',
        displayName: 'chris.nguyen@example.org',
      },
      {
        googleId: 'mock-owner-004',
        email: 'avery.tran@example.org',
        displayName: 'avery.tran@example.org',
      },
      {
        googleId: 'mock-owner-005',
        email: 'noah.diaz@example.org',
        displayName: 'noah.diaz@example.org',
      },
      {
        googleId: 'mock-owner-006',
        email: 'kira.james@example.org',
        displayName: 'kira.james@example.org',
      },
    ].sort(compareOwners);
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is DirectoryPerson => Boolean(item?.googleId && item?.email))
      .map((item) => {
        const email = item.email.toLowerCase();
        return {
          googleId: item.googleId,
          email,
          displayName: email,
        };
      })
      .sort(compareOwners);
  } catch (error) {
    console.error('Failed to parse OWNER_DIRECTORY_MOCK_JSON', error);
    return [];
  }
};

ownersRouter.get('/owners/directory', async (_req, res) => {
  const groupEmail = resolveOwnerDirectoryGroup();
  const members = await listGroupMembers(groupEmail);

  if (members === null) {
    return res.json({
      groupEmail,
      owners: parseMockOwners(),
      source: 'mock',
    });
  }

  return res.json({
    groupEmail,
    owners: members,
    source: 'google-directory',
  });
});

export default ownersRouter;
