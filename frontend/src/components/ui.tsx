import type { ReactNode, SelectHTMLAttributes } from "react";

type CardProps = { children: ReactNode };

export function Card({ children }: CardProps) {
  return <div className="rounded-2xl bg-slate-950/80 backdrop-blur shadow-lg ring-1 ring-slate-800/70">{children}</div>;
}

type CardBodyProps = { children: ReactNode; className?: string };

export function CardBody({ children, className = "" }: CardBodyProps) {
  return <div className={`p-4 ${className}`}>{children}</div>;
}

type LabelProps = { children: ReactNode };

export function Label({ children }: LabelProps) {
  return <label className="block text-sm font-medium text-slate-300">{children}</label>;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full rounded-lg border border-slate-700/80 bg-slate-900 px-3 py-2 text-sm text-slate-100 shadow-inner outline-none focus:ring-2 focus:ring-indigo-500/70"
    />
  );
}

type StatProps = { label: string; value: string };

export function Stat({ label, value }: StatProps) {
  return (
    <div className="rounded-xl bg-slate-950 px-4 py-3 ring-1 ring-slate-800 shadow-sm shadow-black/30">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-100 tabular-nums">{value}</div>
    </div>
  );
}
