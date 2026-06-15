"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { Modal } from "@/components/ui/modal";
import { StatusPill } from "@/components/ui/status-pill";
import { ToastViewport, useToast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { getErrorMessage } from "@/lib/forms/error-message";
import {
  createMatch,
  deleteMatch,
  firstGoalInLabels,
  firstGoalIns,
  getAdminMatch,
  listAdminMatches,
  matchDurationLabels,
  matchDurations,
  matchStageLabels,
  matchStages,
  updateMatch,
} from "@/lib/matches";
import type { MatchCreate, MatchDuration, MatchResponse } from "@/lib/matches";
import { listAdminTeams } from "@/lib/teams";
import type { TeamResponse } from "@/lib/teams";
import { formatDateTime, getTeam1WithFlag, getTeam2WithFlag, getVs } from "@/components/ui/match-card";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { IconCancel, IconHighlight, IconPencil, IconPlus, IconSave, IconSearch, IconTrash, IconX } from "@/components/ui/icons";
import { Pagination } from "@/components/ui/pagination";
import { FirstGoalIn } from "@/lib/matches/types";
import { DEFAULT_TIMEZONE } from "@/lib/api/config";
import Link from "next/link";

type MatchFormState = {
  firstScoringTeamId: string;
  matchDuration: string;
  firstGoalIn: string;
  matchDatetime: string;
  matchDay: string;
  matchLocked: boolean;
  matchReminderSent: boolean;
  matchStage: string;
  kickoffTeamId: string;
  redCardCount: string;
  team1Id: string;
  team1Score: string;
  team2Id: string;
  team2Score: string;
  venueName: string;
  winnerId: string;
  yellowCardCount: string;
};

const emptyFormState: MatchFormState = {
  firstScoringTeamId: "",
  matchDuration: "",
  firstGoalIn: "",
  matchDatetime: "",
  matchDay: "",
  matchLocked: false,
  matchReminderSent: false,
  matchStage: "",
  kickoffTeamId: "",
  redCardCount: "",
  team1Id: "",
  team1Score: "",
  team2Id: "",
  team2Score: "",
  venueName: "",
  winnerId: "",
  yellowCardCount: "",
};

const convertTimeZone = (isoString: string, fromZone: string, toZone: string) => {
  if (!isoString) return "";
  const formatterFrom = new Intl.DateTimeFormat('en-US', {
    timeZone: fromZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
  const date = new Date(isoString + 'Z');
  const parts = formatterFrom.formatToParts(date);
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  const utcFrom = Date.UTC(Number(map.year), Number(map.month) - 1, Number(map.day), Number(map.hour), Number(map.minute), Number(map.second));
  const correctedDate = new Date(date.getTime() + (date.getTime() - utcFrom));
  const formatterTo = new Intl.DateTimeFormat('sv-SE', {
    timeZone: toZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
  return formatterTo.format(correctedDate).replace(' ', 'T');
}

const formatScore = (match: MatchResponse): string => {
  if (!match.match_locked || !match.winner_id && (match.team1_score === null || match.team2_score === null)) return "—";
  return `${match.team1_score} - ${match.team2_score}`;
};

const getMatchStatus = (match: MatchResponse): "Open" | "Locked" => {
  return match.match_locked ? "Locked" : "Open";
};

const getTeamNameById = (teams: TeamResponse[], teamId: number | null | undefined): string => {
  if (!teamId) return "—";
  return teams.find((team) => team.id === teamId)?.name ?? `Team #${teamId}`;
};

const getWinnerLabel = (match: MatchResponse, teams: TeamResponse[]): string => {
  if (!match.match_locked) return "—";
  if (match.winner_id !== null) return getTeamNameById(teams, match.winner_id);
  if (match.team1_score !== null && match.team2_score !== null && match.team1_score == match.team2_score) return "DRAW";
  return "—";
};

const getMatchLabelText = (match: MatchResponse): string => `${match.team1_name} vs ${match.team2_name}`;

const toDateTimeInputValue = (value: string): string => value ? value.slice(0, 16) : "";

const toFormState = (match: MatchResponse): MatchFormState => ({
  firstScoringTeamId: match.first_scoring_team_id === null ? "" : String(match.first_scoring_team_id),
  firstGoalIn: match.first_goal_in ?? "",
  matchDuration: match.match_duration ?? "",
  matchDatetime: toDateTimeInputValue(match.match_datetime),
  matchDay: String(match.match_day),
  matchLocked: match.match_locked,
  matchReminderSent: match.match_reminder_sent,
  matchStage: match.match_stage ?? "",
  kickoffTeamId: match.kick_off_team_id === null ? "" : String(match.kick_off_team_id),
  redCardCount: match.red_card_count === null ? "" : String(match.red_card_count),
  team1Id: String(match.team1_id),
  team1Score: match.team1_score === null ? "" : String(match.team1_score),
  team2Id: String(match.team2_id),
  team2Score: match.team2_score === null ? "" : String(match.team2_score),
  venueName: match.venue_name ?? "",
  winnerId: match.winner_id === null ? "" : String(match.winner_id),
  yellowCardCount: match.yellow_card_count === null ? "" : String(match.yellow_card_count),
});

const parseRequiredInteger = (value: string, label: string): number => {
  const parsedValue = Number(value);
  if (!Number.isInteger(parsedValue) || parsedValue <= 0) throw new Error(`${label} is required.`);
  return parsedValue;
};

const parseOptionalNonNegativeInteger = (value: string, label: string): number | null => {
  const normalizedValue = value.trim();
  if (!normalizedValue) return null;
  const parsedValue = Number(normalizedValue);
  if (!Number.isInteger(parsedValue) || parsedValue < 0) throw new Error(`${label} must be zero or greater.`);
  return parsedValue;
};

const parseOptionalPositiveInteger = (value: string): number | null => {
  return value ? parseRequiredInteger(value, "Team") : null;
};

const isFirstGoalIn = (value: string): value is FirstGoalIn => firstGoalIns.includes(value as FirstGoalIn);
const isMatchDuration = (value: string): value is MatchDuration => matchDurations.includes(value as MatchDuration);

const hasGoals = (state: Pick<MatchFormState, "team1Score" | "team2Score">): boolean => {
  const team1Score = Number(state.team1Score);
  const team2Score = Number(state.team2Score);
  return (Number.isFinite(team1Score) && team1Score > 0) || (Number.isFinite(team2Score) && team2Score > 0);
};

const buildMatchPayload = (state: MatchFormState): MatchCreate => {
  const team1Id = parseRequiredInteger(state.team1Id, "Team 1");
  const team2Id = parseRequiredInteger(state.team2Id, "Team 2");
  if (team1Id === team2Id) throw new Error("Team 1 and Team 2 must be different.");
  const team1Score = parseOptionalNonNegativeInteger(state.team1Score, "Team 1 score");
  const team2Score = parseOptionalNonNegativeInteger(state.team2Score, "Team 2 score");
  const matchHasGoals = (team1Score ?? 0) > 0 || (team2Score ?? 0) > 0;
  if (!state.matchDatetime) throw new Error("Kickoff time is required.");

  return {
    first_goal_in: matchHasGoals && isFirstGoalIn(state.firstGoalIn) ? state.firstGoalIn : null,
    first_scoring_team_id: matchHasGoals ? parseRequiredInteger(state.firstScoringTeamId, "First Scored by") : null,
    match_duration: isMatchDuration(state.matchDuration) ? state.matchDuration : null,
    match_datetime: state.matchDatetime,
    match_day: parseRequiredInteger(state.matchDay, "Match Day"),
    match_locked: state.matchLocked,
    match_reminder_sent: state.matchReminderSent,
    match_stage: state.matchStage,
    kick_off_team_id: parseOptionalPositiveInteger(state.kickoffTeamId),
    red_card_count: state.matchLocked ? parseOptionalNonNegativeInteger(state.redCardCount || "0", "Red cards") : parseOptionalNonNegativeInteger(state.redCardCount, "Red cards"),
    team1_id: team1Id,
    winner_id: parseOptionalPositiveInteger(state.winnerId),
    team1_score: team1Score,
    team2_id: team2Id,
    team2_score: team2Score,
    venue_name: state.venueName.trim() || null,
    yellow_card_count: state.matchLocked ? parseOptionalNonNegativeInteger(state.yellowCardCount || "0", "Yellow cards") : parseOptionalNonNegativeInteger(state.yellowCardCount, "Yellow cards"),
  };
};

const PAGE_SIZE = 20;

const inputCls = "mt-2 h-11 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none transition focus:border-tournament-primary focus:ring-2 focus:ring-emerald-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:ring-emerald-900";
const selectCls = "mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-tournament-primary focus:ring-2 focus:ring-emerald-100 disabled:bg-zinc-100 disabled:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-500 dark:focus:ring-emerald-900";
const labelCls = "text-sm font-medium text-zinc-700 dark:text-zinc-300";

const AdminMatchesPage = () => {
  const { dismissToast, showToast, toasts } = useToast();

  const [editingMatchId, setEditingMatchId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formState, setFormState] = useState<MatchFormState>(emptyFormState);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [openingEditMatchId, setOpeningEditMatchId] = useState<number | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MatchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [matches, setMatches] = useState<MatchResponse[]>([]);
  const [teams, setTeams] = useState<TeamResponse[]>([]);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedTeams = useMemo(
    () =>
      [formState.team1Id, formState.team2Id]
        .map((teamId) => teams.find((team) => team.id === Number(teamId)))
        .filter((team): team is TeamResponse => Boolean(team)),
    [formState.team1Id, formState.team2Id, teams],
  );

  const matchHasGoals = hasGoals(formState);

  useEffect(() => {
    let isMounted = true;

    const loadInitialPageData = async () => {
      setIsLoading(true);

      try {
        const [matchList, teamList] = await Promise.all([
          listAdminMatches({ limit: 500 }),
          listAdminTeams({ limit: 100 }),
        ]);
        if (isMounted) {
          setMatches(matchList.items);
          setTeams(teamList.items);
        }
      } catch (error) {
        if (isMounted) {
          showToast({ tone: "error", message: getErrorMessage(error, "Unable to load matches.") });
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void loadInitialPageData();
    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshMatches = async () => {
    const matchList = await listAdminMatches({ limit: 500 });
    setMatches(matchList.items);
  };

  const filteredMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return matches;
    return matches.filter((m) =>
      m.team1_name.toLowerCase().includes(q) ||
      m.team2_name.toLowerCase().includes(q) ||
      formatDateTime(m.match_datetime).toLowerCase().includes(q) ||
      (m.match_locked ? "locked" : "open").includes(q)
    );
  }, [matches, searchQuery]);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  const updateField = (field: keyof MatchFormState, value: string | boolean) => {
    if (['matchDay', 'team1Score', 'team2Score', 'redCardCount', 'yellowCardCount'].includes(field)) {
      value = Number(value).toString();
    }

    setFormState((current) => {
      const nextState = { ...current, [field]: value };
      const validTeamIds = new Set([nextState.team1Id, nextState.team2Id]);
      if (field === "matchDatetime") {
        nextState.matchDatetime = convertTimeZone(value as string, DEFAULT_TIMEZONE, 'UTC');
      }
      if (!validTeamIds.has(nextState.kickoffTeamId)) nextState.kickoffTeamId = "";
      if (!validTeamIds.has(nextState.winnerId)) nextState.winnerId = "";
      if (!isFirstGoalIn(nextState.firstGoalIn) || ((field === "team1Score" || field === "team2Score") && !hasGoals(nextState))) {
        nextState.firstGoalIn = "";
      }
      if (!validTeamIds.has(nextState.firstScoringTeamId) || ((field === "team1Score" || field === "team2Score") && !hasGoals(nextState))) {
        nextState.firstScoringTeamId = "";
      }
      return nextState;
    });
  };

  const startNewMatch = () => {
    setEditingMatchId(null);
    setFormState(emptyFormState);
    setFormError(null);
    setIsModalOpen(true);
  };

  const startEditingMatch = async (match: MatchResponse) => {
    setFormError(null);
    setOpeningEditMatchId(match.id);

    try {
      const freshMatch = await getAdminMatch(match.id);
      setMatches((currentMatches) =>
        currentMatches.map((currentMatch) =>
          currentMatch.id === freshMatch.id ? freshMatch : currentMatch,
        ),
      );
      setEditingMatchId(freshMatch.id);
      setFormState(toFormState(freshMatch));
      setIsModalOpen(true);
    } catch (error) {
      showToast({ tone: "error", message: getErrorMessage(error, "Unable to load the latest match details.") });
    } finally {
      setOpeningEditMatchId(null);
    }
  };

  const handleCloseModal = () => setIsModalOpen(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const team1Score = Number(formState.team1Score);
      const team2Score = Number(formState.team2Score);
      const winnerId =
        team1Score > team2Score ? formState.team1Id
          : team2Score > team1Score ? formState.team2Id
            : "";
      const isEditing = editingMatchId !== null;
      const payload = buildMatchPayload({ ...formState, winnerId });
      const savedMatch = editingMatchId
        ? await updateMatch(editingMatchId, payload)
        : await createMatch(payload);

      if (isEditing) {
        await refreshMatches();
      } else {
        setMatches((currentMatches) =>
          [...currentMatches, savedMatch].sort(
            (a, b) => new Date(a.match_datetime).getTime() - new Date(b.match_datetime).getTime() || a.id - b.id,
          ),
        );
      }
      setEditingMatchId(savedMatch.id);
      setFormState(toFormState(savedMatch));
      setIsModalOpen(false);
      showToast({
        tone: "success",
        title: isEditing ? "Match updated" : "Match created",
        message: `${savedMatch.team1_name} vs ${savedMatch.team2_name} has been ${isEditing ? "updated" : "created"}.`,
      });
    } catch (error) {
      setFormError(getErrorMessage(error, "Unable to save match."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (match: MatchResponse) => setDeleteTarget(match);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const match = deleteTarget;
    setDeleteTarget(null);
    setIsDeletingId(match.id);
    setFormError(null);
    try {
      await deleteMatch(match.id);
      setMatches((currentMatches) => currentMatches.filter((m) => m.id !== match.id));
      showToast({
        tone: "success",
        title: "Match deleted",
        message: `${match.team1_name} vs ${match.team2_name} has been deleted.`,
      });
    } catch (error) {
      showToast({ tone: "error", message: getErrorMessage(error, "Unable to delete match.") });
    } finally {
      setIsDeletingId(null);
    }
  };

  const pagedMatches = filteredMatches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const isSearchActive = searchQuery.trim().length > 0;

  return (
    <>
      <ToastViewport onDismiss={dismissToast} toasts={toasts} />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <section className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-zinc-950 dark:text-zinc-50">Tournament Matches</h2></div>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-md bg-tournament-primary px-4 text-sm font-semibold text-white transition cursor-pointer hover:bg-tournament-primary"
            type="button"
            onClick={startNewMatch}
          >
            <IconPlus className="h-4 w-4" />
            New Match
          </button>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 items-center justify-between">
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-zinc-400 dark:text-zinc-500">
              <IconSearch className="h-4 w-4" />
            </span>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by team, time, status..."
              className="h-10 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-9 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-tournament-primary focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:ring-emerald-900"
            />
            {isSearchActive && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => handleSearch("")}
                className="absolute inset-y-0 right-3 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                <IconX className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="pl-10">
            <Pagination page={page} pageSize={PAGE_SIZE} total={filteredMatches.length} onChange={setPage} />
          </div>
        </section>

        <section className="overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          {isSearchActive && (
            <div className="border-b border-zinc-100 px-5 py-2.5 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              {filteredMatches.length === 0
                ? `No matches match "${searchQuery}"`
                : `${filteredMatches.length} of ${matches.length} match${matches.length !== 1 ? "es" : ""} match "${searchQuery}"`}
            </div>
          )}
          <div className="overflow-auto max-h-[40rem]">
            <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-700">
              <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                <tr>
                  <th className={[
                    "static sm:sticky left-0 top-0 z-40 w-[50px] min-w-[50px] max-w-[50px] md:w-[64px] md:min-w-[64px] md:max-w-[64px]",
                    "bg-zinc-100 dark:bg-zinc-800",
                    "border-b border-zinc-200 dark:border-zinc-700",
                    "pl-5 pr-3 py-3"
                  ].join(" ")}>S.N.</th>
                  <th className={[
                    "static sm:sticky left-[50px] top-0 z-40 w-[150px] min-w-[150px] max-w-[150px] md:left-[64px] md:w-[320px] md:min-w-[320px] md:max-w-[320px]",
                    "bg-zinc-100 dark:bg-zinc-800",
                    "text-center font-semibold text-sm",
                    "border-b border-zinc-200 dark:border-zinc-700",
                    "px-3 py-3"
                  ].join(" ")} colSpan={3}>Match</th>
                  <th className={[
                    "static sm:sticky top-0 z-30",
                    "bg-zinc-100 dark:bg-zinc-700",
                    "px-3 py-3 border-b border-zinc-200 dark:border-zinc-700"
                  ].join(" ")}>Day</th>
                  <th className={[
                    "static sm:sticky top-0 z-30",
                    "bg-zinc-100 dark:bg-zinc-700",
                    "px-3 py-3 border-b border-zinc-200 dark:border-zinc-700"
                  ].join(" ")}>Highlights</th>
                  <th className={[
                    "static sm:sticky top-0 z-30",
                    "bg-zinc-100 dark:bg-zinc-700",
                    "px-3 py-3 border-b border-zinc-200 dark:border-zinc-700 min-w-[140px]"
                  ].join(" ")}>Time</th>
                  <th className={[
                    "static sm:sticky top-0 z-30",
                    "bg-zinc-100 dark:bg-zinc-700",
                    "px-3 py-3 border-b border-zinc-200 dark:border-zinc-700"
                  ].join(" ")}>Score</th>
                  <th className={[
                    "static sm:sticky top-0 z-30",
                    "bg-zinc-100 dark:bg-zinc-700",
                    "px-3 py-3 border-b border-zinc-200 dark:border-zinc-700 min-w-[150px]"
                  ].join(" ")}>Winner</th>
                  <th className={[
                    "static sm:sticky top-0 z-30",
                    "bg-zinc-100 dark:bg-zinc-700",
                    "px-3 py-3 border-b border-zinc-200 dark:border-zinc-700 min-w-[150px]"
                  ].join(" ")}>Kickoff Team</th>
                  <th className={[
                    "static sm:sticky top-0 z-30",
                    "bg-zinc-100 dark:bg-zinc-700",
                    "px-3 py-3 border-b border-zinc-200 dark:border-zinc-700 min-w-[140px]"
                  ].join(" ")}>First Goal in</th>
                  <th className={[
                    "static sm:sticky top-0 z-30",
                    "bg-zinc-100 dark:bg-zinc-700",
                    "px-3 py-3 border-b border-zinc-200 dark:border-zinc-700 min-w-[145px]"
                  ].join(" ")}>First Score by</th>
                  <th className={[
                    "static sm:sticky top-0 z-30",
                    "bg-zinc-100 dark:bg-zinc-700",
                    "px-3 py-3 border-b border-zinc-200 dark:border-zinc-700 min-w-[100px]"
                  ].join(" ")}>Duration</th>
                  <th className={[
                    "static sm:sticky top-0 z-30",
                    "bg-zinc-100 dark:bg-zinc-700",
                    "px-3 py-3 border-b border-zinc-200 dark:border-zinc-700"
                  ].join(" ")}>Status</th>
                  <th className={[
                    "static sm:sticky top-0 z-30",
                    "bg-zinc-100 dark:bg-zinc-700",
                    "px-3 py-3 border-b border-zinc-200 dark:border-zinc-700 text-right"
                  ].join(" ")}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {isLoading ? (
                  <tr>
                    <td className="px-5 py-8 text-center text-zinc-500 dark:text-zinc-400" colSpan={14}>Loading matches…</td>
                  </tr>
                ) : pagedMatches.length > 0 ? (
                  pagedMatches.map((match, idx) => (
                    <tr key={match.id} className="transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40">
                      <td className={[
                        "static sm:sticky left-0 z-20 w-[50px] min-w-[50px] max-w-[50px] md:w-[64px] md:min-w-[64px] md:max-w-[64px]",
                        "bg-white dark:bg-zinc-950",
                        "border-b border-zinc-200 dark:border-zinc-800",
                        "pl-5 pr-3 py-3 text-left text-zinc-700 dark:text-zinc-300"
                      ].join(" ")}>{idx + 1}</td>
                      <td className={[
                        "static md:sticky left-[64px] z-20 w-32 min-w-[128px] max-w-[128px]",
                        "bg-white dark:bg-zinc-950",
                        "border-b border-zinc-200 dark:border-zinc-800",
                        "pl-3 pr-0 py-3 font-medium text-zinc-950 dark:text-zinc-50",
                        "hidden md:table-cell"
                      ].join(" ")}>{getTeam1WithFlag(match, "sm")}</td>
                      <td className={[
                        "static sm:sticky left-[50px] z-20 w-[75px] min-w-[75px] max-w-[75px]",
                        "bg-white dark:bg-zinc-950",
                        "border-b border-zinc-200 dark:border-zinc-800",
                        "px-1 py-3 font-medium text-zinc-950 dark:text-zinc-50 text-center",
                        "table-cell md:hidden"
                      ].join(" ")}><p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{match.team1_name_short}</p></td>
                      <td className={[
                        "static sm:sticky left-[125px] md:left-[192px] z-20 w-[25px] min-w-[25px] max-w-[25px] md:w-[64px] md:min-w-[64px] md:max-w-[64px]",
                        "bg-white dark:bg-zinc-950",
                        "border-b border-zinc-200 dark:border-zinc-800",
                        "px-0 md:px-3 py-3 text-center font-medium text-zinc-950 dark:text-zinc-50"
                      ].join(" ")}>{getVs("sm")}</td>
                      <td className={[
                        "static md:sticky md:left-[256px] z-20 w-32 min-w-[128px] max-w-[128px]",
                        "bg-white dark:bg-zinc-950",
                        "border-b border-zinc-200 dark:border-zinc-800",
                        "pl-0 pr-3 py-3 font-medium text-zinc-950 dark:text-zinc-50",
                        "hidden md:table-cell"
                      ].join(" ")}>{getTeam2WithFlag(match, "sm")}</td>
                      <td className={[
                        "static sm:sticky left-[150px] z-[50px] w-[75px] min-w-[75px] max-w-[75px]",
                        "bg-white dark:bg-zinc-950",
                        "border-b border-zinc-200 dark:border-zinc-800",
                        "px-1 py-3 font-medium text-zinc-950 dark:text-zinc-50 text-center",
                        "table-cell md:hidden"
                      ].join(" ")}><p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{match.team2_name_short}</p></td>
                      <td className="px-3 py-3 text-zinc-700 dark:text-zinc-300">{match.match_day}</td>
                      <td className="px-3 py-3 text-zinc-700 dark:text-zinc-300 whitespace-nowrap px-3 py-4 text-center">
                        {match.highlights_url ? (
                          <Tooltip content="Watch match highlights">
                            <Link
                              href={match.highlights_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Watch highlights for ${match.team1_name} vs ${match.team2_name}`}
                              onClick={(event) => event.stopPropagation()}
                              onKeyDown={(event) => event.stopPropagation()}
                              className={[
                                "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition",
                                "bg-gray-200 dark:bg-blue-700",
                                "ring-1 ring-inset ring-gray-200 dark:ring-gray-500",
                                "hover:bg-gray-300 dark:hover:bg-blue-600",
                                "text-blue-600 hover:text-blue-700 dark:text-blue-300 "
                              ].join(" ")}
                            >
                              <IconHighlight className="h-4 w-4" />
                            </Link>
                          </Tooltip>
                        ) : (
                          <span className="text-zinc-300 dark:text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-zinc-700 dark:text-zinc-300">{formatDateTime(match.match_datetime)}</td>
                      <td className="px-3 py-3 text-zinc-700 dark:text-zinc-300">{formatScore(match)}</td>
                      <td className="px-3 py-3 text-zinc-700 dark:text-zinc-300">{getWinnerLabel(match, teams)}</td>
                      <td className="px-3 py-3 text-zinc-700 dark:text-zinc-300">{getTeamNameById(teams, match.kick_off_team_id) || "—"}</td>
                      <td className="px-3 py-3 text-zinc-700 dark:text-zinc-300">{match.first_goal_in ? firstGoalInLabels[match.first_goal_in as FirstGoalIn] : "—"}</td>
                      <td className="px-3 py-3 text-zinc-700 dark:text-zinc-300">{getTeamNameById(teams, match.first_scoring_team_id) || "—"}</td>
                      <td className="px-3 py-3 text-zinc-700 dark:text-zinc-300">{match.match_duration ? matchDurationLabels[match.match_duration as MatchDuration] : "—"}</td>
                      <td className="px-3 py-3">
                        <StatusPill tone={match.match_locked ? "accent" : "secondary"}>{getMatchStatus(match)}</StatusPill>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Tooltip content="Edit">
                            <button aria-label="Edit" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-emerald-700 hover:bg-emerald-50 cursor-pointer transition disabled:cursor-not-allowed disabled:opacity-40 dark:text-emerald-400 dark:hover:bg-emerald-950" disabled={openingEditMatchId !== null} type="button" onClick={() => void startEditingMatch(match)}>
                              <IconPencil className="h-4 w-4" />
                              <span className="sr-only">Edit</span>
                            </button>
                          </Tooltip>
                          <Tooltip content="Delete">
                            <button aria-label="Delete" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-rose-700 hover:bg-rose-50 cursor-pointer transition disabled:opacity-40 dark:text-rose-400 dark:hover:bg-rose-950" disabled={isDeletingId === match.id} type="button" onClick={() => handleDeleteClick(match)}>
                              <IconTrash className="h-4 w-4" />
                              <span className="sr-only">Delete</span>
                            </button>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-5 py-8 text-center text-zinc-500 dark:text-zinc-400" colSpan={14}>
                      {isSearchActive ? `No matches match "${searchQuery}".` : "No matches found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <Pagination page={page} pageSize={PAGE_SIZE} total={filteredMatches.length} onChange={setPage} />

        <ConfirmModal
          isOpen={deleteTarget !== null}
          title="Delete Match"
          message={deleteTarget ? `Are you sure you want to delete ${getMatchLabelText(deleteTarget)}? This action cannot be undone.` : ""}
          confirmLabel="Delete"
          isDangerous
          onConfirm={() => void handleDeleteConfirm()}
          onCancel={() => setDeleteTarget(null)}
        />

        <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingMatchId ? "Edit Match" : "New Match"}>
          <form className="flex flex-col gap-4" onSubmit={(e) => void handleSubmit(e)}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Schedule and result details.</p>
              <StatusPill tone={formState.matchLocked ? "accent" : "secondary"}>
                {formState.matchLocked ? "Locked" : "Open"}
              </StatusPill>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={labelCls}><p>Team 1</p></span>
                <select name="team1_id" required value={formState.team1Id} onChange={(event) => updateField("team1Id", event.target.value)} className={selectCls}>
                  <option value="">Select team</option>
                  {teams.map((team) => (<option key={team.id} value={team.id}>{team.name}</option>))}
                </select>
              </label>
              <label className="block">
                <span className={labelCls}><p>Team 2</p></span>
                <select name="team2_id" required value={formState.team2Id} onChange={(event) => updateField("team2Id", event.target.value)} className={selectCls}>
                  <option value="">Select team</option>
                  {teams.map((team) => (<option key={team.id} value={team.id}>{team.name}</option>))}
                </select>
              </label>
              <label className="block">
                <span className={labelCls}><p>Kickoff (Local Time)</p></span>
                <input name="match_datetime" required type="datetime-local" value={convertTimeZone(formState.matchDatetime, 'UTC', DEFAULT_TIMEZONE)} onChange={(event) => updateField("matchDatetime", event.target.value)} className={inputCls} />
              </label>
              <label className="block">
                <span className={labelCls}><p>Match day</p></span>
                <input min="1" name="match_day" required type="number" value={formState.matchDay} onChange={(event) => updateField("matchDay", event.target.value)} className={inputCls} />
              </label>
              <label className="block sm:col-span-1">
                <span className={labelCls}><p>Venue</p></span>
                <input name="venue_name" type="text" value={formState.venueName} onChange={(event) => updateField("venueName", event.target.value)} className={inputCls} />
              </label>
              <label className="block">
                <span className={labelCls}><p>Game Stage</p></span>
                <select name="match_stage" value={formState.matchStage} onChange={(event) => updateField("matchStage", event.target.value)} className={selectCls}>
                  <option value="">Not set</option>
                  {matchStages.map((stage) => (<option key={stage} value={stage}>{matchStageLabels[stage]}</option>))}
                </select>
              </label>
              <label className="block">
                <span className={labelCls}><p>{formState.team1Id ? teams.find((team) => team.id.toString() === formState.team1Id)?.name : "Team 1 score"}</p></span>
                <input min="0" name="team1_score" type="number" value={formState.team1Score || ""} onChange={(event) => updateField("team1Score", event.target.value)} className={inputCls} />
              </label>
              <label className="block">
                <span className={labelCls}><p>{formState.team2Id ? teams.find((team) => team.id.toString() === formState.team2Id)?.name : "Team 2 score"}</p></span>
                <input min="0" name="team2_score" type="number" value={formState.team2Score || ""} onChange={(event) => updateField("team2Score", event.target.value)} className={inputCls} />
              </label>
              <label className="block">
                <span className={labelCls}><p>First goal in</p></span>
                <select disabled={!matchHasGoals} name="first_goal_in" required={matchHasGoals} value={formState.firstGoalIn} onChange={(event) => updateField("firstGoalIn", event.target.value)} className={selectCls}>
                  <option value="">{matchHasGoals ? "Not Set" : "N/A"}</option>
                  {formState.matchStage === "GROUP" && firstGoalIns.filter((slot) => slot !== "ET").map((slot) => (<option key={slot} value={slot}>{firstGoalInLabels[slot]}</option>))}
                  {formState.matchStage !== "GROUP" && firstGoalIns.map((slot) => (<option key={slot} value={slot}>{firstGoalInLabels[slot]}</option>))}
                </select>
              </label>
              <label className="block">
                <span className={labelCls}><p>First score by</p></span>
                <select disabled={!matchHasGoals} name="first_scoring_team_id" required={matchHasGoals} value={formState.firstScoringTeamId} onChange={(event) => updateField("firstScoringTeamId", event.target.value)} className={selectCls}>
                  <option value="">{matchHasGoals ? "Not Set" : "N/A"}</option>
                  <>
                    {Number(formState.team1Score || 0) > 0 && <option value={formState.team1Id}>{teams.find((team) => team.id.toString() === formState.team1Id)?.name}</option>}
                    {Number(formState.team2Score || 0) > 0 && <option value={formState.team2Id}>{teams.find((team) => team.id.toString() === formState.team2Id)?.name}</option>}
                  </>
                </select>
              </label>
              <label className="block">
                <span className={labelCls}><p>Yellow cards</p></span>
                <input min="0" name="yellow_card_count" type="number" value={formState.yellowCardCount || 0} onChange={(event) => updateField("yellowCardCount", event.target.value)} className={inputCls} />
              </label>
              <label className="block">
                <span className={labelCls}><p>Red cards</p></span>
                <input min="0" name="red_card_count" type="number" value={formState.redCardCount || 0} onChange={(event) => updateField("redCardCount", event.target.value)} className={inputCls} />
              </label>
              <label className="block">
                <span className={labelCls}><p>Kick-off team</p></span>
                <select name="kick_off_team_id" value={formState.kickoffTeamId} onChange={(event) => updateField("kickoffTeamId", event.target.value)} className={selectCls}>
                  <option value="">Not set</option>
                  {selectedTeams.map((team) => (<option key={team.id} value={team.id}>{team.name}</option>))}
                </select>
              </label>
              <label className="block">
                <span className={labelCls}><p>Match duration</p></span>
                <select name="match_duration" value={formState.matchStage === "GROUP" ? "90" : formState.matchDuration} disabled={formState.matchStage === "GROUP"} onChange={(event) => updateField("matchDuration", event.target.value)} className={selectCls}>
                  <option value="">{formState.matchStage === "GROUP" ? matchDurationLabels["90"] : "Not set"}</option>
                  {matchDurations.map((duration) => (<option key={duration} value={duration}>{matchDurationLabels[duration]}</option>))}
                </select>
              </label>
              <label className="flex items-center gap-3 cursor-pointer rounded-md border border-zinc-200 px-3 py-3 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                <input checked={formState.matchLocked} name="match_locked" type="checkbox" onChange={(event) => updateField("matchLocked", event.target.checked)} className="h-4 w-4 accent-emerald-700" />
                <p>Locked</p>
              </label>
              <label className="flex items-center gap-3 cursor-pointer rounded-md border border-zinc-200 px-3 py-3 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                <input checked={formState.matchReminderSent} name="match_reminder_sent" type="checkbox" onChange={(event) => updateField("matchReminderSent", event.target.checked)} className="h-4 w-4 accent-emerald-700" />
                <p>Reminder sent</p>
              </label>
              <label className="block">
                <span className={labelCls}><p>Winner</p></span>
                <select name="winner_id" value={formState.winnerId} onChange={(event) => updateField("winnerId", event.target.value)} className={selectCls}>
                  {formState.matchStage === "GROUP" && <option value="">{formState.matchLocked && formState.team1Score === formState.team2Score ? "Draw" : "Not set"}</option>}
                  {formState.matchLocked && formState.team1Score !== formState.team2Score ? selectedTeams.map((team) => (<option key={team.id} value={team.id}>{team.name}</option>)) : null}
                </select>
              </label>
            </div>

            {formError ? (
              <p aria-live="polite" className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-300">
                {formError}
              </p>
            ) : null}

            <div className="mt-4 flex justify-end gap-3">
              <button className="inline-flex h-11 px-4 items-center gap-2 justify-center rounded-md border cursor-pointer border-zinc-200 bg-white text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-700" type="button" onClick={handleCloseModal}>
                <IconCancel className="h-4 w-4" />
                Cancel
              </button>
              <button className="inline-flex h-11 px-4 items-center gap-2 justify-center rounded-md cursor-pointer bg-tournament-primary text-sm font-semibold text-white transition hover:bg-tournament-primary disabled:cursor-not-allowed disabled:bg-zinc-400" disabled={isSubmitting} type="submit">
                <IconSave className="h-4 w-4" />
                {isSubmitting ? "Saving…" : editingMatchId ? "Update Match" : "Save Match"}
              </button>
            </div>
          </form>
        </Modal>
      </main>
    </>
  );
};

export default AdminMatchesPage;
