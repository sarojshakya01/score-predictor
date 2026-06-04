"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  formatDateTime,
  getLockUrgency,
  getStatusTone,
} from "@/components/ui/match-card";
import { StatusPill } from "@/components/ui/status-pill";
import {
  IconAward,
  IconCheck,
  IconLock,
  IconMedal,
  IconSearch,
  IconTrophy,
  IconX,
} from "@/components/ui/icons";
import { getCurrentMatchDay, listFinalMatches, type MatchResponse } from "@/lib/matches";
import { listAllTeams, type TeamResponse } from "@/lib/teams";
import { getCurrentUser, isAuthenticated, MissingAuthTokenError, UserResponse } from "@/lib/auth";
import { Modal } from "../ui/modal";
import { ApiError } from "@/lib/api";
import { getErrorMessage } from "@/lib/forms/error-message";
import { updateCurrentUserFinalist, UserCreate } from "@/lib/users";

type PlaceId = 1 | 2 | 3;

type PlaceDefinition = {
  id: PlaceId;
  label: string;
  title: string;
  emptyLabel: string;
  icon: typeof IconTrophy;
  shellClasses: string;
  iconClasses: string;
  activeClasses: string;
  badgeClasses: string;
  /** Tailwind min-h class that drives the podium step height */
  podiumHeight: string;
  /** Per-slot content scale: icon box, label sizes, flag size, name size */
  scale: {
    iconBox: string;   // h-N w-N on the place icon container
    iconSvg: string;   // h-N w-N on the SVG icon
    rankText: string;  // label like "1st"
    titleText: string; // title like "Winner"
    flagSize: number;  // next/image width+height
    teamName: string;  // team name text size
    rankSub: string;   // FIFA rank sub-text size
    emptyText: string; // empty placeholder text size
    checkIcon: string; // checkmark icon size
    padding: string;   // card padding override
    flagMinHeight: string; // min-h-[30px]
  };
};

const placeDefinitions: PlaceDefinition[] = [
  {
    id: 2,
    label: "2nd",
    title: "Runner-up",
    emptyLabel: "Choose runner up",
    icon: IconMedal,
    podiumHeight: "min-h-[150px]",
    scale: {
      iconBox: "h-9 w-9",
      iconSvg: "h-5 w-5",
      rankText: "text-xs",
      titleText: "text-sm",
      flagSize: 32,
      teamName: "text-sm",
      rankSub: "text-xs",
      emptyText: "text-sm",
      checkIcon: "h-5 w-5",
      padding: "p-4",
      flagMinHeight: "min-h-[30px]",
    },
    shellClasses:
      "border-slate-200 bg-slate-50 text-slate-950 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-100",
    iconClasses:
      "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    activeClasses:
      "border-slate-500 ring-2 ring-slate-200 dark:border-slate-300 dark:ring-slate-800",
    badgeClasses:
      "border-slate-200 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
  },
  {
    id: 1,
    label: "1st",
    title: "Winner",
    emptyLabel: "Choose winner",
    icon: IconTrophy,
    podiumHeight: "min-h-[180px]",
    scale: {
      iconBox: "h-14 w-14",
      iconSvg: "h-8 w-8",
      rankText: "text-sm",
      titleText: "text-xl",
      flagSize: 52,
      teamName: "text-lg",
      rankSub: "text-sm",
      emptyText: "text-base",
      checkIcon: "h-7 w-7",
      padding: "p-5",
      flagMinHeight: "min-h-[40px]",
    },
    shellClasses:
      "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-950 dark:bg-amber-950/40 dark:text-amber-100",
    iconClasses:
      "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200",
    activeClasses:
      "border-amber-500 ring-2 ring-amber-200 dark:border-amber-400 dark:ring-amber-900",
    badgeClasses:
      "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200",
  },
  {
    id: 3,
    label: "3rd",
    title: "3rd Place",
    emptyLabel: "Choose third place",
    icon: IconAward,
    podiumHeight: "min-h-[120px]",
    scale: {
      iconBox: "h-8 w-8",
      iconSvg: "h-4 w-4",
      rankText: "text-xs",
      titleText: "text-sm",
      flagSize: 30,
      teamName: "text-sm",
      rankSub: "text-xs",
      emptyText: "text-sm",
      checkIcon: "h-4 w-4",
      padding: "p-3",
      flagMinHeight: "min-h-[28px]",
    },
    shellClasses:
      "border-orange-200 bg-orange-50/70 text-orange-950 dark:border-orange-950 dark:bg-orange-950/30 dark:text-orange-100",
    iconClasses:
      "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200",
    activeClasses:
      "border-orange-500 ring-2 ring-orange-200 dark:border-orange-400 dark:ring-orange-900",
    badgeClasses:
      "border-orange-200 bg-orange-100 text-orange-800 dark:border-orange-700 dark:bg-orange-950 dark:text-orange-200",
  },
];

const emptySelections: Record<PlaceId, number | null> = {
  1: null,
  2: null,
  3: null,
};

const getRankSortValue = (team: TeamResponse): number => {
  return team.fifa_rank > 0 ? team.fifa_rank : Number.POSITIVE_INFINITY;
};

const formatGroup = (group: string): string => {
  const normalizedGroup = group.trim();

  if (!normalizedGroup) {
    return "Group TBA";
  }

  if (/^group\s+/i.test(normalizedGroup)) {
    return normalizedGroup;
  }

  return `Group ${normalizedGroup}`;
};

const getMatchForPlace = (
  placeId: PlaceId,
  finalMatch: MatchResponse | null,
  thirdPlaceMatch: MatchResponse | null,
): MatchResponse | null => {
  if (placeId === 3) {
    return thirdPlaceMatch;
  }

  return finalMatch;
};

export const FinalsWinnerSelector = () => {
  const [authRequired, setAuthRequired] = useState(false);
  const [currentMatchDay, setCurrentMatchDay] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [teams, setTeams] = useState<TeamResponse[]>([]);
  const [finalMatches, setFinalMatches] = useState<MatchResponse[]>([]);
  const [activePlaceId, setActivePlaceId] = useState<PlaceId>(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selections, setSelections] =
    useState<Record<PlaceId, number | null>>({ ...emptySelections });

  const teamsById = useMemo(() => {
    return new Map(teams.map((team) => [team.id, team]));
  }, [teams]);

  const sortedTeams = useMemo(() => {
    return [...teams].sort((left, right) => {
      const rankDifference = getRankSortValue(left) - getRankSortValue(right);

      if (rankDifference !== 0) {
        return rankDifference;
      }

      return left.name.localeCompare(right.name);
    });
  }, [teams]);

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const filteredTeams = useMemo(() => {
    if (!normalizedSearchTerm) {
      return sortedTeams;
    }

    return sortedTeams.filter((team) => {
      const searchableText = [
        team.name,
        team.fifa_code,
        team.group,
        String(team.fifa_rank),
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearchTerm);
    });
  }, [normalizedSearchTerm, sortedTeams]);

  const selectedTeams = useMemo<Record<PlaceId, TeamResponse | null>>(() => {
    return {
      1: selections[1] ? teamsById.get(selections[1]) ?? null : null,
      2: selections[2] ? teamsById.get(selections[2]) ?? null : null,
      3: selections[3] ? teamsById.get(selections[3]) ?? null : null,
    };
  }, [selections, teamsById]);

  const selectedPlaceByTeamId = useMemo(() => {
    const placeByTeamId = new Map<number, PlaceDefinition>();

    placeDefinitions.forEach((place) => {
      const selectedTeamId = selections[place.id];

      if (selectedTeamId) {
        placeByTeamId.set(selectedTeamId, place);
      }
    });

    return placeByTeamId;
  }, [selections]);

  const finalMatch = useMemo(() => {
    return (
      finalMatches.find((match) => match.match_stage === "F") ??
      finalMatches[1] ??
      null
    );
  }, [finalMatches]);

  const thirdPlaceMatch = useMemo(() => {
    return (
      finalMatches.find((match) => match.match_stage === "3P") ??
      finalMatches[0] ??
      null
    );
  }, [finalMatches]);

  useEffect(() => {
    let isMounted = true;

    const loadNeededData = async () => {
      setIsLoading(true);
      const hasAuthToken = isAuthenticated();
      setAuthRequired(!hasAuthToken);

      try {
        const [matchDayResult, finalMatchesResult, teamsResult, userResult] =
          await Promise.allSettled([
            getCurrentMatchDay(),
            listFinalMatches({ includeLocked: true, limit: 3 }),
            listAllTeams(),
            getCurrentUser()
          ]);
        let matchDay: number | null = null;
        let finalMatches: MatchResponse[] = [];
        let teams: TeamResponse[] = [];
        let currrentUser: UserResponse | null = null;


        if (matchDayResult.status === "fulfilled") {
          matchDay = matchDayResult.value.value;
        } else {
          setFormError(
            getErrorMessage(matchDayResult.reason, "Unable to get data. Please try again."),
          );
        }

        if (finalMatchesResult.status === "fulfilled") {
          finalMatches = finalMatchesResult.value.items;
        } else {
          setFormError(
            getErrorMessage(finalMatchesResult.reason, "Unable to save prediction. Please try again."),
          );
        }

        if (teamsResult.status === "fulfilled") {
          teams = teamsResult.value.items;
        } else {
          setFormError(
            getErrorMessage(teamsResult.reason, "Unable to load teams."),
          );
        }

        if (!hasAuthToken || !matchDay) {
          if (!isMounted) {
            return;
          }
        }

        setCurrentMatchDay(matchDay);
        setFinalMatches(finalMatches);
        setTeams(teams);

        if (userResult.status === "fulfilled") {
          currrentUser = userResult.value;
          if (currrentUser) {
            setSelections({
              1: currrentUser.winner_team_id,
              2: currrentUser.runner_up_team_id,
              3: currrentUser.third_place_team_id,
            });
            const isAlreadyPredicted = currrentUser.winner_team_id && currrentUser.runner_up_team_id && currrentUser.third_place_team_id
            setIsUpdating(!!isAlreadyPredicted)
          }
        }
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
          setFormError(
            getErrorMessage(error, "Unable to load user."),
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadNeededData();

    return () => {
      isMounted = false;
    };
  }, []);

  const activePlace =
    placeDefinitions.find((place) => place.id === activePlaceId) ??
    placeDefinitions[2];
  const activeMatch = getMatchForPlace(
    activePlace.id,
    finalMatch,
    thirdPlaceMatch,
  );

  const predictionLocked = currentMatchDay ? currentMatchDay > 7 : false;
  const predictionStatus = !currentMatchDay ? "Open" : predictionLocked ? "Locked" : currentMatchDay >= 5 ? "Locking soon" : "Open";
  const ActivePlaceIcon = activePlace.icon;

  const selectTeam = (teamId: number) => {
    setFormError(null);
    if (predictionLocked) {
      return;
    }

    setSelections((currentSelections) => {
      const nextSelections = { ...currentSelections };

      placeDefinitions.forEach((place) => {
        if (
          place.id !== activePlace.id &&
          nextSelections[place.id] === teamId
        ) {
          nextSelections[place.id] = null;
        }
      });

      nextSelections[activePlace.id] =
        nextSelections[activePlace.id] === teamId ? null : teamId;

      return nextSelections;
    });
  };

  const handleConfirmClick = async () => {
    if (isAuthenticated()) {
      setFormError(null);
      setSuccessMessage(null);
      setIsSubmitting(true);
      try {

        // if all places predictiona are saved then update them otherwise create them
        const savedPrediction = selections[1] && selections[2] && selections[3];

        const savedSelections: Partial<UserCreate> = await updateCurrentUserFinalist({
          winner_team_id: selections[1]!,
          runner_up_team_id: selections[2]!,
          third_place_team_id: selections[3]!
        });

        setSelections({
          1: savedSelections.winner_team_id !== undefined ? savedSelections.winner_team_id : null,
          2: savedSelections.runner_up_team_id !== undefined ? savedSelections.runner_up_team_id : null,
          3: savedSelections.third_place_team_id !== undefined ? savedSelections.third_place_team_id : null,
        });

        setSuccessMessage(
          savedPrediction
            ? "Prediction updated successfully."
            : "Prediction submitted successfully.",
        );
      } catch (error) {
        if (error instanceof MissingAuthTokenError) {
          setFormError("Please login first and try again.");
        } else {
          setFormError(
            getErrorMessage(error, "Unable to save prediction. Please try again."),
          );
        }
      } finally {
        setIsSubmitting(false);
        setShowConfirm(false);
      }
    } else {
      setFormError("You must be logged in to predict.");
      setShowConfirm(false);
    }
  };

  const handleCancelSubmit = () => {
    setShowConfirm(false);
  };

  return (<>
    <article className={(predictionLocked ? "opacity-70 " : "") + "overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-zinc-950"}>
      <div className="flex flex-row items-center justify-between gap-4 border-b border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={[
              "grid h-11 w-11 shrink-0 place-items-center rounded-md border",
              activePlace.iconClasses,
            ].join(" ")}
          >
            <ActivePlaceIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              Finalist
            </p>
            {predictionLocked ? (<div className="flex gap-1"><IconLock /><p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
              Prediction has been locked.
            </p></div>) : <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
              {isUpdating ? "Update" : "Select"} your <span className="font-semibold text-zinc-950 dark:text-zinc-50">{activePlace.title}</span> from the team list
            </p>}
          </div>
        </div>

        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          {(!predictionLocked && predictionStatus) ? (
            <StatusPill
              tone={getStatusTone(predictionStatus)}
              urgency={activeMatch ? getLockUrgency(activeMatch) : "none"}
            >
              {predictionStatus}
            </StatusPill>
          ) : (
            <StatusPill tone="primary">Final picks</StatusPill>
          )}

          <div className="relative w-full sm:w-auto">
            <label className="sr-only" htmlFor="winner-team-search">
              Search teams
            </label>
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
            <input
              id="winner-team-search"
              type="text"
              inputMode="search"
              autoComplete="off"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search team, code, group..."
              className="h-10 w-full rounded-md border border-zinc-300 bg-white pl-9 pr-9 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-tournament-primary focus:ring-2 focus:ring-emerald-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:ring-emerald-900 sm:w-72"
            />
            {searchTerm ? (
              <button
                type="button"
                aria-label="Clear team search"
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
              >
                <IconX className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 p-6 sm:flex-row sm:items-end sm:justify-center sm:gap-4 sm:px-10 items-center">
        {placeDefinitions.map((place) => {
          const selectedTeam = selectedTeams[place.id];
          const PlaceIcon = place.icon;
          const isActive = activePlace.id === place.id;

          return (
            <button
              key={place.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => setActivePlaceId(place.id)}
              disabled={predictionLocked}
              className={[
                "flex w-full flex-col justify-between rounded-md border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md sm:flex-1 disabled:cursor-not-allowed disabled:opacity-60",
                place.podiumHeight,
                place.shellClasses,
                isActive ? place.activeClasses : "",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={[
                      "grid shrink-0 place-items-center rounded-md",
                      place.scale.iconBox,
                      place.iconClasses,
                    ].join(" ")}
                  >
                    <PlaceIcon className={place.scale.iconSvg} />
                  </span>
                  <div className="min-w-0">
                    <p className={`${place.scale.rankText} font-semibold uppercase tracking-[0.12em]`}>
                      {place.label}
                    </p>
                    <p className={`mt-0.5 truncate font-semibold ${place.scale.titleText}`}>
                      {place.title}
                    </p>
                  </div>
                </div>
                {selectedTeam ? <IconCheck className={`${place.scale.checkIcon} shrink-0`} /> : null}
              </div>

              <div className="mt-3 flex min-w-0 items-center gap-2">
                {selectedTeam ? (
                  <>
                    <Image
                      width={place.scale.flagSize}
                      height={place.scale.flagSize}
                      className={place.scale.flagMinHeight + " w-auto shrink-0 rounded object-cover shadow-sm"}
                      decoding="async"
                      loading="lazy"
                      src={selectedTeam.flag_url}
                      alt={`${selectedTeam.name} flag`}
                    />
                    <div className="min-w-0">
                      <p className={`truncate font-semibold ${place.scale.teamName}`}>
                        {selectedTeam.name}
                      </p>
                      <p className={`mt-0.5 opacity-75 ${place.scale.rankSub}`}>
                        FIFA #{selectedTeam.fifa_rank}
                      </p>
                    </div>
                  </>
                ) : (
                  <p className={`${place.scale.emptyText} font-medium opacity-70`}>
                    {place.emptyLabel}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="border-t border-zinc-200 px-4 pb-4 pt-3 dark:border-zinc-800">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            <ActivePlaceIcon className="h-4 w-4" />
            {predictionLocked ? <span>Teams</span> : <span>Select your team</span>}
          </div>
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {filteredTeams.length} of {teams.length} teams
          </span>
        </div>

        {filteredTeams.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto p-2">
            {filteredTeams.map((team) => {
              const selectedPlace = selectedPlaceByTeamId.get(team.id);
              const isSelectedForActivePlace =
                selections[activePlace.id] === team.id;
              const TeamPlaceIcon = selectedPlace?.icon;

              return (
                <button
                  key={team.id}
                  type="button"
                  disabled={predictionLocked}
                  aria-pressed={isSelectedForActivePlace}
                  aria-label={`Select ${team.name} for ${activePlace.title}`}
                  onClick={() => selectTeam(team.id)}
                  className={[
                    "relative flex min-h-36 w-40 shrink-0 flex-col justify-between rounded-md border bg-zinc-50 p-3 text-left transition hover:-translate-y-0.5 hover:border-tournament-primary hover:bg-white hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-tournament-primary dark:hover:bg-zinc-700",
                    (isSelectedForActivePlace || selectedPlace)
                      ? `${activePlace.activeClasses} bg-white dark:bg-zinc-900`
                      : "border-zinc-200",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <Image
                      width={30}
                      height={30}
                      className="min-h-[28px] w-auto rounded object-cover shadow-sm"
                      decoding="async"
                      loading="lazy"
                      src={team.flag_url}
                      alt={`${team.name} flag`}
                    />
                    {selectedPlace && TeamPlaceIcon ? (
                      <span
                        className={[
                          "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold",
                          selectedPlace.badgeClasses,
                        ].join(" ")}
                      >
                        <TeamPlaceIcon className="h-3.5 w-3.5" />
                        {selectedPlace.label}
                      </span>
                    ) : (
                      <span className="rounded-full border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                        FIFA #{team.fifa_rank}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                      {team.name}
                    </p>
                    <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
                      {team.fifa_code} · {formatGroup(team.group)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            No teams match {searchTerm ? "'" + searchTerm.trim() + "'" : ""}
          </div>
        )}
      </div>

      {formError ? (
        <label className="flex col-span-1 justify-center">
          <p
            aria-live="polite"
            className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-300"
          >
            {formError}
          </p></label>
      ) : null}
      {successMessage ? (
        <label className="flex col-span-1 justify-center">
          <p
            aria-live="polite"
            className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
          >
            {successMessage}
          </p></label>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/50 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 text-sm text-zinc-600 dark:text-zinc-400">
          {activeMatch ? (
            <p className="truncate">
              {formatDateTime(activeMatch.match_datetime)}
              {activeMatch.venue_name ? ` · ${activeMatch.venue_name}` : ""}
            </p>
          ) : (
            <p>Final schedule will appear when matches are available.</p>
          )}
        </div>
        {!predictionLocked && (<button
          onClick={() => {
            setFormError(null);
            if (Object.values(selections).some((val) => val === null)) {
              setFormError("All places are not selected. Please select a winner, runner up, and third place.")
              return;
            }
            setShowConfirm(true)
          }}
          disabled={isLoading}
          className={[
            "inline-flex h-10 items-center justify-center rounded-md bg-tournament-primary px-4 text-sm font-semibold text-white transition hover:bg-tournament-primary",
            (isLoading) ? "pointer-events-none cursor-default opacity-70" : "",
          ].join(" ")}
        >
          Predict
        </button>)}
      </div>
    </article>

    <Modal
      isOpen={showConfirm}
      onClose={handleCancelSubmit}
      title={authRequired ? "Login required" : "Confirm Prediction"}
    >
      {authRequired ? (
        <div className="flex flex-col gap-5">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Please login to submit your prediction.
          </p>
          <Link href="/login">
            <button
              className="inline-flex h-10 justify-center items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-700"
            >
              Login
            </button>
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {Object.values(selections).filter(Boolean).length === 3 ? (
              <>
                You are about to{" "}
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">update</span>{" "}
                your prediction for winners of the tournament.
              </>
            ) : (
              <>
                You are about to{" "}
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">submit</span>{" "}
                your prediction for winners of the tournament. Please review before confirming.
              </>
            )}
          </p>


          <div className="rounded-md border border-zinc-200 dark:border-zinc-700 overflow-hidden">
            <div className="bg-zinc-50 dark:bg-zinc-800 px-4 py-2 border-b border-zinc-200 dark:border-zinc-700">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Your Prediction
              </p>
            </div>
            <dl className="grid grid-cols-1 gap-px bg-zinc-200 dark:bg-zinc-700">
              {Object.entries(selections).map(([key, value]) => {
                const place = placeDefinitions.find((def) => def.id === Number(key));
                const team = teamsById.get(Number(value));
                if (!place || !team) {
                  return null;
                }
                const PlaceIcon = place?.icon;
                return (
                  <div key={key} className="grid grid-cols-2 gap-2 bg-white dark:bg-zinc-900 px-4 py-3">
                    <dt className="text-sm content-center text-zinc-500 dark:text-zinc-400">{place?.title || key}
                      {PlaceIcon && <PlaceIcon className="h-4 w-4" />}
                    </dt>
                    <dd className="flex text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      <Image
                        width={20}
                        height={20}
                        className="min-h-[19px] w-auto shrink-0 rounded object-cover shadow-sm"
                        decoding="async"
                        loading="lazy"
                        src={team.flag_url || ""}
                        alt={`${teamsById.get(Number(value))?.name || "Not Selected"} flag`}
                      />
                      <div className="min-w-0 px-5">
                        <p className="truncate font-semibold text-xs">
                          {teamsById.get(Number(value))?.name || "Not Selected"}
                        </p>
                        <p className="mt-0.5 opacity-75 text-xs" >
                          FIFA #{teamsById.get(Number(value))?.fifa_rank}
                        </p>
                      </div>
                    </dd>
                  </div>
                )
              })}
            </dl>
          </div>

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
              onClick={() => void handleConfirmClick()}
              disabled={isSubmitting}
              className="inline-flex h-10 items-center gap-2 justify-center rounded-md bg-tournament-primary px-4 text-sm font-semibold text-white transition hover:bg-tournament-primary disabled:cursor-not-allowed disabled:bg-zinc-400"
            >
              {isSubmitting
                ? (isUpdating ? "Updating..." : "Submitting...")
                : (isUpdating ? "Confirm Update" : "Confirm & Submit")}
            </button>
          </div>
        </div >
      )}
    </Modal >
  </>
  );
};
