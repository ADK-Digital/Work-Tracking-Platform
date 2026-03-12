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
  { googleId: "mock-owner-001", email: "alex.kim@example.org", displayName: "Alex Kim" },
  { googleId: "mock-owner-002", email: "morgan.lee@example.org", displayName: "Morgan Lee" },
  { googleId: "mock-owner-003", email: "chris.nguyen@example.org", displayName: "Chris Nguyen" },
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
