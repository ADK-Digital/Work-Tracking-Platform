import { useEffect, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { PurchaseRequestsWidget } from "../components/widgets/PurchaseRequestsWidget";
import { TasksWidget } from "../components/widgets/TasksWidget";
import { apiFetch, ApiError } from "../services/http";
import { API_ERROR_EVENT, API_UNAUTHORIZED_EVENT, isApiModeEnabled } from "../services/workItemsService";

interface DashboardProps {
  onReset: () => void;
  resetting: boolean;
  resetSignal: number;
}

export const Dashboard = ({ onReset, resetting, resetSignal }: DashboardProps) => {
  const [apiError, setApiError] = useState<string | null>(null);
  const [authWarning, setAuthWarning] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<{ email: string; name: string } | null>(null);

  const loadMe = async () => {
    if (!isApiModeEnabled) {
      return;
    }

    try {
      const me = await apiFetch<{ email: string; name: string }>("/api/me");
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

    window.addEventListener(API_ERROR_EVENT, handleApiError);
    window.addEventListener(API_UNAUTHORIZED_EVENT, handleUnauthorized);

    return () => {
      window.removeEventListener(API_ERROR_EVENT, handleApiError);
      window.removeEventListener(API_UNAUTHORIZED_EVENT, handleUnauthorized);
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
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <PurchaseRequestsWidget resetSignal={resetSignal} />
        <TasksWidget resetSignal={resetSignal} />
      </div>
    </AppShell>
  );
};
