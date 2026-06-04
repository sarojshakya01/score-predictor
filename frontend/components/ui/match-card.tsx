import { MatchResponse } from "@/lib/matches"
import { PillTone, StatusPill } from "./status-pill";
import { JSX } from "react";
import { PredictionStatus } from "@/lib/matches/types";
import Link from "next/link";
import Image from "next/image";
import { DEFAULT_TIMEZONE } from "@/lib/api/config";
import { IconCheck, IconCross, IconLocation, IconWarning } from "./icons";

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

  if (Number.isFinite(deadline) && now >= deadline) return "Locked";
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
  return (
    <dl className="items-start justify-between gap-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
          Match day {match.match_day}
        </p>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">{formatMatchGroup(match)}</p>
        <StatusPill tone={getStatusTone(status)} urgency={urgency}>{status}</StatusPill>
      </div>
    </dl>
  );
};

export const getTeam1WithFlag = (match: MatchResponse, size: string = "md") => (
  <div className={(size === "sm" ? "w-full" : "w-[47%]") + " flex items-center justify-end gap-2 pr-2"}>
    <span className="inline-block w-full text-right">{match.team1_name}</span>
    {match.team1_flag_url ? (
      <Image width={30} height={30} className={(size === "sm" ? "min-h-[18px]" : "min-h-[25px]") + " w-auto rounded object-cover shadow-sm"} decoding="async" loading="lazy" src={match.team1_flag_url} alt="flag" />
    ) : null}
  </div>
)

export const getVs = (size: string = "md") => (
  <span className={(size === "sm" ? "w-full" : "w-[6%]") + " text-sm text-center text-zinc-400 dark:text-zinc-500"}>vs</span>
)

export const getTeam2WithFlag = (match: MatchResponse, size: string = "md") => (
  <div className={(size === "sm" ? "w-full" : "w-[47%]") + " flex items-center justify-start gap-2 pl-2"}>
    {match.team2_flag_url ? (
      <Image width={30} height={30} className={(size === "sm" ? "min-h-[18px]" : "min-h-[25px]") + " w-auto rounded object-cover shadow-sm"} decoding="async" loading="lazy" src={match.team2_flag_url} alt="flag" />
    ) : null}
    <span className="inline-block w-full text-left">{match.team2_name}</span>
  </div>
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
        target="_blank"
        className="flex items-center justify-center cursor-pointer p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 transition"
      >
        <IconLocation />
      </Link>
      <dd className="mt-1 font-medium text-zinc-950 dark:text-zinc-50">
        {match.venue_name
          ? <Link target="_blank" href={`https://google.com/search?q=${match.venue_name?.trim()}`} className="text-tournament-primary-light hover:text-tournament-primary">{match.venue_name?.trim()}</Link>
          : "TBA"}
      </dd>
    </div>
  </dl>
);

const MatchSaveStatus = (isPredictionAvailable: boolean, isSaved: boolean, isMatchLocked: boolean) => {
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
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-tournament-secondary text-white">
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
  handleCardClick: (match: MatchResponse) => void;
  className?: string;
}) => {
  const { match, isSelected, isSaved, isPredictionAvailable, handleCardClick, className } = props;

  return (
    <article
      key={match.id}
      className={[
        match.match_locked ? "opacity-70" : "",
        isSelected ? "border-tournament" : "border-zinc-200 dark:border-zinc-700",
        "relative overflow-hidden cursor-pointer rounded-md border bg-white p-4 shadow-sm dark:bg-zinc-900 dark:shadow-zinc-950",
        className,
      ].join(" ")}
      onClick={() => handleCardClick(match)}
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
            {MatchSaveStatus(isPredictionAvailable, isSaved, match.match_locked)}
          </dd>
        </div>
      </dl>
    </article>
  );
};

export const MatchCard = (props: { match: MatchResponse; className?: string }) => {
  const { match, className } = props;

  return (
    <article
      className={[
        match.match_locked ? "opacity-70 mouse-events-none" : "",
        "border-zinc-200 dark:border-zinc-700",
        "relative overflow-hidden rounded-md border bg-white p-4 shadow-sm dark:bg-zinc-900 dark:shadow-zinc-950",
        className,
      ].join(" ")}
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
          <Link
            href="/predictions"
            className={(match.match_locked ? "pointer-events-none cursor-default " : "") + "inline-flex h-10 items-center justify-center rounded-md bg-tournament-primary px-4 text-sm font-semibold text-white transition hover:bg-tournament-primary"}
          >
            Predict
          </Link>
        </div>
      </dl>
    </article>
  );
};
