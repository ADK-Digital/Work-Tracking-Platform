const statusStyles: Record<string, string> = {
  New: "bg-sky-100 text-sky-700",
  "Waiting on Info": "bg-amber-100 text-amber-800",
  Submitted: "bg-indigo-100 text-indigo-700",
  Approved: "bg-emerald-100 text-emerald-700",
  Ordered: "bg-violet-100 text-violet-700",
  "Received/Closed": "bg-slate-200 text-slate-700",
  "Rejected/Cancelled": "bg-rose-100 text-rose-700",
  Backlog: "bg-slate-100 text-slate-700",
  "In Progress": "bg-indigo-100 text-indigo-700",
  Blocked: "bg-red-100 text-red-700",
  Done: "bg-emerald-100 text-emerald-700",
  Cancelled: "bg-slate-200 text-slate-700"
};

export const Badge = ({ status }: { status: string }) => (
  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusStyles[status] ?? "bg-slate-100 text-slate-700"}`}>
    {status}
  </span>
);
