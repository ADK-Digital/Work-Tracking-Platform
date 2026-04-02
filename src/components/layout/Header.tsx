import { Button } from "../ui/Button";
import type { ReactNode } from "react";
import type { AuthUser } from "../../services/authService";

interface HeaderProps {
  authUser?: AuthUser | null;
  onSignOut?: () => Promise<void>;
  headerActions?: ReactNode;
}

export const Header = ({ authUser, onSignOut, headerActions }: HeaderProps) => (
  <header className="border-b border-slate-200 bg-white">
    <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Work Tracking Platform</h1>
        <p className="text-sm text-slate-500">Internal work tracking application for projects and requests.</p>
      </div>
      <div className="flex items-center gap-2">
        {authUser ? (
          <>
            {headerActions}
            <span className="text-sm text-slate-600">{authUser.email}</span>
            <Button variant="secondary" onClick={() => void onSignOut?.()}>
              Sign out
            </Button>
          </>
        ) : (
          <a
            href="/auth/google"
            className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Sign in
          </a>
        )}
      </div>
    </div>
  </header>
);
