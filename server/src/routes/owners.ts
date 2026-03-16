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
      .filter((item): item is DirectoryPerson => Boolean(item?.googleId && item?.email && item?.displayName))
      .map((item) => ({
        googleId: item.googleId,
        email: item.email.toLowerCase(),
        displayName: item.displayName,
      }))
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

ownersRouter.get('/owners/directory/debug', async (req, res) => {
  const groupEmail = resolveOwnerDirectoryGroup();
  const members = await listGroupMembers(groupEmail);

  if (members === null) {
    return res.status(503).json({
      error: 'Google directory client unavailable; debug route requires google-directory mode.',
      groupEmail,
    });
  }

  const emails = typeof req.query.emails === 'string'
    ? req.query.emails
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
    : [];

  const filtered = emails.length > 0 ? members.filter((member) => emails.includes(member.email)) : members;

  const owners = filtered.map((member) => ({
    googleId: member.googleId,
    email: member.email,
    displayName: member.displayName,
    firstName: member.firstName ?? null,
    lastName: member.lastName ?? null,
  }));

  console.info(
    '[owner-directory-debug] payload',
    JSON.stringify({
      groupEmail,
      requestedEmails: emails,
      ownerCount: owners.length,
      owners,
    }),
  );

  return res.json({
    groupEmail,
    ownerCount: owners.length,
    owners,
  });
});

export default ownersRouter;
