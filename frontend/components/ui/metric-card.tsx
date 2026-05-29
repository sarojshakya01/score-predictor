import type { Metric } from "@/lib/view-data";

type MetricCardProps = {
  metric: Metric;
};

export const toneClasses: Record<Metric["tone"], string> = {
  amber: "border-amber-200 bg-amber-50 text-amber-900",
  blue: "border-sky-200 bg-sky-50 text-sky-900",
  green: "border-emerald-200 bg-emerald-50 text-emerald-900",
  red: "border-rose-200 bg-rose-50 text-rose-900",
};

export function MetricCard({ metric }: MetricCardProps) {
  return (
    <div className={`rounded-md border p-4 ${toneClasses[metric.tone]}`}>
      <p className="text-sm font-medium">{metric.label}</p>
      <p className="mt-2 text-lg text-zinc-500">{metric.value}</p>
    </div>
  );
}
