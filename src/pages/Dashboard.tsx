import { useEffect, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { PurchaseRequestsWidget } from "../components/widgets/PurchaseRequestsWidget";
import { TasksWidget } from "../components/widgets/TasksWidget";
import { API_ERROR_EVENT, isApiModeEnabled } from "../services/workItemsService";

interface DashboardProps {
  onReset: () => void;
  resetting: boolean;
  resetSignal: number;
}

export const Dashboard = ({ onReset, resetting, resetSignal }: DashboardProps) => {
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    const handleApiError = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      setApiError(customEvent.detail);
    };

    window.addEventListener(API_ERROR_EVENT, handleApiError);

    return () => {
      window.removeEventListener(API_ERROR_EVENT, handleApiError);
    };
  }, []);

  return (
    <AppShell onReset={onReset} resetting={resetting}>
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
