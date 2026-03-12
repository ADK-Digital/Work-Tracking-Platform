const parseEnvList = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const DEFAULT_OWNER_GROUP = 'cms-admins';

export const resolveOwnerDirectoryGroup = (): string => {
  const explicitGroup = process.env.OWNER_DIRECTORY_GROUP?.trim();
  if (explicitGroup) {
    return explicitGroup;
  }

  const adminGroups = parseEnvList(process.env.ADMIN_GROUPS);
  if (adminGroups.length > 0) {
    return adminGroups[0];
  }

  return DEFAULT_OWNER_GROUP;
};
