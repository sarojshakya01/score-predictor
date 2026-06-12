"use client";

import { useEffect, useState } from "react";
import { MetricCard, type Metrics } from "@/components/ui/metric-card";
import { isAuthenticated, authenticatedApiFetch } from "@/lib/auth";
import type { HomeSummaryResponse } from "@/lib/home/types";

type PredictionsMetricCardProps = {
  defaultMetric: Metrics;
};

export const PredictionsMetricCard = ({ defaultMetric }: PredictionsMetricCardProps) => {
  const [metric, setMetric] = useState<Metrics>(defaultMetric);

  useEffect(() => {
    if (!isAuthenticated()) {
      return;
    }

    const fetchUserSummary = async () => {
      try {
        const response = await authenticatedApiFetch<HomeSummaryResponse>("/home/summary", {
          method: "GET",
        });
        setMetric({
          ...defaultMetric,
          label: "Your predictions",
          value: new Intl.NumberFormat("en").format(response.predictions_made),
        });
      } catch (e) {
        // Fallback to default metric if authenticated fetch fails
      }
    };

    void fetchUserSummary();
  }, [defaultMetric]);

  return <MetricCard metric={metric} />;
};
