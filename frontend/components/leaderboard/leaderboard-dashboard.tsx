"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";

import { Modal } from "@/components/ui/modal";
import { PillTone, StatusPill } from "@/components/ui/status-pill";
import { ApiError } from "@/lib/api";
import { isAuthenticated, MissingAuthTokenError } from "@/lib/auth";
import { getUserPredictionDetails, listLeaderboard } from "@/lib/leaderboard";
import type {
  LeaderboardEntryResponse,
  LeaderboardRaceFrameResponse,
  LeaderboardRaceUserResponse,
  LeaderboardResponse,
  UserPointsDetailsListResponse,
  UserPointsDetailsResponse,
} from "@/lib/leaderboard";
import { firstGoalInLabels, MatchDuration, matchDurationLabels } from "@/lib/matches";
import { FirstGoalIn } from "@/lib/matches/types";

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

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Unable to load leaderboard.";
};

const formatSignedNumber = (value: number): string => {
  return String(value);
};

const getPointsTone = (points: number): PillTone => {
  if (points > 0) {
    return "primary";
  }

  return "accent";
};

const getFrameMaxPoints = (frame: LeaderboardRaceFrameResponse): number => {
  return Math.max(
    1,
    ...frame.standings.map((standing) => Math.abs(standing.total_points)),
  );
};


// ── Helpers for the detail table ─────────────────────────────────────────────
const fmtDuration = (v: string | null): string =>
  v ? (matchDurationLabels[v as MatchDuration] ?? v) : "—";

const fmtFirstGoalIn = (v: string | null): string => {
  if (v === null) return "—";
  return v ? (firstGoalInLabels[v as FirstGoalIn] ?? v) : "—";
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

const PtsCell = ({ points }: { points: number }) => {
  const color =
    points > 0
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:ring-emerald-800"
      : points < 0
        ? "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950 dark:text-rose-400 dark:ring-rose-800"
        : "bg-zinc-100 text-zinc-500 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-600";
  return (
    <td className="whitespace-nowrap px-3 py-2.5 text-center">
      <span
        className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${color}`}
      >
        {formatSignedNumber(points)}
      </span>
    </td>
  );
};

// ── Score row ─────────────────────────────────────────────────────────────────

const ScoreRow = ({
  index,
  item,
}: {
  index: number;
  item: UserPointsDetailsResponse;
}) => {
  const totalColor =
    item.total_points > 0
      ? "bg-emerald-600 text-white"
      : item.total_points < 0
        ? "bg-rose-600 text-white"
        : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300";

  return (
    <tr className="group border-b border-zinc-100 dark:border-zinc-800 transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-800/50">
      {/* S.N. */}
      <td className="whitespace-nowrap px-3 py-2.5 text-center text-xs font-medium text-zinc-400 dark:text-zinc-500">
        {index + 1}
      </td>

      {/* Match */}
      <td className="min-w-[10rem] px-3 py-2.5">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {item.team1_name} <span className="text-zinc-400 dark:text-zinc-500">vs</span> {item.team2_name}
        </p>
      </td>

      {/* Total */}
      <td className="whitespace-nowrap px-3 py-2.5 text-center">
        <span
          className={`inline-flex h-8 w-12 items-center justify-center rounded-lg text-sm font-bold ${totalColor}`}
        >
          {formatSignedNumber(item.total_points)}
        </span>
      </td>

      {/* Score – actual */}
      <ActualCell>
        <span className="font-semibold text-zinc-700 dark:text-zinc-300">
          {item.team1_score} – {item.team2_score}
        </span>
      </ActualCell>
      {/* Score – predicted */}
      <PredCell>
        {item.predicted_team1_score} – {item.predicted_team2_score}
      </PredCell>
      {/* Score points */}
      <PtsCell points={item.score_points} />

      {/* Goal diff – actual */}
      <ActualCell>{Math.abs(item.team1_score - item.team2_score)}</ActualCell>
      {/* Goal diff – predicted */}
      <PredCell>
        {Math.abs(item.predicted_team1_score - item.predicted_team2_score)}
      </PredCell>
      <PtsCell points={item.goal_difference_points} />

      {/* Yellow cards */}
      <ActualCell>{fmtVal(item.yellow_card_count)}</ActualCell>
      <PredCell>{item.predicted_yellow_card_count}</PredCell>
      <PtsCell points={item.yellow_card_points} />

      {/* Red cards */}
      <ActualCell>{fmtVal(item.red_card_count)}</ActualCell>
      <PredCell>{item.predicted_red_card_count > 0 ? fmtVal(item.predicted_red_card_count) : fmtVal(null)}</PredCell>
      <PtsCell points={item.red_card_points} />

      {/* Kick-off team */}
      <ActualCell>{fmtVal(item.kick_off_team)}</ActualCell>
      <PredCell>{item.predicted_kick_off_team}</PredCell>
      <PtsCell points={item.kick_off_team_points} />

      {/* First goal in */}
      <ActualCell>{fmtFirstGoalIn(item.first_goal_in)}</ActualCell>
      <PredCell>{fmtFirstGoalIn(item.predicted_first_goal_in)}</PredCell>
      <PtsCell points={item.first_goal_in_points} />

      {/* First scoring team */}
      <ActualCell>{fmtVal(item.first_scoring_team)}</ActualCell>
      <PredCell>{fmtVal(item.predicted_first_scoring_team)}</PredCell>
      <PtsCell points={item.first_scoring_team_points} />

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
  { label: "Yellow Card", colSpan: 3, color: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400" },
  { label: "Red Card", colSpan: 3, color: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400" },
  { label: "Kick-off", colSpan: 3, color: "bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-400" },
  { label: "First Goal in", colSpan: 3, color: "bg-lime-50 text-lime-700 dark:bg-lime-950/50 dark:text-lime-400" },
  { label: "First Score by", colSpan: 3, color: "bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400" },
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
    <Modal isOpen={isOpen} onClose={onClose} title={`Points Breakdown — ${userName}`} isLarge>
      {/* Loading skeleton */}
      {isLoading && (
        <div className="flex flex-col gap-3 py-2">
          <div className="h-16 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Data */}
      {data && !isLoading && (
        <>
          {/* Summary cards */}
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Predictions", value: data.items.length, color: "text-zinc-900" },
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
                    ? (data.total_points / data.items.length).toFixed(1)
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
                className="flex flex-col gap-1 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/50"
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
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 py-12 text-center dark:border-zinc-700 dark:bg-zinc-800/50">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">No predictions on completed matches yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
              <table className="min-w-max w-full border-collapse text-sm">
                <thead>
                  {/* Group row */}
                  <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/70">
                    <th
                      rowSpan={2}
                      className="whitespace-nowrap border-r border-zinc-200 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:border-zinc-700 dark:text-zinc-500"
                    >
                      #
                    </th>
                    <th
                      rowSpan={2}
                      className="whitespace-nowrap border-r border-zinc-200 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
                    >
                      Match
                    </th>
                    <th
                      rowSpan={2}
                      className="whitespace-nowrap border-r border-zinc-200 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
                    >
                      Total
                    </th>
                    {GROUP_COLS.map(({ label, colSpan, color }) => (
                      <th
                        key={label}
                        colSpan={colSpan}
                        className={`border-r border-zinc-200 dark:border-zinc-700 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider last:border-r-0 ${color}`}
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
                          className={`whitespace-nowrap px-3 py-1.5 text-center text-[11px] font-medium tracking-wide text-zinc-400 dark:text-zinc-500 ${sub === "Pts" ? "border-r border-zinc-200 dark:border-zinc-700" : ""}`}
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
                <tfoot className="border-t-2 border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/70">
                  <tr>
                    <td colSpan={3} className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Totals
                    </td>
                    {/* Score pts */}
                    <td colSpan={2} />
                    <PtsCell
                      points={data.items.reduce((s, i) => s + i.score_points, 0)}
                    />
                    {/* Goal diff pts */}
                    <td colSpan={2} />
                    <PtsCell
                      points={data.items.reduce((s, i) => s + i.goal_difference_points, 0)}
                    />
                    {/* Yellow card pts */}
                    <td colSpan={2} />
                    <PtsCell
                      points={data.items.reduce((s, i) => s + i.yellow_card_points, 0)}
                    />
                    {/* Red card pts */}
                    <td colSpan={2} />
                    <PtsCell
                      points={data.items.reduce((s, i) => s + i.red_card_points, 0)}
                    />
                    {/* Kick-off pts */}
                    <td colSpan={2} />
                    <PtsCell
                      points={data.items.reduce((s, i) => s + i.kick_off_team_points, 0)}
                    />
                    {/* First Goal In pts */}
                    <td colSpan={2} />
                    <PtsCell
                      points={data.items.reduce((s, i) => s + i.first_goal_in_points, 0)}
                    />
                    {/* First Score By pts */}
                    <td colSpan={2} />
                    <PtsCell
                      points={data.items.reduce((s, i) => s + i.first_scoring_team_points, 0)}
                    />
                    {/* Duration pts */}
                    <td colSpan={2} />
                    <PtsCell
                      points={data.items.reduce((s, i) => s + i.match_duration_points, 0)}
                    />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </Modal>
  );
};


const LeaderboardRow = ({
  row,
  completedMatches,
  onUserClick,
}: {
  row: LeaderboardEntryResponse;
  completedMatches: number;
  onUserClick: (userId: number, userName: string) => void;
}) => {
  return (
    <tr className="dark:hover:bg-zinc-800/40 transition-colors">
      <td className="px-5 py-4 font-semibold text-zinc-950 dark:text-zinc-100">#{row.rank}</td>
      <td className="px-5 py-4">
        <button
          type="button"
          onClick={() => onUserClick(row.user_id, row.name)}
          className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline transition-colors cursor-pointer text-left dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          {row.name}
        </button>
      </td>
      <td className="px-5 py-4 text-zinc-700 dark:text-zinc-300">{row.score_points}</td>
      <td className="px-5 py-4 text-zinc-700 dark:text-zinc-300">{row.goal_difference_points}</td>
      <td className="px-5 py-4 text-zinc-700 dark:text-zinc-300">{row.kick_off_team_points}</td>
      <td className="px-5 py-4 text-zinc-700 dark:text-zinc-300">{row.yellow_card_points}</td>
      <td className="px-5 py-4">
        <StatusPill tone={getPointsTone(row.red_card_points)}>
          {formatSignedNumber(row.red_card_points)}
        </StatusPill>
      </td>
      <td className="px-5 py-4 text-zinc-700 dark:text-zinc-300">{row.first_goal_in_points}</td>
      <td className="px-5 py-4 text-zinc-700 dark:text-zinc-300">{row.first_scoring_team_points}</td>
      <td className="px-5 py-4 text-zinc-700 dark:text-zinc-300">{row.match_duration_points}</td>
      <td className="px-5 py-4 text-right font-semibold text-zinc-950 dark:text-zinc-100">
        {row.total_points}
      </td>
      <td className="px-5 py-4 text-zinc-700 dark:text-zinc-300">
        {row.predicted_matches} / {completedMatches}
      </td>
    </tr>
  );
};

// ── Race Chart ────────────────────────────────────────────────────────────────

const RaceChartRow = ({
  maxPoints,
  standing,
  onUserClick,
}: {
  maxPoints: number;
  standing: LeaderboardRaceUserResponse;
  onUserClick: (userId: number, userName: string) => void;
}) => {
  const barWidth =
    standing.total_points === 0
      ? 2
      : Math.max(8, (Math.abs(standing.total_points) / maxPoints) * 100);
  const barColor =
    standing.total_points < 0
      ? "bg-rose-600"
      : standing.match_points > 0
        ? "bg-tournament-primary-light"
        : "bg-zinc-500";

  return (
    <div className="grid min-w-[42rem] grid-cols-[4rem_13rem_1fr_5rem_5rem] items-center gap-3 px-4 py-3 text-sm">
      <div className="font-semibold text-zinc-950 dark:text-zinc-100">#{standing.rank}</div>
      <div className="truncate font-medium text-indigo-600 hover:text-indigo-800 hover:underline transition-colors cursor-pointer text-left dark:text-indigo-400 dark:hover:text-indigo-300" onClick={() => onUserClick(standing.user_id, standing.name)}>{standing.name}</div>
      <div className="h-9 overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-700">
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
      <div className="text-right font-semibold text-zinc-950 dark:text-zinc-100">
        {standing.total_points}
      </div>
    </div>
  );
};

const RaceChart = ({ frames, onUserClick }: { frames: LeaderboardRaceFrameResponse[]; onUserClick: (userId: number, userName: string) => void }) => {
  const safeFrames = frames.length > 0 ? frames : [];
  const [frameIndex, setFrameIndex] = useState(safeFrames.length - 1);
  const [isPlaying, setIsPlaying] = useState(false);

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
    <section className="overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex flex-col gap-4 border-b border-zinc-200 px-5 py-4 lg:flex-row lg:items-end lg:justify-between dark:border-zinc-700">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">Leaderboard Race</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{frame.label}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (!isPlaying) {
                setFrameIndex(0);
              }

              setIsPlaying((currentValue) => !currentValue);
            }}
            disabled={safeFrames.length <= 1}
            className="inline-flex h-10 items-center justify-center cursor-pointer rounded-md border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:bg-zinc-700 dark:disabled:text-zinc-600"
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
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            {frameIndex + 1} / {safeFrames.length}
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[42rem] border-b border-zinc-100 bg-zinc-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-400">
          <div className="grid grid-cols-[4rem_13rem_1fr_5rem_5rem] gap-3">
            <span>Rank</span>
            <span>User</span>
            <span>Total</span>
            <span className="text-right">Match Point</span>
            <span className="text-right">Pts</span>
          </div>
        </div>
        <div className="max-h-[30rem] divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800">
          {frame.standings.map((standing) => (
            <RaceChartRow
              key={standing.user_id}
              maxPoints={maxPoints}
              standing={standing}
              onUserClick={onUserClick}
            />
          ))}
        </div>
      </div>
    </section>
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

  const handleUserClick = (userId: number, userName: string) => {
    setModalUserId(userId);
    setModalUserName(userName);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
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
    };

    void loadLeaderboard();

    return () => {
      isMounted = false;
    };
  }, []);

  const rows = leaderboard?.items ?? [];

  if (isLoading) {
    return (
      <>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-28 animate-pulse rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          ))}
        </section>
        <section className="h-96 animate-pulse rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800" />
      </>
    );
  }

  if (authRequired) {
    return (
      <section className="flex flex-col gap-3 rounded-md border border-amber-200 px-4 py-4 text-sm dark:text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-zinc-300 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Login required</h2>
          <p className="mt-1 text-sm">
            Log in to view tournament leaderboard and the racing charts.
          </p>
        </div>
        <Link
          href="/login"
          className="inline-flex h-10 items-center justify-center rounded-md bg-tournament-primary px-4 text-sm font-semibold text-white transition hover:bg-tournament-primary"
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

      {leaderboard ? <RaceChart frames={leaderboard.race_frames} onUserClick={handleUserClick} /> : null}

      {rows.length > 0 ? (
        <section className="overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-700">
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">Leaderboard Breakdown</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Showing {rows.length} of {leaderboard?.total ?? 0} ranked users
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-700">
              <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:bg-zinc-800/70 dark:text-zinc-400">
                <tr>
                  <th className="px-5 py-3 dark:text-zinc-400">Rank</th>
                  <th className="px-5 py-3 dark:text-zinc-400">User</th>
                  <th className="px-5 py-3 dark:text-zinc-400">Score</th>
                  <th className="px-5 py-3 dark:text-zinc-400">Goal Diff</th>
                  <th className="px-5 py-3 dark:text-zinc-400">Kick-off</th>
                  <th className="px-5 py-3 dark:text-zinc-400">Yello Card</th>
                  <th className="px-5 py-3 dark:text-zinc-400">Red Card</th>
                  <th className="px-5 py-3 dark:text-zinc-400">First Score In</th>
                  <th className="px-5 py-3 dark:text-zinc-400">First Score By</th>
                  <th className="px-5 py-3 dark:text-zinc-400">Duration</th>
                  <th className="px-5 py-3 text-right dark:text-zinc-400">Total Points</th>
                  <th className="px-5 py-3 text-right dark:text-zinc-400">Predicted Matches</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {rows.map((row) => (
                  <LeaderboardRow
                    key={row.user_id}
                    row={row}
                    completedMatches={leaderboard?.completed_matches || 0}
                    onUserClick={handleUserClick}
                  />
                ))}
              </tbody>
            </table>
          </div>
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
    </>
  );
};
