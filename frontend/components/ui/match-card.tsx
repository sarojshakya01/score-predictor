import { MatchResponse, matchStageLabels } from "@/lib/matches"
import { PillTone, StatusPill } from "./status-pill";
import { JSX } from "react";
import { PredictionStatus } from "@/lib/matches/types";
import Link from "next/link";
import { DEFAULT_TIMEZONE } from "@/lib/api/config";
import { IconCheck, IconCross, IconLiveDot, IconLocation, IconWarning } from "./icons";
import TeamWithFlag from "./team-with-flag";

// ---------------------------------------------------------------------------
// Lock-urgency helpers
// ---------------------------------------------------------------------------

/** Returns how urgently the match is about to lock, based on match_datetime (UTC). */
export const getLockUrgency = (match: MatchResponse): "alarm" | "warn" | "none" => {
  if (match.match_locked) return "none";

  const kickoff = new Date(`${match.match_datetime}Z`).getTime();
  const lockDeadline = kickoff - 60 * 60 * 1000; // 1 hr before kickoff
  const msLeft = lockDeadline - Date.now();

  if (msLeft <= 0) return "none"; // already past deadline
  if (msLeft <= 4 * 60 * 60 * 1000) return "alarm"; // ≤ 4 hrs  → alarming
  if (msLeft <= 8 * 60 * 60 * 1000) return "warn";  // ≤ 8 hrs  → average attention
  return "none";
};

// ---------------------------------------------------------------------------
// Existing helpers (unchanged)
// ---------------------------------------------------------------------------

export const getStatusTone = (status: PredictionStatus): PillTone => {
  if (status === "Open") return "secondary";
  if (status === "Locking soon") return "yellow";
  return "accent";
};

export type MatchCard = {
  awayFlag: string | null;
  awayTeam: string;
  day: string;
  group: string;
  homeFlag: string | null;
  homeTeam: string;
  id: number;
  kickOff: string;
  lockState: "Open" | "Locking soon" | "Locked";
  venue: string;
};

export const getPredictionStatus = (
  match: MatchResponse,
): "Locked" | "Locking soon" | "Open" => {
  if (match.match_locked) return "Locked";

  const kickoff = new Date(`${match.match_datetime}Z`).getTime();
  const deadline = kickoff - 60 * 60 * 1000;
  const now = Date.now();

  if (Number.isFinite(deadline) && deadline - now <= 3 * 60 * 60 * 1000) return "Locking soon";
  return "Open";
};

export const formatDateTime = (value: string, isUTC: boolean = true): string => {
  const date = isUTC ? new Date(`${value}Z`) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone: DEFAULT_TIMEZONE,
  }).format(date);
};

export const isMatchPlayedOrLive = (match: MatchResponse): { isMatchPlayed: boolean, isMatchLive: boolean } => {
  const now = new Date();
  const kickoff = new Date(`${match.match_datetime}Z`);
  const isMatchPlayed = match.match_locked && match.team1_score !== null && match.team2_score !== null;
  const matchMinutes = match.match_stage === matchStageLabels.GROUP ? (45 + 15 + 45 + 10) : (45 + 15 + 45 + 10 + 35 + 15); // tentative total minutes for group stage and knockout matches
  const isMatchCompleted = (match.team1_score != match.team2_score && match.winner_id) || (isMatchPlayed && now.getTime() > kickoff.getTime() + matchMinutes * 60 * 1000);
  const isMatchLive = now.getTime() > kickoff.getTime() && !isMatchCompleted;

  return { isMatchPlayed, isMatchLive };
}

const formatGroupLabel = (group: string): string => {
  const normalizedGroup = group.trim();
  if (!normalizedGroup) return "Group TBA";
  if (/^group\s+/i.test(normalizedGroup)) return normalizedGroup;
  return `Group ${normalizedGroup}`;
};

const formatMatchGroup = (match: MatchResponse): string => {
  if (match.team1_group === match.team2_group) return formatGroupLabel(match.team1_group);
  return `${formatGroupLabel(match.team1_group)} / ${formatGroupLabel(match.team2_group)}`;
};

const MatchDayNGroupNStatus = (match: MatchResponse) => {
  const status = getPredictionStatus(match);
  const urgency = getLockUrgency(match);
  const { isMatchPlayed, isMatchLive } = isMatchPlayedOrLive(match);
  return (
    <dl className="items-start justify-between gap-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
          Match day {match.match_day}
        </p>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">{formatMatchGroup(match)}</p>
        {isMatchPlayed
          ? (<StatusPill tone={isMatchLive ? "green" : "primary"} urgency="none">{isMatchLive ? <IconLiveDot /> : null} {isMatchLive ? "Live: " : "FT: "}{match.team1_score} - {match.team2_score}</StatusPill>)
          : (<StatusPill tone={getStatusTone(status)} urgency={urgency}>{status}</StatusPill>)}
      </div>
    </dl>
  );
};

export const getTeam1WithFlag = (match: MatchResponse, size: string = "md") => (
  <TeamWithFlag match={match} size={size} isHomeTeam={true} />
)

export const getVs = (size: string = "md") => (
  <span className={(size === "sm" ? "w-full" : "w-[6%]") + " text-sm text-center text-zinc-400 dark:text-zinc-500"}>vs</span>
)

export const getTeam2WithFlag = (match: MatchResponse, size: string = "md") => (
  <TeamWithFlag match={match} size={size} isHomeTeam={false} />
)
export const getMatchLabelWithFlag = (match: MatchResponse, width: string = "w-full", size: string = "md"): JSX.Element => (
  <div className={`flex ${width} items-center gap-3`}>
    {getTeam1WithFlag(match, size)}
    {getVs()}
    {getTeam2WithFlag(match, size)}
  </div>
);

const MatchTitle = (match: MatchResponse) => (
  <dl className="items-start justify-between gap-3 min-h-[50px] content-center">
    <div className="flex items-center justify-center">
      <h2 className="w-full mt-2 text-md font-semibold text-zinc-950 dark:text-zinc-50">
        {getMatchLabelWithFlag(match)}
      </h2>
    </div>
  </dl>
);

export const MatchVenue = (match: MatchResponse) => (
  <dl className="mt-2">
    <div className="flex w-full flex-col items-center justify-center">
      <Link
        href={`https://google.com/search?q=${match.venue_name?.trim()}`}
        onClick={(e) => e.stopPropagation()}
        target="_blank"
        className="flex items-center justify-center cursor-pointer p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 transition"
      >
        <IconLocation />
      </Link>
      <dd className="mt-1 font-medium text-zinc-950 dark:text-zinc-50">
        {match.venue_name ? match.venue_name?.trim() : "TBA"}
      </dd>
    </div>
  </dl>
);

const MatchSaveStatus = (isPredictionAvailable: boolean, isSaved: boolean, isMatchLocked: boolean, isCorrectWinner: boolean | null = null) => {
  if (!isPredictionAvailable) return <></>
  if (isMatchLocked && !isSaved) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
        <IconCross className="h-4 w-4 shrink-0" />
        Missed
      </span>
    );
  } else if (isSaved) {
    return (
      isCorrectWinner !== null && isCorrectWinner ? (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-tournament-secondary text-white">
          <IconCheck className="h-4 w-4 shrink-0" />
          Correct
        </span>
      ) : isCorrectWinner !== null && !isCorrectWinner ? (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-tournament-accent text-white">
          <IconCross className="h-4 w-4 shrink-0" />
          Wrong
        </span>
      ) : <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-tournament-secondary text-white">
        <IconCheck className="h-4 w-4 shrink-0" />
        Saved
      </span>
    );
  } else {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-tournament-accent text-white animate-bounce">
        <IconWarning className="h-4 w-4 shrink-0" />
        Not Saved
      </span>
    );
  }
}

// ---------------------------------------------------------------------------
// Card components
// ---------------------------------------------------------------------------

export const SelectableMatchCard = (props: {
  match: MatchResponse;
  isSelected: boolean;
  isSaved: boolean;
  isPredictionAvailable: boolean;
  isCorrectWinner: boolean | null;
  handleCardClick: (match: MatchResponse) => void;
  className?: string;
}) => {
  const { match, isSelected, isSaved, isPredictionAvailable, isCorrectWinner, handleCardClick, className } = props;

  const { isMatchLive } = isMatchPlayedOrLive(match);

  return (
    <article
      key={match.id}
      className={[
        match.match_locked ? "opacity-70" : "",
        "border " + (isSelected ? "border-tournament bg-gray-200 dark:bg-zinc-700" : "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"),
        "relative overflow-hidden cursor-pointer rounded-md p-4",
        "shadow-sm dark:shadow-zinc-950",
        "hover:bg-gray-100 hover:dark:bg-zinc-500/40",
        className,
        isMatchLive ? "animate-pulse" : ""
      ].join(" ")}
      onClick={() => handleCardClick(match)}
      data-match-id={match.id}
    >
      <>
        {MatchDayNGroupNStatus(match)}
        {MatchTitle(match)}
        {MatchVenue(match)}
      </>
      <dl className="mt-1 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-zinc-500 dark:text-zinc-400">Kickoff</dt>
          <dd className="font-medium text-zinc-950 dark:text-zinc-50">
            {formatDateTime(match.match_datetime)}
          </dd>
        </div>
        <div className="flex items-end justify-self-end">
          <dd className="font-medium text-zinc-950 dark:text-zinc-50">
            {MatchSaveStatus(isPredictionAvailable, isSaved, match.match_locked, isCorrectWinner)}
          </dd>
        </div>
      </dl>
    </article>
  );
};

export const MatchCard = (props: {
  match: MatchResponse;
  className?: string;
  isSaved?: boolean;
  isPredictionAvailable?: boolean;
  isCorrectWinner: boolean | null;
}) => {
  const { match, className, isSaved = false, isPredictionAvailable = false, isCorrectWinner = false } = props;
  const predictionHref = `/predictions?matchday=${match.match_day}&id=${match.id}`;

  const cardContent = (
    <article
      className={[
        match.match_locked ? "opacity-70" : "",
        isSaved ? "cursor-pointer" : "",
        "relative overflow-hidden rounded-md p-4",
        "bg-zinc-50 dark:bg-zinc-800",
        "border border-zinc-200 dark:border-zinc-700",
        "shadow-sm dark:shadow-zinc-950",
        "hover:bg-gray-100 hover:dark:bg-zinc-500/40",
        className,
      ].join(" ")}
      onClick={(e: React.MouseEvent) => { e.stopPropagation(); window.location.href = predictionHref }}
    >
      <>
        {MatchDayNGroupNStatus(match)}
        <div className="mt-[10px] mb-[10px]">{MatchTitle(match)}</div>
      </>
      {MatchVenue(match)}
      <dl className="mt-2 grid grid-cols-2 gap-4 text-sm items-center">
        <div>
          <dt className="text-zinc-500 dark:text-zinc-400">Kickoff</dt>
          <dd className="mt-1 font-medium text-zinc-950 dark:text-zinc-50">
            {formatDateTime(match.match_datetime)}
          </dd>
        </div>
        <div className="flex justify-end">
          {isSaved ? (
            <dd className="font-medium text-zinc-950 dark:text-zinc-50">
              {MatchSaveStatus(isPredictionAvailable, isSaved, match.match_locked, isCorrectWinner)}
            </dd>
          ) : (
            <Link
              href={predictionHref}
              onClick={(e) => e.stopPropagation()}
              className={
                (match.match_locked ? "pointer-events-none cursor-default " : "") +
                "inline-flex h-9 items-center justify-center rounded-md bg-tournament-primary px-4 text-sm font-semibold text-white transition hover:bg-tournament-primary border border-gray-100 dark:border-gray-700"
              }
            >
              Predict
            </Link>
          )}
        </div>
      </dl>
    </article>
  );

  if (isSaved) {
    return cardContent;
  }

  return cardContent;
};
