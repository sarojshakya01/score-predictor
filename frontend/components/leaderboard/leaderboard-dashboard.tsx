"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { MetricCard } from "@/components/ui/metric-card";
import { StatusPill } from "@/components/ui/status-pill";
import { ApiError } from "@/lib/api";
import { isAuthenticated, MissingAuthTokenError } from "@/lib/auth";
import { listLeaderboard } from "@/lib/leaderboard";
import type {
  LeaderboardEntryResponse,
  LeaderboardRaceFrameResponse,
  LeaderboardRaceUserResponse,
  LeaderboardResponse,
} from "@/lib/leaderboard";
import type { Metric } from "@/lib/view-data";

function getLoadErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof MissingAuthTokenError) {
    return "Please sign in before viewing the leaderboard.";
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Unable to load leaderboard.";
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en").format(value);
}

function formatSignedNumber(value: number): string {
  if (value > 0) {
    return `+${value}`;
  }

  return String(value);
}

function getPointsTone(points: number): "green" | "red" | "zinc" {
  if (points > 0) {
    return "green";
  }

  if (points < 0) {
    return "red";
  }

  return "zinc";
}

function buildMetrics(leaderboard: LeaderboardResponse): Metric[] {
  const topScore = leaderboard.items[0]?.total_points ?? 0;

  return [
    {
      label: "Ranked users",
      value: formatNumber(leaderboard.total),
      tone: "blue",
    },
    {
      label: "Completed matches",
      value: formatNumber(leaderboard.completed_matches),
      tone: "green",
    },
    {
      label: "Scored predictions",
      value: formatNumber(leaderboard.scored_predictions),
      tone: "amber",
    },
    {
      label: "Top score",
      value: formatNumber(topScore),
      tone: topScore < 0 ? "red" : "green",
    },
  ];
}

function getFrameMaxPoints(frame: LeaderboardRaceFrameResponse): number {
  return Math.max(
    1,
    ...frame.standings.map((standing) => Math.abs(standing.total_points)),
  );
}

function LeaderboardRow({ row }: { row: LeaderboardEntryResponse }) {
  return (
    <tr>
      <td className="px-5 py-4 font-semibold text-zinc-950">#{row.rank}</td>
      <td className="px-5 py-4 font-medium text-zinc-950">{row.name}</td>
      <td className="px-5 py-4 text-zinc-700">{row.exact_scores}</td>
      <td className="px-5 py-4 text-zinc-700">{row.correct_results}</td>
      <td className="px-5 py-4 text-zinc-700">
        {row.scored_predictions} / {row.predictions_made}
      </td>
      <td className="px-5 py-4">
        <StatusPill tone={getPointsTone(row.card_points)}>
          {formatSignedNumber(row.card_points)}
        </StatusPill>
      </td>
      <td className="px-5 py-4 text-right font-semibold text-zinc-950">
        {row.total_points}
      </td>
    </tr>
  );
}

function RaceChartRow({
  maxPoints,
  standing,
}: {
  maxPoints: number;
  standing: LeaderboardRaceUserResponse;
}) {
  const barWidth =
    standing.total_points === 0
      ? 2
      : Math.max(8, (Math.abs(standing.total_points) / maxPoints) * 100);
  const barColor =
    standing.total_points < 0
      ? "bg-rose-600"
      : standing.match_points > 0
        ? "bg-emerald-700"
        : "bg-zinc-500";

  return (
    <div className="grid min-w-[42rem] grid-cols-[4rem_13rem_1fr_5rem_5rem] items-center gap-3 px-4 py-3 text-sm">
      <div className="font-semibold text-zinc-950">#{standing.rank}</div>
      <div className="truncate font-medium text-zinc-950">{standing.name}</div>
      <div className="h-9 overflow-hidden rounded-md bg-zinc-100">
        <div
          className={`flex h-full items-center justify-end rounded-md px-3 text-xs font-semibold text-white transition-[width] duration-700 ease-out ${barColor}`}
          style={{ width: `${barWidth}%` }}
        >
          {standing.total_points}
        </div>
      </div>
      <div className="text-right">
        <StatusPill tone={getPointsTone(standing.match_points)}>
          {formatSignedNumber(standing.match_points)}
        </StatusPill>
      </div>
      <div className="text-right font-semibold text-zinc-950">
        {standing.total_points}
      </div>
    </div>
  );
}

function RaceChart({ frames }: { frames: LeaderboardRaceFrameResponse[] }) {
  const safeFrames = frames.length > 0 ? frames : [];
  const [frameIndex, setFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(safeFrames.length > 1);

  useEffect(() => {
    if (!isPlaying || safeFrames.length <= 1) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setFrameIndex((currentFrameIndex) =>
        currentFrameIndex >= safeFrames.length - 1 ? 0 : currentFrameIndex + 1,
      );
    }, 1600);

    return () => window.clearInterval(intervalId);
  }, [isPlaying, safeFrames.length]);

  const frame = safeFrames[frameIndex] ?? null;
  const maxPoints = frame ? getFrameMaxPoints(frame) : 1;

  if (!frame) {
    return null;
  }

  return (
    <section className="overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-zinc-200 px-5 py-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">Points race</h2>
          <p className="mt-1 text-sm text-zinc-500">{frame.label}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setIsPlaying((currentValue) => !currentValue)}
            disabled={safeFrames.length <= 1}
            className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-400"
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
          <input
            aria-label="Race chart frame"
            className="w-40 accent-emerald-700"
            disabled={safeFrames.length <= 1}
            max={Math.max(safeFrames.length - 1, 0)}
            min={0}
            type="range"
            value={frameIndex}
            onChange={(event) => {
              setFrameIndex(Number(event.target.value));
              setIsPlaying(false);
            }}
          />
          <span className="text-sm font-medium text-zinc-600">
            {frameIndex + 1} / {safeFrames.length}
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[42rem] border-b border-zinc-100 bg-zinc-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
          <div className="grid grid-cols-[4rem_13rem_1fr_5rem_5rem] gap-3">
            <span>Rank</span>
            <span>User</span>
            <span>Total</span>
            <span className="text-right">Game</span>
            <span className="text-right">Pts</span>
          </div>
        </div>
        <div className="max-h-[30rem] divide-y divide-zinc-100 overflow-y-auto">
          {frame.standings.map((standing) => (
            <RaceChartRow
              key={standing.user_id}
              maxPoints={maxPoints}
              standing={standing}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export function LeaderboardDashboard() {
  const [authRequired, setAuthRequired] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(
    null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadLeaderboard() {
      setIsLoading(true);
      setLoadError(null);

      if (!isAuthenticated()) {
        if (isMounted) {
          setAuthRequired(true);
          setLeaderboard(null);
          setIsLoading(false);
        }
        return;
      }

      try {
        const leaderboardResponse = await listLeaderboard({ limit: 100 });

        if (!isMounted) {
          return;
        }

        setAuthRequired(false);
        setLeaderboard(leaderboardResponse);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (
          error instanceof MissingAuthTokenError ||
          (error instanceof ApiError && error.status === 401)
        ) {
          setAuthRequired(true);
          setLeaderboard(null);
        } else {
          setLoadError(getLoadErrorMessage(error));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadLeaderboard();

    return () => {
      isMounted = false;
    };
  }, []);

  const rows = leaderboard?.items ?? [];
  const metrics = useMemo(
    () => (leaderboard ? buildMetrics(leaderboard) : []),
    [leaderboard],
  );

  if (isLoading) {
    return (
      <>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-28 rounded-md border border-zinc-200 bg-white shadow-sm"
            />
          ))}
        </section>
        <section className="h-96 rounded-md border border-zinc-200 bg-white shadow-sm" />
      </>
    );
  }

  if (authRequired) {
    return (
      <section className="flex flex-col gap-4 rounded-md border border-amber-200 bg-amber-50 px-5 py-5 text-amber-900 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Login required</h2>
          <p className="mt-1 text-sm">
            Sign in to view tournament rankings and the points race.
          </p>
        </div>
        <Link
          href="/login"
          className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800"
        >
          Login
        </Link>
      </section>
    );
  }

  return (
    <>
      {loadError ? (
        <section
          className="rounded-md border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700"
          role="alert"
        >
          {loadError}
        </section>
      ) : null}

      {metrics.length > 0 ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <MetricCard key={metric.label} metric={metric} />
          ))}
        </section>
      ) : null}

      {leaderboard ? <RaceChart frames={leaderboard.race_frames} /> : null}

      {rows.length > 0 ? (
        <section className="overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-zinc-950">Top users</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Showing {rows.length} of {leaderboard?.total ?? 0} ranked users
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                <tr>
                  <th className="px-5 py-3">Rank</th>
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">Exact scores</th>
                  <th className="px-5 py-3">Results</th>
                  <th className="px-5 py-3">Scored</th>
                  <th className="px-5 py-3">Cards</th>
                  <th className="px-5 py-3 text-right">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((row) => (
                  <LeaderboardRow key={row.user_id} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="rounded-md border border-zinc-200 bg-white px-5 py-10 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-950">
            No ranked users yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
            Rankings will appear after users and predictions are available from the API.
          </p>
        </section>
      )}
    </>
  );
}
