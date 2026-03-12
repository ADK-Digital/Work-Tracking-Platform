export type OwnerIdentity = {
  googleId?: string | null;
  email?: string | null;
  displayName?: string | null;
  name?: string | null;
};

const normalize = (value: string): string => value.trim().toLowerCase();

export const ownerStringMatchesIdentity = (ownerValue: string, identity: OwnerIdentity): boolean => {
  const candidate = normalize(ownerValue);
  if (!candidate) {
    return false;
  }

  const tokens = [identity.googleId, identity.email, identity.displayName, identity.name]
    .filter((value): value is string => Boolean(value && value.trim()))
    .map(normalize);

  if (tokens.length === 0) {
    return false;
  }

  return tokens.includes(candidate);
};
