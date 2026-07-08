"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";

import { Modal } from "@/components/ui/modal";
import { SearchInput } from "@/components/ui/search-input";
import { IconChevronDown, IconLock, IconTrophy } from "@/components/ui/icons";
import { ApiError } from "@/lib/api";
import { getCurrentUser, isAuthenticated, MissingAuthTokenError, SessionExpiredError } from "@/lib/auth";
import { getUserPredictionDetails, listFinalistPredictions, listLeaderboard } from "@/lib/leaderboard";
import type {
  FinalistPredictionEntryResponse,
  FinalistPredictionsResponse,
  FinalistPredictionTeamResponse,
  LeaderboardEntryResponse,
  LeaderboardResponse,
  UserPointsDetailsListResponse,
  UserPointsDetailsResponse,
} from "@/lib/leaderboard";
import { firstGoalInLabels, getCurrentMatchDay, MatchDuration, matchDurationLabels } from "@/lib/matches";
import { FirstGoalIn } from "@/lib/matches/types";
import { getFinalistPredictionDeadline } from "@/lib/settings";
import RaceChart from "./race-chart";
import { UserResponse } from "@/lib/users";

const DEFAULT_FINALIST_PREDICTION_DEADLINE = 7;

export type LeaderboardRow = {
  name: string;
  points: number;
  rank: number;
  trend: string;
  exactScores: number;
};

const getLoadErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof MissingAuthTokenError) {
    return "Please log in before viewing the leaderboard.";
  }

  if (error instanceof SessionExpiredError) {
    return "Your session has expired. Please login again.";
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Unable to load leaderboard.";
};

const formatSignedNumber = (value: number): string => {
  return String(value);
};


// ── Helpers for the detail table ─────────────────────────────────────────────
const fmtDuration = (v: string | null): string =>
  v ? (matchDurationLabels[v as MatchDuration] ?? v) : "—";

const fmtFirstGoalIn = (v: string | null): string => {
  if (v === null) return "—";
  return v ? (firstGoalInLabels[v as FirstGoalIn] ?? v) : "—";
};

const fmtGoalDiff = (v1: number | null, v2: number | null): string => {
  if (v1 === null || v2 === null) return "—";
  const diff = v1 - v2;
  return diff > 0 ? `+${diff}` : String(diff);
};

const fmtVal = (v: string | number | null | undefined): string =>
  v === null || v === undefined ? "—" : String(v);

// ── Cell helpers ──────────────────────────────────────────────────────────────

const ActualCell = ({ children }: { children: React.ReactNode }) => (
  <td className="whitespace-nowrap px-3 py-2.5 text-center text-sm text-zinc-700 dark:text-zinc-300">
    {children}
  </td>
);

const PredCell = ({ children }: { children: React.ReactNode }) => (
  <td className="whitespace-nowrap px-3 py-2.5 text-center text-sm font-medium text-indigo-700 dark:text-indigo-400">
    {children}
  </td>
);

const PtsCell = ({ points, isLastRow = false }: { points: number, isLastRow?: boolean }) => {
  const color =
    points > 0
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:ring-emerald-800"
      : points < 0
        ? "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950 dark:text-rose-400 dark:ring-rose-800"
        : "bg-zinc-100 text-zinc-500 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-600";
  return (
    <td className={`whitespace-nowrap px-3 py-2.5 text-center dark:border-zinc-700 ${isLastRow ? "" : "border-r border-zinc-200"}`}>
      <span
        className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 ${isLastRow ? "text-md" : "text-xs"} font-semibold ring-1 ring-inset ${color}`}
      >
        {formatSignedNumber(points)}
      </span>
    </td>
  );
};

const totalColor = (totalPoints: number) => {
  const totalColor =
    totalPoints > 0
      ? "bg-emerald-600 text-white"
      : totalPoints < 0
        ? "bg-rose-600 text-white"
        : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300";
  return totalColor;
}
// ── Score row ─────────────────────────────────────────────────────────────────

const ScoreRow = ({
  index,
  item,
}: {
  index: number;
  item: UserPointsDetailsResponse;
}) => {

  return (
    <tr className="group border-b border-zinc-100 dark:border-zinc-800 transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-800/50">
      {/* S.N. */}
      <td className={[
        "static sm:sticky left-0 z-20 w-[30px] min-w-[30px] max-w-[30px]",
        "bg-white dark:bg-zinc-950",
        "border-b border-zinc-200 dark:border-zinc-800",
        "whitespace-nowrap px-3 md:px-5 py-2.5 text-left text-xs font-medium text-zinc-400 dark:text-zinc-500"
      ].join(" ")}>
        {index + 1}
      </td>

      {/* Match */}
      <td className={[
        "static sm:sticky left-[30px] z-20 w-[110px] min-w-[110px] max-w-[110px] md:left-[40px] md:w-[285px] md:min-w-[285px] md:max-w-[285px]",
        "bg-white dark:bg-zinc-950",
        "border-b border-zinc-200 dark:border-zinc-800",
        "px-0 px-3 py-2.5 text-center"
      ].join(" ")}>
        <span className={"md:hidden text-sm font-semibold text-zinc-900 dark:text-zinc-100"}>
          {item.team1_name_short} <span className="text-zinc-400 dark:text-zinc-500">vs</span> {item.team2_name_short}
        </span>
        <span className={"hidden md:block text-sm font-semibold text-zinc-900 dark:text-zinc-100"}>
          {item.team1_name} <span className="text-zinc-400 dark:text-zinc-500">vs</span> {item.team2_name}
        </span>
      </td>

      {/* Total */}
      <td className={[
        "static sm:sticky left-[140px] md:left-[325px] z-20 w-[80px] min-w-[80px] max-w-[80px]",
        "bg-white dark:bg-zinc-950",
        "border-b border-zinc-200 dark:border-zinc-800",
        "whitespace-nowrap px-3 py-2.5 text-center"
      ].join(" ")}>
        <span
          className={`inline-flex h-8 w-12 items-center justify-center rounded-lg text-sm font-bold ${totalColor(item.total_points)}`}
        >
          {formatSignedNumber(item.total_points)}
        </span>
      </td>

      {/* Score */}
      <ActualCell>
        <span className="font-semibold text-zinc-700 dark:text-zinc-300">
          {item.team1_score !== null && item.team2_score !== null ? `${item.team1_score} - ${item.team2_score}` : "—"}
        </span>
      </ActualCell>
      <PredCell>
        {item.predicted_team1_score === null && item.predicted_team2_score === null ? "—" : `${item.predicted_team1_score} - ${item.predicted_team2_score}`}
      </PredCell>
      <PtsCell points={item.score_points} />

      {/* Goal diff */}
      <ActualCell>{fmtGoalDiff(item.team1_score, item.team2_score)}</ActualCell>
      <PredCell>
        {fmtGoalDiff(item.predicted_team1_score, item.predicted_team2_score)}
      </PredCell>
      <PtsCell points={item.goal_difference_points} />

      {/* First goal in */}
      <ActualCell>{fmtFirstGoalIn(item.first_goal_in)}</ActualCell>
      <PredCell>{fmtFirstGoalIn(item.predicted_first_goal_in)}</PredCell>
      <PtsCell points={item.first_goal_in_points} />

      {/* First scoring team */}
      <ActualCell>{fmtVal(item.first_scoring_team)}</ActualCell>
      <PredCell>{fmtVal(item.predicted_first_scoring_team)}</PredCell>
      <PtsCell points={item.first_scoring_team_points} />

      {/* Yellow cards */}
      <ActualCell>{fmtVal(item.yellow_card_count)}</ActualCell>
      <PredCell>{fmtVal(item.predicted_yellow_card_count)}</PredCell>
      <PtsCell points={item.yellow_card_points} />

      {/* Red cards */}
      <ActualCell>{fmtVal(item.red_card_count)}</ActualCell>
      <PredCell>{item.predicted_red_card_count > 0 ? fmtVal(item.predicted_red_card_count) : fmtVal(null)}</PredCell>
      <PtsCell points={item.red_card_points} />

      {/* Kick-off team */}
      <ActualCell>{fmtVal(item.kick_off_team)}</ActualCell>
      <PredCell>{fmtVal(item.predicted_kick_off_team)}</PredCell>
      <PtsCell points={item.kick_off_team_points} />

      {/* Duration */}
      <ActualCell>{fmtDuration(item.match_duration)}</ActualCell>
      <PredCell>{fmtDuration(item.predicted_match_duration)}</PredCell>
      <PtsCell points={item.match_duration_points} />
    </tr>
  );
};

// ── Group header columns ──────────────────────────────────────────────────────

const GROUP_COLS: { label: string; colSpan: number; color: string }[] = [
  { label: "Score", colSpan: 3, color: "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-400" },
  { label: "Goal Diff", colSpan: 3, color: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400" },
  { label: "First Goal in", colSpan: 3, color: "bg-lime-50 text-lime-700 dark:bg-lime-950/50 dark:text-lime-400" },
  { label: "First Score by", colSpan: 3, color: "bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400" },
  { label: "Yellow Card", colSpan: 3, color: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400" },
  { label: "Red Card", colSpan: 3, color: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400" },
  { label: "Kick-off", colSpan: 3, color: "bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-400" },
  { label: "Duration", colSpan: 3, color: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400" },
];

// ── Modal ─────────────────────────────────────────────────────────────────────

const UserPointsDetailModal = ({
  userId,
  userName,
  isOpen,
  onClose,
}: {
  userId: number | null;
  userName: string;
  isOpen: boolean;
  onClose: () => void;
}) => {
  const [data, setData] = useState<UserPointsDetailsListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [areFinalRowsExpanded, setAreFinalRowsExpanded] = useState(false);

  useEffect(() => {
    if (!isOpen || userId === null) {
      return;
    }

    let isMounted = true;

    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setData(null);
        setAreFinalRowsExpanded(false);
        const result = await getUserPredictionDetails(userId);
        if (isMounted) {
          setData(result);
        }
      } catch (err) {
        if (isMounted) {
          setError(getLoadErrorMessage(err));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [isOpen, userId]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Points Breakdown — ${userName}`} isLarge isSticky={true}>
      {/* Loading skeleton */}
      {isLoading && (
        <div className="flex flex-col gap-3 py-2">
          <div className="h-16 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Data */}
      {data && !isLoading && (
        <>
          {/* Summary cards */}
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Total Match Predictions", value: data.items.filter((i) => i.predicted_team1_score !== null && i.predicted_team1_score !== null).length, color: "text-zinc-900" },
              {
                label: "Total Points",
                value: formatSignedNumber(data.total_points),
                color:
                  data.total_points > 0
                    ? "text-emerald-600"
                    : data.total_points < 0
                      ? "text-rose-600"
                      : "text-zinc-900",
              },
              {
                label: "Avg per Match",
                value:
                  data.items.length > 0
                    ? ((data.total_points - (data.winner_points + data.runner_up_points + data.third_place_points)) / Math.max(data.items.filter((i) => i.kick_off_team && i.predicted_team1_score !== null && i.predicted_team1_score !== null).length, 1)).toFixed(1)
                    : "—",
                color: "text-zinc-900",
              },
              {
                label: "Highest Point",
                value:
                  data.items.length > 0
                    ? formatSignedNumber(
                      Math.max(...data.items.map((i) => i.total_points)),
                    )
                    : "—",
                color: "text-emerald-600",
              },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="flex flex-col gap-1 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/50"
              >
                <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                  {label}
                </p>
                <p className={`text-2xl font-bold ${color} dark:text-zinc-500`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Empty state */}
          {data.items.length === 0 ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 py-12 text-center dark:border-zinc-700 dark:bg-zinc-800/50">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">No predictions on completed matches yet.</p>
            </div>
          ) : (
            <div className="overflow-auto max-h-[40rem] rounded-lg border border-zinc-200 dark:border-zinc-700">
              <table className="min-w-max w-full border-collapse text-sm">
                <thead>
                  {/* Group row */}
                  <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/70">
                    <th
                      rowSpan={2}
                      className={[
                        "static sm:sticky left-0 top-0 z-40 w-[30px] min-w-[30px] max-w-[30px]",
                        "bg-zinc-100 dark:bg-zinc-900",
                        "border-b border-zinc-200 dark:border-zinc-700",
                        "whitespace-nowrap px-3 md:px-5 py-2.5 text-left semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500"
                      ].join(" ")}
                    >
                      #
                    </th>
                    <th
                      rowSpan={2}
                      className={[
                        "static sm:sticky left-[30px] top-0 z-40 w-[110px] min-w-[110px] max-w-[110px] md:left-[40px] md:w-[285px] md:min-w-[285px] md:max-w-[285px]",
                        "bg-zinc-100 dark:bg-zinc-900",
                        "border-b border-zinc-200 dark:border-zinc-700",
                        "whitespace-nowrap px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500"
                      ].join(" ")}
                    >
                      Match
                    </th>
                    <th
                      rowSpan={2}
                      className={[
                        "static sm:sticky left-[140px] md:left-[325px] top-0 z-40 w-[80px] min-w-[80px] max-w-[80px]",
                        "bg-zinc-100 dark:bg-zinc-900",
                        "border-b border-zinc-200 dark:border-zinc-700",
                        "whitespace-nowrap px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500"
                      ].join(" ")}
                    >
                      Total
                    </th>
                    {GROUP_COLS.map(({ label, colSpan, color }) => (
                      <th
                        key={label}
                        colSpan={colSpan}
                        className={[
                          "static sm:sticky top-0 z-30",
                          "bg-zinc-50 dark:bg-zinc-800",
                          "border-r border-zinc-200 dark:border-zinc-700",
                          "px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider",
                          "last:border-r-0",
                          color
                        ].join(" ")}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                  {/* Sub-header row */}
                  <tr className="border-b border-zinc-200 bg-zinc-50/70 dark:border-zinc-700 dark:bg-zinc-800/40">
                    {GROUP_COLS.map(({ label }) =>
                      (["Actual", "Predicted", "Pts"] as const).map((sub) => (
                        <th
                          key={`${label}-${sub}`}
                          className={[
                            "static sm:sticky top-8 z-30",
                            "bg-zinc-50 dark:bg-zinc-800",
                            "whitespace-nowrap px-3 py-1.5 text-center text-[11px] font-medium tracking-wide text-zinc-400 dark:text-zinc-500",
                            sub === "Pts" ? "border-r border-zinc-200 dark:border-zinc-700" : ""
                          ].join(" ")}
                        >
                          {sub}
                        </th>
                      )),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                  {data.items.map((item, idx) => (
                    <ScoreRow key={item.match_id} index={idx} item={item} />
                  ))}
                </tbody>
                {/* Totals footer */}
                <tfoot className="border-t-2 border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/70 mb-2">
                  {areFinalRowsExpanded && (
                    <tr>
                      <td className={[
                        "static sm:sticky left-0 z-20 w-[30px] min-w-[30px] max-w-[30px]",
                        "bg-white dark:bg-zinc-950",
                        "border-b border-zinc-200 dark:border-zinc-800",
                        "whitespace-nowrap px-3 md:px-5 py-2.5 text-left text-xs font-medium text-zinc-400 dark:text-zinc-500"
                      ].join(" ")}></td>
                      <td className={[
                        "static sm:sticky left-[30px] z-20 w-[110px] min-w-[110px] max-w-[110px] md:left-[40px] md:w-[285px] md:min-w-[285px] md:max-w-[285px]",
                        "bg-white dark:bg-zinc-950",
                        "border-b border-zinc-200 dark:border-zinc-800",
                        "px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                      ].join(" ")}>
                        <span className="hidden md:block">Winner Points ({data.winner_prediction || "—"})</span>
                        <span className="md:hidden">Winner Pts ({data.winner_prediction || "—"})</span>
                      </td>
                      {/* Score pts */}
                      <td className={[
                        "static sm:sticky left-[140px] md:left-[325px] z-20 w-16 min-w-[80px] max-w-[80px]",
                        "bg-white dark:bg-zinc-950",
                        "border-b border-zinc-200 dark:border-zinc-800",
                        "whitespace-nowrap px-3 py-2.5 text-center"
                      ].join(" ")}>
                        <span
                          className={`inline-flex h-8 w-12 items-center justify-center rounded-lg text-sm font-bold ${totalColor(data.total_points)}`}
                        >
                          {data.winner_points}
                        </span>
                      </td>
                      <td colSpan={24} />
                    </tr>
                  )}
                  {areFinalRowsExpanded && (
                    <tr>
                      <td className={[
                        "static sm:sticky left-0 z-20 w-[30px] min-w-[30px] max-w-[30px]",
                        "bg-white dark:bg-zinc-950",
                        "border-b border-zinc-200 dark:border-zinc-800",
                        "whitespace-nowrap px-3 md:px-5 py-2.5 text-left text-xs font-medium text-zinc-400 dark:text-zinc-500"
                      ].join(" ")}></td>
                      <td className={[
                        "static sm:sticky left-[30px] z-20 w-[110px] min-w-[110px] max-w-[110px] md:left-[40px] md:w-[285px] md:min-w-[285px] md:max-w-[285px]",
                        "bg-white dark:bg-zinc-950",
                        "border-b border-zinc-200 dark:border-zinc-800",
                        "px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                      ].join(" ")}>
                        <span className="hidden md:block">Runner up Points ({data.runner_up_prediction || "—"})</span>
                        <span className="md:hidden">Runner-up Pts ({data.runner_up_prediction || "—"})</span>

                      </td>
                      {/* Score pts */}
                      <td className={[
                        "static sm:sticky left-[140px] md:left-[325px] z-20 w-16 min-w-[80px] max-w-[80px]",
                        "bg-white dark:bg-zinc-950",
                        "border-b border-zinc-200 dark:border-zinc-800",
                        "whitespace-nowrap px-3 py-2.5 text-center"
                      ].join(" ")}>
                        <span
                          className={`inline-flex h-8 w-12 items-center justify-center rounded-lg text-sm font-bold ${totalColor(data.total_points)}`}
                        >
                          {data.runner_up_points}
                        </span>
                      </td>
                      <td colSpan={24} />
                    </tr>
                  )}
                  {areFinalRowsExpanded && (
                    <tr>
                      <td className={[
                        "static sm:sticky left-0 z-20 w-[30px] min-w-[30px] max-w-[30px]",
                        "bg-white dark:bg-zinc-950",
                        "border-b border-zinc-200 dark:border-zinc-800",
                        "whitespace-nowrap px-3 md:px-5 py-2.5 text-left text-xs font-medium text-zinc-400 dark:text-zinc-500"
                      ].join(" ")}></td>
                      <td className={[
                        "static sm:sticky left-[30px] z-20 w-[110px] min-w-[110px] max-w-[110px] md:left-[40px] md:w-[285px] md:min-w-[285px] md:max-w-[285px]",
                        "bg-white dark:bg-zinc-950",
                        "border-b border-zinc-200 dark:border-zinc-800",
                        "px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                      ].join(" ")}>
                        <span className="hidden md:block">Third Place Points ({data.third_place_prediction || "—"})</span>
                        <span className="md:hidden">3rd Place Pts ({data.third_place_prediction || "—"})</span>
                      </td>
                      {/* Score pts */}
                      <td className={[
                        "static sm:sticky left-[140px] md:left-[325px] z-20 w-16 min-w-[80px] max-w-[80px]",
                        "bg-white dark:bg-zinc-950",
                        "border-b border-zinc-200 dark:border-zinc-800",
                        "whitespace-nowrap px-3 py-2.5 text-center"
                      ].join(" ")}>
                        <span
                          className={`inline-flex h-8 w-12 items-center justify-center rounded-lg text-sm font-bold ${totalColor(data.total_points)}`}
                        >
                          {data.third_place_points}
                        </span>
                      </td>
                      <td colSpan={24} />
                    </tr>
                  )}
                  <tr>
                    {/* <td className={[
                      "static sm:sticky left-0 z-20 w-[30px] min-w-[30px] max-w-[30px]",
                      "bg-white dark:bg-zinc-950",
                      "border-b border-zinc-200 dark:border-zinc-800",
                      "whitespace-nowrap px-3 md:px-5 py-2.5 text-left text-xs font-medium text-zinc-400 dark:text-zinc-500"
                    ].join(" ")}></td> */}
                    <td className={[
                      "static sm:sticky left-0 z-20 w-[110px] min-w-[110px] max-w-[110px] md:w-[285px] md:min-w-[285px] md:max-w-[285px]",
                      "bg-white dark:bg-zinc-950",
                      "border-b border-zinc-200 dark:border-zinc-800",
                      "px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                    ].join(" ")} colSpan={2}>
                      <button
                        type="button"
                        aria-expanded={areFinalRowsExpanded}
                        onClick={() => setAreFinalRowsExpanded((expanded) => !expanded)}
                        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 text-xs font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                      >
                        <IconChevronDown
                          className={[
                            "h-4 w-4 transition-transform",
                            areFinalRowsExpanded ? "rotate-180" : "",
                          ].join(" ")}
                        />
                        <span className="hidden md:block">Total Points</span>
                        <span className="md:hidden">Total Pts</span>
                      </button>
                    </td>
                    {/* Total pts */}
                    <td className={[
                      "static sm:sticky left-[140px] md:left-[325px] z-20 w-16 min-w-[80px] max-w-[80px]",
                      "bg-white dark:bg-zinc-950",
                      "border-b border-zinc-200 dark:border-zinc-800",
                      "whitespace-nowrap px-3 py-2.5 text-center"
                    ].join(" ")}>
                      <span
                        className={`inline-flex h-8 w-12 items-center justify-center rounded-lg text-sm font-bold ${totalColor(data.total_points)}`}
                      >
                        {data.total_points}
                      </span>
                    </td>
                    {/* Score pts */}
                    <td colSpan={2} />
                    <PtsCell
                      points={data.items.reduce((s, i) => s + i.score_points, 0) + data.winner_points + data.runner_up_points + data.third_place_points}
                      isLastRow={true}
                    />
                    {/* Goal diff pts */}
                    <td colSpan={2} />
                    <PtsCell
                      points={data.items.reduce((s, i) => s + i.goal_difference_points, 0)}
                      isLastRow={true}
                    />
                    {/* First Goal In pts */}
                    <td colSpan={2} />
                    <PtsCell
                      points={data.items.reduce((s, i) => s + i.first_goal_in_points, 0)}
                      isLastRow={true}
                    />
                    {/* First Score By pts */}
                    <td colSpan={2} />
                    <PtsCell
                      points={data.items.reduce((s, i) => s + i.first_scoring_team_points, 0)}
                      isLastRow={true}
                    />
                    {/* Yellow card pts */}
                    <td colSpan={2} />
                    <PtsCell
                      points={data.items.reduce((s, i) => s + i.yellow_card_points, 0)}
                      isLastRow={true}
                    />
                    {/* Red card pts */}
                    <td colSpan={2} />
                    <PtsCell
                      points={data.items.reduce((s, i) => s + i.red_card_points, 0)}
                      isLastRow={true}
                    />
                    {/* Kick-off pts */}
                    <td colSpan={2} />
                    <PtsCell
                      points={data.items.reduce((s, i) => s + i.kick_off_team_points, 0)}
                      isLastRow={true}
                    />
                    {/* Duration pts */}
                    <td colSpan={2} />
                    <PtsCell
                      points={data.items.reduce((s, i) => s + i.match_duration_points, 0)}
                      isLastRow={true}
                    />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </Modal >
  );
};

const FinalistTeamCell = ({
  isVisible,
  points,
  team,
}: {
  isVisible: boolean;
  points: number;
  team: FinalistPredictionTeamResponse | null;
}) => {
  if (!isVisible) {
    return (
      <div className="flex min-w-[10rem] items-center gap-2 text-zinc-400 dark:text-zinc-500">
        <IconLock className="h-4 w-4 shrink-0" />
        <span className="text-sm font-medium">Hidden</span>
      </div>
    );
  }

  return (
    <div className="flex min-w-[10rem] items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="inline-flex h-7 w-10 shrink-0 items-center justify-center rounded border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800">
          {team?.flag_url ? (
            <Image
              width={30}
              height={30}
              alt={`${team.name} flag`}
              className="h-6 w-auto rounded object-cover"
              src={team.flag_url}
            />
          ) : (
            <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">—</span>
          )}
        </span>
        <div className="max-w-[11rem] truncate text-xs text-zinc-500 dark:text-zinc-400">
          {team?.name ?? "No pick"}
        </div>
      </div>
      <span
        className={`inline-flex h-7 min-w-9 shrink-0 items-center justify-center rounded-md px-2 text-xs font-bold ${totalColor(points)}`}
      >
        {points}
      </span>
    </div>
  );
};

const FinalistPredictionRow = ({
  row,
  user,
}: {
  row: FinalistPredictionEntryResponse;
  user: UserResponse | null;
}) => {
  const isCurrentUser = row.user_id === user?.id;

  return (
    <tr
      className={[
        "transition-colors",
        isCurrentUser
          ? "bg-zinc-200 font-bold dark:bg-sky-900/90"
          : "hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40",
      ].join(" ")}
    >
      <td
        className={[
          "static sm:sticky left-0 z-20 w-[56px] min-w-[56px]",
          "border-b border-zinc-200 px-3 py-3 text-center font-semibold dark:border-zinc-800",
          isCurrentUser ? "bg-zinc-200 dark:bg-sky-900" : "bg-white dark:bg-zinc-950",
        ].join(" ")}
      >
        {row.rank}
      </td>
      <td
        className={[
          "static sm:sticky left-[56px] z-20 w-[160px] min-w-[160px]",
          "border-b border-zinc-200 px-3 py-3 dark:border-zinc-800",
          isCurrentUser ? "bg-zinc-200 dark:bg-sky-900" : "bg-white dark:bg-zinc-950",
        ].join(" ")}
      >
        <div className="truncate text-sm font-semibold text-zinc-950 dark:text-zinc-100">
          {row.user_name}
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          {row.total_points} pts
        </div>
      </td>
      <td className="border-b border-zinc-100 px-3 py-3 dark:border-zinc-800">
        <FinalistTeamCell
          isVisible={row.is_prediction_visible}
          points={row.winner_points}
          team={row.winner_prediction}
        />
      </td>
      <td className="border-b border-zinc-100 px-3 py-3 dark:border-zinc-800">
        <FinalistTeamCell
          isVisible={row.is_prediction_visible}
          points={row.runner_up_points}
          team={row.runner_up_prediction}
        />
      </td>
      <td className="border-b border-zinc-100 px-3 py-3 dark:border-zinc-800">
        <FinalistTeamCell
          isVisible={row.is_prediction_visible}
          points={row.third_place_points}
          team={row.third_place_prediction}
        />
      </td>
    </tr>
  );
};

const FinalistPredictionsModal = ({
  isOpen,
  onClose,
  user,
}: {
  isOpen: boolean;
  onClose: () => void;
  user: UserResponse | null;
}) => {
  const [data, setData] = useState<FinalistPredictionsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let isMounted = true;

    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setData(null);
        const result = await listFinalistPredictions();
        if (isMounted) {
          setData(result);
        }
      } catch (err) {
        if (isMounted) {
          setError(getLoadErrorMessage(err));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Winner Predictions" isLarge>
      {isLoading && (
        <div className="flex flex-col gap-3">
          <div className="h-12 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-14 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          {error}
        </div>
      )}

      {data && !isLoading && (
        data.items.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 py-12 text-center dark:border-zinc-700 dark:bg-zinc-800/50">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No finalist predictions yet.</p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[40rem] rounded-lg border border-zinc-200 dark:border-zinc-700">
            <table className="min-w-max w-full border-collapse text-sm">
              <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:bg-zinc-800/70 dark:text-zinc-400">
                <tr>
                  <th className="static sm:sticky left-0 top-0 z-40 w-[56px] min-w-[56px] bg-zinc-100 px-3 py-3 text-center dark:bg-zinc-800">
                    Rank
                  </th>
                  <th className="static sm:sticky left-[56px] top-0 z-40 w-[160px] min-w-[160px] bg-zinc-100 px-3 py-3 dark:bg-zinc-800">
                    User
                  </th>
                  <th className="min-w-[12rem] px-3 py-3">Final</th>
                  <th className="min-w-[12rem] px-3 py-3">Runner-up</th>
                  <th className="min-w-[12rem] px-3 py-3">Third Place</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {data.predictions_visible ? (
                  data.items.map((row) => (
                    <FinalistPredictionRow key={row.user_id} row={row} user={user} />
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-4 text-sm text-zinc-500 dark:text-zinc-400">
                      Finalist predictions are not locked yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )
      )}
    </Modal>
  );
};


const LeaderboardRow = ({
  user,
  row,
  completedMatches,
  onUserClick,
}: {
  user: UserResponse | null;
  row: LeaderboardEntryResponse;
  completedMatches: number;
  onUserClick: (userId: number, userName: string) => void;
}) => {
  return (
    <tr className={[
      "transition-colors",
      row.user_id === user?.id ? "bg-zinc-200 dark:bg-sky-900/90 hover:bg-zinc-200/80 dark:hover:bg-sky-900/90 font-bold" : "hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 font-medium",
    ].join(" ")}>
      <td className={[
        "static sm:sticky left-0 z-20 w-[30px] min-w-[30px] max-w-[30px]",
        "border-b border-zinc-200 dark:border-zinc-800",
        "px-3 py-4 font-semibold text-zinc-950 dark:text-zinc-100 text-center",
        row.user_id === user?.id ? "bg-zinc-200 dark:bg-sky-900 font-bold" : "bg-white dark:bg-zinc-950",
      ].join(" ")}>{row.rank}</td>
      <td className={[
        "static sm:sticky z-20 left-[30px] w-[80px] min-w-[80px] max-w-[80px] md:left-[75px] md:w-[150px] md:min-w-[150px] md:max-w-[150px]",
        "border-b border-zinc-200 dark:border-zinc-800",
        "px-3 py-3 font-medium text-zinc-950 dark:text-zinc-50",
        row.user_id === user?.id ? "bg-zinc-200 dark:bg-sky-900 font-bold" : "bg-white dark:bg-zinc-950",
      ].join(" ")}>
        <div
          onClick={() => onUserClick(row.user_id, row.name)}
          className="font-medium text-indigo-600 hover:text-emerald-950 transition-colors cursor-pointer text-left dark:text-indigo-300 dark:hover:text-indigo-400 truncate"
        >
          {row.name}
        </div>
      </td>
      <td className={[
        "static sm:sticky left-[110px] md:left-[225px] z-20 w-[90px] min-w-[90px] max-w-[90px]",
        "border-b border-zinc-200 dark:border-zinc-800",
        "px-3 py-3 font-medium text-zinc-950 dark:text-zinc-50 text-right",
        row.user_id === user?.id ? "bg-zinc-200 dark:bg-sky-900 font-bold" : "bg-white dark:bg-zinc-950",
      ].join(" ")}>
        {row.total_points}
      </td>
      <td className="px-3 py-4 text-zinc-700 dark:text-zinc-300 text-right">{row.score_points}</td>
      <td className="px-3 py-4 text-zinc-700 dark:text-zinc-300 text-right">{row.goal_difference_points}</td>
      <td className="px-3 py-4 text-zinc-700 dark:text-zinc-300 text-right">{row.first_goal_in_points}</td>
      <td className="px-3 py-4 text-zinc-700 dark:text-zinc-300 text-right">{row.first_scoring_team_points}</td>
      <td className="px-3 py-4 text-zinc-700 dark:text-zinc-300 text-right">{row.yellow_card_points}</td>
      {/* <td className="px-3 py-4">
        <StatusPill tone={"yellow"}>
          {formatSignedNumber(row.red_card_points)}
        </StatusPill>
      </td> */}
      <td className="px-3 py-4 text-zinc-700 dark:text-zinc-300 text-right">{row.red_card_points}</td>
      {/* <td className="px-3 py-4">
        <StatusPill tone={getPointsTone(row.red_card_points)}>
          {formatSignedNumber(row.red_card_points)}
        </StatusPill>
      </td> */}
      <td className="px-3 py-4 text-zinc-700 dark:text-zinc-300 text-right">{row.kick_off_team_points}</td>
      <td className="px-3 py-4 text-zinc-700 dark:text-zinc-300 text-right">{row.match_duration_points}</td>
      <td className="px-3 py-4 text-zinc-700 dark:text-zinc-300 text-right">
        {row.predicted_matches} / {completedMatches}
      </td>
    </tr>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
export const LeaderboardDashboard = () => {
  const [authRequired, setAuthRequired] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(
    null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modal state
  const [modalUserId, setModalUserId] = useState<number | null>(null);
  const [modalUserName, setModalUserName] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFinalistModalOpen, setIsFinalistModalOpen] = useState(false);
  const [currentMatchDay, setCurrentMatchDay] = useState<number | null>(null);
  const [finalistPredictionDeadline, setFinalistPredictionDeadline] = useState(
    DEFAULT_FINALIST_PREDICTION_DEADLINE,
  );
  const [user, setUser] = useState<UserResponse | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState("");

  const handleUserClick = (userId: number, userName: string) => {
    setModalUserId(userId);
    setModalUserName(userName);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
  };

  const handleFinalistModalClose = () => {
    setIsFinalistModalOpen(false);
  };

  useEffect(() => {
    let isMounted = true;

    const loadLeaderboard = async () => {
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
        const [
          leaderboardResponse,
          currentUser,
          matchDayResponse,
          deadlineResponse,
        ] = await Promise.all([
          listLeaderboard({ limit: 10000, is_race_data_required: true }),
          getCurrentUser(),
          getCurrentMatchDay().catch(() => null),
          getFinalistPredictionDeadline().catch(() => null),
        ]);

        if (!isMounted) {
          return;
        }

        setUser(currentUser);
        setCurrentMatchDay(matchDayResponse?.value ?? null);
        setFinalistPredictionDeadline(
          deadlineResponse?.value ?? DEFAULT_FINALIST_PREDICTION_DEADLINE,
        );

        setAuthRequired(false);
        setLeaderboard(leaderboardResponse);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (
          error instanceof SessionExpiredError ||
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
    };

    void loadLeaderboard();

    return () => {
      isMounted = false;
    };
  }, []);

  const rows = useMemo(() => leaderboard?.items ?? [], [leaderboard?.items]);
  const normalizedUserSearchQuery = userSearchQuery.trim().toLowerCase();
  const filteredRows = useMemo(() => {
    if (!normalizedUserSearchQuery) {
      return rows;
    }

    return rows.filter((row) =>
      row.name.toLowerCase().includes(normalizedUserSearchQuery),
    );
  }, [normalizedUserSearchQuery, rows]);
  const isUserSearchActive = normalizedUserSearchQuery.length > 0;
  const predictionLocked = currentMatchDay ? currentMatchDay > finalistPredictionDeadline : false;

  if (isLoading) {
    return (
      <>
        <section className="h-[687px] animate-pulse rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800" />
        <section className="h-[727px] animate-pulse rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800" />
      </>
    );
  }

  if (authRequired) {
    return (
      <section className="flex flex-col gap-3 rounded-md border border-yellow-200 px-4 py-4 text-sm text-yellow-900 dark:text-zinc-400 dark:border-yellow-700 bg-yellow-50 dark:bg-amber-950 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Login required</h2>
          <p className="mt-1 text-sm">Log in to view tournament leaderboard and the racing charts.</p>
        </div>
        <Link
          href="/login"
          className="inline-flex h-10 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-700"
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
          className="rounded-md border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400"
          role="alert"
        >
          {loadError}
        </section>
      ) : null}

      {leaderboard ? <RaceChart dataset={leaderboard.race_frames} userId={user?.id} /> : null}

      {rows.length > 0 ? (
        <section className="overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex flex-col gap-4 border-b border-zinc-200 px-3 py-2 md:px-5 md:py-4 lg:flex-row lg:items-center lg:justify-between dark:border-zinc-700">
            <div>
              <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">Leaderboard Breakdown</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Showing {filteredRows.length} of {rows.length} ranked users
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {predictionLocked ? (
                <button
                  type="button"
                  onClick={() => setIsFinalistModalOpen(true)}
                  className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-700"
                >
                  <IconTrophy className="h-4 w-4" />
                  Winner Predictions
                </button>
              ) : null}
              <SearchInput
                value={userSearchQuery}
                onChange={setUserSearchQuery}
                placeholder="Search user..."
                resultCount={filteredRows.length}
                totalCount={rows.length}
              />
            </div>
          </div>
          {isUserSearchActive && filteredRows.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-100">No users found</h3>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                No leaderboard users match &quot;{userSearchQuery}&quot;.
              </p>
            </div>
          ) : (
            <div className="overflow-auto max-h-[40rem]">
              <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-700">
                <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:bg-zinc-800/70 dark:text-zinc-400">
                  <tr>
                    <th className={[
                      "static sm:sticky left-0 top-0 z-40 w-30px min-w-[30px] max-w-[30px]",
                      "bg-zinc-100 dark:bg-zinc-800",
                      "border-b border-zinc-200 dark:border-zinc-700",
                      "px-3 py-3 dark:text-zinc-400 text-center",
                      "table-cell md:hidden"
                    ].join(" ")}>#</th>
                    <th className={[
                      "static md:sticky left-0 top-0 z-40 w-16 min-w-[75px] max-w-[64px]",
                      "bg-zinc-100 dark:bg-zinc-800",
                      "border-b border-zinc-200 dark:border-zinc-700",
                      "px-3 py-3 dark:text-zinc-400 text-center",
                      "hidden md:table-cell"
                    ].join(" ")}>Rank</th>
                    <th className={[
                      "static sm:sticky top-0 z-40 left-[30px] w-[80px] min-w-[80px] max-w-[80px] md:left-[75px] md:w-[150px] md:min-w-[150px] md:max-w-[150px]",
                      "bg-zinc-100 dark:bg-zinc-800",
                      "font-semibold text-sm",
                      "px-3 py-3 dark:text-zinc-400",
                      "border-b border-zinc-200 dark:border-zinc-700"
                    ].join(" ")}>User</th>
                    <th className={[
                      "static sm:sticky left-[110px] md:left-[225px] top-0 z-40 w-[90px] min-w-[90px] max-w-[90px]",
                      "bg-zinc-100 dark:bg-zinc-800",
                      "font-semibold text-sm text-right",
                      "border-b border-zinc-200 dark:border-zinc-700",
                      "px-3 py-3"
                    ].join(" ")}>Total</th>
                    <th className={[
                      "static sm:sticky top-0 z-30",
                      "bg-zinc-100 dark:bg-zinc-700",
                      "px-3 py-3 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700 text-right"
                    ].join(" ")}>Score</th>
                    <th className={[
                      "static sm:sticky top-0 z-30",
                      "bg-zinc-100 dark:bg-zinc-700",
                      "px-3 py-3 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700 text-right min-w-[105px]"
                    ].join(" ")}>Goal Diff</th>
                    <th className={[
                      "static sm:sticky top-0 z-30",
                      "bg-zinc-100 dark:bg-zinc-700",
                      "px-3 py-3 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700 text-right min-w-[145px]"
                    ].join(" ")}>First Score In</th>
                    <th className={[
                      "static sm:sticky top-0 z-30",
                      "bg-zinc-100 dark:bg-zinc-700",
                      "px-3 py-3 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700 text-right min-w-[145px]"
                    ].join(" ")}>First Score By</th>
                    <th className={[
                      "static sm:sticky top-0 z-30",
                      "bg-zinc-100 dark:bg-zinc-700",
                      "px-3 py-3 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700 text-right min-w-[120px]"
                    ].join(" ")}>Yello Card</th>
                    <th className={[
                      "static sm:sticky top-0 z-30",
                      "bg-zinc-100 dark:bg-zinc-700",
                      "px-3 py-3 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700 text-right min-w-[100px]"
                    ].join(" ")}>Red Card</th>
                    <th className={[
                      "static sm:sticky top-0 z-30",
                      "bg-zinc-100 dark:bg-zinc-700",
                      "px-3 py-3 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700 text-right min-w-[100px]"
                    ].join(" ")}>Kick-off</th>
                    <th className={[
                      "static sm:sticky top-0 z-30",
                      "bg-zinc-100 dark:bg-zinc-700",
                      "px-3 py-3 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700 text-right"
                    ].join(" ")}>Duration</th>
                    <th className={[
                      "static sm:sticky top-0 z-30",
                      "bg-zinc-100 dark:bg-zinc-700",
                      "px-3 py-3 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700 text-right min-w-[150px]"
                    ].join(" ")}>Predicted/Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {filteredRows.map((row) => (
                    <LeaderboardRow
                      user={user}
                      key={row.user_id}
                      row={row}
                      completedMatches={leaderboard?.completed_matches || 0}
                      onUserClick={handleUserClick}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <section className="rounded-md border border-zinc-200 bg-white px-5 py-10 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">
            No ranked users yet.
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            Rankings will appear after users and predictions are available.
          </p>
        </section>
      )}

      <UserPointsDetailModal
        userId={modalUserId}
        userName={modalUserName}
        isOpen={isModalOpen}
        onClose={handleModalClose}
      />
      {predictionLocked ? (
        <FinalistPredictionsModal
          isOpen={isFinalistModalOpen}
          onClose={handleFinalistModalClose}
          user={user}
        />
      ) : null}
    </>
  );
};
