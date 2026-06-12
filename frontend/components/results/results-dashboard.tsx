"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { formatDateTime, getMatchLabelWithFlag } from "@/components/ui/match-card";
import { Modal } from "@/components/ui/modal";
import { StatusPill } from "@/components/ui/status-pill";
import { ApiError } from "@/lib/api";
import { DEFAULT_TIMEZONE } from "@/lib/api/config";
import {
  isAuthenticated,
  MissingAuthTokenError,
  SessionExpiredError,
} from "@/lib/auth";
import {
  getMatchPointsDetails,
  type MatchPointsDetailsResponse,
  type MatchUserPointsDetailsResponse,
} from "@/lib/leaderboard";
import {
  firstGoalInLabels,
  listMatchResults,
  matchDurationLabels,
  matchStageLabels,
  type MatchResponse,
} from "@/lib/matches";

type PointsKey =
  | "score_points"
  | "goal_difference_points"
  | "first_goal_in_points"
  | "first_scoring_team_points"
  | "yellow_card_points"
  | "red_card_points"
  | "kick_off_team_points"
  | "match_duration_points";

const pointGroups: {
  label: string;
  pointsKey: PointsKey;
  actual: (details: MatchPointsDetailsResponse) => string;
  predicted: (row: MatchUserPointsDetailsResponse) => string;
}[] = [
    {
      label: "Score",
      pointsKey: "score_points",
      actual: (details) => formatScore(details.team1_score, details.team2_score),
      predicted: (row) =>
        formatScore(row.predicted_team1_score, row.predicted_team2_score),
    },
    {
      label: "Goal Difference",
      pointsKey: "goal_difference_points",
      actual: (details) =>
        formatGoalDifference(details.team1_score, details.team2_score),
      predicted: (row) =>
        formatGoalDifference(row.predicted_team1_score, row.predicted_team2_score),
    },
    {
      label: "First Goal In",
      pointsKey: "first_goal_in_points",
      actual: (details) => formatFirstGoalIn(details.first_goal_in),
      predicted: (row) => formatFirstGoalIn(row.predicted_first_goal_in),
    },
    {
      label: "First Score By",
      pointsKey: "first_scoring_team_points",
      actual: (details) => details.first_scoring_team ?? "--",
      predicted: (row) => row.predicted_first_scoring_team ?? "--",
    },
    {
      label: "Yellow Card",
      pointsKey: "yellow_card_points",
      actual: (details) => formatNullableNumber(details.yellow_card_count),
      predicted: (row) => formatNullableNumber(row.predicted_yellow_card_count),
    },
    {
      label: "Red Card",
      pointsKey: "red_card_points",
      actual: (details) => formatNullableNumber(details.red_card_count),
      predicted: (row) => formatNullableNumber(row.predicted_red_card_count),
    },
    {
      label: "Kick-off",
      pointsKey: "kick_off_team_points",
      actual: (details) => details.kick_off_team ?? "--",
      predicted: (row) => row.predicted_kick_off_team ?? "--",
    },
    {
      label: "Duration",
      pointsKey: "match_duration_points",
      actual: (details) => formatMatchDuration(details.match_duration),
      predicted: (row) => formatMatchDuration(row.predicted_match_duration),
    },
  ];

const getLoadErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
};

const formatNullableNumber = (value: number | null | undefined): string => {
  return value === null || value === undefined ? "--" : String(value);
};

const formatScore = (
  team1Score: number | null | undefined,
  team2Score: number | null | undefined,
): string => {
  if (team1Score === null || team1Score === undefined) return "--";
  if (team2Score === null || team2Score === undefined) return "--";
  return `${team1Score} - ${team2Score}`;
};

const formatGoalDifference = (
  team1Score: number | null | undefined,
  team2Score: number | null | undefined,
): string => {
  if (team1Score === null || team1Score === undefined) return "--";
  if (team2Score === null || team2Score === undefined) return "--";
  return String(Math.abs(team1Score - team2Score));
};

const formatFirstGoalIn = (value: string | null | undefined): string => {
  if (!value || !(value in firstGoalInLabels)) return "--";
  return firstGoalInLabels[value as keyof typeof firstGoalInLabels];
};

const formatMatchDuration = (value: string | null | undefined): string => {
  if (!value || !(value in matchDurationLabels)) return "--";
  return matchDurationLabels[value as keyof typeof matchDurationLabels];
};

const formatGroupLabel = (group: string | null | undefined): string => {
  const normalizedGroup = group?.trim();
  if (!normalizedGroup) return "";
  if (/^group\s+/i.test(normalizedGroup)) return normalizedGroup;
  return `Group ${normalizedGroup}`;
};

const formatGroup = (match: MatchResponse): string => {
  if (match.match_stage !== "GROUP") {
    return matchStageLabels[match.match_stage];
  }

  const team1Group = formatGroupLabel(match.team1_group);
  const team2Group = formatGroupLabel(match.team2_group);

  if (!team1Group && !team2Group) return "--";
  if (team1Group === team2Group) return team1Group || "--";
  return [team1Group, team2Group].filter(Boolean).join(" / ");
};

const getTeamNameById = (match: MatchResponse, teamId: number | null): string | null => {
  if (teamId === match.team1_id) return match.team1_name;
  if (teamId === match.team2_id) return match.team2_name;
  return null;
};

const formatWinner = (match: MatchResponse): string => {
  return getTeamNameById(match, match.winner_id) ?? "DRAW";
};

const formatSignedNumber = (value: number): string => {
  return value > 0 ? `+${value}` : String(value);
};

const totalColor = (value: number): string => {
  if (value > 0) {
    return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  }
  if (value < 0) {
    return "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300";
  }
  return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
};

const PointsCell = ({ points }: { points: number }) => {
  return (
    <td className="whitespace-nowrap px-3 py-3 text-center">
      <span
        className={[
          "inline-flex h-8 min-w-11 items-center justify-center rounded-md px-2 text-sm font-bold",
          totalColor(points),
        ].join(" ")}
      >
        {formatSignedNumber(points)}
      </span>
    </td>
  );
};

const MatchPointsModal = ({
  details,
  error,
  isLoading,
  isOpen,
  match,
  onClose,
}: {
  details: MatchPointsDetailsResponse | null;
  error: string | null;
  isLoading: boolean;
  isOpen: boolean;
  match: MatchResponse | null;
  onClose: () => void;
}) => {
  const title = match
    ? `Points Breakdown - ${match.team1_name} vs ${match.team2_name}`
    : "Points Breakdown";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} isLarge>
      {isLoading ? (
        <div className="grid gap-3">
          <div className="h-16 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-12 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800"
            />
          ))}
        </div>
      ) : null}

      {!isLoading && error ? (
        <div className="flex flex-col gap-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <Link
            href="/login"
            className="inline-flex h-9 w-fit items-center rounded-md border border-amber-300 bg-white px-3 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 dark:border-amber-700 dark:bg-zinc-900 dark:text-amber-200 dark:hover:bg-zinc-800"
          >
            Login
          </Link>
        </div>
      ) : null}

      {!isLoading && details && !error ? (
        <>
          <div className="mb-4 grid gap-3 grid-cols-2 md:grid-cols-4">
            <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/50">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                FT Score
              </p>
              <p className="mt-1 text-2xl font-bold text-zinc-950 dark:text-zinc-50">
                {formatScore(details.team1_score, details.team2_score)}
              </p>
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/50">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                Winner
              </p>
              <p className="mt-1 text-2xl font-bold text-zinc-950 dark:text-zinc-50 truncate">
                {match ? formatWinner(match) : "--"}
              </p>
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/50">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                Match Day
              </p>
              <p className="mt-1 text-2xl font-bold text-zinc-950 dark:text-zinc-50">
                {details.match_day}
              </p>
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/50">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                Users
              </p>
              <p className="mt-1 text-2xl font-bold text-zinc-950 dark:text-zinc-50">
                {details.total}
              </p>
            </div>
          </div>

          <div className="overflow-auto max-h-[60vh] rounded-md border border-zinc-200 dark:border-zinc-700">
            <table className="min-w-max w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/70">
                  <th
                    rowSpan={2}
                    className={[
                      "static md:sticky left-0 top-0 z-40 w-10 min-w-[50px] max-w-[50px]",
                      "bg-zinc-100 dark:bg-zinc-900",
                      "border-b border-zinc-200 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:border-zinc-700 dark:text-zinc-500",
                    ].join(" ")}
                  >
                    S.N.
                  </th>
                  <th
                    rowSpan={2}
                    className={[
                      "static md:sticky left-[50px] top-0 z-40 w-[100px] min-w-[100px] max-w-[100px]",
                      "bg-zinc-100 dark:bg-zinc-900",
                      "border-b border-zinc-200 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:border-zinc-700 dark:text-zinc-500",
                    ].join(" ")}
                  >
                    User
                  </th>
                  <th
                    rowSpan={2}
                    className={[
                      "static md:sticky left-[150px] top-0 z-40 w-[80px] min-w-[80px] max-w-[80px]",
                      "bg-zinc-100 dark:bg-zinc-900",
                      "border-b border-zinc-200 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:border-zinc-700 dark:text-zinc-500",
                    ].join(" ")}
                  >
                    Total
                  </th>
                  {pointGroups.map((group) => (
                    <th
                      key={group.label}
                      colSpan={3}
                      className={[
                        "static md:sticky top-0 z-30",
                        "border-r border-zinc-200 bg-zinc-50 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider last:border-r-0 dark:border-zinc-700 dark:bg-zinc-800/70",
                      ].join(" ")}
                    >
                      {group.label}
                    </th>
                  ))}
                </tr>
                <tr className="border-b border-zinc-200 bg-zinc-50/70 dark:border-zinc-700 dark:bg-zinc-800">
                  {pointGroups.map((group) =>
                    (["Actual", "Predicted", "Pts"] as const).map((sub) => (
                      <th
                        key={`${group.label}-${sub}`}
                        className={[
                          "static md:sticky top-8 z-30",
                          "bg-zinc-50 px-3 py-1.5 text-center text-[11px] font-medium tracking-wide text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500",
                          sub === "Pts" ? "border-r border-zinc-200 dark:border-zinc-700" : "",
                        ].join(" ")}
                      >
                        {sub}
                      </th>
                    )),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                {details.items.map((row, index) => (
                  <tr
                    key={row.user_id}
                    className="transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40"
                  >
                    <td
                      className={[
                        "static md:sticky left-0 z-20 w-10 min-w-[50px] max-w-[50px]",
                        "bg-white dark:bg-zinc-950",
                        "border-b border-zinc-200 px-3 py-3 text-center text-zinc-700 dark:border-zinc-800 dark:text-zinc-300",
                      ].join(" ")}
                    >
                      {index + 1}
                    </td>
                    <td
                      className={[
                        "static md:sticky left-[50px] z-20 w-[100px] min-w-[100px] max-w-[100px]",
                        "bg-white dark:bg-zinc-950",
                        "border-b border-zinc-200 px-3 py-3 font-medium text-zinc-950 dark:border-zinc-800 dark:text-zinc-50 truncate",
                      ].join(" ")}
                    >
                      <span className="block truncate">{row.user_name}</span>
                    </td>
                    <td
                      className={[
                        "static md:sticky left-[150px] z-20 w-[80px] min-w-[80px] max-w-[80px]",
                        "bg-white dark:bg-zinc-950",
                        "border-b border-zinc-200 px-3 py-3 text-center dark:border-zinc-800",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "inline-flex h-8 min-w-11 items-center justify-center rounded-md px-2 text-sm font-bold",
                          totalColor(row.total_points),
                        ].join(" ")}
                      >
                        {formatSignedNumber(row.total_points)}
                      </span>
                    </td>
                    {pointGroups.map((group) => (
                      <FragmentGroup
                        key={`${row.user_id}-${group.label}`}
                        actual={group.actual(details)}
                        points={row[group.pointsKey]}
                        predicted={group.predicted(row)}
                      />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </Modal>
  );
};

const FragmentGroup = ({
  actual,
  points,
  predicted,
}: {
  actual: string;
  points: number;
  predicted: string;
}) => {
  return (
    <>
      <td className="whitespace-nowrap px-3 py-3 text-center text-zinc-600 dark:text-zinc-300">
        {actual}
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-center text-zinc-900 dark:text-zinc-100">
        {predicted}
      </td>
      <PointsCell points={points} />
    </>
  );
};

export const ResultsDashboard = () => {
  const [matches, setMatches] = useState<MatchResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<MatchResponse | null>(null);
  const [details, setDetails] = useState<MatchPointsDetailsResponse | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadResults = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await listMatchResults({ limit: 500 });
        if (isMounted) {
          setMatches(response.items);
        }
      } catch (error) {
        if (isMounted) {
          setLoadError(
            getLoadErrorMessage(error, "Unable to load match results."),
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadResults();

    return () => {
      isMounted = false;
    };
  }, []);

  const rows = useMemo(() => {
    return [...matches].sort((a, b) => {
      const aTime = new Date(`${a.match_datetime}Z`).getTime();
      const bTime = new Date(`${b.match_datetime}Z`).getTime();
      return bTime - aTime || b.id - a.id;
    });
  }, [matches]);

  const openMatchDetails = async (match: MatchResponse) => {
    setSelectedMatch(match);
    setIsModalOpen(true);
    setDetails(null);
    setDetailError(null);

    if (!isAuthenticated()) {
      setDetailError("Please log in to view the points breakdown.");
      return;
    }

    setIsDetailLoading(true);
    try {
      const response = await getMatchPointsDetails(match.id);
      setDetails(response);
    } catch (error) {
      if (
        error instanceof SessionExpiredError ||
        error instanceof MissingAuthTokenError ||
        (error instanceof ApiError && error.status === 401)
      ) {
        setDetailError("Your session has expired. Please login again.");
      } else {
        setDetailError(
          getLoadErrorMessage(error, "Unable to load points breakdown."),
        );
      }
    } finally {
      setIsDetailLoading(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  if (isLoading) {
    return (
      <section className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <div className="mb-4 h-10 w-48 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
        <div className="grid gap-3">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-14 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800"
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex justify-between gap-2 border-b border-zinc-200 px-5 py-4 dark:border-zinc-700">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">Completed Matches</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {/* Showing {rows.length} of {leaderboard?.total ?? 0} ranked users */}
            </p>
          </div>
          <StatusPill tone="green">{rows.length} played</StatusPill>
        </div>

        {loadError ? (
          <div
            className="m-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400"
            role="alert"
          >
            {loadError}
          </div>
        ) : null}

        {!loadError && rows.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              No results yet
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              Completed match results will appear here.
            </p>
          </div>
        ) : null}

        {!loadError && rows.length > 0 ? (
          <div className="overflow-auto max-h-[42rem]">
            <table className="min-w-max w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-700">
              <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                <tr>
                  <th
                    className={[
                      "static md:sticky left-0 top-0 z-40 w-8 min-w-[50px] max-w-[50px]",
                      "bg-zinc-100 dark:bg-zinc-900",
                      "border-b border-zinc-200 px-3 py-3 text-center dark:border-zinc-700",
                    ].join(" ")}
                  >
                    S.N.
                  </th>
                  <th
                    className={[
                      "static md:sticky left-[50px] top-0 z-40 w-[100px] min-w-[100px] max-w-[100px]",
                      "bg-zinc-100 dark:bg-zinc-900",
                      "border-b border-zinc-200 px-3 py-3 text-center dark:border-zinc-700",
                    ].join(" ")}
                  >
                    Match
                  </th>
                  {[
                    "Group",
                    "Score",
                    "Goal Diff",
                    "1st Goal In",
                    "1st Score By",
                    "Y Card",
                    "R Card",
                    "Kick-off",
                    "Duration",
                    "Winner",
                    "Played On",
                  ].map((header) => (
                    <th
                      key={header}
                      className={[
                        "static md:sticky top-0 z-30",
                        "bg-zinc-100 px-3 py-3 dark:bg-zinc-700",
                        "border-b border-zinc-200 dark:border-zinc-700",
                        ["Group", "Score", "Goal Diff", "Y Card", "R Card", "Kick-off", "Duration", "Winner"].includes(header) ? "min-w-[90px]" : "min-w-[120px]",
                      ].join(" ")}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {rows.map((match, index) => (
                  <tr
                    key={match.id}
                    role="button"
                    tabIndex={0}
                    className="cursor-pointer transition-colors hover:bg-zinc-50/80 focus:bg-zinc-50/80 focus:outline-none dark:hover:bg-zinc-800/50 dark:focus:bg-zinc-800/50"
                    onClick={() => void openMatchDetails(match)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        void openMatchDetails(match);
                      }
                    }}
                  >
                    <td
                      className={[
                        "static md:sticky left-0 z-20 w-10 min-w-[50px] max-w-[50px]",
                        "bg-white dark:bg-zinc-950",
                        "border-b border-zinc-200 px-3 py-4 text-center text-zinc-700 dark:border-zinc-800 dark:text-zinc-300",
                      ].join(" ")}
                    >
                      {index + 1}
                    </td>
                    <td className={[
                      "static md:sticky left-[50px] z-20 w-[100px] min-w-[100px] max-w-[100px]",
                      "bg-white dark:bg-zinc-950",
                      "border-b border-zinc-200 dark:border-zinc-800",
                      "pl-2 pr-3 py-4 font-medium text-zinc-950 dark:text-zinc-50",
                    ].join(" ")}>
                      {<div className="flex justify-center text-indigo-500 hover:text-indigo-600"><p className="text-sm font-semibold mr-1">{match.team1_name_short}</p>vs
                        <p className="text-sm font-semibold ml-1">{match.team2_name_short}</p></div>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-zinc-700 dark:text-zinc-300">
                      {formatGroup(match)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 font-semibold text-zinc-950 dark:text-zinc-50">
                      {formatScore(match.team1_score, match.team2_score)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-zinc-700 dark:text-zinc-300">
                      {formatGoalDifference(match.team1_score, match.team2_score)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-zinc-700 dark:text-zinc-300">
                      {formatFirstGoalIn(match.first_goal_in)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-zinc-700 dark:text-zinc-300">
                      {getTeamNameById(match, match.first_scoring_team_id) ?? "--"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-zinc-700 dark:text-zinc-300">
                      {formatNullableNumber(match.yellow_card_count)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-zinc-700 dark:text-zinc-300">
                      {formatNullableNumber(match.red_card_count)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-zinc-700 dark:text-zinc-300">
                      {getTeamNameById(match, match.kick_off_team_id) ?? "--"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-zinc-700 dark:text-zinc-300">
                      {formatMatchDuration(match.match_duration)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-zinc-700 dark:text-zinc-300">
                      {formatWinner(match)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-zinc-700 dark:text-zinc-300">
                      {formatDateTime(match.match_datetime)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <MatchPointsModal
        details={details}
        error={detailError}
        isLoading={isDetailLoading}
        isOpen={isModalOpen}
        match={selectedMatch}
        onClose={closeModal}
      />
    </>
  );
};
