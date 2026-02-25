import { apiFetch } from "./http";
import { isApiModeEnabled } from "./workItemsService";

export type AuthRole = "admin" | "user";

export type AuthUser = {
  email: string;
  name: string;
  role: AuthRole;
};

export const loadAuthUser = async (): Promise<AuthUser | null> => {
  if (!isApiModeEnabled) {
    return null;
  }

  return apiFetch<AuthUser>("/api/me");
};
