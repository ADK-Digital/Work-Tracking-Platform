import type { WorkItemOwner } from "../types/workItem";

type DirectoryOwnerLike = {
  email?: string | null;
};

export const getOwnerDisplayName = (owner: DirectoryOwnerLike): string => {
  const email = owner.email?.trim();
  return email || "Unknown owner";
};

export const formatOwnerLabel = (owner: Partial<WorkItemOwner>, directoryOwner?: DirectoryOwnerLike): string =>
  getOwnerDisplayName({
    email: owner.ownerEmail ?? directoryOwner?.email,
  });
