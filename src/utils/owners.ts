import type { WorkItemOwner } from "../types/workItem";

type OwnerNameParts = {
  firstName?: string | null;
  lastName?: string | null;
};

type DirectoryOwnerLike = OwnerNameParts & {
  displayName?: string | null;
  ownerName?: string | null;
  email?: string | null;
};

const formatNameParts = ({ firstName, lastName }: OwnerNameParts): string | null => {
  const fullName = [firstName?.trim(), lastName?.trim()].filter(Boolean).join(" ");
  return fullName || null;
};

export const getOwnerDisplayName = (owner: DirectoryOwnerLike): string => {
  const displayName = owner.displayName?.trim();
  const email = owner.email?.trim();
  const displayNameLooksLikeEmail = Boolean(displayName && email && displayName.toLowerCase() === email.toLowerCase());

  if (displayName && !displayNameLooksLikeEmail) {
    return displayName;
  }

  const fullName = formatNameParts(owner);
  if (fullName) {
    return fullName;
  }

  const ownerName = owner.ownerName?.trim();
  if (ownerName) {
    return ownerName;
  }

  if (email) {
    return email;
  }

  return "Unknown owner";
};

export const formatOwnerLabel = (owner: Partial<WorkItemOwner>, directoryOwner?: DirectoryOwnerLike): string =>
  getOwnerDisplayName({
    displayName: directoryOwner?.displayName,
    firstName: directoryOwner?.firstName,
    lastName: directoryOwner?.lastName,
    ownerName: owner.ownerName,
    email: owner.ownerEmail ?? directoryOwner?.email,
  });
