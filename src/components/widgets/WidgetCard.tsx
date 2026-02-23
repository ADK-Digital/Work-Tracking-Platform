import type { ReactNode } from "react";

interface WidgetCardProps {
  title: string;
  subtitle: string;
  controls?: ReactNode;
  children: ReactNode;
}

export const WidgetCard = ({ title, subtitle, controls, children }: WidgetCardProps) => (
  <section className="rounded-xl border border-slate-200 bg-white shadow-soft">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
      {controls}
    </div>
    <div className="p-4 sm:p-5">{children}</div>
  </section>
);
