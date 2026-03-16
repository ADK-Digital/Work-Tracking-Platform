const statusStyles: Record<string, string> = {
  submitted: "bg-rose-100 text-rose-800",
  quote_received: "bg-rose-100 text-rose-800",
  in_progress: "bg-amber-100 text-amber-800",
  on_hold: "bg-amber-100 text-amber-800",
  quote_requested: "bg-amber-100 text-amber-800",
  ordered: "bg-amber-100 text-amber-800",
  completed: "bg-emerald-100 text-emerald-800",
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
