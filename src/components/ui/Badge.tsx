const statusStyles: Record<string, string> = {
  submitted: "bg-indigo-100 text-indigo-700",
  quote_requested: "bg-amber-100 text-amber-800",
  quote_received: "bg-sky-100 text-sky-700",
  ordered: "bg-violet-100 text-violet-700",
  in_progress: "bg-indigo-100 text-indigo-700",
  on_hold: "bg-rose-100 text-rose-700",
  completed: "bg-emerald-100 text-emerald-700",
};

const humanize = (value: string): string =>
  value
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

export const Badge = ({ status, label }: { status: string; label?: string }) => (
  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusStyles[status] ?? "bg-slate-100 text-slate-700"}`}>
    {label ?? humanize(status)}
  </span>
);
