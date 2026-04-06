import type { ReactNode } from "react";
import { Header } from "./Header";
import type { AuthUser } from "../../services/authService";

interface AppShellProps {
  children: ReactNode;
  authUser?: AuthUser | null;
  onSignOut?: () => Promise<void>;
  signInUrl?: string | null;
  headerActions?: ReactNode;
}

export const AppShell = ({ children, authUser, onSignOut, signInUrl, headerActions }: AppShellProps) => (
  <div className="min-h-screen bg-slate-50 text-slate-900">
    <Header authUser={authUser} onSignOut={onSignOut} signInUrl={signInUrl} headerActions={headerActions} />
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
  </div>
);
