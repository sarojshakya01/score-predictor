import { ResultsDashboard } from "@/components/results/results-dashboard";
import { PageShell } from "@/components/ui/page-shell";

const ResultsPage = () => {
  return (
    <PageShell
      eyebrow="Results"
      subtitle="Completed matches and per-match prediction points."
      title="Match Results"
    >
      <ResultsDashboard />
    </PageShell>
  );
};

export default ResultsPage;
