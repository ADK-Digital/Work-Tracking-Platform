import type { WorkItem } from "../types/workItem";

export type OwnerIdentity = {
  googleId?: string | null;
  email?: string | null;
  displayName?: string | null;
  name?: string | null;
};

export const workItemMatchesOwnerIdentity = (item: WorkItem, identity: OwnerIdentity): boolean => {
  if (!identity.googleId) {
    return false;
  }

  return item.ownerGoogleId === identity.googleId;
};
