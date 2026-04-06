import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { Dashboard } from "./pages/Dashboard";
import { WorkItemDetailPage } from "./pages/WorkItemDetailPage";
import { ToastProvider } from "./components/ui/Toast";
import { isDemoMode } from "./config/appMode";
import { DEMO_DATA_RESET_EVENT } from "./providers/data/workItemsDataProvider";

const AppContent = ({ resetKey }: { resetKey: number }) => (
  <Routes>
    <Route path="/" element={<Dashboard key={`dashboard-${resetKey}`} />} />
    <Route path="/work-items/:id" element={<WorkItemDetailPage key={`detail-${resetKey}`} />} />
  </Routes>
);

const App = () => {
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    if (!isDemoMode) {
      return;
    }

    const handleDemoReset = () => {
      setResetKey((current) => current + 1);
    };

    window.addEventListener(DEMO_DATA_RESET_EVENT, handleDemoReset);

    return () => {
      window.removeEventListener(DEMO_DATA_RESET_EVENT, handleDemoReset);
    };
  }, []);

  return (
    <ToastProvider>
      <AppContent resetKey={resetKey} />
    </ToastProvider>
  );
};

export default App;
