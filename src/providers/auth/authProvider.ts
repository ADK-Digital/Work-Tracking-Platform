import { apiFetch } from "../../services/http";
import type { AuthUser } from "../../services/authService";
import { APP_MODE } from "../../config/appMode";

export interface AuthProvider {
  getCurrentUser(): Promise<AuthUser | null>;
  signOut(): Promise<void>;
  getSignInUrl(): string | null;
}

const standardAuthProvider: AuthProvider = {
  getCurrentUser: () => apiFetch<AuthUser>("/api/me"),
  signOut: () => apiFetch<void>("/auth/logout", { method: "POST" }),
  getSignInUrl: () => "/auth/google",
};

const demoAuthProvider: AuthProvider = {
  getCurrentUser: async () => ({
    email: "demo.user@example.edu",
    name: "Demo User",
    displayName: "Demo User",
    googleId: "demo-user",
    role: "admin",
  }),
  signOut: async () => Promise.resolve(),
  getSignInUrl: () => null,
};

export const getAuthProvider = (): AuthProvider => (APP_MODE === "demo" ? demoAuthProvider : standardAuthProvider);
