import { useEffect, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { PurchaseRequestsWidget } from "../components/widgets/PurchaseRequestsWidget";
import { TasksWidget } from "../components/widgets/TasksWidget";
import { ApiError, apiFetch } from "../services/http";
import { type AuthUser, loadAuthUser } from "../services/authService";
import { API_ERROR_EVENT, API_FORBIDDEN_EVENT, API_UNAUTHORIZED_EVENT, isApiModeEnabled } from "../services/workItemsService";

interface DashboardProps {
  onReset: () => void;
  resetting: boolean;
  resetSignal: number;
}

export const Dashboard = ({ onReset, resetting, resetSignal }: DashboardProps) => {
  const [apiError, setApiError] = useState<string | null>(null);
  const [authWarning, setAuthWarning] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [forbiddenWarning, setForbiddenWarning] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const canManage = !isApiModeEnabled || authUser?.role === "admin";
  const canUseDeletedFeatures = isApiModeEnabled && authUser?.role === "admin";

  const loadMe = async () => {
    if (!isApiModeEnabled) {
      return;
    }

    try {
      const me = await loadAuthUser();
      setAuthUser(me);
      setAuthWarning(null);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setAuthUser(null);
        return;
      }

      console.error(error);
    }
  };

  const signOut = async () => {
    await apiFetch<void>("/auth/logout", { method: "POST" });
    setAuthUser(null);
    setAuthWarning("Please sign in to continue");
  };

  useEffect(() => {
    void loadMe();

    const handleApiError = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      setApiError(customEvent.detail);
    };
    const handleUnauthorized = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      setAuthUser(null);
      setAuthWarning(customEvent.detail);
    };
    const handleForbidden = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      setForbiddenWarning(customEvent.detail);
    };

    window.addEventListener(API_ERROR_EVENT, handleApiError);
    window.addEventListener(API_UNAUTHORIZED_EVENT, handleUnauthorized);
    window.addEventListener(API_FORBIDDEN_EVENT, handleForbidden);

    return () => {
      window.removeEventListener(API_ERROR_EVENT, handleApiError);
      window.removeEventListener(API_UNAUTHORIZED_EVENT, handleUnauthorized);
      window.removeEventListener(API_FORBIDDEN_EVENT, handleForbidden);
    };
  }, []);

  return (
    <AppShell
      onReset={onReset}
      resetting={resetting}
      showAuthControls={isApiModeEnabled}
      authUser={authUser}
      onSignOut={signOut}
    >
      {isApiModeEnabled && authWarning ? (
        <div className="mb-4 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-900">{authWarning}</div>
      ) : null}
      {isApiModeEnabled && apiError ? (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {apiError}
        </div>
      ) : null}
      {isApiModeEnabled && forbiddenWarning ? (
        <div className="mb-4 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">{forbiddenWarning}</div>
      ) : null}
      {canUseDeletedFeatures ? (
        <div className="mb-3 flex items-center gap-2 text-sm text-slate-700">
          <input
            id="show-deleted"
            type="checkbox"
            checked={showDeleted}
            onChange={(event) => setShowDeleted(event.target.checked)}
          />
          <label htmlFor="show-deleted">Show deleted</label>
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <PurchaseRequestsWidget
          resetSignal={resetSignal}
          canManage={canManage}
          includeDeleted={showDeleted}
          canRestore={canUseDeletedFeatures}
        />
        <TasksWidget
          resetSignal={resetSignal}
          canManage={canManage}
          includeDeleted={showDeleted}
          canRestore={canUseDeletedFeatures}
        />
      </div>
    </AppShell>
  );
};
