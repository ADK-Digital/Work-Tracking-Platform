import { useState } from "react";
import { Route, Routes } from "react-router-dom";
import { Dashboard } from "./pages/Dashboard";
import { WorkItemDetailPage } from "./pages/WorkItemDetailPage";
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

  return (
    <Routes>
      <Route path="/" element={<Dashboard onReset={handleReset} resetting={resetting} resetSignal={resetSignal} />} />
      <Route
        path="/work-items/:id"
        element={<WorkItemDetailPage onReset={handleReset} resetting={resetting} />}
      />
    </Routes>
  );
};

const App = () => (
  <ToastProvider>
    <AppContent />
  </ToastProvider>
);

export default App;
