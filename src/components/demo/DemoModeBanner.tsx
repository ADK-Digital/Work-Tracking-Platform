import { useState } from "react";
import { Button } from "../ui/Button";
import { resetDemoSessionStore } from "../../providers/data/workItemsDataProvider";

export const DemoModeBanner = () => {
  const [resetting, setResetting] = useState(false);

  const handleReset = () => {
    setResetting(true);
    resetDemoSessionStore();
    setResetting(false);
  };

  return (
    <section className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p>
          <span className="font-semibold">Demo mode.</span> Sample data is shown, and changes last only for the current browser
          session.
        </p>
        <Button variant="secondary" onClick={handleReset} disabled={resetting}>
          {resetting ? "Resetting..." : "Reset Demo Data"}
        </Button>
      </div>
    </section>
  );
};
