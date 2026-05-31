export type Metrics = {
  label: string;
  value: string;
  tone: string;
}
type MetricCardProps = {
  metric: Metrics;
};

export const MetricCard = ({ metric }: MetricCardProps) => {
  return (
    <div className={`rounded-md border p-4 ${metric.tone}`}>
      <p className="text-sm font-medium">{metric.label}</p>
      <p className="mt-2 text-lg">{metric.value}</p>
    </div>
  );
};
