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
  getCurrentMatchDay,
  getHeadToHeadMatchHistory,
  listMatches,
  listUpcomingMatches,
  matchDurationLabels,
  matchDurations,
} from "@/lib/matches";
import type { HeadToHeadMatchHistory, MatchDuration, MatchResponse } from "@/lib/matches";
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
  SelectableMatchCard,
} from "../ui/match-card";
import Image from "next/image";
import { IconChevronLeft, IconChevronRight, IconSave } from "../ui/icons";
import { IconSparkles } from "@/components/ui/icons";
import ImageWithFallback from "../ui/image-with-fallback";
import { FirstGoalIn } from "@/lib/matches/types";
import { listAllTeams, type TeamResponse } from "@/lib/teams";

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

type HeadToHeadStats = {
  averageRedCards: number;
  averageTotalGoals: number;
  averageYellowCards: number;
  matchCount: number;
  team1Goals: number;
  team1Points: number;
  team2Goals: number;
  team2Points: number;
};

type AiPrediction = {
  formState: PredictionFormState;
  summary: string;
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

const getRankSortValue = (team: TeamResponse | undefined): number => {
  if (!team || team.fifa_rank <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  return team.fifa_rank;
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

const getCompletedHeadToHeadMatches = (
  selectedMatch: MatchResponse,
  allMatches: MatchResponse[],
): MatchResponse[] => {
  const teamIds = new Set([selectedMatch.team1_id, selectedMatch.team2_id]);

  return allMatches
    .filter((match) => {
      if (match.id === selectedMatch.id) return false;
      if (!match.match_locked) return false;
      if (match.team1_score === null || match.team2_score === null) return false;

      return teamIds.has(match.team1_id) && teamIds.has(match.team2_id);
    })
    .sort(
      (left, right) =>
        new Date(right.match_datetime).getTime() -
        new Date(left.match_datetime).getTime(),
    )
    .slice(0, 7);
};

const getHeadToHeadStats = (
  selectedMatch: MatchResponse,
  headToHeadMatches: MatchResponse[],
): HeadToHeadStats => {
  return headToHeadMatches.reduce<HeadToHeadStats>(
    (stats, match, index) => {
      const team1WasMatchTeam1 = match.team1_id === selectedMatch.team1_id;
      const selectedTeam1Score = team1WasMatchTeam1
        ? match.team1_score ?? 0
        : match.team2_score ?? 0;
      const selectedTeam2Score = team1WasMatchTeam1
        ? match.team2_score ?? 0
        : match.team1_score ?? 0;
      const recencyWeight = 1 - index * 0.08;

      stats.matchCount += 1;
      stats.team1Goals += selectedTeam1Score * recencyWeight;
      stats.team2Goals += selectedTeam2Score * recencyWeight;
      stats.averageTotalGoals +=
        (selectedTeam1Score + selectedTeam2Score) * recencyWeight;
      stats.averageYellowCards += (match.yellow_card_count ?? 4) * recencyWeight;
      stats.averageRedCards += (match.red_card_count ?? 0) * recencyWeight;

      if (selectedTeam1Score > selectedTeam2Score) {
        stats.team1Points += 3 * recencyWeight;
      } else if (selectedTeam2Score > selectedTeam1Score) {
        stats.team2Points += 3 * recencyWeight;
      } else {
        stats.team1Points += recencyWeight;
        stats.team2Points += recencyWeight;
      }

      return stats;
    },
    {
      averageRedCards: 0,
      averageTotalGoals: 0,
      averageYellowCards: 0,
      matchCount: 0,
      team1Goals: 0,
      team1Points: 0,
      team2Goals: 0,
      team2Points: 0,
    },
  );
};

const getHeadToHeadHistoryStats = (
  headToHeadMatchHistory: HeadToHeadMatchHistory[],
): HeadToHeadStats => {
  return headToHeadMatchHistory.reduce<HeadToHeadStats>(
    (stats, match, index) => {
      const recencyWeight = 1 - index * 0.08;

      stats.matchCount += 1;
      stats.team1Goals += match.team1_score * recencyWeight;
      stats.team2Goals += match.team2_score * recencyWeight;
      stats.averageTotalGoals +=
        (match.team1_score + match.team2_score) * recencyWeight;
      stats.averageYellowCards += 4.4 * recencyWeight;
      stats.averageRedCards += 0.16 * recencyWeight;

      if (match.team1_score > match.team2_score) {
        stats.team1Points += 3 * recencyWeight;
      } else if (match.team2_score > match.team1_score) {
        stats.team2Points += 3 * recencyWeight;
      } else {
        stats.team1Points += recencyWeight;
        stats.team2Points += recencyWeight;
      }

      return stats;
    },
    {
      averageRedCards: 0,
      averageTotalGoals: 0,
      averageYellowCards: 0,
      matchCount: 0,
      team1Goals: 0,
      team1Points: 0,
      team2Goals: 0,
      team2Points: 0,
    },
  );
};

const getRankStrength = (team: TeamResponse | undefined): number => {
  const rank = getRankSortValue(team);

  if (!Number.isFinite(rank)) {
    return 0.4;
  }

  return clamp((80 - Math.min(rank, 79)) / 80, 0.06, 1);
};

const getRoundedGoalValue = (value: number): number => {
  const noisyValue = value + (Math.random() - 0.5) * 0.65;

  return clamp(Math.round(noisyValue), 0, 6);
};

const ensureKnockoutWinner = (
  selectedMatch: MatchResponse,
  team1Score: number,
  team2Score: number,
  team1Power: number,
  team2Power: number,
): [number, number] => {
  if (selectedMatch.match_stage === "GROUP" || team1Score !== team2Score) {
    return [team1Score, team2Score];
  }

  if (team1Power >= team2Power) {
    return [team1Score + 1, team2Score];
  }

  return [team1Score, team2Score + 1];
};

const buildAiPrediction = (
  selectedMatch: MatchResponse,
  allMatches: MatchResponse[],
  teamsById: Map<number, TeamResponse>,
  headToHeadMatchHistory: HeadToHeadMatchHistory[] = [],
): AiPrediction => {
  const team1 = teamsById.get(selectedMatch.team1_id);
  const team2 = teamsById.get(selectedMatch.team2_id);
  const headToHeadMatches =
    headToHeadMatchHistory.length > 0
      ? []
      : getCompletedHeadToHeadMatches(selectedMatch, allMatches);
  const stats =
    headToHeadMatchHistory.length > 0
      ? getHeadToHeadHistoryStats(headToHeadMatchHistory)
      : getHeadToHeadStats(selectedMatch, headToHeadMatches);
  const h2hTotal = Math.max(1, stats.team1Points + stats.team2Points);
  const h2hTeam1Score = stats.matchCount ? stats.team1Points / h2hTotal : 0.5;
  const h2hTeam2Score = stats.matchCount ? stats.team2Points / h2hTotal : 0.5;
  const rankTeam1Score = getRankStrength(team1);
  const rankTeam2Score = getRankStrength(team2);
  const goalDiffSignal = stats.matchCount
    ? clamp((stats.team1Goals - stats.team2Goals) / 10, -0.18, 0.18)
    : 0;
  const variance = (Math.random() - 0.5) * 0.16;
  const team1Power =
    rankTeam1Score * 0.58 + h2hTeam1Score * 0.34 + goalDiffSignal + variance;
  const team2Power =
    rankTeam2Score * 0.58 + h2hTeam2Score * 0.34 - goalDiffSignal - variance;
  const powerDifference = team1Power - team2Power;
  const historyAverageGoals = stats.matchCount
    ? stats.averageTotalGoals / stats.matchCount
    : 2.45;
  const expectedTotalGoals = clamp(historyAverageGoals, 1.4, 4.2);
  const team1ExpectedGoals = clamp(
    expectedTotalGoals / 2 + powerDifference * 1.4,
    0.15,
    4.8,
  );
  const team2ExpectedGoals = clamp(
    expectedTotalGoals / 2 - powerDifference * 1.4,
    0.15,
    4.8,
  );
  let team1Score = getRoundedGoalValue(team1ExpectedGoals);
  let team2Score = getRoundedGoalValue(team2ExpectedGoals);

  if (team1Score === 0 && team2Score === 0 && expectedTotalGoals > 1.8) {
    if (team1Power >= team2Power) {
      team1Score = 1;
    } else {
      team2Score = 1;
    }
  }

  [team1Score, team2Score] = ensureKnockoutWinner(
    selectedMatch,
    team1Score,
    team2Score,
    team1Power,
    team2Power,
  );

  const hasGoals = team1Score + team2Score > 0;
  const firstScoringTeamId = hasGoals
    ? team1Score === 0
      ? selectedMatch.team2_id
      : team2Score === 0
        ? selectedMatch.team1_id
        : team1Power >= team2Power
          ? selectedMatch.team1_id
          : selectedMatch.team2_id
    : "";
  const firstGoalIn =
    !hasGoals
      ? ""
      : selectedMatch.match_stage !== "GROUP" && Math.random() < 0.08
        ? "ET"
        : Math.random() < 0.68
          ? "1H"
          : "2H";
  const averageYellowCards = stats.matchCount
    ? stats.averageYellowCards / stats.matchCount
    : selectedMatch.match_stage === "GROUP"
      ? 4
      : 5;
  const averageRedCards = stats.matchCount
    ? stats.averageRedCards / stats.matchCount
    : 0.15;
  const yellowCards = clamp(
    Math.round(averageYellowCards + (Math.random() - 0.5) * 2),
    1,
    9,
  );
  const redCards = clamp(
    Math.round(averageRedCards + (Math.random() < 0.18 ? 1 : 0)),
    0,
    3,
  );
  const matchDuration =
    selectedMatch.match_stage === "GROUP"
      ? "90"
      : team1Score === team2Score
        ? Math.random() < 0.45
          ? "PENALTY"
          : "120"
        : Math.random() < 0.12
          ? "120"
          : "90";
  const kickoffTeamId =
    Math.random() < 0.5 ? selectedMatch.team1_id : selectedMatch.team2_id;

  return {
    formState: {
      firstGoalIn,
      firstScoringTeamId: firstScoringTeamId ? String(firstScoringTeamId) : "",
      kickoffTeamId: String(kickoffTeamId),
      matchDuration,
      redCardCount: String(redCards),
      team1Score: String(team1Score),
      team2Score: String(team2Score),
      yellowCardCount: String(yellowCards),
    },
    summary:
      headToHeadMatchHistory.length > 0
        ? `AI pick loaded using ${headToHeadMatchHistory.length} head-to-head result${headToHeadMatches.length === 1 ? "" : "s"} and FIFA ranking.`
        : headToHeadMatches.length > 0
          ? `AI pick loaded using ${headToHeadMatches.length} recent head-to-head match${headToHeadMatches.length === 1 ? "" : "es"} and FIFA ranking.`
          : "AI pick loaded using FIFA ranking and tournament-stage trends.",
  };
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
  return value ? matchDurations.includes(value as MatchDuration) : false;
};

const isFirstGoalIn = (value: string): value is FirstGoalIn => {
  return firstGoalIns.includes(value as FirstGoalIn);
};

const getWinnerTeamId = (team1Score: number, team2Score: number, selectedMatch: MatchResponse | null) => {
  if (team1Score > team2Score) {
    return selectedMatch?.team1_id || null;
  }
  if (team2Score > team1Score) {
    return selectedMatch?.team2_id || null;
  }
  return null;
};

const buildFormState = (
  match: MatchResponse,
  prediction?: PredictionResponse,
): PredictionFormState => {
  if (prediction) {
    return {
      firstScoringTeamId: prediction.first_scoring_team_id ? String(prediction.first_scoring_team_id) : "",
      firstGoalIn: prediction.first_goal_in || "",
      matchDuration: prediction.match_duration || "",
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
  const [isAiPicking, setIsAiPicking] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchResponse[]>([]);
  const [allMatches, setAllMatches] = useState<MatchResponse[]>([]);
  const [teams, setTeams] = useState<TeamResponse[]>([]);
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
  const teamsById = useMemo(() => {
    return new Map(teams.map((team) => [team.id, team]));
  }, [teams]);

  const applyMatchSelection = useCallback((
    nextMatches: MatchResponse[],
    nextPredictions: PredictionResponse[],
  ) => {
    let firstMatch = nextMatches.find((match) => !match.match_locked) ?? null;
    if (!firstMatch) {
      firstMatch = nextMatches.find((match) => match) ?? null;
    }
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

        try {
          const allMatches = await listMatches({ limit: 1000 });
          if (allMatches?.items?.length) {
            setAllMatches(allMatches.items);
          }
        } catch { }

        try {
          const teamList = await listAllTeams({ limit: 500 });
          if (teamList?.items?.length) {
            setTeams(teamList.items);
          }
        } catch { }

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

        const predictionList = await listCurrentUserPredictions({ limit: 500 });

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
    const team1Score = parseNonNegativeInteger(
      formState.team1Score,
      "Team 1",
    );
    const team2Score = parseNonNegativeInteger(
      formState.team2Score,
      "Team 2",
    );

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
      match_duration: isMatchDuration(formState.matchDuration) ? formState.matchDuration : null,
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
      winner_team_id: getWinnerTeamId(team1Score, team2Score, selectedMatch),
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

  const handleAiPick = async () => {
    setFormError(null);
    setSuccessMessage(null);

    if (!selectedMatch) {
      setFormError("Select a match before using AI pick.");
      return;
    }

    if (selectedStatus === "Locked") {
      setFormError("Prediction is locked for this match.");
      return;
    }

    if (teams.length === 0) {
      setFormError("Team ranking data is not available for AI pick.");
      return;
    }

    setIsAiPicking(true);
    try {
      let headToHeadMatchHistory: HeadToHeadMatchHistory[] = [];

      try {
        const headToHeadMatch = await getHeadToHeadMatchHistory(selectedMatch.id, {
          limit: 7,
        });
        headToHeadMatchHistory = headToHeadMatch.items;
      } catch {
        headToHeadMatchHistory = [];
      }

      const aiPrediction = buildAiPrediction(
        selectedMatch,
        allMatches,
        teamsById,
        headToHeadMatchHistory,
      );
      setFormState(aiPrediction.formState);
      setSuccessMessage(aiPrediction.summary);
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
    setFormError(null);
    setSuccessMessage(null);
  };

  const handleMatchDayChange = async (matchDay: number) => {
    setIsLoading(true);
    setLoadError(null);
    setFormError(null);
    setSuccessMessage(null);

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
  const hasAnyPredictedGoals = hasAnyGoalPrediction(formState);

  const inputCls = "mt-1 h-11 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none transition focus:border-tournament-primary focus:ring-2 focus:ring-emerald-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:ring-emerald-900";
  const selectCls = "mt-1 h-11 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none transition focus:border-tournament-primary focus:ring-2 focus:ring-emerald-100 disabled:bg-zinc-100 disabled:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-500 dark:focus:ring-emerald-900";
  const labelTextCls = "flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300";

  return (
    <>
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

      <section className="flex gap-4 overflow-x-auto pb-2">
        {isLoading ? (
          Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="h-64 w-[280px] shrink-0 animate-pulse rounded-md border border-zinc-200 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:shadow-zinc-950 sm:w-80 lg:w-[360px]"
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
                isPredictionAvailable={predictions.length > 0}
                isSelected={isSelected}
                handleCardClick={handleCardClick}
                className="w-[280px] shrink-0 sm:w-80 lg:w-[360px]"
              />
            );
          })
        ) : (
          <div className="w-full rounded-md border border-zinc-200 p-5 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:shadow-zinc-950">
            No upcoming matches are available.
          </div>
        )}
      </section >

      {loadError ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-300">
          {loadError}
        </div>
      ) : null}

      {authRequired ? (
        <div className="flex flex-col gap-3 rounded-md border border-yellow-200 px-4 py-4 text-sm text-yellow-900 dark:text-zinc-400 dark:border-yellow-700 bg-yellow-50 dark:bg-amber-950 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Login required</h2>
            <p className="mt-1 text-sm">Log in to submit your predictions.</p>
          </div>
          <Link
            href="/login"
            className="inline-flex h-10 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-700"
          >
            Login
          </Link>
        </div>
      ) : null}

      <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-center">
        <div className="hidden lg:flex w-40 h-[525px] shrink-0 grow basis-0 flex-col gap-2 items-center justify-center text-center bg-player rounded-md min-h-48">
          <ImageWithFallback width={525} height={525} src={"/images/players/" + selectedMatch?.team1_name_short?.toLowerCase() + ".png"} alt={selectedMatch?.team1_name || "Captain Image"} />
        </div>{""}
        <form
          className={(selectedStatus === "Locked" ? "opacity-50 pointer-events-none " : "") + "relative w-full lg:max-w-2xl rounded-md border border-zinc-200 dark:bg-zinc-900 dark:shadow-zinc-950 p-4 sm:p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"}
          onSubmit={handleSubmit}
        >
          <div className="absolute left-[20px] top-[20px]">
            <button
              type="button"
              title="Scrape head-to-head scores, then blend them with FIFA ranking"
              disabled={isFormDisabled || isAiPicking || teams.length === 0}
              onClick={() => void handleAiPick()}
              className="mt-0 inline-flex h-10 items-center justify-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:border-emerald-700 dark:hover:bg-emerald-900 dark:disabled:border-zinc-700 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
            >
              <IconSparkles className="h-4 w-4" />
              <p className="hidden md:block">{isAiPicking ? "Picking ..." : "Auto pick with AI"}</p>
            </button>
          </div>
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
            <StatusPill tone={getStatusTone(selectedStatus)} urgency={selectedMatch ? getLockUrgency(selectedMatch) : "none"}>
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
                      <Image width={32} height={32} className="min-h-[30px] w-auto rounded object-cover shadow-sm" decoding="async" loading="lazy" src={selectedMatch.team1_flag_url} alt={selectedMatch.team1_name} />
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
                      <Image width={32} height={32} className="min-h-[30px] w-auto rounded object-cover shadow-sm" decoding="async" loading="lazy" src={selectedMatch.team2_flag_url} alt={selectedMatch.team2_name} />
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
      </section >

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
                <th className="pl-5 pr-3 py-3">S.N.</th>
                <th className="pl-2 pr-5 py-3 text-center min-w-[300px]">Match</th>
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
                  const predictionMatch = allMatches.find(
                    (match) => match.id === prediction.match_id,
                  );

                  return (
                    <tr key={prediction.id}>
                      <td className="pl-5 pr-3 py-4">{idx + 1}</td>
                      <td className="pl-2 pr-5 py-4 font-medium text-zinc-950 dark:text-zinc-50">
                        {predictionMatch
                          ? getMatchLabelWithFlag(predictionMatch)
                          : `Match #${prediction.match_id}`}
                      </td>
                      <td className="px-5 py-4 text-zinc-700 dark:text-zinc-300">
                        {prediction.team1_score} - {prediction.team2_score}
                      </td>
                      <td className="px-5 py-4 text-zinc-700 dark:text-zinc-300">
                        {prediction.first_goal_in ? firstGoalInLabels[prediction.first_goal_in] : "Not Predicted"}
                      </td>
                      <td className="px-5 py-4 text-zinc-700 dark:text-zinc-300">
                        {prediction.first_scoring_team_id ? getTeamNameById(
                          predictionMatch,
                          prediction.first_scoring_team_id,
                        ) : "Not Predicted"}
                      </td>
                      <td className="px-5 py-4 text-zinc-700 dark:text-zinc-300">
                        {prediction.yellow_card_count}
                      </td>
                      <td className="px-5 py-4 text-zinc-700 dark:text-zinc-300">
                        {prediction.red_card_count}
                      </td>
                      <td className="px-5 py-4 text-zinc-700 dark:text-zinc-300">
                        {prediction.kick_off_team_id ? getTeamNameById(
                          predictionMatch,
                          prediction.kick_off_team_id,
                        ) : "Not Predicted"}
                      </td>
                      <td className="px-5 py-4 text-zinc-700 dark:text-zinc-300">
                        {prediction.match_duration ? matchDurationLabels[prediction.match_duration] : "Not Predicted"}
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
                    colSpan={10}
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
                  ["First Goal In", pendingPredictionFields.first_goal_in ? firstGoalInLabels[pendingPredictionFields.first_goal_in] : "Not Predicted"],
                  ["First Score By", pendingPredictionFields.first_scoring_team_id
                    ? getTeamNameById(selectedMatch, pendingPredictionFields.first_scoring_team_id)
                    : "Not Predicted"],
                  ["Yellow Cards", String(pendingPredictionFields.yellow_card_count)],
                  ["Red Cards", String(pendingPredictionFields.red_card_count)],
                  ["Kick-off Team", pendingPredictionFields.kick_off_team_id ? getTeamNameById(selectedMatch, pendingPredictionFields.kick_off_team_id) : "Not Predicted"],
                  ["Duration", pendingPredictionFields.match_duration ? matchDurationLabels[pendingPredictionFields.match_duration] : "Not Predicted"],

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
