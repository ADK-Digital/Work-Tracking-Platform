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
        displayName: 'Alex Kim',
      },
      {
        googleId: 'mock-owner-002',
        email: 'morgan.lee@example.org',
        displayName: 'Morgan Lee',
      },
      {
        googleId: 'mock-owner-003',
        email: 'chris.nguyen@example.org',
        displayName: 'Chris Nguyen',
      },
      {
        googleId: 'mock-owner-004',
        email: 'avery.tran@example.org',
        displayName: 'Avery Tran',
      },
      {
        googleId: 'mock-owner-005',
        email: 'noah.diaz@example.org',
        displayName: 'Noah Diaz',
      },
      {
        googleId: 'mock-owner-006',
        email: 'kira.james@example.org',
        displayName: 'Kira James',
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
        const firstName = typeof item.firstName === 'string' ? item.firstName.trim() : '';
        const lastName = typeof item.lastName === 'string' ? item.lastName.trim() : '';
        const fullName = [firstName, lastName].filter(Boolean).join(' ');
        const displayName = typeof item.displayName === 'string' && item.displayName.trim().length > 0
          ? item.displayName.trim()
          : (fullName || item.email.toLowerCase());

        return {
          googleId: item.googleId,
          email: item.email.toLowerCase(),
          displayName,
          ...(firstName ? { firstName } : {}),
          ...(lastName ? { lastName } : {}),
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
