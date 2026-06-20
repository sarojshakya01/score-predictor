"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { MatchResponse } from "@/lib/matches";
import type { PredictionResponse } from "@/lib/predictions";
import { listCurrentUserPredictions } from "@/lib/predictions";
import { isAuthenticated } from "@/lib/auth";
import { MatchCard } from "@/components/ui/match-card";

type UpcomingMatchesSectionProps = {
  matches: MatchResponse[];
};

export const UpcomingMatchesSection = ({ matches }: UpcomingMatchesSectionProps) => {
  const [predictions, setPredictions] = useState<PredictionResponse[]>([]);
  const [isPredictionsLoaded, setIsPredictionsLoaded] = useState(!isAuthenticated());

  useEffect(() => {
    if (!isAuthenticated()) {
      return;
    }

    listCurrentUserPredictions({ limit: 500 })
      .then((res) => setPredictions(res.items))
      .catch(() => {
        // silently fail — cards will just show Predict button
      })
      .finally(() => setIsPredictionsLoaded(true));
  }, []);

  const savedMatchIds = new Set(predictions.map((p) => p.match_id));
  const hasPredictions = predictions.length > 0;

  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
            Upcoming matches
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Select the fixtures and make your predictions.
          </p>
        </div>
        <Link
          href="/predictions"
          className="hidden text-sm font-semibold text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300 sm:inline"
        >
          All predictions
        </Link>
      </div>
      {matches.length > 0 ? (
        <div
          className={[
            "flex gap-4 overflow-x-auto p-4 overflow-hidden cursor-pointer rounded-md",
            "border border-zinc-200 dark:border-zinc-700",
            "shadow-sm dark:shadow-zinc-950",
            "bg-white dark:bg-zinc-900",
          ].join(" ")}
        >
          {matches.map((match) => {
            const isSaved = isPredictionsLoaded && savedMatchIds.has(match.id);
            return (
              <MatchCard
                key={match.id}
                match={match}
                isSaved={isSaved}
                isPredictionAvailable={hasPredictions}
                isCorrectWinner={null}
                className="h-60 shrink-0 w-[360px]"
              />
            );
          })}
        </div>
      ) : (
        <div className="rounded-md border border-zinc-200 bg-white px-5 py-10 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            No upcoming matches
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            Fixtures will appear here as soon as the matches are scheduled.
          </p>
        </div>
      )}
    </section>
  );
};
