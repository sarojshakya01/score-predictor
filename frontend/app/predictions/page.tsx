import { PredictionsDashboard } from "@/components/predictions/predictions-dashboard";
import { PageShell } from "@/components/ui/page-shell";

export default function PredictionsPage() {
  return (
    <PageShell
      eyebrow="Predictions"
      subtitle="Submit scores, cards, opening team, and game duration before the lock window closes."
      title="Prediction Board"
    >
      <PredictionsDashboard />
    </PageShell>
  );
}
