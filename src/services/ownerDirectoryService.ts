import { apiFetch } from "./http";
import { isApiModeEnabled } from "./workItemsService";

export type OwnerDirectoryEntry = {
  googleId: string;
  email: string;
  displayName: string;
};

export type OwnerDirectoryResponse = {
  groupEmail: string;
  owners: OwnerDirectoryEntry[];
  source: "google-directory" | "mock";
};

const mockOwners: OwnerDirectoryEntry[] = [
  { googleId: "mock-owner-001", email: "alex.kim@example.org", displayName: "alex.kim@example.org" },
  { googleId: "mock-owner-002", email: "morgan.lee@example.org", displayName: "morgan.lee@example.org" },
  { googleId: "mock-owner-003", email: "chris.nguyen@example.org", displayName: "chris.nguyen@example.org" },
  { googleId: "mock-owner-004", email: "avery.tran@example.org", displayName: "avery.tran@example.org" },
  { googleId: "mock-owner-005", email: "noah.diaz@example.org", displayName: "noah.diaz@example.org" },
  { googleId: "mock-owner-006", email: "kira.james@example.org", displayName: "kira.james@example.org" },
];

export const loadOwnerDirectory = async (): Promise<OwnerDirectoryResponse> => {
  if (!isApiModeEnabled) {
    return {
      groupEmail: "cms-admins",
      owners: mockOwners,
      source: "mock",
    };
  }

  return apiFetch<OwnerDirectoryResponse>("/api/owners/directory");
};
