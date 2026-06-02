"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { Modal } from "@/components/ui/modal";
import { StatusPill } from "@/components/ui/status-pill";
import { ApiError } from "@/lib/api";
import { isAuthenticated, MissingAuthTokenError } from "@/lib/auth";
import { getErrorMessage } from "@/lib/forms/error-message";
import {
  firstGoalInLabels,
  firstGoalIns,
  listMatches,
  listUpcomingMatches,
  matchDurationLabels,
  matchDurations,
} from "@/lib/matches";
import type { MatchDuration, MatchResponse } from "@/lib/matches";
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
import { IconChevronLeft, IconChevronRight, IconSave } from "../ui/icons";
import { getCurrentMatchDay } from "@/lib/matches/match-service";
import ImageWithFallback from "../ui/image-with-fallback";
import { FirstGoalIn } from "@/lib/matches/types";

type PredictionFormState = {
  firstScoringTeamId: string;
  matchDuration: string;
  firstGoalIn: string;
  kickoffTeamId: string;
  redCardCount: string;
  team1Score: string;
  team2Score: string;
  yellowCardCount: string;
};

const emptyFormState: PredictionFormState = {
  firstScoringTeamId: "",
  matchDuration: "90",
  firstGoalIn: "",
  kickoffTeamId: "",
  redCardCount: "",
  team1Score: "",
  team2Score: "",
  yellowCardCount: "",
};

const getMatchLabelText = (match: MatchResponse): string => {
  return `${match.team1_name} vs ${match.team2_name}`;
};

const getTeamNameById = (
  match: MatchResponse | undefined,
  teamId: number | null,
): string => {
  if (teamId === null) {
    return "N/A";
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

const hasAnyGoalPrediction = (
  state: Pick<PredictionFormState, "team1Score" | "team2Score">,
): boolean => {
  const team1Score = Number(state.team1Score);
  const team2Score = Number(state.team2Score);

  return (
    (Number.isFinite(team1Score) && team1Score > 0) ||
    (Number.isFinite(team2Score) && team2Score > 0)
  );
};

const isMatchDuration = (value: string): value is MatchDuration => {
  return matchDurations.includes(value as MatchDuration);
};

const isFirstGoalIn = (value: string): value is FirstGoalIn => {
  return firstGoalIns.includes(value as FirstGoalIn);
};

const buildFormState = (
  match: MatchResponse,
  prediction?: PredictionResponse,
): PredictionFormState => {
  if (prediction) {
    return {
      firstScoringTeamId: prediction.first_scoring_team_id ? String(prediction.first_scoring_team_id) : "",
      firstGoalIn: prediction.first_goal_in || "",
      matchDuration: prediction.match_duration,
      kickoffTeamId: String(prediction.kick_off_team_id),
      redCardCount: String(prediction.red_card_count),
      team1Score: String(prediction.team1_score),
      team2Score: String(prediction.team2_score),
      yellowCardCount: String(prediction.yellow_card_count),
    };
  }

  return {
    ...emptyFormState,
    kickoffTeamId: String(match.team1_id),
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
  const [showUpdateConfirm, setShowUpdateConfirm] = useState(false);
  const [pendingPredictionFields, setPendingPredictionFields] = useState<PredictionFields | null>(null);

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
    const firstMatch = nextMatches.find((match) => !match.match_locked) ?? null;
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

        let matchDaySetting = null;
        try {
          matchDaySetting = await getCurrentMatchDay();
        } catch {
          console.warn("Failed to load match day setting");
        }

        const nextMatches = matchList.items;
        if (!hasAuthToken) {
          if (!isMounted) {
            return;
          }

          applyMatchSelection(nextMatches, []);
          setCurrentMatchDay(matchDaySetting?.value ? Number(matchDaySetting.value) : null);
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
        !hasAnyGoalPrediction(nextState)
      ) {
        return {
          ...nextState,
          firstScoringTeamId: "",
          firstGoalIn: "",
        };
      }

      return nextState;
    });
  };

  const buildPredictionFields = (): PredictionFields => {
    if (!isMatchDuration(formState.matchDuration)) {
      throw new Error("Match duration is required.");
    }

    const team1Score = parseNonNegativeInteger(
      formState.team1Score,
      "Team 1",
    );
    const team2Score = parseNonNegativeInteger(
      formState.team2Score,
      "Team 2",
    );
    const hasPredictedGoalsFromBothTeams = team1Score > 0 && team2Score > 0;
    const hasPredictedGoals = team1Score + team2Score > 0;

    return {
      first_scoring_team_id: hasPredictedGoalsFromBothTeams
        ? parsePositiveInteger(formState.firstScoringTeamId, "first scoring team")
        : null,
      first_goal_in: hasPredictedGoals && isFirstGoalIn(formState.firstGoalIn)
        ? formState.firstGoalIn
        : null,
      match_duration: formState.matchDuration,
      kick_off_team_id: parsePositiveInteger(
        formState.kickoffTeamId,
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

  const submitPrediction = async (predictionFields: PredictionFields) => {
    if (!selectedMatch) return;
    setIsSubmitting(true);
    try {
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

    let predictionFields: PredictionFields;
    try {
      predictionFields = buildPredictionFields();
    } catch (error) {
      setFormError(getErrorMessage(error, "Invalid prediction values."));
      return;
    }

    // Always show confirmation modal before saving
    setPendingPredictionFields(predictionFields);
    setShowUpdateConfirm(true);
  };

  const handleConfirmSubmit = async () => {
    if (!pendingPredictionFields) return;
    setShowUpdateConfirm(false);
    await submitPrediction(pendingPredictionFields);
    setPendingPredictionFields(null);
  };

  const handleCancelSubmit = () => {
    setShowUpdateConfirm(false);
    setPendingPredictionFields(null);
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
  const hasAnyPredictedGoals = hasAnyGoalPrediction(formState);

  const inputCls = "mt-1 h-11 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none transition focus:border-tournament-primary focus:ring-2 focus:ring-emerald-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:ring-emerald-900";
  const selectCls = "mt-1 h-11 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none transition focus:border-tournament-primary focus:ring-2 focus:ring-emerald-100 disabled:bg-zinc-100 disabled:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-500 dark:focus:ring-emerald-900";
  const labelTextCls = "flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300";

  return (
    <>
      {loadError ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-300">
          {loadError}
        </div>
      ) : null}

      {authRequired ? (
        <div className="flex flex-col gap-3 rounded-md border border-amber-200 px-4 py-4 text-sm dark:text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-zinc-300 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Login required</h2>
            <p className="mt-1 text-sm">Log in to submit your predictions.</p>
          </div>
          <Link
            href="/login"
            className="inline-flex h-10 items-center justify-center rounded-md bg-tournament-primary px-4 text-sm font-semibold dark:text-zinc-300 transition hover:bg-tournament-primary"
          >
            Login
          </Link>
        </div>
      ) : null}

      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
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
            className="grid h-10 w-10 place-items-center cursor-pointer rounded-md border border-zinc-300 dark:bg-zinc-900 dark:shadow-zinc-950 text-lg font-semibold text-zinc-700 transition hover:border-tournament-primary hover:text-emerald-800 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-tournament-primary dark:disabled:border-zinc-700 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600"
          >
            <IconChevronLeft />
          </button>
          <span className="min-w-28 text-center text-sm font-medium text-zinc-600 dark:text-zinc-400">
            {referenceMatchDay === null
              ? "Match day"
              : `Match Day ${referenceMatchDay}`}
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
            className="grid h-10 w-10 place-items-center cursor-pointer rounded-md border border-zinc-300 dark:bg-zinc-900 dark:shadow-zinc-950 text-lg font-semibold text-zinc-700 transition hover:border-tournament-primary hover:text-emerald-800 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-tournament-primary dark:disabled:border-zinc-700 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600"
          >
            <IconChevronRight />
          </button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="h-64 animate-pulse rounded-md border border-zinc-200 dark:bg-zinc-900 dark:shadow-zinc-950 shadow-sm dark:border-zinc-700 dark:bg-zinc-800"
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
          <div className="rounded-md border border-zinc-200 dark:bg-zinc-900 dark:shadow-zinc-950 p-5 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 lg:col-span-3">
            No upcoming matches are available.
          </div>
        )}
      </section >

      <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-center">
        <div className="hidden lg:flex w-40 h-[525px] shrink-0 grow basis-0 flex-col gap-2 items-center justify-center text-center bg-player rounded-md min-h-48">
          <ImageWithFallback width={525} height={525} src={"/images/players/" + selectedMatch?.team1_name_short?.toLowerCase() + ".png"} alt={selectedMatch?.team1_name || "Captain Image"} />
        </div>{""}
        <form
          className={(selectedStatus === "Locked" ? "opacity-50 " : "") + "relative w-full lg:max-w-2xl rounded-md border border-zinc-200 dark:bg-zinc-900 dark:shadow-zinc-950 p-4 sm:p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"}
          onSubmit={handleSubmit}
        >
          <div className="flex flex-wrap items-center justify-center gap-3">
            <div className="text-center">
              <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                Match Prediction
              </h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {selectedMatch
                  ? `${getMatchLabelText(selectedMatch)} - ${formatDateTime(
                    selectedMatch.match_datetime
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

          <div className="mt-6 grid gap-4 sm:grid-cols-2" id="prediction-fields">
            {/* Score row – Team 1 */}
            <label className="flex flex-col gap-1">
              <span className={labelTextCls}>
                {selectedMatch ? (
                  <>
                    {selectedMatch.team1_flag_url && (
                      <Image width={24} height={24} className="min-h-[30px] w-auto rounded object-cover shadow-sm" decoding="async" loading="lazy" src={selectedMatch.team1_flag_url} alt={selectedMatch.team1_name} />
                    )}
                    <span>{selectedMatch.team1_name} Score</span>
                  </>
                ) : "Team 1 Score"}
              </span>
              <input min="0" max="100" name="team1_score" type="number" value={formState.team1Score || 0} onChange={(e) => updateField("team1Score", e.target.value)} className={inputCls} />
            </label>

            {/* Score row – Team 2 */}
            <label className="flex flex-col gap-1">
              <span className={labelTextCls}>
                {selectedMatch ? (
                  <>
                    {selectedMatch.team2_flag_url && (
                      <Image width={24} height={24} className="min-h-[30px] w-auto rounded object-cover shadow-sm" decoding="async" loading="lazy" src={selectedMatch.team2_flag_url} alt={selectedMatch.team2_name} />
                    )}
                    <span>{selectedMatch.team2_name} Score</span>
                  </>
                ) : "Team 2 Score"}
              </span>
              <input min="0" max="100" name="team2_score" type="number" value={formState.team2Score || 0} onChange={(e) => updateField("team2Score", e.target.value)} className={inputCls} />
            </label>

            {/* First Goal in */}
            <label className="flex flex-col gap-1">
              <span className={labelTextCls}>First Goal in</span>
              <select disabled={!hasAnyPredictedGoals} name="first_goal_in" value={hasAnyPredictedGoals ? formState.firstGoalIn : ""} onChange={(e) => updateField("firstGoalIn", e.target.value)} className={selectCls}>
                <option value="">{hasAnyPredictedGoals ? "Select Time" : "N/A"}</option>
                {selectedMatch && selectedMatch.match_stage === "GROUP" && firstGoalIns.filter((fg) => fg !== "ET").map((fg) => <option key={fg} value={fg}>{firstGoalInLabels[fg]}</option>)}
                {selectedMatch && selectedMatch.match_stage !== "GROUP" && firstGoalIns.map((fg) => <option key={fg} value={fg}>{firstGoalInLabels[fg]}</option>)}
              </select>
            </label>

            {/* First Scoring Team */}
            <label className="flex flex-col gap-1">
              <span className={labelTextCls}>First Score by</span>
              <select disabled={!hasAnyPredictedGoals} name="first_scoring_team_id" value={hasAnyPredictedGoals ? formState.firstScoringTeamId : ""} onChange={(e) => updateField("firstScoringTeamId", e.target.value)} className={selectCls}>
                <option value="">{hasAnyPredictedGoals ? "Select Time" : "N/A"}</option>
                {selectedMatch && (<>
                  {Number(formState.team1Score || 0) > 0 && <option value={selectedMatch.team1_id}>{selectedMatch.team1_name}</option>}
                  {Number(formState.team2Score || 0) > 0 && <option value={selectedMatch.team2_id}>{selectedMatch.team2_name}</option>}
                </>)}
              </select>
            </label>

            {/* Yellow cards */}
            <label className="flex flex-col gap-1">
              <span className={labelTextCls}>Total Yellow Cards</span>
              <input min="0" max="100" name="yellow_card_count" type="number" value={formState.yellowCardCount || 0} onChange={(e) => updateField("yellowCardCount", e.target.value)} className={inputCls} />
            </label>

            {/* Red cards */}
            <label className="flex flex-col gap-1">
              <span className={labelTextCls}>Total Red Cards</span>
              <input min="0" max="100" name="red_card_count" type="number" value={formState.redCardCount || 0} onChange={(e) => updateField("redCardCount", e.target.value)} className={inputCls} />
            </label>

            {/* Kick-off team */}
            <label className="flex flex-col gap-1">
              <span className={labelTextCls}>Kick-off Team</span>
              <select name="kick_off_team_id" value={formState.kickoffTeamId} onChange={(e) => updateField("kickoffTeamId", e.target.value)} className={selectCls}>
                {selectedMatch ? (
                  <>
                    <option value="">Select Team</option>
                    <option value={selectedMatch.team1_id}>{selectedMatch.team1_name}</option>
                    <option value={selectedMatch.team2_id}>{selectedMatch.team2_name}</option>
                  </>
                ) : <option value="">Select match first</option>}
              </select>
            </label>

            {/* Match duration */}
            <label className="flex flex-col gap-1">
              <span className={labelTextCls}>Match Duration</span>
              <select name="match_duration" disabled={!!(selectedMatch && selectedMatch.match_stage === "GROUP")} value={selectedMatch && selectedMatch.match_stage === "GROUP" ? matchDurations[0] : formState.matchDuration} onChange={(e) => updateField("matchDuration", e.target.value)} className={selectCls}>
                {matchDurations.map((d) => <option key={d} value={d}>{matchDurationLabels[d]}</option>)}
              </select>
            </label>
          </div>

          {formError ? (
            <label className="block col-span-2">
              <p
                aria-live="polite"
                className="mt-5 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-300"
              >
                {formError}
              </p></label>
          ) : null}
          {successMessage ? (
            <label className="block col-span-2">
              <p
                aria-live="polite"
                className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
              >
                {successMessage}
              </p></label>
          ) : null}

          <div className="grid place-items-center w-full">
            <button
              type="submit"
              disabled={isFormDisabled}
              className="inline-flex h-11 px-4 items-center gap-2 mt-6 cursor-pointer justify-center rounded-md bg-tournament-primary px-4 text-sm font-semibold text-white transition hover:bg-tournament-primary disabled:cursor-not-allowed disabled:bg-zinc-400 sm:w-auto"
            >
              <IconSave className="h-4 w-4" />
              {isSubmitting
                ? "Saving..."
                : selectedPrediction
                  ? "Update Prediction"
                  : "Save Prediction"}
            </button>
          </div>
        </form>
        <div className="hidden lg:flex w-40 h-[525px] shrink-0 grow basis-0 flex-col gap-2 items-center justify-center text-center bg-player rounded-md min-h-48">
          <ImageWithFallback width={525} height={525} src={"/images/players/" + selectedMatch?.team2_name_short?.toLowerCase() + ".png"} alt={selectedMatch?.team2_name || "Captain Image"} />
        </div>
      </section>
      <section className="overflow-hidden rounded-md border border-zinc-200 dark:bg-zinc-900 dark:shadow-zinc-950 shadow-sm grid gap-6 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-700">
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Prediction History
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-700">
            <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              <tr>
                <th className="px-5 py-3">S.N.</th>
                <th className="px-5 py-3 text-center min-w-[300px]">Match</th>
                <th className="px-5 py-3">Score</th>
                <th className="px-5 py-3 min-w-[170px]">First Goal in</th>
                <th className="px-5 py-3 min-w-[170px]">First Score by</th>
                <th className="px-5 py-3 min-w-[150px]">Yellow Card</th>
                <th className="px-5 py-3 min-w-[120px]">Red Card</th>
                <th className="px-5 py-3 min-w-[120px]">Kick-off</th>
                <th className="px-5 py-3 min-w-[120px]">Duration</th>
                <th className="px-5 py-3 text-right min-w-[150px]">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {predictions.length > 0 ? (
                predictions.map((prediction, idx) => {
                  const predictionMatch = matches.find(
                    (match) => match.id === prediction.match_id,
                  );

                  return (
                    <tr key={prediction.id}>
                      <td className="px-5 py-4">{idx + 1}</td>
                      <td className="px-5 py-4 font-medium text-zinc-950 dark:text-zinc-50">
                        {predictionMatch
                          ? getMatchLabelWithFlag(predictionMatch)
                          : `Match #${prediction.match_id}`}
                      </td>
                      <td className="px-5 py-4 text-zinc-700 dark:text-zinc-300">
                        {prediction.team1_score} - {prediction.team2_score}
                      </td>
                      <td className="px-5 py-4 text-zinc-700 dark:text-zinc-300">
                        {prediction.first_goal_in ? firstGoalInLabels[prediction.first_goal_in] : "N/A"}
                      </td>
                      <td className="px-5 py-4 text-zinc-700 dark:text-zinc-300">
                        {getTeamNameById(
                          predictionMatch,
                          prediction.first_scoring_team_id,
                        )}
                      </td>
                      <td className="px-5 py-4 text-zinc-700 dark:text-zinc-300">
                        {prediction.yellow_card_count}
                      </td>
                      <td className="px-5 py-4 text-zinc-700 dark:text-zinc-300">
                        {prediction.red_card_count}
                      </td>
                      <td className="px-5 py-4 text-zinc-700 dark:text-zinc-300">
                        {getTeamNameById(
                          predictionMatch,
                          prediction.kick_off_team_id,
                        )}
                      </td>
                      <td className="px-5 py-4 text-zinc-700 dark:text-zinc-300">
                        {matchDurationLabels[prediction.match_duration]}
                      </td>
                      <td className="px-5 py-4 text-right text-zinc-700 dark:text-zinc-300">
                        {formatDateTime(prediction.predicted_datetime, false)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-8 text-center text-zinc-500 dark:text-zinc-400"
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

      {/* Prediction Confirmation Modal */}
      <Modal
        isOpen={showUpdateConfirm}
        onClose={handleCancelSubmit}
        title={selectedPrediction ? "Update Prediction" : "Confirm Prediction"}
      >
        <div className="flex flex-col gap-5">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {selectedPrediction ? (
              <>
                You are about to{" "}
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">change</span>{" "}
                your prediction for{" "}
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {selectedMatch ? getMatchLabelText(selectedMatch) : "this match"}
                </span>
                . This will overwrite your existing prediction.
              </>
            ) : (
              <>
                You are about to{" "}
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">submit</span>{" "}
                your prediction for{" "}
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {selectedMatch ? getMatchLabelText(selectedMatch) : "this match"}
                </span>
                . Please review before confirming.
              </>
            )}
          </p>

          {pendingPredictionFields && selectedMatch && (
            <div className="rounded-md border border-zinc-200 dark:border-zinc-700 overflow-hidden">
              <div className="bg-zinc-50 dark:bg-zinc-800 px-4 py-2 border-b border-zinc-200 dark:border-zinc-700">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Your Prediction
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-px bg-zinc-200 dark:bg-zinc-700">
                {([
                  [`${selectedMatch.team1_name} Score`, pendingPredictionFields.team1_score],
                  [`${selectedMatch.team2_name} Score`, pendingPredictionFields.team2_score],
                  ["First Goal In", pendingPredictionFields.first_goal_in ? firstGoalInLabels[pendingPredictionFields.first_goal_in] : "N/A"],
                  ["First Score By", pendingPredictionFields.first_scoring_team_id
                    ? getTeamNameById(selectedMatch, pendingPredictionFields.first_scoring_team_id)
                    : "N/A"],
                  ["Yellow Cards", String(pendingPredictionFields.yellow_card_count)],
                  ["Red Cards", String(pendingPredictionFields.red_card_count)],
                  ["Kick-off Team", pendingPredictionFields.kick_off_team_id ? getTeamNameById(selectedMatch, pendingPredictionFields.kick_off_team_id) : "N/A"],
                  ["Duration", matchDurationLabels[pendingPredictionFields.match_duration]],

                ] as [string, string][]).map(([label, value]) => (
                  <div key={label} className="flex flex-col gap-0.5 bg-white dark:bg-zinc-900 px-4 py-3">
                    <dt className="text-xs text-zinc-500 dark:text-zinc-400">{label}</dt>
                    <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={handleCancelSubmit}
              className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleConfirmSubmit()}
              disabled={isSubmitting}
              className="inline-flex h-10 items-center gap-2 justify-center rounded-md bg-tournament-primary px-4 text-sm font-semibold text-white transition hover:bg-tournament-primary disabled:cursor-not-allowed disabled:bg-zinc-400"
            >
              {isSubmitting
                ? (selectedPrediction ? "Updating..." : "Submitting...")
                : (selectedPrediction ? "Confirm Update" : "Confirm & Submit")}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};
