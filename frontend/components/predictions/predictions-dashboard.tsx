"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Modal } from "@/components/ui/modal";
import { StatusPill } from "@/components/ui/status-pill";
import { ToastViewport, useToast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { ApiError } from "@/lib/api";
import { isAuthenticated, MissingAuthTokenError, SessionExpiredError } from "@/lib/auth";
import { getErrorMessage } from "@/lib/forms/error-message";
import {
  firstGoalInLabels,
  firstGoalIns,
  getCurrentMatchDay,
  getMatchInsight,
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
  getLockUrgency,
  getMatchLabelWithFlag,
  getPredictionStatus,
  getStatusTone,
  isMatchPlayedOrLive,
  SelectableMatchCard,
} from "../ui/match-card";
import Image from "next/image";
import { IconCancel, IconChevronLeft, IconChevronRight, IconLiveDot, IconSave } from "../ui/icons";
import { IconSparkles } from "@/components/ui/icons";
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
  matchDuration: "",
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
  if (!state.team1Score || !state.team2Score) {
    return false;
  }

  // if any goal is predicted, set other 0 by default
  const team1Score = Number(state.team1Score || '0');
  const team2Score = Number(state.team2Score || '0');

  return (
    (Number.isFinite(team1Score) && team1Score > 0) ||
    (Number.isFinite(team2Score) && team2Score > 0)
  );
};

const isMatchDuration = (value: string): value is MatchDuration => {
  return value ? matchDurations.includes(value as MatchDuration) : false;
};

const isFirstGoalIn = (value: string): value is FirstGoalIn => {
  return firstGoalIns.includes(value as FirstGoalIn);
};

const getWinnerTeamId = (team1Score: number | null, team2Score: number | null, selectedMatch: MatchResponse | null) => {
  if (!team1Score || !team2Score) {
    return null;
  }
  if (team1Score > team2Score) {
    return selectedMatch?.team1_id || null;
  }
  if (team2Score > team1Score) {
    return selectedMatch?.team2_id || null;
  }
  return null;
};

const toFormValue = (value: number | string | null | undefined): string =>
  value === null || value === undefined ? "" : String(value);

const buildFormState = (
  match: MatchResponse,
  prediction?: PredictionResponse,
): PredictionFormState => {
  if (prediction) {
    return {
      firstScoringTeamId: toFormValue(prediction.first_scoring_team_id),
      firstGoalIn: toFormValue(prediction.first_goal_in),
      matchDuration: toFormValue(prediction.match_duration),
      kickoffTeamId: toFormValue(prediction.kick_off_team_id),
      redCardCount: toFormValue(prediction.red_card_count),
      team1Score: toFormValue(prediction.team1_score),
      team2Score: toFormValue(prediction.team2_score),
      yellowCardCount: toFormValue(prediction.yellow_card_count),
    };
  }

  return emptyFormState;
};

const arePredictionFormStatesEqual = (
  current: PredictionFormState,
  initial: PredictionFormState,
): boolean =>
  current.firstScoringTeamId === initial.firstScoringTeamId &&
  current.firstGoalIn === initial.firstGoalIn &&
  current.matchDuration === initial.matchDuration &&
  current.kickoffTeamId === initial.kickoffTeamId &&
  current.redCardCount === initial.redCardCount &&
  current.team1Score === initial.team1Score &&
  current.team2Score === initial.team2Score &&
  current.yellowCardCount === initial.yellowCardCount;

const getReferenceMatchDay = (matches: MatchResponse[]): number | null => {
  return matches[0]?.match_day ?? null;
};

export const PredictionsDashboard = () => {
  const searchParams = useSearchParams();
  // Parse and validate query params — ignore non-numeric / out-of-range values.
  const paramMatchDay = (() => {
    const raw = searchParams.get("matchday");
    const n = raw ? Number(raw) : NaN;
    return Number.isInteger(n) && n > 0 ? n : null;
  })();
  const paramMatchId = (() => {
    const raw = searchParams.get("id");
    const n = raw ? Number(raw) : NaN;
    return Number.isInteger(n) && n > 0 ? n : null;
  })();

  const [authRequired, setAuthRequired] = useState(false);
  const [currentMatchDay, setCurrentMatchDay] = useState<number | null>(null);
  const [formState, setFormState] = useState<PredictionFormState>(emptyFormState);
  const [isAiPicking, setIsAiPicking] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchResponse[]>([]);
  const [allMatches, setAllMatches] = useState<MatchResponse[]>([]);
  const [predictions, setPredictions] = useState<PredictionResponse[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [showUpdateConfirm, setShowUpdateConfirm] = useState(false);
  const [pendingPredictionFields, setPendingPredictionFields] = useState<PredictionFields | null>(null);
  const { dismissToast, showToast, toasts } = useToast();

  // ref for the horizontal card scroll container
  const cardStripRef = useRef<HTMLElement>(null);

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
  const initialFormState = useMemo(
    () =>
      selectedMatch
        ? buildFormState(selectedMatch, selectedPrediction)
        : emptyFormState,
    [selectedMatch, selectedPrediction],
  );
  const isPredictionDirty = selectedPrediction
    ? !arePredictionFormStatesEqual(formState, initialFormState)
    : true;
  // Scroll the selected card into view whenever selectedMatchId changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [predictions]);

  const applyMatchSelection = useCallback((
    nextMatches: MatchResponse[],
    nextPredictions: PredictionResponse[],
    preferredMatchId?: number | null,
  ) => {
    // Prefer the match from the URL `id` param; fall back to first unlocked match.
    const selectedMatch =
      (preferredMatchId != null
        ? nextMatches.find((m) => m.id === preferredMatchId)
        : undefined)
      ?? nextMatches.find((m) => !m.match_locked)
      ?? nextMatches[0]
      ?? null;

    const matchPrediction = selectedMatch
      ? nextPredictions.find((p) => p.match_id === selectedMatch!.id)
      : undefined;

    setMatches(nextMatches);
    setSelectedMatchId(selectedMatch?.id ?? null);
    setFormState(
      selectedMatch
        ? buildFormState(selectedMatch, matchPrediction)
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
        // ── Step 1: Resolve which match day to display ─────────────────────
        // Priority: URL param → server current match day → fallback (upcoming)
        let resolvedMatchDay: number | null = paramMatchDay;

        if (resolvedMatchDay === null) {
          try {
            const setting = await getCurrentMatchDay();
            resolvedMatchDay = setting?.value ? Number(setting.value) : null;
          } catch {
            console.warn("Failed to load current match day from server");
          }
        }

        // ── Step 2: Fetch matches for the resolved match day ───────────────
        let matchListItems: MatchResponse[] = [];

        if (resolvedMatchDay !== null) {
          try {
            const matchListResponse = await listMatches({ matchDay: resolvedMatchDay });
            matchListItems = matchListResponse.items;
          } catch {
            console.warn(`Failed to load matches for match day ${resolvedMatchDay}`);
          }
        }

        // ── Step 3: Fall back to upcoming matches if nothing was found ──────
        if (matchListItems.length === 0) {
          if (paramMatchDay !== null) {
            // Param was supplied but yielded no results — warn the user.
            setLoadError(`No matches found for match day ${paramMatchDay}.`);
          }
          resolvedMatchDay = null;
          try {
            const upcomingResponse = await listUpcomingMatches({ includeLocked: true, limit: 50 });
            matchListItems = upcomingResponse.items;
            // Use the match day of the first upcoming match as the reference.
            resolvedMatchDay = matchListItems[0]?.match_day ?? null;
          } catch {
            console.warn("Failed to load upcoming matches");
          }
        }

        // ── Step 4: Prefetch all matches for the match-day navigator ───────
        try {
          const allMatchesResponse = await listMatches({ limit: 1000 });
          if (allMatchesResponse?.items?.length) {
            setAllMatches(allMatchesResponse.items);
          }
        } catch { }

        if (!isMounted) return;

        // ── Step 5: Apply the match list (unauthenticated path) ────────────
        if (!hasAuthToken) {
          applyMatchSelection(matchListItems, [], paramMatchId);
          setCurrentMatchDay(resolvedMatchDay);
          setAuthRequired(true);
          setPredictions([]);
          return;
        }

        // ── Step 6: Fetch predictions and apply (authenticated path) ───────
        const predictionList = await listCurrentUserPredictions({ limit: 500 });

        if (!isMounted) return;

        applyMatchSelection(matchListItems, predictionList.items, paramMatchId);
        setCurrentMatchDay(resolvedMatchDay);
        setAuthRequired(false);
        setPredictions(predictionList.items);
      } catch (error) {
        if (!isMounted) return;

        if (
          error instanceof SessionExpiredError ||
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
    };

    void loadPageData();

    return () => {
      isMounted = false;
    };
    // Re-run whenever URL params change (navigation from match card "Predict" button).
  }, [applyMatchSelection, paramMatchDay, paramMatchId]);

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
    const team1Score = formState.team1Score ? parseNonNegativeInteger(
      formState.team1Score,
      "Team 1",
    ) : null;

    const team2Score = formState.team2Score ? parseNonNegativeInteger(
      formState.team2Score,
      "Team 2",
    ) : null;

    return {
      first_goal_in: formState.firstGoalIn && isFirstGoalIn(formState.firstGoalIn)
        ? formState.firstGoalIn
        : null,
      first_scoring_team_id: formState.firstScoringTeamId
        ? parseNonNegativeInteger(formState.firstScoringTeamId, "First Score by")
        : null,
      kick_off_team_id: formState.kickoffTeamId ? parsePositiveInteger(
        formState.kickoffTeamId,
        "Kick-off team",
      ) : null,
      match_duration: isMatchDuration(formState.matchDuration) ? formState.matchDuration : (selectedMatch?.match_stage === "GROUP" ? '90' : null),
      red_card_count: formState.redCardCount !== '' ? parseNonNegativeInteger(
        formState.redCardCount,
        "Red cards",
      ) : 0,
      team1_score: team1Score,
      team2_score: team2Score,
      yellow_card_count: formState.yellowCardCount !== '' ? parseNonNegativeInteger(
        formState.yellowCardCount,
        "Yellow cards",
      ) : null,
      winner_team_id: getWinnerTeamId(team1Score, team2Score, selectedMatch),
    };
  };

  const showAuthRequiredToast = () => {
    showToast({
      action: (
        <Link
          href="/login"
          className="inline-flex h-8 items-center justify-center rounded-md border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          Login
        </Link>
      ),
      durationMs: 7000,
      id: "prediction-auth-required",
      message: "Please login to submit your prediction.",
      title: "Login required",
      tone: "info",
    });
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
      showToast({
        message: selectedPrediction
          ? "Prediction updated successfully."
          : "Prediction submitted successfully.",
        tone: "success",
      });
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        setAuthRequired(true);
        return;
      }

      if (
        error instanceof MissingAuthTokenError ||
        (error instanceof ApiError && error.status === 401)
      ) {
        setAuthRequired(true);
        showAuthRequiredToast();
      } else {
        showToast({
          message: getErrorMessage(error, "Unable to save prediction. Please try again."),
          tone: "error",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (authRequired || !isAuthenticated()) {
      setAuthRequired(true);
      showAuthRequiredToast();
      return;
    }

    if (!selectedMatch) {
      showToast({
        message: "Select a match before saving a prediction.",
        tone: "error",
      });
      return;
    }

    if (getPredictionStatus(selectedMatch) === "Locked") {
      showToast({
        message: "Prediction is locked for this match.",
        tone: "error",
      });
      return;
    }

    if (selectedPrediction && !isPredictionDirty) {
      return;
    }

    let predictionFields: PredictionFields;
    try {
      predictionFields = buildPredictionFields();
    } catch (error) {
      showToast({
        message: getErrorMessage(error, "Invalid prediction values."),
        tone: "error",
      });
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

  const handleResetPredictionChanges = () => {
    setFormState({ ...initialFormState });
  };

  const handleAiPick = async () => {
    if (authRequired || !isAuthenticated()) {
      setAuthRequired(true);
      showAuthRequiredToast();
      return;
    }

    if (!selectedMatch) {
      showToast({
        message: "Select a match before using AI pick.",
        tone: "error",
      });
      return;
    }

    if (selectedStatus === "Locked") {
      showToast({
        message: "Prediction is locked for this match.",
        tone: "error",
      });
      return;
    }

    setIsAiPicking(true);
    try {
      const matchInsight = await getMatchInsight(selectedMatch.id);
      const team1Score = matchInsight.predicted_team1_score;
      const team2Score = matchInsight.predicted_team2_score;

      if (team1Score === null || team2Score === null) {
        showToast({
          message: matchInsight.summary || "AI score pick is not available for this match.",
          tone: "error",
        });
        return;
      }

      const totalGoals = team1Score + team2Score;
      const isKnockout = selectedMatch.match_stage !== "GROUP";

      // Random yellow cards: 1–6
      const randomYellowCards = Math.floor(Math.random() * 5) + 1;

      // Random red cards: 0 or 1, weighted heavily toward 0 (25% chance of 1)
      const randomRedCards = Math.random() < 0.05 ? 1 : 0;

      // Random first scoring team (only if goals > 0)
      let randomFirstScoringTeamId = "";
      if (totalGoals > 0) {
        const candidateTeams: number[] = [];
        if (team1Score > 0) candidateTeams.push(selectedMatch.team1_id);
        if (team2Score > 0) candidateTeams.push(selectedMatch.team2_id);
        randomFirstScoringTeamId = String(candidateTeams[Math.floor(Math.random() * candidateTeams.length)]);
      }

      // Random first goal in (only if goals > 0)
      const availableFirstGoalIns: string[] = isKnockout
        ? [...firstGoalIns]
        : firstGoalIns.filter((fg) => fg !== "ET");

      const getRandomFirstGoalIn = () => {
        const weights = availableFirstGoalIns.map((fg, idx) => {
          if (isKnockout) {
            return {
              label: fg,
              value: idx === 0 ? 60 : idx === 1 ? 27 : 13,
            };
          }

          return {
            label: fg,
            value: idx === 0 ? 70 : 30,
          };

        });

        const totalWeight = weights.reduce(
          (sum, weight) => sum + weight.value,
          0
        );

        console.log(12121, totalWeight)

        let random = Math.random() * totalWeight;

        for (const option of weights) {
          random -= option.value;
          if (random <= 0) {
            return option.label;
          }
        }

        return availableFirstGoalIns[0];
      };

      const randomFirstGoalIn =
        totalGoals > 0
          ? getRandomFirstGoalIn()
          : "";

      // Random kick-off team (only for knockout stage)
      const randomKickoffTeamId = String(Math.random() < 0.5 ? selectedMatch.team1_id : selectedMatch.team2_id);

      // Random match duration (only for knockout stage, weighted toward 90)
      const randomMatchDuration = isKnockout
        ? (() => { const roll = Math.random(); return roll < 0.6 ? "90" : roll < 0.85 ? "120" : "PENALTY"; })()
        : "90";

      setFormState((current) => ({
        ...current,
        firstGoalIn: randomFirstGoalIn,
        firstScoringTeamId: randomFirstScoringTeamId,
        kickoffTeamId: randomKickoffTeamId,
        matchDuration: isKnockout ? randomMatchDuration : current.matchDuration || "90",
        redCardCount: String(randomRedCards),
        team1Score: String(team1Score),
        team2Score: String(team2Score),
        yellowCardCount: String(randomYellowCards),
      }));
      showToast({
        message: matchInsight.summary || "AI score pick loaded.",
        tone: "success",
      });
    } catch (error) {
      showToast({
        message: getErrorMessage(error, "Unable to load AI score pick."),
        tone: "error",
      });
    } finally {
      setIsAiPicking(false);
    }
  };

  const handleCardClick = (match: MatchResponse) => {
    const clickedPrediction = predictions.find(
      (prediction) => prediction.match_id === match.id,
    );

    setSelectedMatchId(match.id);
    setFormState(buildFormState(match, clickedPrediction));

    // scroll card to the view box
    if (!cardStripRef.current) return;
    const card = cardStripRef.current.querySelector<HTMLElement>(
      `[data-match-id="${match.id}"]`,
    );

    if (!card) return;
    card.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  };

  const handleMatchDayChange = async (matchDay: number) => {
    setIsLoading(true);
    setLoadError(null);

    try {
      let matchList = allMatches.filter((match) => match.match_day === matchDay);

      if (matchList.length) {
        const matchResponse = await listMatches({ matchDay });
        matchList = matchResponse.items;
      }

      if (matchList.length === 0) {
        setLoadError(`No matches found for match day ${matchDay}.`);
        setCurrentMatchDay(null);
      } else {
        setCurrentMatchDay(matchDay);
        applyMatchSelection(matchList, predictions);
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
  const isSubmitDisabled =
    isFormDisabled || isAiPicking || (Boolean(selectedPrediction) && !isPredictionDirty);
  const hasAnyPredictedGoals = hasAnyGoalPrediction(formState);

  const inputCls = "mt-1 h-10 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none transition focus:border-tournament-primary focus:ring-2 focus:ring-emerald-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:ring-emerald-900";
  const selectCls = "mt-1 h-10 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none transition focus:border-tournament-primary focus:ring-2 focus:ring-emerald-100 disabled:bg-zinc-100 disabled:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-500 dark:focus:ring-emerald-900";
  const labelTextCls = "flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300";

  const { isMatchPlayed, isMatchLive } = selectedMatch ? isMatchPlayedOrLive(selectedMatch) : { isMatchPlayed: false, isMatchLive: false };

  return (
    <>
      <ToastViewport onDismiss={dismissToast} toasts={toasts} />

      {/* Card strip — ref attached so scroll-into-view can target it */}
      <section ref={cardStripRef} >
        <div className="mb-4 flex items-end justify-end sm:justify-between gap-4">
          <div className="hidden sm:block">
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              {matchListTitle}
            </h2>
            <p className="hidden md:block text-sm text-zinc-500 dark:text-zinc-400">Select match day and match to make your predictions for the match.</p>
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
              <IconChevronLeft className="h-5 w-5" />
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
              <IconChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className={[
          "flex gap-4 overflow-x-scroll p-4 overflow-hidden rounded-md",
          "border border-zinc-200 dark:border-zinc-700",
          "shadow-sm dark:shadow-zinc-950",
          "bg-white dark:bg-zinc-900"
        ].join(" ")}>
          {isLoading ? (
            Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="h-55 w-[280px] shrink-0 animate-pulse rounded-md border border-zinc-200 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:shadow-zinc-950 sm:w-80 lg:w-[360px]"
              />
            ))
          ) : matches.length > 0 ? (
            matches.map((match) => {
              const isSelected = match.id === selectedMatchId;
              const prediction = predictions.find(
                (prediction) => prediction.match_id === match.id,
              );

              const isSaved = !!prediction;
              let isCorrectWinner = null;
              if (match.team1_score !== null && match.team2_score !== null) {
                isCorrectWinner = prediction ? (match.match_locked && ((prediction.team1_score ?? 0) > (prediction.team2_score ?? 0) && match.winner_id === match.team1_id) || ((prediction.team2_score ?? 0) > (prediction.team1_score ?? 0) && match.winner_id === match.team2_id) || (prediction.team1_score === prediction.team2_score && match.winner_id === null)) : false;
              }

              return (
                <SelectableMatchCard
                  key={match.id}
                  match={match}
                  isSaved={isSaved}
                  isPredictionAvailable={predictions.length > 0}
                  isCorrectWinner={isCorrectWinner}
                  isSelected={isSelected}
                  handleCardClick={handleCardClick}
                  className="h-55 shrink-0 w-[360px]"
                />
              );
            })
          ) : (
            <div className="w-full rounded-md border border-zinc-200 p-5 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:shadow-zinc-950">
              No upcoming matches are available.
            </div>
          )}
        </div>
      </section >

      {loadError ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-300">
          {loadError}
        </div>
      ) : null}

      <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-center">
        <div className={[
          "hidden lg:flex w-40 h-[504px] shrink-0 grow basis-0 flex-col gap-2 items-center justify-center text-center bg-player rounded-md min-h-48",
          (selectedMatch?.winner_id && selectedMatch?.winner_id === selectedMatch?.team2_id) ? "opacity-50" : (selectedMatch?.team1_score !== null && selectedMatch?.team1_score === selectedMatch?.team2_score) ? "opacity-70" : "opacity-100",
          (selectedMatch?.match_stage !== "GROUP" && selectedMatch?.winner_id && selectedMatch?.winner_id === selectedMatch?.team2_id) ? "filter grayscale" : ""
        ].join(" ")}>
          <ImageWithFallback width={530} height={530} src={"/images/players/" + selectedMatch?.team1_name_short?.toLowerCase() + ".png"} alt={selectedMatch?.team1_name || "Captain Image"} />
        </div>
        <div className="overflow-x-auto relative w-full lg:max-w-2xl rounded-md md:w-full">
          <form
            className={[
              "min-w-[315px]",
              "border border-zinc-200 dark:border-zinc-700",
              "dark:shadow-zinc-950 p-2 sm:p-4 shadow-sm",
              "dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-black",
              (selectedStatus === "Locked" ? "opacity-50 pointer-events-none " : ""),
            ].join(" ")}
            onSubmit={handleSubmit}
          >
            <div className="absolute inset-0 bg-[url('/images/logo-tournament.avif')] bg-center bg-no-repeat bg-cover opacity-[0.07] dark:opacity-[0.05] pointer-events-none bg-prediction"></div>
            <div className="absolute left-[15px] top-[15px]">
              <Tooltip content="Predict the score from H2H, recent form, tournament form, and FIFA ranking" side="right">
                <button
                  type="button"
                  disabled={isFormDisabled || isAiPicking}
                  onClick={() => void handleAiPick()}
                  className="mt-0 inline-flex h-8 items-center justify-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:border-emerald-700 dark:hover:bg-emerald-900 dark:disabled:border-zinc-700 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
                >
                  <IconSparkles className="h-4 w-4" />
                  <p className="hidden md:block text-sm">{isAiPicking ? "Picking ..." : "Auto predict with AI"}</p>
                </button>
              </Tooltip>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <div className="text-center">
                <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                  Match Prediction
                </h2>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  {selectedMatch
                    ? `${getMatchLabelText(selectedMatch)} - ${formatDateTime(
                      selectedMatch.match_datetime
                    )}`
                    : "Select a match to continue"}
                </p>
              </div>
            </div>
            <div className="absolute right-[15px] top-[15px]">
              {selectedMatch && isMatchPlayed
                ? (<StatusPill tone={isMatchLive ? "green" : "primary"} urgency="none">{isMatchLive ? <IconLiveDot /> : null} {isMatchLive ? "Live: " : "FT: "}{selectedMatch.team1_score} - {selectedMatch.team2_score}</StatusPill>)
                : (<StatusPill tone={getStatusTone(selectedStatus)} urgency={selectedMatch ? getLockUrgency(selectedMatch) : "none"}>
                  {selectedStatus}
                </StatusPill>)}
            </div>


            <div className="mt-6 grid gap-4 xs:grid-cols-1 grid-cols-2">
              {/* Score row – Team 1 */}
              <label className="flex flex-col gap-1">
                <span className={labelTextCls}>
                  {selectedMatch ? (
                    <>
                      {selectedMatch.team1_flag_url && (
                        <Image width={32} height={32} className="min-h-[30px] w-auto rounded object-cover shadow-sm" decoding="async" loading="lazy" src={selectedMatch.team1_flag_url} alt={selectedMatch.team1_name} />
                      )}
                      <span>{selectedMatch.team1_name} {selectedMatch.team1_fifa_rank ? `(Rank: ${selectedMatch.team1_fifa_rank})` : ""}</span>
                    </>
                  ) : "Team 1 Score"}
                </span>
                <input min="0" max="100" name="team1_score" type="number" value={formState.team1Score} onChange={(e) => {
                  updateField("team1Score", e.target.value);
                  if (e.target.value && formState.team2Score === '') updateField("team2Score", '0');
                  else if (!e.target.value && formState.team2Score === '0') updateField("team2Score", '');
                }} className={inputCls} />
              </label>

              {/* Score row – Team 2 */}
              <label className="flex flex-col gap-1">
                <span className={labelTextCls}>
                  {selectedMatch ? (
                    <>
                      {selectedMatch.team2_flag_url && (
                        <Image width={32} height={32} className="min-h-[30px] w-auto rounded object-cover shadow-sm" decoding="async" loading="lazy" src={selectedMatch.team2_flag_url} alt={selectedMatch.team2_name} />
                      )}
                      <span>{selectedMatch.team2_name} {selectedMatch.team2_fifa_rank ? `(Rank: ${selectedMatch.team2_fifa_rank})` : ""}</span>
                    </>
                  ) : "Team 2 Score"}
                </span>
                <input min="0" max="100" name="team2_score" type="number" value={formState.team2Score} onChange={(e) => {
                  updateField("team2Score", e.target.value);
                  if (e.target.value && formState.team1Score === '') updateField("team1Score", '0');
                  else if (!e.target.value && formState.team1Score === '0') updateField("team1Score", '');
                }} className={inputCls} />
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
                  <option value="">{hasAnyPredictedGoals ? "Select Team" : "N/A"}</option>
                  {selectedMatch && (<>
                    {Number(formState.team1Score || 0) > 0 && <option value={selectedMatch.team1_id}>{selectedMatch.team1_name}</option>}
                    {Number(formState.team2Score || 0) > 0 && <option value={selectedMatch.team2_id}>{selectedMatch.team2_name}</option>}
                  </>)}
                </select>
              </label>

              {/* Yellow cards */}
              <label className="flex flex-col gap-1">
                <span className={labelTextCls}>Total Yellow Cards</span>
                <input min="0" max="100" name="yellow_card_count" type="number" value={formState.yellowCardCount || ''} onChange={(e) => updateField("yellowCardCount", e.target.value)} className={inputCls} />
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
                  {Number(formState.team1Score) === Number(formState.team2Score) ?
                    matchDurations.filter((duration) => duration !== "PENALTY").map((d) => <option key={d} value={d}>{matchDurationLabels[d]}</option>)
                    : matchDurations.map((d) => <option key={d} value={d}>{matchDurationLabels[d]}</option>)}
                </select>
              </label>
            </div>

            <div className="mt-5 flex w-full flex-wrap items-center justify-center gap-3">
              {selectedPrediction && isPredictionDirty ? (
                <button
                  type="button"
                  aria-label="Reset changes to saved prediction"
                  disabled={isFormDisabled || isAiPicking}
                  onClick={handleResetPredictionChanges}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:bg-zinc-800 dark:disabled:border-zinc-700 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
                >
                  <IconCancel className="h-4 w-4" />
                  Cancel
                </button>
              ) : null}
              <button
                type="submit"
                disabled={isSubmitDisabled}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-tournament-primary px-4 text-sm font-semibold text-white transition hover:bg-tournament-primary disabled:cursor-not-allowed disabled:bg-zinc-400 sm:w-auto"
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
        </div>
        <div className={[
          "hidden lg:flex w-40 h-[504px] shrink-0 grow basis-0 flex-col gap-2 items-center justify-center text-center bg-player rounded-md min-h-48",
          (selectedMatch?.winner_id && selectedMatch?.winner_id === selectedMatch?.team1_id) ? "opacity-50" : (selectedMatch?.team1_score !== null && selectedMatch?.team1_score === selectedMatch?.team2_score) ? "opacity-70" : "opacity-100",
          (selectedMatch?.match_stage !== "GROUP" && selectedMatch?.winner_id && selectedMatch?.winner_id === selectedMatch?.team1_id) ? "filter grayscale" : ""
        ].join(" ")}>
          <ImageWithFallback width={530} height={530} src={"/images/players/" + selectedMatch?.team2_name_short?.toLowerCase() + ".png"} alt={selectedMatch?.team2_name || "Captain Image"} />
        </div>
      </section >

      {!authRequired && (<section className="overflow-hidden rounded-md border border-zinc-200 dark:bg-zinc-900 dark:shadow-zinc-950 shadow-sm grid dark:border-zinc-700 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-700">
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Prediction History
          </h2>
        </div>
        <div className="overflow-auto max-h-[40rem]">
          <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-700">
            <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              <tr>
                <th className={[
                  "static sm:sticky left-0 top-0 z-40 w-[50px] min-w-[50px] max-w-[50px]",
                  "bg-zinc-100 dark:bg-zinc-800",
                  "border-b border-zinc-200 dark:border-zinc-700",
                  "pl-3 pr-3 py-3"
                ].join(" ")}>S.N.</th>
                <th className={[
                  "static sm:sticky left-[50px] top-0 z-40 w-[120px] min-w-[120px] max-w-[120px] md:w-[350px] md:min-w-[350px] md:max-w-[350px]",
                  "bg-zinc-100 dark:bg-zinc-800",
                  "text-center font-semibold text-sm",
                  "border-b border-zinc-200 dark:border-zinc-700",
                  "pl-2 pr-3 py-3 text-center",
                ].join(" ")}>Match</th>
                <th className={[
                  "static sm:sticky top-0 z-30",
                  "bg-zinc-100 dark:bg-zinc-700",
                  "px-3 py-3 border-b border-zinc-200 dark:border-zinc-700"
                ].join(" ")}>Score</th>
                <th className={[
                  "static sm:sticky top-0 z-30",
                  "bg-zinc-100 dark:bg-zinc-700",
                  "px-3 py-3 border-b border-zinc-200 dark:border-zinc-700 min-w-[135px]"
                ].join(" ")}>First Goal in</th>
                <th className={[
                  "static sm:sticky top-0 z-30",
                  "bg-zinc-100 dark:bg-zinc-700",
                  "px-3 py-3 border-b border-zinc-200 dark:border-zinc-700 min-w-[145px]"
                ].join(" ")}>First Score by</th>
                <th className={[
                  "static sm:sticky top-0 z-30",
                  "bg-zinc-100 dark:bg-zinc-700",
                  "px-3 py-3 border-b border-zinc-200 dark:border-zinc-700 min-w-[135px]"
                ].join(" ")}>Yellow Card</th>
                <th className={[
                  "static sm:sticky top-0 z-30",
                  "bg-zinc-100 dark:bg-zinc-700",
                  "px-3 py-3 border-b border-zinc-200 dark:border-zinc-700 min-w-[100px]"
                ].join(" ")}>Red Card</th>
                <th className={[
                  "static sm:sticky top-0 z-30",
                  "bg-zinc-100 dark:bg-zinc-700",
                  "px-3 py-3 border-b border-zinc-200 dark:border-zinc-700 min-w-[100px]"
                ].join(" ")}>Kick-off</th>
                <th className={[
                  "static sm:sticky top-0 z-30",
                  "bg-zinc-100 dark:bg-zinc-700",
                  "px-3 py-3 border-b border-zinc-200 dark:border-zinc-700 min-w-[100px]"
                ].join(" ")}>Duration</th>
                <th className={[
                  "static sm:sticky top-0 z-30",
                  "bg-zinc-100 dark:bg-zinc-700",
                  "px-3 py-3 border-b border-zinc-200 dark:border-zinc-700 text-right min-w-[135px]"
                ].join(" ")}>Submitted at</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {predictions.length > 0 ? (
                predictions.sort((a, b) => b.created_at.localeCompare(a.created_at)).map((prediction, idx) => {
                  const predictionMatch = allMatches.find(
                    (match) => match.id === prediction.match_id,
                  );

                  return (
                    <tr key={prediction.id}>
                      <td className={[
                        "static sm:sticky left-0 z-20 w-[50px] min-w-[50px] max-w-[50px]",
                        "bg-white dark:bg-zinc-950",
                        "border-b border-zinc-200 dark:border-zinc-800",
                        "pl-3 pr-3 py-4 text-left text-zinc-700 dark:text-zinc-300"
                      ].join(" ")}>{idx + 1}</td>
                      <td className={[
                        "static md:sticky left-[50px] z-20 md:w-[350px] md:min-w-[350px] md:max-w-[350px]",
                        "bg-white dark:bg-zinc-950",
                        "border-b border-zinc-200 dark:border-zinc-800",
                        "pl-2 pr-3 py-4 font-medium text-zinc-950 dark:text-zinc-50",
                        "hidden md:table-cell"
                      ].join(" ")}>
                        {predictionMatch
                          ? getMatchLabelWithFlag(predictionMatch)
                          : `Match #${prediction.match_id}`}
                      </td>
                      <td className={[
                        "static sm:sticky left-[50px] z-20 w-[120px] min-w-[120px] max-w-[120px]",
                        "bg-white dark:bg-zinc-950",
                        "border-b border-zinc-200 dark:border-zinc-800",
                        "pl-2 pr-3 py-4 font-medium text-zinc-950 dark:text-zinc-50",
                        "table-cell md:hidden"
                      ].join(" ")}>
                        {predictionMatch
                          ? <div className="flex justify-center"><p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mr-1">{predictionMatch.team1_name_short}</p>vs
                            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 ml-1">{predictionMatch.team2_name_short}</p></div>
                          : `Match #${prediction.match_id}`}
                      </td>
                      <td className="px-3 py-4 text-zinc-700 dark:text-zinc-300">
                        {prediction.team1_score} - {prediction.team2_score}
                      </td>
                      <td className="px-3 py-4 text-zinc-700 dark:text-zinc-300">
                        {prediction.first_goal_in ? firstGoalInLabels[prediction.first_goal_in] : "Not Predicted"}
                      </td>
                      <td className="px-3 py-4 text-zinc-700 dark:text-zinc-300">
                        {prediction.first_scoring_team_id ? getTeamNameById(
                          predictionMatch,
                          prediction.first_scoring_team_id,
                        ) : "Not Predicted"}
                      </td>
                      <td className="px-3 py-4 text-zinc-700 dark:text-zinc-300">
                        {prediction.yellow_card_count !== null ? prediction.yellow_card_count : "Not Predicted"}
                      </td>
                      <td className="px-3 py-4 text-zinc-700 dark:text-zinc-300">
                        {prediction.red_card_count !== null ? prediction.red_card_count : "Not Predicted"}
                      </td>
                      <td className="px-3 py-4 text-zinc-700 dark:text-zinc-300">
                        {prediction.kick_off_team_id ? getTeamNameById(
                          predictionMatch,
                          prediction.kick_off_team_id,
                        ) : "Not Predicted"}
                      </td>
                      <td className="px-3 py-4 text-zinc-700 dark:text-zinc-300">
                        {prediction.match_duration ? matchDurationLabels[prediction.match_duration] : "Not Predicted"}
                      </td>
                      <td className="px-3 py-4 text-right text-zinc-700 dark:text-zinc-300">
                        {formatDateTime(prediction.predicted_datetime, false)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={10}
                    className="px-5 py-8 text-center text-zinc-500 dark:text-zinc-400"
                  >
                    {"No predictions submitted yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section >)}

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
                  [`${selectedMatch.team1_name} Score`, pendingPredictionFields.team1_score !== null && pendingPredictionFields.team1_score >= 0 ? pendingPredictionFields.team1_score : "Not Predicted"],
                  [`${selectedMatch.team2_name} Score`, pendingPredictionFields.team2_score !== null && pendingPredictionFields.team2_score >= 0 ? pendingPredictionFields.team2_score : "Not Predicted"],
                  ["First Goal In", pendingPredictionFields.first_goal_in ? firstGoalInLabels[pendingPredictionFields.first_goal_in] : ((pendingPredictionFields.team1_score && pendingPredictionFields.team1_score > 0) || (pendingPredictionFields.team2_score && pendingPredictionFields.team2_score > 0)) ? "Not Predicted" : "N/A"],
                  ["First Score By", pendingPredictionFields.first_scoring_team_id
                    ? getTeamNameById(selectedMatch, pendingPredictionFields.first_scoring_team_id)
                    : ((pendingPredictionFields.team1_score && pendingPredictionFields.team1_score > 0) || (pendingPredictionFields.team2_score && pendingPredictionFields.team2_score > 0)) ? "Not Predicted" : "N/A"],
                  ["Total Yellow Cards", pendingPredictionFields.yellow_card_count !== null ? String(pendingPredictionFields.yellow_card_count) : "Not Predicted"],
                  ["Total Red Cards", pendingPredictionFields.red_card_count !== null ? String(pendingPredictionFields.red_card_count) : "Not Predicted"],
                  ["Kick-off Team", pendingPredictionFields.kick_off_team_id ? getTeamNameById(selectedMatch, pendingPredictionFields.kick_off_team_id) : "Not Predicted"],
                  ["Match Duration", pendingPredictionFields.match_duration ? matchDurationLabels[pendingPredictionFields.match_duration] : "Not Predicted"],
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
