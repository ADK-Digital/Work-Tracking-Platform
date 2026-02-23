import { useState } from "react";
import { Dashboard } from "./pages/Dashboard";
import { workItemsService } from "./services/workItemsService";
import { ToastProvider, useToast } from "./components/ui/Toast";

const AppContent = () => {
  const [resetting, setResetting] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const { notify } = useToast();

  const handleReset = async () => {
    setResetting(true);
    await workItemsService.resetDemoData();
    setResetSignal((value) => value + 1);
    notify("Reset demo data");
    setResetting(false);
  };

  return <Dashboard onReset={handleReset} resetting={resetting} resetSignal={resetSignal} />;
};

const App = () => (
  <ToastProvider>
    <AppContent />
  </ToastProvider>
);

export default App;
