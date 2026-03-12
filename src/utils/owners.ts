import type { WorkItemOwner } from "../types/workItem";

export const formatOwnerLabel = (owner: Partial<WorkItemOwner>): string => {
  if (owner.ownerName?.trim()) {
    return owner.ownerName;
  }

  if (owner.ownerEmail?.trim()) {
    return owner.ownerEmail;
  }

  return "Unassigned";
};
