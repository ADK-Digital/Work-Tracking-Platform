import type { Request, RequestHandler } from 'express';
import { isMember } from './googleDirectory';

type Role = 'admin' | 'user';

const parseEnvList = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

const allowedDomains = new Set(parseEnvList(process.env.ALLOWED_EMAIL_DOMAINS));
const allowedUserGroups = parseEnvList(process.env.ALLOWED_USER_GROUPS);
const adminGroups = parseEnvList(process.env.ADMIN_GROUPS);
const adminEmails = new Set(parseEnvList(process.env.ADMIN_EMAILS));

const isDomainAllowed = (email: string): boolean => {
  if (allowedDomains.size === 0) {
    return true;
  }

  const domain = email.split('@')[1]?.toLowerCase();
  return Boolean(domain && allowedDomains.has(domain));
};

const hasAnyGroupMembership = async (email: string, groups: string[]): Promise<boolean> => {
  if (groups.length === 0) {
    return false;
  }

  for (const groupEmail of groups) {
    const member = await isMember(email, groupEmail);
    if (member) {
      return true;
    }
  }

  return false;
};

const resolveRole = async (email: string): Promise<Role | null> => {
  const normalizedEmail = email.toLowerCase();

  if (!isDomainAllowed(normalizedEmail)) {
    return null;
  }

  if (allowedUserGroups.length > 0) {
    const allowedByGroup = await hasAnyGroupMembership(normalizedEmail, allowedUserGroups);
    if (!allowedByGroup) {
      return null;
    }
  }

  if (adminGroups.length > 0) {
    const isAdminByGroup = await hasAnyGroupMembership(normalizedEmail, adminGroups);
    if (isAdminByGroup) {
      return 'admin';
    }
  }

  if (adminEmails.has(normalizedEmail)) {
    return 'admin';
  }

  return 'user';
};

const logForbidden = (req: Request, message: string) => {
  const email = req.user?.email ?? 'unknown';
  console.warn(`[authz] ${message}; email=${email}; route=${req.method} ${req.originalUrl}`);
};

const computeRole = async (req: Request): Promise<Role | null> => {
  if (!req.user?.email) {
    return null;
  }

  if (req.authz?.role) {
    return req.authz.role;
  }

  const role = await resolveRole(req.user.email);
  if (role) {
    req.authz = { role };
  }

  return role;
};

export const requireAllowedUser: RequestHandler = async (req, res, next) => {
  try {
    const role = await computeRole(req);
    if (!role) {
      logForbidden(req, 'allowed-user check failed');
      return res.status(403).json({ message: 'Forbidden' });
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

export const requireRole = (requiredRole: Role): RequestHandler => async (req, res, next) => {
  try {
    const role = await computeRole(req);

    if (!role || role !== requiredRole) {
      logForbidden(req, `required role=${requiredRole}, actual role=${role ?? 'none'}`);
      return res.status(403).json({ message: 'Forbidden' });
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

export const getUserRole = async (req: Request): Promise<Role | null> => computeRole(req);

