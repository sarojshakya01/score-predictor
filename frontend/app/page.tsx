import Link from "next/link";

import { FinalsWinnerSelector } from "@/components/home/finals-winner-selector";
import { MatchResultsList } from "@/components/home/match-results-list";
import { MetricCard, Metrics } from "@/components/ui/metric-card";
import { PageShell } from "@/components/ui/page-shell";
import { StatusPill, toneClasses } from "@/components/ui/status-pill";
import { ApiError } from "@/lib/api";
import { getHomeSummary } from "@/lib/home";
import type { HomeSummaryResponse } from "@/lib/home";
import { listMatchResults, listUpcomingMatches } from "@/lib/matches";
import type { MatchResponse } from "@/lib/matches";
import { MatchCard } from "@/components/ui/match-card";

type HomePageData = {
  errors: string[];
  matches: MatchResponse[];
  results: MatchResponse[];
  summary: HomeSummaryResponse | null;
};

const getLoadErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
};

const loadHomePageData = async (): Promise<HomePageData> => {
  const [summaryResult, matchesResult, resultsResult] =
    await Promise.allSettled([
      getHomeSummary(),
      listUpcomingMatches({ includeLocked: false, limit: 10 }),
      listMatchResults({ limit: 10 }),
    ]);
  const errors: string[] = [];
  let summary: HomeSummaryResponse | null = null;
  let matches: MatchResponse[] = [];
  let results: MatchResponse[] = [];

  if (summaryResult.status === "fulfilled") {
    summary = summaryResult.value;
  } else {
    errors.push(
      getLoadErrorMessage(
        summaryResult.reason,
        "Unable to load tournament summary.",
      ),
    );
  }

  if (matchesResult.status === "fulfilled") {
    matches = matchesResult.value.items;
  } else {
    errors.push(
      getLoadErrorMessage(
        matchesResult.reason,
        "Unable to load upcoming matches.",
      ),
    );
  }

  if (resultsResult.status === "fulfilled") {
    results = resultsResult.value.items;
  } else {
    errors.push(
      getLoadErrorMessage(
        resultsResult.reason,
        "Unable to load match results.",
      ),
    );
  }

  return { errors, matches, results, summary };
};

const formatNumber = (value: number | undefined): string => {
  if (value === undefined) {
    return "N/A";
  }

  return new Intl.NumberFormat("en").format(value);
};

const buildDashboardMetrics = (summary: HomeSummaryResponse | null): Metrics[] => {
  return [
    {
      label: "Open matches",
      tone: toneClasses.zinc,
      value: formatNumber(summary?.open_matches),
    },
    {
      label: "Predictions made",
      tone: toneClasses.primary,
      value: formatNumber(summary?.predictions_made),
    },
    {
      label: "Locking soon",
      tone: toneClasses.accent,
      value: formatNumber(summary?.locking_soon),
    },
    {
      label: "Completed matches",
      tone: toneClasses.secondary,
      value: formatNumber(summary?.completed_matches),
    },
  ];
};

const formatMinutes = (value: number): string => {
  if (value <= 0) {
    return "Now";
  }

  const days = Math.floor(value / (24 * 60));
  const hours = Math.floor((value % (24 * 60)) / 60);
  const minutes = value % 60;

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h ${minutes}m` : `${days}d ${minutes}m`;
  }

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  return `${minutes}m`;
};

const Home = async () => {
  const { errors, matches, results, summary } = await loadHomePageData();
  const dashboardMetrics = buildDashboardMetrics(summary);
  const nextLock = summary?.next_lock ?? null;

  return (
    <PageShell
      actions={
        <div className="flex flex-wrap gap-2">
          <Link
            href="/predictions"
            className="inline-flex h-10 items-center rounded-md bg-tournament-primary px-4 text-sm font-semibold text-white transition hover:bg-tournament-primary"
          >
            Make prediction
          </Link>
          <Link
            href="/leaderboard"
            className="inline-flex h-10 items-center rounded-md border border-zinc-200 px-4 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-700"
          >
            View ranks
          </Link>
        </div>
      }
      eyebrow="Match center"
      subtitle="Upcoming fixtures, prediction windows, standings signals, and quick access to tournament areas."
      title="Football Match Tournament Predictor"
    >
      {errors.length > 0 ? (
        <section
          className="rounded-md border border-amber-200 dark:bg-amber-50 px-5 py-4 text-sm dark:text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300"
          role="alert"
        >
          {errors.join(" ")}
        </section>
      ) : null}

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
                Predict Winners
              </h2>
            </div>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Predict your World Cup 2026 winner, runner-up and third place.
            </p>
          </div>
        </div>

        <FinalsWinnerSelector />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {dashboardMetrics.map((metric) => (
            <MetricCard key={metric.label} metric={metric} />
          ))}
        </div>

        <div className="countdown-container relative min-h-64 overflow-hidden rounded-md border border-emerald-900/20 p-5 text-white shadow-sm">
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div className="flex items-center justify-between">
              <StatusPill tone={nextLock ? "secondary" : "accent"}>
                {nextLock ? "Live window" : "No open locks"}
              </StatusPill>
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
                {summary ? `${summary.open_matches} open` : "Live API"}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-50">
                Next match locks in
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-normal">
                {nextLock ? formatMinutes(nextLock.minutes_until_lock) : "N/A"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
              Match results
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              See the latest match results.
            </p>
          </div>
        </div>

        <MatchResultsList matches={results} />
      </section>

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
          <div className="flex gap-4 overflow-x-auto pb-2">
            {matches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                className="w-[280px] shrink-0 sm:w-80 lg:w-[360px]"
              />
            ))}
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
    </PageShell>
  );
};

export default Home;
