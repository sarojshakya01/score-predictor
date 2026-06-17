import Link from "next/link";

import { FinalsWinnerSelector } from "@/components/home/finals-winner-selector";
import { MatchResultsList } from "@/components/home/match-results-list";
import { MetricCard, Metrics } from "@/components/ui/metric-card";
import { PageShell } from "@/components/ui/page-shell";
import { StatusPill, toneClasses, toneClassesLight } from "@/components/ui/status-pill";
import { ApiError } from "@/lib/api";
import { getHomeSummary } from "@/lib/home";
import type { HomeSummaryResponse } from "@/lib/home";
import { listMatchResults, listUpcomingMatches } from "@/lib/matches";
import type { MatchResponse } from "@/lib/matches";
import { formatDateTime } from "@/components/ui/match-card";
import { PredictionsMetricCard } from "@/components/home/predictions-metric-card";
import { TopLeaderboardPreview } from "@/components/home/top-leaderboard-preview";
import { UpcomingMatchesSection } from "@/components/home/upcoming-matches-section";
import { DEFAULT_TIMEZONE } from "@/lib/api/config";

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

const getTimezoneOffsetString = (timeZone: string, date = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset'
  });

  // Example output of parts: [{type: "timeZoneName", value: "GMT-4"}]
  const parts = formatter.formatToParts(date);
  const tzPart = parts.find(part => part.type === 'timeZoneName');

  return tzPart ? tzPart.value : 'GMT';
}

const loadHomePageData = async (): Promise<HomePageData> => {
  const [summaryResult, matchesResult, resultsResult] =
    await Promise.allSettled([
      getHomeSummary(),
      listUpcomingMatches({ includeLocked: false, limit: 20 }),
      listMatchResults({ limit: 20 }),
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
      tone: toneClassesLight.primary,
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

const LiveWindowPanel = ({
  nextLock,
  summary,
}: {
  nextLock: HomeSummaryResponse["next_lock"];
  summary: HomeSummaryResponse | null;
}) => {
  return (
    <section className="countdown-container relative min-h-[280px] overflow-hidden rounded-md border border-emerald-900/20 p-5 text-white shadow-sm">
      <div className="relative z-10 flex h-full flex-col justify-between gap-8">
        <div className="flex items-center justify-between gap-3">
          <StatusPill tone={nextLock ? "secondary" : "accent"}>
            {nextLock ? "Live window" : "No open locks"}
          </StatusPill>
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
            {summary ? `${summary.open_matches} open` : "Live API"}
          </span>
        </div>
        <div className="text-gray-900/70">
          <p className="text-sm font-medium">
            Next match locks in
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-normal">
            {nextLock ? formatMinutes(nextLock.minutes_until_lock) : "N/A"}
          </p>
          <p className="mt-3 text-md leading-6 text-emerald-50/90 truncate">
            {nextLock
              ? `${nextLock.label} locks at ${formatDateTime(nextLock.lock_datetime, false)}.`
              : "Predictions will reopen when new unlocked fixtures are available."}
          </p>
        </div>
      </div>
    </section>
  );
};

const Home = async () => {
  const { errors, matches, results, summary } = await loadHomePageData();
  const dashboardMetrics = buildDashboardMetrics(summary);
  const nextLock = summary?.next_lock ?? null;
  const nextFirstMatch = matches[0];
  const predictionStartDate = nextFirstMatch ? new Date(`${nextFirstMatch.match_datetime}Z`) : new Date();
  predictionStartDate.setDate(predictionStartDate.getDate() - 3);
  predictionStartDate.setHours(predictionStartDate.getHours() - 6);

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
    >
      {errors.length > 0 ? (
        <section
          className="rounded-md border border-amber-200 dark:bg-amber-50 px-5 py-4 text-sm dark:text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300"
          role="alert"
        >
          {errors.join(" ")}
        </section>
      ) : null}

      {/* Announcements */}
      {(new Date() < predictionStartDate) && <section
        className="rounded-md border border-yellow-700 dark:bg-yellow-950 px-5 py-4 text-sm dark:text-amber-500 dark:border-amber-700 bg-yellow-100 dark:bg-amber-950 dark:text-amber-300"
        role="alert"
      >
        {`Announcement: This site is under testing. Prediction will be available after ${formatDateTime(predictionStartDate.toString(), false)}. Please try using and report the bugs to the Admin. Thank you.`}
      </section>}

      {nextFirstMatch && nextFirstMatch.match_day <= 5 && <section
        className="rounded-md border border-yellow-700 dark:bg-yellow-950 px-5 py-4 text-sm dark:text-amber-500 dark:border-amber-700 bg-yellow-100 dark:bg-amber-950 dark:text-amber-300"
        role="alert"
      >
        <li className="list-decimal">Everyday at 10AM {`(${getTimezoneOffsetString(DEFAULT_TIMEZONE)})`}, you will receive an email listing the scheduled matches in next 24 hours in your registered email</li>
        <li className="list-decimal">You will get prediction reminder notification for every match 3 hours before the match starts.</li>
        <li className="list-decimal">Prediction for a match will be locked 1 hour before the match kicks-off.</li>
        <li className="list-decimal">Prediction for the final matches (Winner, Runner-up and third place) will be available for 7 days from the date of the tournament start.</li>
      </section>}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)] lg:items-stretch">
        <TopLeaderboardPreview />
        <LiveWindowPanel nextLock={nextLock} summary={summary} />
      </section>

      <UpcomingMatchesSection matches={matches} />

      <section className="lg:grid-cols-[1.4fr_0.8fr]">
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
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
                Predict Winners
              </h2>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Predict your World Cup 2026 winner, runner-up and third place.
            </p>
          </div>
        </div>

        <FinalsWinnerSelector />
      </section>

      {/* <section className="grid gap-6">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {dashboardMetrics.map((metric) => {
            if (metric.label === "Predictions made") {
              return <PredictionsMetricCard key={metric.label} defaultMetric={metric} />;
            }
            return <MetricCard key={metric.label} metric={metric} />;
          })}
        </div>
      </section> */}
    </PageShell>
  );
};

export default Home;
