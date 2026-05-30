"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { StatusPill } from "@/components/ui/status-pill";
import { ApiError } from "@/lib/api";
import { isAuthenticated, MissingAuthTokenError } from "@/lib/auth";
import { getErrorMessage } from "@/lib/forms/error-message";
import {
  listMatches,
  listUpcomingMatches,
  match_durations,
} from "@/lib/matches";
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
import {
  formatDateTime,
  getMatchLabelWithFlag,
  getPredictionStatus,
  getStatusTone,
  SelectableMatchCard,
} from "../ui/match-card";
import Image from "next/image";

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

const getMatchLabelText = (match: MatchResponse): string => {
  return `${match.team1_name} vs ${match.team2_name}`;
};

const getTeamNameById = (
  match: MatchResponse | undefined,
  teamId: number | null,
): string => {
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
};

const parseNonNegativeInteger = (value: string, label: string): number => {
  let normalizedValue = value.trim();

  if (!normalizedValue) {
    normalizedValue = "0";
  }

  const parsedValue = Number(normalizedValue);

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    throw new Error(`${label} must be zero or greater.`);
  }

  return parsedValue;
};

const parsePositiveInteger = (value: string, label: string): number => {
  const parsedValue = parseNonNegativeInteger(value, label);

  if (parsedValue <= 0) {
    throw new Error(`${label} is required.`);
  }

  return parsedValue;
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

const hasGoalPrediction = (
  state: Pick<PredictionFormState, "team1Score" | "team2Score">,
): boolean => {
  const team1Score = Number(state.team1Score);
  const team2Score = Number(state.team2Score);

  return (
    (Number.isFinite(team1Score) && team1Score > 0) ||
    (Number.isFinite(team2Score) && team2Score > 0)
  );
};

const isGameDuration = (value: string): value is GameDuration => {
  return match_durations.includes(value as GameDuration);
};

const buildFormState = (
  match: MatchResponse,
  prediction?: PredictionResponse,
): PredictionFormState => {
  if (prediction) {
    return {
      firstScoringTeamId:
        prediction.first_scoring_team_id === null
          ? ""
          : String(prediction.first_scoring_team_id),
      gameDuration: prediction.match_duration,
      isGoalInFirstHalf:
        prediction.is_goal_in_first_half === null
          ? ""
          : String(prediction.is_goal_in_first_half),
      openingTeamId: String(prediction.kick_off_team_id),
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
};

const getReferenceMatchDay = (matches: MatchResponse[]): number | null => {
  return matches[0]?.match_day ?? null;
};

export const PredictionsDashboard = () => {
  const [authRequired, setAuthRequired] = useState(false);
  const [currentMatchDay, setCurrentMatchDay] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formState, setFormState] = useState<PredictionFormState>(emptyFormState);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchResponse[]>([]);
  const [predictions, setPredictions] = useState<PredictionResponse[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
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

  const applyMatchSelection = useCallback((
    nextMatches: MatchResponse[],
    nextPredictions: PredictionResponse[],
  ) => {
    const firstMatch = nextMatches[0] ?? null;
    const firstMatchPrediction = firstMatch
      ? nextPredictions.find(
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
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadPageData = async () => {
      setIsLoading(true);
      setLoadError(null);
      const hasAuthToken = isAuthenticated();
      setAuthRequired(!hasAuthToken);

      try {
        const matchList = await listUpcomingMatches({
          includeLocked: true,
          limit: 50,
        });

        const nextMatches = matchList.items;
        if (!hasAuthToken) {
          if (!isMounted) {
            return;
          }

          applyMatchSelection(nextMatches, []);
          setCurrentMatchDay(null);
          setAuthRequired(true);
          setPredictions([]);
          return;
        }

        const predictionList = await listCurrentUserPredictions({ limit: 100 });

        if (!isMounted) {
          return;
        }

        applyMatchSelection(nextMatches, predictionList.items);
        setCurrentMatchDay(null);
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
  }, [applyMatchSelection]);

  const updateField = (field: keyof PredictionFormState, value: string) => {
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
  };

  const buildPredictionFields = (): PredictionFields => {
    if (!isGameDuration(formState.gameDuration)) {
      throw new Error("Game duration is required.");
    }

    const team1Score = parseNonNegativeInteger(
      formState.team1Score,
      "Team 1",
    );
    const team2Score = parseNonNegativeInteger(
      formState.team2Score,
      "Team 2",
    );
    const hasPredictedGoals = team1Score + team2Score > 0;

    return {
      first_scoring_team_id: hasPredictedGoals
        ? parsePositiveInteger(formState.firstScoringTeamId, "first scoring team")
        : null,
      match_duration: formState.gameDuration,
      is_goal_in_first_half: hasPredictedGoals
        ? parseRequiredBoolean(formState.isGoalInFirstHalf, "Goal in first half")
        : null,
      kick_off_team_id: parsePositiveInteger(
        formState.openingTeamId,
        "Kick-off team",
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
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    if (!selectedMatch) {
      setFormError("Select a match before saving a prediction.");
      return;
    }

    if (!isAuthenticated()) {
      setAuthRequired(true);
      setFormError("Please log in before saving a prediction.");
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
  };

  const handleCardClick = (match: MatchResponse) => {
    const clickedPrediction = predictions.find(
      (prediction) => prediction.match_id === match.id,
    );
    setSelectedMatchId(match.id);
    setFormState(buildFormState(match, clickedPrediction));
    setFormError(null);
    setSuccessMessage(null);
  };

  const handleMatchDayChange = async (matchDay: number) => {
    setIsLoading(true);
    setLoadError(null);
    setFormError(null);
    setSuccessMessage(null);

    try {
      const matchList = await listMatches({ matchDay });

      if (matchList.items.length === 0) {
        setLoadError(`No matches found for match day ${matchDay}.`);
        setCurrentMatchDay(null);
      } else {
        setCurrentMatchDay(matchDay);
        applyMatchSelection(matchList.items, predictions);
      }
    } catch (error) {
      setLoadError(
        getErrorMessage(error, `Unable to load match day ${matchDay}.`),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const selectedStatus = selectedMatch
    ? getPredictionStatus(selectedMatch)
    : "Locked";

  const referenceMatchDay = currentMatchDay ?? getReferenceMatchDay(matches);
  const previousMatchDay =
    referenceMatchDay !== null && referenceMatchDay > 1
      ? referenceMatchDay - 1
      : null;
  const nextMatchDay =
    referenceMatchDay !== null ? referenceMatchDay + 1 : null;
  const matchListTitle = "Upcoming Matches" + (currentMatchDay ? ` - Match Day ${currentMatchDay}` : "");

  const isFormDisabled =
    isSubmitting || authRequired || !selectedMatch || selectedStatus === "Locked";
  const hasPredictedGoals = hasGoalPrediction(formState);

  const areGoalTimelineFieldsDisabled = !hasPredictedGoals;

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
            <p className="mt-1 text-sm">Log in to submit predictions and view your prediction history.</p>
          </div>
          <Link
            href="/login"
            className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            Login
          </Link>
        </div>
      ) : null}

      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">
            {matchListTitle}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous match day"
            disabled={isLoading || previousMatchDay === null}
            onClick={() => {
              if (previousMatchDay !== null) {
                void handleMatchDayChange(previousMatchDay);
              }
            }}
            className="grid h-10 w-10 place-items-center cursor-pointer rounded-md border border-zinc-300 bg-white text-lg font-semibold text-zinc-700 transition hover:border-emerald-700 hover:text-emerald-800 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400"
          >
            &lt;
          </button>
          <span className="min-w-28 text-center text-sm font-medium text-zinc-600">
            {referenceMatchDay === null
              ? "Match day"
              : `Day ${referenceMatchDay}`}
          </span>
          <button
            type="button"
            aria-label="Next match day"
            disabled={isLoading || nextMatchDay === null}
            onClick={() => {
              if (nextMatchDay !== null) {
                void handleMatchDayChange(nextMatchDay);
              }
            }}
            className="grid h-10 w-10 place-items-center cursor-pointer rounded-md border border-zinc-300 bg-white text-lg font-semibold text-zinc-700 transition hover:border-emerald-700 hover:text-emerald-800 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400"
          >
            &gt;
          </button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="h-64 animate-pulse rounded-md border border-zinc-200 bg-white shadow-sm"
            />
          ))
        ) : matches.length > 0 ? (
          matches.map((match) => {
            const isSelected = match.id === selectedMatchId;
            const isSaved = predictions.some(
              (prediction) => prediction.match_id === match.id,
            );

            return (
              <SelectableMatchCard
                key={match.id}
                match={match}
                isSaved={isSaved}
                isSelected={isSelected}
                handleCardClick={handleCardClick}
              />
            );
          })
        ) : (
          <div className="rounded-md border border-zinc-200 bg-white p-5 text-sm text-zinc-600 lg:col-span-3">
            No upcoming matches are available.
          </div>
        )}
      </section >

      <section className="flex justify-center">
        <div className="w-[20%] mr-5 flex flex-col gap-2 justify-center text-center bg-red-100">Player1 Image</div>
        <form
          className="relative w-[60%] rounded-md border border-zinc-200 bg-white p-5 shadow-sm"
          onSubmit={handleSubmit}
        >
          <div className="flex flex-wrap items-center justify-center gap-3">
            <div className="text-center">
              <h2 className="text-lg font-semibold text-zinc-950">
                Match Prediction
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                {selectedMatch
                  ? `${getMatchLabelText(selectedMatch)} - ${formatDateTime(
                    selectedMatch.match_datetime,
                  )}`
                  : "Select a match to continue"}
              </p>
            </div>
          </div>
          <div className="absolute right-[20px] top-[20px]">
            <StatusPill tone={getStatusTone(selectedStatus)}>
              {selectedStatus}
            </StatusPill>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="flex flex-row gap-4 justify-end">
              <span className="flex items-center gap-2 text-sm font-medium text-zinc-700">
                {selectedMatch ? (
                  <>
                    <span>{selectedMatch.team1_name}</span>
                    {selectedMatch.team1_flag_url ? (
                      <Image width={30} height={30} className="min-h-[25px] w-auto  rounded object-cover shadow-sm" decoding="async" loading="lazy" src={selectedMatch.team1_flag_url} alt={selectedMatch.team1_name} />
                    ) : null}
                  </>
                ) : "Team 1"}
              </span>
              <input
                min="0"
                max="100"
                name="team1_score"
                type="number"
                value={formState.team1Score || 0}
                onChange={(event) => updateField("team1Score", event.target.value)}
                className="mt-2 h-11 w-auto min-w-1/4 rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <div className="flex flex-row gap-4">
              <input
                min="0"
                max="100"
                name="team2_score"
                type="number"
                value={formState.team2Score || 0}
                onChange={(event) => updateField("team2Score", event.target.value)}
                className="mt-2 h-11 w-auto min-w-1/4 rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              />
              <span className="flex items-center gap-2 mt-2 text-sm font-medium text-zinc-700">
                {selectedMatch ? (
                  <>
                    {selectedMatch.team2_flag_url ? (
                      <Image width={30} height={30} className="min-h-[25px] w-auto  rounded object-cover shadow-sm" decoding="async" loading="lazy" src={selectedMatch.team2_flag_url} alt={selectedMatch.team2_name} />
                    ) : null}
                    <span>{selectedMatch.team2_name}</span>
                  </>
                ) : "Team 2"}
              </span>
            </div>
            <div className="flex flex-row gap-4 justify-end">
              <span className="flex items-center gap-2 mt-2 text-sm font-medium text-zinc-700">
                First Scoring Team
              </span>
              <select
                disabled={areGoalTimelineFieldsDisabled}
                name="first_scoring_team_id"
                required={hasPredictedGoals}
                value={formState.firstScoringTeamId}
                onChange={(event) =>
                  updateField("firstScoringTeamId", event.target.value)
                }
                className="mt-2 h-11 w-auto min-w-1/4 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100 disabled:bg-zinc-100 disabled:text-zinc-400"
              >
                <option value="">
                  {hasPredictedGoals ? "Select Team" : "Score is 0"}
                </option>
                {selectedMatch ? (
                  <>
                    {Number(formState.team1Score || 0) > 0 && (<option value={selectedMatch.team1_id}>
                      {selectedMatch.team1_name}
                    </option>)}
                    {Number(formState.team2Score || 0) > 0 && <option value={selectedMatch.team2_id}>
                      {selectedMatch.team2_name}
                    </option>}
                  </>
                ) : null}
              </select>
            </div>
            <div className="flex flex-row gap-4">
              <select
                disabled={areGoalTimelineFieldsDisabled}
                name="is_goal_in_first_half"
                required={hasPredictedGoals}
                value={formState.isGoalInFirstHalf}
                onChange={(event) =>
                  updateField("isGoalInFirstHalf", event.target.value)
                }
                className="mt-2 h-11 w-auto min-w-1/4 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100 disabled:bg-zinc-100 disabled:text-zinc-400"
              >
                <option value="">
                  {hasPredictedGoals ? "Select Option" : "Score is 0"}
                </option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
              <span className="flex items-center gap-2 mt-2 text-sm font-medium text-zinc-700">
                Goal in First Half ?
              </span>
            </div>
            <div className="flex flex-row gap-4 justify-end">
              <span className="flex items-center gap-2 mt-2 text-sm font-medium text-zinc-700">
                Total Yellow Cards
              </span>
              <input
                min="0"
                max="100"
                name="yellow_card_count"
                type="number"
                value={formState.yellowCardCount || 0}
                onChange={(event) =>
                  updateField("yellowCardCount", event.target.value)
                }
                className="mt-2 h-11 w-auto min-w-1/4 rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <div className="flex flex-row gap-4">
              <input
                min="0"
                max="100"
                name="red_card_count"
                type="number"
                value={formState.redCardCount || 0}
                onChange={(event) => updateField("redCardCount", event.target.value)}
                className="mt-2 h-11 w-auto min-w-1/4 rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              />
              <span className="flex items-center gap-2 mt-2 text-sm font-medium text-zinc-700">
                Total Red cards
              </span>
            </div>
            <div className="flex flex-row gap-4 justify-end">
              <span className="flex items-center gap-2 mt-2 text-sm font-medium text-zinc-700">
                <p>Kick-off team</p>
              </span>
              <select
                name="kick_off_team_id"
                value={formState.openingTeamId}
                onChange={(event) => updateField("openingTeamId", event.target.value)}
                className="mt-2 h-11 w-auto min-w-1/4 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              >
                {selectedMatch ? (
                  <>
                    <option value="">
                      Select Team
                    </option>
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
            </div>
            <div className="flex flex-row gap-4">
              <select
                name="match_duration"
                disabled={selectedMatch && selectedMatch.match_stage === "GROUP" ? true : false}
                value={selectedMatch && selectedMatch.match_stage === "GROUP" ? match_durations[0] : formState.gameDuration}
                onChange={(event) => updateField("gameDuration", event.target.value)}
                className={"mt-2 h-11 w-auto min-w-1/4 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100 disabled:bg-zinc-100 disabled:text-zinc-400"}
              >
                {match_durations.map((duration) => (
                  <option key={duration} value={duration}>
                    {durationLabels[duration]}
                  </option>
                ))}
              </select>
              <span className="flex items-center gap-2 mt-2 text-sm font-medium text-zinc-700">
                <p>Game duration</p>
              </span>
            </div>
          </div>

          {formError ? (
            <label className="block col-span-2">
              <p
                aria-live="polite"
                className="mt-5 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
              >
                {formError}
              </p></label>
          ) : null}
          {successMessage ? (
            <label className="block col-span-2">
              <p
                aria-live="polite"
                className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
              >
                {successMessage}
              </p></label>
          ) : null}

          <div className="grid place-items-center w-full">
            <button
              type="submit"
              disabled={isFormDisabled}
              className="mt-6 inline-flex h-11 w-full items-center cursor-pointer justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400 sm:w-auto"
            >
              {isSubmitting
                ? "Saving..."
                : selectedPrediction
                  ? "Update Prediction"
                  : "Save Prediction"}
            </button>
          </div>
        </form>
        <div className="w-[20%] ml-5 flex flex-col gap-2 justify-center text-center bg-red-100">Player2 Image</div>
      </section >
      <section className="overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm grid gap-6">
        <div className="border-b border-zinc-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-zinc-950">
            Prediction History
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1280px] divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
              <tr>
                <th className="px-5 py-3">Match</th>
                <th className="px-5 py-3">Score</th>
                <th className="px-5 py-3">First Score</th>
                <th className="px-5 py-3">Score 1H</th>
                <th className="px-5 py-3">Yellow Card</th>
                <th className="px-5 py-3">Red Card</th>
                <th className="px-5 py-3">Kick-off</th>
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
                          ? getMatchLabelWithFlag(predictionMatch)
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
                        {prediction.yellow_card_count}
                      </td>
                      <td className="px-5 py-4 text-zinc-700">
                        {prediction.red_card_count}
                      </td>
                      <td className="px-5 py-4 text-zinc-700">
                        {getTeamNameById(
                          predictionMatch,
                          prediction.kick_off_team_id,
                        )}
                      </td>
                      <td className="px-5 py-4 text-zinc-700">
                        {durationLabels[prediction.match_duration]}
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
      </section >
    </>
  );
};
