import { apiFetch } from "./http";

export type AuthRole = "admin" | "user";

export type AuthUser = {
  email: string;
  name: string;
  role: AuthRole;
  googleId?: string;
  displayName?: string;
};

export const loadAuthUser = async (): Promise<AuthUser | null> => apiFetch<AuthUser>("/api/me");
