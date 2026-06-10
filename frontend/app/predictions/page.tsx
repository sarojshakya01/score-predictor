import { Suspense } from "react";

import { PredictionsDashboard } from "@/components/predictions/predictions-dashboard";
import { PageShell } from "@/components/ui/page-shell";

const PredictionsPage = () => {
  return (
    <PageShell
      eyebrow="Predictions"
      subtitle="Submit scores, cards, kickoff team, and match duration before the lock window closes."
      title="Prediction Board"
    >
      <Suspense>
        <PredictionsDashboard />
      </Suspense>
    </PageShell>
  );
};

export default PredictionsPage;
