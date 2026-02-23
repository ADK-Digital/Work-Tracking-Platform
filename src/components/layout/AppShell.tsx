import type { ReactNode } from "react";
import { Header } from "./Header";

interface AppShellProps {
  children: ReactNode;
  onReset: () => void;
  resetting: boolean;
}

export const AppShell = ({ children, onReset, resetting }: AppShellProps) => (
  <div className="min-h-screen bg-slate-50 text-slate-900">
    <Header onReset={onReset} resetting={resetting} />
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
  </div>
);
