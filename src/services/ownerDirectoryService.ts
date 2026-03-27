import { apiFetch } from "./http";

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

export const loadOwnerDirectory = async (): Promise<OwnerDirectoryResponse> =>
  apiFetch<OwnerDirectoryResponse>("/api/owners/directory");
