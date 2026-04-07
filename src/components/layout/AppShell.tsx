import type { ReactNode } from "react";
import { Header } from "./Header";
import backLogo from "../../../images/favicon.png";
import type { AuthUser } from "../../services/authService";
import { isDemoMode } from "../../config/appMode";
import { DemoModeBanner } from "../demo/DemoModeBanner";

interface AppShellProps {
  children: ReactNode;
  authUser?: AuthUser | null;
  onSignOut?: () => Promise<void>;
  signInUrl?: string | null;
  headerActions?: ReactNode;
}

export const AppShell = ({ children, authUser, onSignOut, signInUrl, headerActions }: AppShellProps) => (
  <div className="min-h-screen bg-slate-50 text-slate-900">
    <a
      href="https://adk-digital.com"
      aria-label="Back to ADK Digital homepage"
      className="fixed left-3 top-16 z-[9999] flex h-14 w-14 items-center justify-center rounded-full border border-white/25 bg-[rgba(17,17,17,0.72)] shadow-[0_10px_30px_rgba(2,6,23,0.35)] backdrop-blur-md transition-transform duration-200 hover:scale-105 hover:bg-[rgba(17,17,17,0.85)] sm:left-4 sm:top-[4.5rem] sm:h-20 sm:w-20"
    >
      <img src={backLogo} alt="ADK Digital" className="h-8 w-8 object-contain sm:h-12 sm:w-12" />
    </a>
    <Header authUser={authUser} onSignOut={onSignOut} signInUrl={signInUrl} headerActions={headerActions} />
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {isDemoMode ? <DemoModeBanner /> : null}
      {children}
    </main>
  </div>
);
