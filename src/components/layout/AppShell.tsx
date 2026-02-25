import type { ReactNode } from "react";
import { Header } from "./Header";

interface AppShellProps {
  children: ReactNode;
  onReset: () => void;
  resetting: boolean;
  showAuthControls?: boolean;
  authUser?: { email: string; name: string } | null;
  onSignOut?: () => Promise<void>;
}

export const AppShell = ({ children, onReset, resetting, showAuthControls, authUser, onSignOut }: AppShellProps) => (
  <div className="min-h-screen bg-slate-50 text-slate-900">
    <Header
      onReset={onReset}
      resetting={resetting}
      showAuthControls={showAuthControls}
      authUser={authUser}
      onSignOut={onSignOut}
    />
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
  </div>
);
