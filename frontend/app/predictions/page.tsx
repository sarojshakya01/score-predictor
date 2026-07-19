import { Suspense } from "react";

import { TournamentWinnerCelebration } from "@/components/celebrations/tournament-winner-celebration";
import { PredictionsDashboard } from "@/components/predictions/predictions-dashboard";
import { PageShell } from "@/components/ui/page-shell";

const PredictionsPage = () => {
  return (
    <PageShell>
      <TournamentWinnerCelebration duration={6000} />
      <Suspense>
        <PredictionsDashboard />
      </Suspense>
    </PageShell>
  );
};

export default PredictionsPage;
