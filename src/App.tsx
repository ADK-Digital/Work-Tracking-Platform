import { Route, Routes } from "react-router-dom";
import { Dashboard } from "./pages/Dashboard";
import { WorkItemDetailPage } from "./pages/WorkItemDetailPage";
import { ToastProvider } from "./components/ui/Toast";

const AppContent = () => (
  <Routes>
    <Route path="/" element={<Dashboard />} />
    <Route path="/work-items/:id" element={<WorkItemDetailPage />} />
  </Routes>
);

const App = () => (
  <ToastProvider>
    <AppContent />
  </ToastProvider>
);

export default App;
