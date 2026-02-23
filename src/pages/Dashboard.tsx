import { AppShell } from "../components/layout/AppShell";
import { PurchaseRequestsWidget } from "../components/widgets/PurchaseRequestsWidget";
import { TasksWidget } from "../components/widgets/TasksWidget";

interface DashboardProps {
  onReset: () => void;
  resetting: boolean;
  resetSignal: number;
}

export const Dashboard = ({ onReset, resetting, resetSignal }: DashboardProps) => (
  <AppShell onReset={onReset} resetting={resetting}>
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <PurchaseRequestsWidget resetSignal={resetSignal} />
      <TasksWidget resetSignal={resetSignal} />
    </div>
  </AppShell>
);
