import type { WorkItemOwner } from "../types/workItem";

type OwnerNameParts = {
  firstName?: string | null;
  lastName?: string | null;
};

type DirectoryOwnerLike = OwnerNameParts & {
  displayName?: string | null;
  email?: string | null;
};

const formatNameParts = ({ firstName, lastName }: OwnerNameParts): string | null => {
  const fullName = [firstName?.trim(), lastName?.trim()].filter(Boolean).join(" ");
  return fullName || null;
};

export const getOwnerDisplayName = (owner: DirectoryOwnerLike): string => {
  const displayName = owner.displayName?.trim();
  if (displayName) {
    return displayName;
  }

  const fullName = formatNameParts(owner);
  if (fullName) {
    return fullName;
  }

  if (owner.email?.trim()) {
    return owner.email;
  }

  return "Unknown owner";
};

export const formatOwnerLabel = (owner: Partial<WorkItemOwner>): string => {
  if (owner.ownerName?.trim()) {
    return owner.ownerName;
  }

  if (owner.ownerEmail?.trim()) {
    return owner.ownerEmail;
  }

  return "Unassigned";
};
