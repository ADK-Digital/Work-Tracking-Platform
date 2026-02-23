import { Button } from "../ui/Button";

interface HeaderProps {
  onReset: () => void;
  resetting: boolean;
}

export const Header = ({ onReset, resetting }: HeaderProps) => (
  <header className="border-b border-slate-200 bg-white">
    <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Special Projects Tracker</h1>
        <p className="text-sm text-slate-500">Prototype dashboard for purchase requests and project tasks.</p>
      </div>
      <Button variant="secondary" onClick={onReset} disabled={resetting}>
        {resetting ? "Resetting..." : "Reset Demo Data"}
      </Button>
    </div>
  </header>
);
