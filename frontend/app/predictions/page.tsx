import { Suspense } from "react";

import { PredictionsDashboard } from "@/components/predictions/predictions-dashboard";
import { PageShell } from "@/components/ui/page-shell";

const PredictionsPage = () => {
  return (
    <PageShell>
      <Suspense>
        <PredictionsDashboard />
      </Suspense>
    </PageShell>
  );
};

export default PredictionsPage;
