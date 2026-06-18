"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { IconLeaderboard, IconTrophy } from "@/components/ui/icons";
import { ApiError } from "@/lib/api";
import {
  isAuthenticated,
  MissingAuthTokenError,
  SessionExpiredError,
} from "@/lib/auth";
import { listLeaderboard, type LeaderboardEntryResponse } from "@/lib/leaderboard";

const getErrorMessage = (error: unknown): string => {
  if (
    error instanceof MissingAuthTokenError ||
    error instanceof SessionExpiredError ||
    (error instanceof ApiError && error.status === 401)
  ) {
    return "Log in to see the live standings.";
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Unable to load leaderboard.";
};

const rankTone = (rank: number): string => {
  if (rank === 1) return "bg-amber-100 text-amber-800 ring-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-700";
  if (rank === 2) return "bg-slate-100 text-slate-700 ring-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-600";
  if (rank === 3) return "bg-orange-100/50 text-orange-800 ring-orange-300 dark:bg-orange-950/50 dark:text-orange-200 dark:ring-orange-700/50";
  return "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-800";
};

export const TopLeaderboardPreview = () => {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [players, setPlayers] = useState<LeaderboardEntryResponse[]>([]);

  useEffect(() => {
    let isMounted = true;

    const loadTopPlayers = async () => {
      if (!isAuthenticated()) {
        if (isMounted) {
          setError("Log in to see the live standings.");
          setIsLoading(false);
        }
        return;
      }

      try {
        const response = await listLeaderboard({ limit: 5 });
        if (!isMounted) return;
        setPlayers(response.items.slice(0, 5));
        setError(null);
      } catch (loadError) {
        if (!isMounted) return;
        setError(getErrorMessage(loadError));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadTopPlayers();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-4 py-4 dark:border-zinc-700">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-800">
            <IconLeaderboard className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              Top Players
            </h2>
            <p className="hidden md:block mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Top five players by total points.
            </p>
          </div>
        </div>
        <Link
          href="/leaderboard"
          className="shrink-0 rounded-md border border-zinc-200 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-zinc-700 dark:text-emerald-300 dark:hover:border-emerald-800 dark:hover:bg-emerald-950"
        >
          See full leaderboard
        </Link>
      </div>

      <div className="p-4">
        {isLoading ? (
          <div className="grid gap-3">
            {[1, 2, 3, 4, 5].map((item) => (
              <div
                key={item}
                className="h-14 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800"
              />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-6 text-center dark:border-zinc-700 dark:bg-zinc-800">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
              {error}
            </p>
            <Link
              href="/login"
              className="mt-3 inline-flex h-9 items-center justify-center rounded-md bg-tournament-primary px-3 text-sm font-semibold text-white transition hover:bg-tournament-primary"
            >
              Login
            </Link>
          </div>
        ) : players.length > 0 ? (
          <ol className="grid gap-2">
            {players.map((player) => (
              <li
                key={player.user_id}
                className="flex items-center gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-3 dark:border-zinc-700 dark:bg-zinc-800"
              >
                <span
                  className={[
                    "grid h-9 w-9 shrink-0 place-items-center rounded-md text-sm font-bold ring-1",
                    rankTone(player.rank),
                  ].join(" ")}
                >
                  {player.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    {player.rank === 1 ? (
                      <IconTrophy className="h-4 w-4 shrink-0 text-yellow-600 dark:text-yellow-300" />
                    ) : null}
                    <p className="truncate text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                      {player.name}
                    </p>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    prediction from {player.predicted_matches} matches
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                    {player.total_points}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">pts</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-8 text-center dark:border-zinc-700 dark:bg-zinc-800">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
              No ranked players yet.
            </p>
          </div>
        )}
      </div>
    </section>
  );
};
