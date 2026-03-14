interface StatsCardProps {
  label: string;
  value: string | number;
  hint: string;
}

export function StatsCard({ label, value, hint }: StatsCardProps) {
  return (
    <article className="rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-[0_20px_50px_rgba(15,23,42,0.05)]">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-400">
        {label}
      </p>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
        {value}
      </p>
      <p className="mt-3 text-sm text-slate-500">{hint}</p>
    </article>
  );
}
