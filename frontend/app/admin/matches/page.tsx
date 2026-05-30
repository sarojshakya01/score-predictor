"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { Modal } from "@/components/ui/modal";
import { StatusPill } from "@/components/ui/status-pill";
import { getErrorMessage } from "@/lib/forms/error-message";
import {
  createMatch,
  deleteMatch,
  match_durations,
  listAdminMatches,
  updateMatch,
  match_stages,
} from "@/lib/matches";
import type { GameDuration, MatchCreate, MatchResponse, MatchStage } from "@/lib/matches";
import { listAdminTeams } from "@/lib/teams";
import type { TeamResponse } from "@/lib/teams";
import { formatDateTime, getMatchLabelWithFlag } from "@/components/ui/match-card";

type MatchFormState = {
  firstScoringTeamId: string;
  gameDuration: string;
  isGoalInFirstHalf: string;
  matchDatetime: string;
  matchDay: string;
  matchLocked: boolean;
  matchReminderSent: boolean;
  matchStage: string;
  openingTeamId: string;
  redCardCount: string;
  team1Id: string;
  team1Score: string;
  team2Id: string;
  team2Score: string;
  venueName: string;
  yellowCardCount: string;
};

const emptyFormState: MatchFormState = {
  firstScoringTeamId: "",
  gameDuration: "",
  isGoalInFirstHalf: "",
  matchDatetime: "",
  matchDay: "",
  matchLocked: false,
  matchReminderSent: false,
  matchStage: "",
  openingTeamId: "",
  redCardCount: "",
  team1Id: "",
  team1Score: "",
  team2Id: "",
  team2Score: "",
  venueName: "",
  yellowCardCount: "",
};

const durationLabels: Record<GameDuration, string> = {
  "90": "90 minutes",
  "120": "120 minutes",
  PENALTY: "Penalty",
};

const stageLabels: Record<MatchStage, string> = {
  "GROUP": "Group Stage",
  "R32": "Round of 32",
  "R16": "Round of 16",
  "QF": "Quarter Final",
  "SF": "Semi Final",
  "3P": "Third Place",
  "F": "Final",
};

const formatScore = (match: MatchResponse): string => {
  if (match.team1_score === null || match.team2_score === null) {
    return "Not set";
  }

  return `${match.team1_score} - ${match.team2_score}`;
};

const getMatchStatus = (match: MatchResponse): "Open" | "Locked" => {
  return match.match_locked ? "Locked" : "Open";
};

const getTeamNameById = (
  teams: TeamResponse[],
  teamId: number | null | undefined,
): string => {
  if (teamId === null || teamId === undefined) {
    return "None";
  }

  return teams.find((team) => team.id === teamId)?.name ?? `Team #${teamId}`;
};

const getMatchLabelText = (match: MatchResponse): string => {
  return `${match.team1_name} vs ${match.team2_name}`;
};

const toDateTimeInputValue = (value: string): string => {
  return value ? value.slice(0, 16) : "";
};

const toFormState = (match: MatchResponse): MatchFormState => {
  return {
    firstScoringTeamId:
      match.first_scoring_team_id === null
        ? ""
        : String(match.first_scoring_team_id),
    gameDuration: match.match_duration ?? "",
    isGoalInFirstHalf:
      match.is_goal_in_first_half === null
        ? ""
        : String(match.is_goal_in_first_half),
    matchDatetime: toDateTimeInputValue(match.match_datetime),
    matchDay: String(match.match_day),
    matchLocked: match.match_locked,
    matchReminderSent: match.match_reminder_sent,
    matchStage: match.match_stage ?? "",
    openingTeamId:
      match.kick_off_team_id === null ? "" : String(match.kick_off_team_id),
    redCardCount:
      match.red_card_count === null ? "" : String(match.red_card_count),
    team1Id: String(match.team1_id),
    team1Score:
      match.team1_score === null ? "" : String(match.team1_score),
    team2Id: String(match.team2_id),
    team2Score:
      match.team2_score === null ? "" : String(match.team2_score),
    venueName: match.venue_name ?? "",
    yellowCardCount:
      match.yellow_card_count === null ? "" : String(match.yellow_card_count),
  };
};

const parseRequiredInteger = (value: string, label: string): number => {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`${label} is required.`);
  }

  return parsedValue;
};

const parseOptionalNonNegativeInteger = (
  value: string,
  label: string,
): number | null => {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return null;
  }

  const parsedValue = Number(normalizedValue);

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    throw new Error(`${label} must be zero or greater.`);
  }

  return parsedValue;
};

const parseOptionalPositiveInteger = (value: string): number | null => {
  return value ? parseRequiredInteger(value, "Team") : null;
};

const parseRequiredBoolean = (value: string, label: string): boolean => {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error(`${label} is required.`);
};

const isGameDuration = (value: string): value is GameDuration => {
  return match_durations.includes(value as GameDuration);
};

const hasGoals = (state: Pick<MatchFormState, "team1Score" | "team2Score">): boolean => {
  const team1Score = Number(state.team1Score);
  const team2Score = Number(state.team2Score);

  return (
    (Number.isFinite(team1Score) && team1Score > 0) ||
    (Number.isFinite(team2Score) && team2Score > 0)
  );
};

const buildMatchPayload = (state: MatchFormState): MatchCreate => {
  const team1Id = parseRequiredInteger(state.team1Id, "Team 1");
  const team2Id = parseRequiredInteger(state.team2Id, "Team 2");

  if (team1Id === team2Id) {
    throw new Error("Team 1 and Team 2 must be different.");
  }

  const team1Score = parseOptionalNonNegativeInteger(
    state.team1Score,
    "Team 1 score",
  );
  const team2Score = parseOptionalNonNegativeInteger(
    state.team2Score,
    "Team 2 score",
  );
  const matchHasGoals = (team1Score ?? 0) > 0 || (team2Score ?? 0) > 0;

  if (!state.matchDatetime) {
    throw new Error("Kickoff is required.");
  }

  return {
    first_scoring_team_id: matchHasGoals
      ? parseRequiredInteger(state.firstScoringTeamId, "First Scoring Team")
      : null,
    match_duration: isGameDuration(state.gameDuration)
      ? state.gameDuration
      : null,
    is_goal_in_first_half: matchHasGoals
      ? parseRequiredBoolean(state.isGoalInFirstHalf, "Goal in First Half")
      : null,
    match_datetime: state.matchDatetime,
    match_day: parseRequiredInteger(state.matchDay, "Match Day"),
    match_locked: state.matchLocked,
    match_reminder_sent: state.matchReminderSent,
    match_stage: state.matchStage,
    kick_off_team_id: parseOptionalPositiveInteger(state.openingTeamId),
    red_card_count: parseOptionalNonNegativeInteger(
      state.redCardCount,
      "Red cards",
    ),
    team1_id: team1Id,
    team1_score: team1Score,
    team2_id: team2Id,
    team2_score: team2Score,
    venue_name: state.venueName.trim() || null,
    yellow_card_count: parseOptionalNonNegativeInteger(
      state.yellowCardCount,
      "Yellow cards",
    ),
  };
};

const AdminMatchesPage = () => {
  const [editingMatchId, setEditingMatchId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formState, setFormState] = useState<MatchFormState>(emptyFormState);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchResponse[]>([]);
  const [teams, setTeams] = useState<TeamResponse[]>([]);

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
      setLoadError(null);

      try {
        const [matchList, teamList] = await Promise.all([
          listAdminMatches({ limit: 100 }),
          listAdminTeams({ limit: 100 }),
        ]);

        if (isMounted) {
          setMatches(matchList.items);
          setTeams(teamList.items);
        }
      } catch (error) {
        if (isMounted) {
          setLoadError(getErrorMessage(error, "Unable to load matches."));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadInitialPageData();

    return () => {
      isMounted = false;
    };
  }, []);

  const updateField = (field: keyof MatchFormState, value: string | boolean) => {
    setFormState((current) => {
      const nextState = {
        ...current,
        [field]: value,
      };
      const validTeamIds = new Set([nextState.team1Id, nextState.team2Id]);

      if (!validTeamIds.has(nextState.openingTeamId)) {
        nextState.openingTeamId = "";
      }

      if (
        !validTeamIds.has(nextState.firstScoringTeamId) ||
        ((field === "team1Score" || field === "team2Score") &&
          !hasGoals(nextState))
      ) {
        nextState.firstScoringTeamId = "";
        nextState.isGoalInFirstHalf = "";
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

  const startEditingMatch = (match: MatchResponse) => {
    setEditingMatchId(match.id);
    setFormState(toFormState(match));
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const payload = buildMatchPayload(formState);
      const savedMatch = editingMatchId
        ? await updateMatch(editingMatchId, payload)
        : await createMatch(payload);

      setMatches((currentMatches) => {
        if (editingMatchId) {
          return currentMatches.map((match) =>
            match.id === savedMatch.id ? savedMatch : match,
          );
        }

        return [...currentMatches, savedMatch].sort(
          (a, b) =>
            new Date(a.match_datetime).getTime() -
            new Date(b.match_datetime).getTime() || a.id - b.id,
        );
      });
      setEditingMatchId(savedMatch.id);
      setFormState(toFormState(savedMatch));
      setIsModalOpen(false);
    } catch (error) {
      setFormError(getErrorMessage(error, "Unable to save match."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (match: MatchResponse) => {
    if (!window.confirm(`Delete ${getMatchLabelText(match)}?`)) {
      return;
    }

    setIsDeletingId(match.id);
    setFormError(null);

    try {
      await deleteMatch(match.id);
      setMatches((currentMatches) =>
        currentMatches.filter((currentMatch) => currentMatch.id !== match.id),
      );
    } catch (error) {
      setFormError(getErrorMessage(error, "Unable to delete match."));
    } finally {
      setIsDeletingId(null);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div><h2>Tournament Matches</h2></div>
        <button
          className="inline-flex h-10 items-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition cursor-pointer hover:bg-zinc-800"
          type="button"
          onClick={startNewMatch}
        >
          New Match
        </button>
      </section>

      {loadError ? (
        <section
          className="rounded-md border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-800"
          role="alert"
        >
          {loadError}
        </section>
      ) : null}

      <section className="overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
              <tr>
                <th className="px-5 py-3">Match</th>
                <th className="px-5 py-3">Day</th>
                <th className="px-5 py-3">Kickoff</th>
                <th className="px-5 py-3">Score</th>
                <th className="px-5 py-3">First Scorer</th>
                <th className="px-5 py-3">Goal in First Half</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {isLoading ? (
                <tr>
                  <td
                    className="px-5 py-8 text-center text-zinc-500"
                    colSpan={8}
                  >
                    Loading matches...
                  </td>
                </tr>
              ) : matches.length > 0 ? (
                matches.map((match) => (
                  <tr key={match.id}>
                    <td className="px-5 py-4 font-medium text-zinc-950">
                      {getMatchLabelWithFlag(match)}
                    </td>
                    <td className="px-5 py-4 text-zinc-700">
                      {match.match_day}
                    </td>
                    <td className="px-5 py-4 text-zinc-700">
                      {formatDateTime(match.match_datetime)}
                    </td>
                    <td className="px-5 py-4 text-zinc-700">
                      {formatScore(match)}
                    </td>
                    <td className="px-5 py-4 text-zinc-700">
                      {getTeamNameById(teams, match.first_scoring_team_id)}
                    </td>
                    <td className="px-5 py-4 text-zinc-700">
                      {match.is_goal_in_first_half === null
                        ? "None"
                        : match.is_goal_in_first_half
                          ? "Yes"
                          : "No"}
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill
                        tone={match.match_locked ? "red" : "green"}
                      >
                        {getMatchStatus(match)}
                      </StatusPill>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          className="font-semibold text-emerald-700 cursor-pointer hover:text-emerald-900"
                          type="button"
                          onClick={() => startEditingMatch(match)}
                        >
                          Edit
                        </button>
                        <button
                          className="font-semibold text-rose-700 cursor-pointer hover:text-rose-900 disabled:text-zinc-400"
                          disabled={isDeletingId === match.id}
                          type="button"
                          onClick={() => void handleDelete(match)}
                        >
                          {isDeletingId === match.id ? "Deleting" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    className="px-5 py-8 text-center text-zinc-500"
                    colSpan={8}
                  >
                    No matches found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingMatchId ? "Edit match" : "New match"}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => void handleSubmit(e)}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <p className="text-sm text-zinc-500">
              Schedule and result details.
            </p>
            <StatusPill tone={formState.matchLocked ? "red" : "green"}>
              {formState.matchLocked ? "Locked" : "Open"}
            </StatusPill>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-zinc-700"><p>Team 1</p></span>
              <select
                name="team1_id"
                required
                value={formState.team1Id}
                onChange={(event) => updateField("team1Id", event.target.value)}
                className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="">Select team</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700"><p>Team 2</p></span>
              <select
                name="team2_id"
                required
                value={formState.team2Id}
                onChange={(event) => updateField("team2Id", event.target.value)}
                className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="">Select team</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700"><p>Kickoff (UTC Time)</p></span>
              <input
                name="match_datetime"
                required
                type="datetime-local"
                value={formState.matchDatetime}
                onChange={(event) =>
                  updateField("matchDatetime", event.target.value)
                }
                className="mt-2 h-11 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700"><p>Match day</p></span>
              <input
                min="1"
                name="match_day"
                required
                type="number"
                value={formState.matchDay}
                onChange={(event) => updateField("matchDay", event.target.value)}
                className="mt-2 h-11 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <label className="block sm:col-span-1">
              <span className="text-sm font-medium text-zinc-700"><p>Venue</p></span>
              <input
                name="venue_name"
                type="text"
                value={formState.venueName}
                onChange={(event) => updateField("venueName", event.target.value)}
                className="mt-2 h-11 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">
                <p>Game Stage</p>
              </span>
              <select
                name="match_stage"
                value={formState.matchStage}
                onChange={(event) =>
                  updateField("matchStage", event.target.value)
                }
                className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="">Not set</option>
                {match_stages.map((stage) => (
                  <option key={stage} value={stage}>
                    {stageLabels[stage]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">
                <p>
                  {formState.team1Id ? teams.find((team) => team.id.toString() === formState.team1Id)?.name : "Team 1 score"}
                </p>
              </span>
              <input
                min="0"
                name="team1_score"
                type="number"
                value={formState.team1Score || ""}
                onChange={(event) => updateField("team1Score", event.target.value)}
                className="mt-2 h-11 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">
                <p>
                  {formState.team2Id ? teams.find((team) => team.id.toString() === formState.team2Id)?.name : "Team 2 score"}
                </p>
              </span>
              <input
                min="0"
                name="team2_score"
                type="number"
                value={formState.team2Score || ""}
                onChange={(event) => updateField("team2Score", event.target.value)}
                className="mt-2 h-11 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">
                <p>First scoring team</p>
              </span>
              <select
                disabled={!matchHasGoals}
                name="first_scoring_team_id"
                required={matchHasGoals}
                value={formState.firstScoringTeamId}
                onChange={(event) =>
                  updateField("firstScoringTeamId", event.target.value)
                }
                className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100 disabled:bg-zinc-100 disabled:text-zinc-400"
              >
                <option value="">
                  {matchHasGoals ? "Select team" : "No goals"}
                </option>
                {selectedTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">
                <p>Goal in first half</p>
              </span>
              <select
                disabled={!matchHasGoals}
                name="is_goal_in_first_half"
                required={matchHasGoals}
                value={formState.isGoalInFirstHalf}
                onChange={(event) =>
                  updateField("isGoalInFirstHalf", event.target.value)
                }
                className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100 disabled:bg-zinc-100 disabled:text-zinc-400"
              >
                <option value="">{matchHasGoals ? "Select" : "No goals"}</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">
                <p>Yellow cards</p>
              </span>
              <input
                min="0"
                name="yellow_card_count"
                type="number"
                value={formState.yellowCardCount || 0}
                onChange={(event) =>
                  updateField("yellowCardCount", event.target.value)
                }
                className="mt-2 h-11 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700"><p>Red cards</p></span>
              <input
                min="0"
                name="red_card_count"
                type="number"
                value={formState.redCardCount || 0}
                onChange={(event) => updateField("redCardCount", event.target.value)}
                className="mt-2 h-11 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">
                <p>Kick-off team</p>
              </span>
              <select
                name="kick_off_team_id"
                value={formState.openingTeamId}
                onChange={(event) =>
                  updateField("openingTeamId", event.target.value)
                }
                className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="">Not set</option>
                {selectedTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">
                <p>Game duration</p>
              </span>
              <select
                name="match_duration"
                value={formState.gameDuration}
                onChange={(event) =>
                  updateField("gameDuration", event.target.value)
                }
                className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="">Not set</option>
                {match_durations.map((duration) => (
                  <option key={duration} value={duration}>
                    {durationLabels[duration]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-3 cursor-pointer rounded-md border border-zinc-200 px-3 py-3 text-sm font-medium text-zinc-700">
              <input
                checked={formState.matchLocked}
                name="match_locked"
                type="checkbox"
                onChange={(event) =>
                  updateField("matchLocked", event.target.checked)
                }
                className="h-4 w-4 accent-emerald-700"
              />
              <p>Locked</p>
            </label>
            <label className="flex items-center gap-3 cursor-pointer rounded-md border border-zinc-200 px-3 py-3 text-sm font-medium text-zinc-700">
              <input
                checked={formState.matchReminderSent}
                name="match_reminder_sent"
                type="checkbox"
                onChange={(event) =>
                  updateField("matchReminderSent", event.target.checked)
                }
                className="h-4 w-4 accent-emerald-700"
              />
              <p>Reminder sent</p>
            </label>
          </div>

          {formError ? (
            <label className="block col-span-2">
              <p
                aria-live="polite"
                className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
              >
                {formError}
              </p>
            </label>
          ) : null}

          <div className="mt-4 flex justify-end gap-3">
            <button
              className="inline-flex h-11 items-center justify-center rounded-md border cursor-pointer border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
              type="button"
              onClick={handleCloseModal}
            >
              Cancel
            </button>
            <button
              className="inline-flex h-11 items-center justify-center rounded-md cursor-pointer bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting
                ? "Saving..."
                : editingMatchId
                  ? "Update Match"
                  : "Save Match"}
            </button>
          </div>
        </form>
      </Modal>
    </main>
  );
};

export default AdminMatchesPage;
