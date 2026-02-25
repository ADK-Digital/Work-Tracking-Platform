import { Button } from "../ui/Button";
import { API_BASE_URL } from "../../services/http";

interface AuthUser {
  email: string;
  name: string;
}

interface HeaderProps {
  onReset: () => void;
  resetting: boolean;
  showAuthControls?: boolean;
  authUser?: AuthUser | null;
  onSignOut?: () => Promise<void>;
}

export const Header = ({ onReset, resetting, showAuthControls = false, authUser, onSignOut }: HeaderProps) => (
  <header className="border-b border-slate-200 bg-white">
    <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Special Projects Tracker</h1>
        <p className="text-sm text-slate-500">Prototype dashboard for purchase requests and project tasks.</p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={onReset} disabled={resetting}>
          {resetting ? "Resetting..." : "Reset Demo Data"}
        </Button>
        {showAuthControls ? authUser ? (
          <>
            <span className="text-sm text-slate-600">{authUser.email}</span>
            <Button variant="secondary" onClick={() => void onSignOut?.()}>
              Sign out
            </Button>
          </>
        ) : (
          <a
            href={`${API_BASE_URL}/auth/google`}
            className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Sign in
          </a>
        ) : null}
      </div>
    </div>
  </header>
);
