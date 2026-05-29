"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { StatusPill } from "@/components/ui/status-pill";
import { ApiError } from "@/lib/api";
import { isAuthenticated, MissingAuthTokenError } from "@/lib/auth";
import { getErrorMessage } from "@/lib/forms/error-message";
import { GAME_DURATIONS, listUpcomingMatches } from "@/lib/matches";
import type { GameDuration, MatchResponse } from "@/lib/matches";
import {
  createPrediction,
  listCurrentUserPredictions,
  updatePrediction,
} from "@/lib/predictions";
import type {
  PredictionFields,
  PredictionResponse,
} from "@/lib/predictions";

type PredictionFormState = {
  firstScoringTeamId: string;
  gameDuration: string;
  isGoalInFirstHalf: string;
  openingTeamId: string;
  redCardCount: string;
  team1Score: string;
  team2Score: string;
  yellowCardCount: string;
};

const emptyFormState: PredictionFormState = {
  firstScoringTeamId: "",
  gameDuration: "90",
  isGoalInFirstHalf: "",
  openingTeamId: "",
  redCardCount: "",
  team1Score: "",
  team2Score: "",
  yellowCardCount: "",
};

const durationLabels: Record<GameDuration, string> = {
  "90": "90 minutes",
  "120": "120 minutes",
  PENALTY: "Penalty",
};

function getMatchLabel(match: MatchResponse): string {
  return `${match.team1_name} vs ${match.team2_name}`;
}

function getTeamNameById(
  match: MatchResponse | undefined,
  teamId: number | null,
): string {
  if (teamId === null) {
    return "No goal";
  }

  if (!match) {
    return `Team #${teamId}`;
  }

  if (match.team1_id === teamId) {
    return match.team1_name;
  }

  if (match.team2_id === teamId) {
    return match.team2_name;
  }

  return `Team #${teamId}`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getPredictionStatus(
  match: MatchResponse,
): "Locked" | "Locking soon" | "Open" {
  if (match.match_locked) {
    return "Locked";
  }

  const kickoff = new Date(match.match_datetime).getTime();
  const deadline = kickoff - 60 * 60 * 1000;
  const now = Date.now();

  if (Number.isFinite(deadline) && now >= deadline) {
    return "Locked";
  }

  if (Number.isFinite(deadline) && deadline - now <= 3 * 60 * 60 * 1000) {
    return "Locking soon";
  }

  return "Open";
}

function getStatusTone(status: ReturnType<typeof getPredictionStatus>) {
  if (status === "Open") {
    return "green";
  }

  if (status === "Locking soon") {
    return "amber";
  }

  return "red";
}

function parseNonNegativeInteger(value: string, label: string): number {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new Error(`${label} is required.`);
  }

  const parsedValue = Number(normalizedValue);

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    throw new Error(`${label} must be zero or greater.`);
  }

  return parsedValue;
}

function parsePositiveInteger(value: string, label: string): number {
  const parsedValue = parseNonNegativeInteger(value, label);

  if (parsedValue <= 0) {
    throw new Error(`${label} is required.`);
  }

  return parsedValue;
}

function parseRequiredBoolean(value: string, label: string): boolean {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error(`${label} is required.`);
}

function hasGoalPrediction(
  state: Pick<PredictionFormState, "team1Score" | "team2Score">,
): boolean {
  const team1Score = Number(state.team1Score);
  const team2Score = Number(state.team2Score);

  return (
    (Number.isFinite(team1Score) && team1Score > 0) ||
    (Number.isFinite(team2Score) && team2Score > 0)
  );
}

function isGameDuration(value: string): value is GameDuration {
  return GAME_DURATIONS.includes(value as GameDuration);
}

function buildFormState(
  match: MatchResponse,
  prediction?: PredictionResponse,
): PredictionFormState {
  if (prediction) {
    return {
      firstScoringTeamId:
        prediction.first_scoring_team_id === null
          ? ""
          : String(prediction.first_scoring_team_id),
      gameDuration: prediction.game_duration,
      isGoalInFirstHalf:
        prediction.is_goal_in_first_half === null
          ? ""
          : String(prediction.is_goal_in_first_half),
      openingTeamId: String(prediction.opening_team_id),
      redCardCount: String(prediction.red_card_count),
      team1Score: String(prediction.team1_score),
      team2Score: String(prediction.team2_score),
      yellowCardCount: String(prediction.yellow_card_count),
    };
  }

  return {
    ...emptyFormState,
    openingTeamId: String(match.team1_id),
  };
}

export function PredictionsDashboard() {
  const [authRequired, setAuthRequired] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formState, setFormState] = useState<PredictionFormState>(emptyFormState);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchResponse[]>([]);
  const [predictions, setPredictions] = useState<PredictionResponse[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [upcomingMatches, setUpComingMatches] = useState<MatchResponse[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const selectedMatch = useMemo(
    () => matches.find((match) => match.id === selectedMatchId) ?? null,
    [matches, selectedMatchId],
  );
  const selectedPrediction = useMemo(
    () =>
      selectedMatch
        ? predictions.find((prediction) => prediction.match_id === selectedMatch.id)
        : undefined,
    [predictions, selectedMatch],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadPageData() {
      setIsLoading(true);
      setLoadError(null);
      const hasAuthToken = isAuthenticated();
      setAuthRequired(!hasAuthToken);

      try {
        const matchList = await listUpcomingMatches({
          includeLocked: false,
          limit: 50,
        });

        setUpComingMatches(matchList.items);

        const nextMatches = matchList.items;
        if (!hasAuthToken) {
          if (!isMounted) {
            return;
          }

          const firstMatch = nextMatches[0] ?? null;
          setMatches(nextMatches);
          setSelectedMatchId(firstMatch?.id ?? null);
          setFormState(firstMatch ? buildFormState(firstMatch) : emptyFormState);
          setAuthRequired(true);
          setPredictions([]);
          return;
        }

        const predictionList = await listCurrentUserPredictions({ limit: 100 });

        if (!isMounted) {
          return;
        }

        const firstMatch = nextMatches[0] ?? null;
        const firstMatchPrediction = firstMatch
          ? predictionList.items.find(
            (prediction) => prediction.match_id === firstMatch.id,
          )
          : undefined;

        setMatches(nextMatches);
        setSelectedMatchId(firstMatch?.id ?? null);
        setFormState(
          firstMatch
            ? buildFormState(firstMatch, firstMatchPrediction)
            : emptyFormState,
        );
        setAuthRequired(false);
        setPredictions(predictionList.items);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (
          error instanceof MissingAuthTokenError ||
          (error instanceof ApiError && error.status === 401)
        ) {
          setAuthRequired(true);
        } else {
          setLoadError(
            getErrorMessage(error, "Unable to load prediction data."),
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadPageData();

    return () => {
      isMounted = false;
    };
  }, []);

  function updateField(field: keyof PredictionFormState, value: string) {
    setFormState((current) => {
      const nextState = {
        ...current,
        [field]: value,
      };

      if (
        (field === "team1Score" || field === "team2Score") &&
        !hasGoalPrediction(nextState)
      ) {
        return {
          ...nextState,
          firstScoringTeamId: "",
          isGoalInFirstHalf: "",
        };
      }

      return nextState;
    });
  }

  function buildPredictionFields(): PredictionFields {
    if (!isGameDuration(formState.gameDuration)) {
      throw new Error("Game duration is required.");
    }

    const team1Score = parseNonNegativeInteger(
      formState.team1Score,
      "Team 1 score",
    );
    const team2Score = parseNonNegativeInteger(
      formState.team2Score,
      "Team 2 score",
    );
    const hasPredictedGoals = team1Score + team2Score > 0;

    return {
      first_scoring_team_id: hasPredictedGoals
        ? parsePositiveInteger(formState.firstScoringTeamId, "1st scoring team")
        : null,
      game_duration: formState.gameDuration,
      is_goal_in_first_half: hasPredictedGoals
        ? parseRequiredBoolean(formState.isGoalInFirstHalf, "Goal in 1st half")
        : null,
      opening_team_id: parsePositiveInteger(
        formState.openingTeamId,
        "Opening team",
      ),
      red_card_count: parseNonNegativeInteger(
        formState.redCardCount,
        "Red cards",
      ),
      team1_score: team1Score,
      team2_score: team2Score,
      yellow_card_count: parseNonNegativeInteger(
        formState.yellowCardCount,
        "Yellow cards",
      ),
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    if (!selectedMatch) {
      setFormError("Select a match before saving a prediction.");
      return;
    }

    if (!isAuthenticated()) {
      setAuthRequired(true);
      setFormError("Please sign in before saving a prediction.");
      return;
    }

    if (getPredictionStatus(selectedMatch) === "Locked") {
      setFormError("Prediction is locked for this match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const predictionFields = buildPredictionFields();
      const savedPrediction = selectedPrediction
        ? await updatePrediction(selectedPrediction.id, predictionFields)
        : await createPrediction({
          ...predictionFields,
          match_id: selectedMatch.id,
        });

      setPredictions((currentPredictions) => {
        const existingIndex = currentPredictions.findIndex(
          (prediction) => prediction.id === savedPrediction.id,
        );

        if (existingIndex === -1) {
          return [savedPrediction, ...currentPredictions];
        }

        return currentPredictions.map((prediction) =>
          prediction.id === savedPrediction.id ? savedPrediction : prediction,
        );
      });
      setAuthRequired(false);
      setSuccessMessage(
        selectedPrediction
          ? "Prediction updated successfully."
          : "Prediction submitted successfully.",
      );
    } catch (error) {
      if (error instanceof MissingAuthTokenError) {
        setAuthRequired(true);
      }

      setFormError(
        getErrorMessage(error, "Unable to save prediction. Please try again."),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectedStatus = selectedMatch
    ? getPredictionStatus(selectedMatch)
    : "Locked";
  const isFormDisabled =
    isSubmitting || authRequired || !selectedMatch || selectedStatus === "Locked";
  const hasPredictedGoals = hasGoalPrediction(formState);
  const areGoalTimelineFieldsDisabled = isFormDisabled || !hasPredictedGoals;

  return (
    <>
      {loadError ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {loadError}
        </div>
      ) : null}

      {authRequired ? (
        <div className="flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Login required</h2>
            <p className="mt-1 text-sm">Sign in to submit predictions and view your prediction history.</p>
          </div>
          <Link
            href="/login"
            className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            Login
          </Link>
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-3">
        {isLoading ? (
          upcomingMatches.map((match) => (
            <div
              key={match.id}
              className="h-64 rounded-md border border-zinc-200 bg-white shadow-sm"
            />
          ))
        ) : matches.length > 0 ? (
          matches.map((match) => {
            const status = getPredictionStatus(match);
            const isSelected = match.id === selectedMatchId;

            return (
              <article
                key={match.id}
                className={`cursor-pointer rounded-md border bg-white p-4 shadow-sm ${isSelected ? "border-emerald-700" : "border-zinc-200"
                }`}
                onClick={() => {
                  const clickedPrediction = predictions.find(
                    (prediction) => prediction.match_id === match.id,
                  );
                  setSelectedMatchId(match.id);
                  setFormState(buildFormState(match, clickedPrediction));
                  setFormError(null);
                  setSuccessMessage(null);
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                      Match day {match.match_day}
                    </p>
                    <h2 className="mt-2 text-lg font-semibold text-zinc-950">
                      {getMatchLabel(match)}
                    </h2>
                  </div>
                  <StatusPill tone={getStatusTone(status)}>{status}</StatusPill>
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-zinc-500">Kickoff</dt>
                    <dd className="mt-1 font-medium text-zinc-950">
                      {formatDateTime(match.match_datetime)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Prediction</dt>
                    <dd className="mt-1 font-medium text-zinc-950">
                      {predictions.some(
                        (prediction) => prediction.match_id === match.id,
                      )
                        ? "Saved"
                        : "Not saved"}
                    </dd>
                  </div>
                </dl>
              </article>
            );
          })
        ) : (
          <div className="rounded-md border border-zinc-200 bg-white p-5 text-sm text-zinc-600 lg:col-span-3">
            No upcoming matches are available.
          </div>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <form
          className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm"
          onSubmit={handleSubmit}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-zinc-950">
                Match Prediction
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                {selectedMatch
                  ? `${getMatchLabel(selectedMatch)} - ${formatDateTime(
                    selectedMatch.match_datetime,
                  )}`
                  : "Select a match to continue"}
              </p>
            </div>
            <StatusPill tone={getStatusTone(selectedStatus)}>
              {selectedStatus}
            </StatusPill>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">
                {selectedMatch ? selectedMatch.team1_name : "Team 1"} score
              </span>
              <input
                min="0"
                name="team1_score"
                required
                type="number"
                value={formState.team1Score}
                onChange={(event) => updateField("team1Score", event.target.value)}
                className="mt-2 h-11 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">
                {selectedMatch ? selectedMatch.team2_name : "Team 2"} score
              </span>
              <input
                min="0"
                name="team2_score"
                required
                type="number"
                value={formState.team2Score}
                onChange={(event) => updateField("team2Score", event.target.value)}
                className="mt-2 h-11 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">
                1st scoring team
              </span>
              <select
                disabled={areGoalTimelineFieldsDisabled}
                name="first_scoring_team_id"
                required={hasPredictedGoals}
                value={formState.firstScoringTeamId}
                onChange={(event) =>
                  updateField("firstScoringTeamId", event.target.value)
                }
                className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100 disabled:bg-zinc-100 disabled:text-zinc-400"
              >
                <option value="">
                  {hasPredictedGoals ? "Select team" : "No predicted goal"}
                </option>
                {selectedMatch ? (
                  <>
                    <option value={selectedMatch.team1_id}>
                      {selectedMatch.team1_name}
                    </option>
                    <option value={selectedMatch.team2_id}>
                      {selectedMatch.team2_name}
                    </option>
                  </>
                ) : null}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">
                Goal in 1st half
              </span>
              <select
                disabled={areGoalTimelineFieldsDisabled}
                name="is_goal_in_first_half"
                required={hasPredictedGoals}
                value={formState.isGoalInFirstHalf}
                onChange={(event) =>
                  updateField("isGoalInFirstHalf", event.target.value)
                }
                className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100 disabled:bg-zinc-100 disabled:text-zinc-400"
              >
                <option value="">
                  {hasPredictedGoals ? "Select" : "No predicted goal"}
                </option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">
                Total Yellow cards
              </span>
              <input
                min="0"
                name="yellow_card_count"
                required
                type="number"
                value={formState.yellowCardCount}
                onChange={(event) =>
                  updateField("yellowCardCount", event.target.value)
                }
                className="mt-2 h-11 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">
                Total Red cards
              </span>
              <input
                min="0"
                name="red_card_count"
                required
                type="number"
                value={formState.redCardCount}
                onChange={(event) => updateField("redCardCount", event.target.value)}
                className="mt-2 h-11 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">
                Opening team
              </span>
              <select
                name="opening_team_id"
                required
                value={formState.openingTeamId}
                onChange={(event) => updateField("openingTeamId", event.target.value)}
                className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              >
                {selectedMatch ? (
                  <>
                    <option value={selectedMatch.team1_id}>
                      {selectedMatch.team1_name}
                    </option>
                    <option value={selectedMatch.team2_id}>
                      {selectedMatch.team2_name}
                    </option>
                  </>
                ) : (
                  <option value="">Select match first</option>
                )}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">
                Game duration
              </span>
              <select
                name="game_duration"
                required
                value={formState.gameDuration}
                onChange={(event) => updateField("gameDuration", event.target.value)}
                className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              >
                {GAME_DURATIONS.map((duration) => (
                  <option key={duration} value={duration}>
                    {durationLabels[duration]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {formError ? (
            <p
              aria-live="polite"
              className="mt-5 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
            >
              {formError}
            </p>
          ) : null}
          {successMessage ? (
            <p
              aria-live="polite"
              className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
            >
              {successMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isFormDisabled}
            className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400 sm:w-auto"
          >
            {isSubmitting
              ? "Saving..."
              : selectedPrediction
                ? "Update prediction"
                : "Save prediction"}
          </button>
        </form>

        <section className="overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-zinc-950">
              Prediction history
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                <tr>
                  <th className="px-5 py-3">Match</th>
                  <th className="px-5 py-3">Score</th>
                  <th className="px-5 py-3">1st scorer</th>
                  <th className="px-5 py-3">1H goal</th>
                  <th className="px-5 py-3">Duration</th>
                  <th className="px-5 py-3 text-right">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {predictions.length > 0 ? (
                  predictions.map((prediction) => {
                    const predictionMatch = matches.find(
                      (match) => match.id === prediction.match_id,
                    );

                    return (
                      <tr key={prediction.id}>
                        <td className="px-5 py-4 font-medium text-zinc-950">
                          {predictionMatch
                            ? getMatchLabel(predictionMatch)
                            : `Match #${prediction.match_id}`}
                        </td>
                        <td className="px-5 py-4 text-zinc-700">
                          {prediction.team1_score} - {prediction.team2_score}
                        </td>
                        <td className="px-5 py-4 text-zinc-700">
                          {getTeamNameById(
                            predictionMatch,
                            prediction.first_scoring_team_id,
                          )}
                        </td>
                        <td className="px-5 py-4 text-zinc-700">
                          {prediction.is_goal_in_first_half === null
                            ? "No goal"
                            : prediction.is_goal_in_first_half
                              ? "Yes"
                              : "No"}
                        </td>
                        <td className="px-5 py-4 text-zinc-700">
                          {durationLabels[prediction.game_duration]}
                        </td>
                        <td className="px-5 py-4 text-right text-zinc-700">
                          {formatDateTime(prediction.predicted_datetime)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-8 text-center text-zinc-500"
                    >
                      {authRequired
                        ? "Login to load your prediction history."
                        : "No predictions submitted yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </>
  );
}
