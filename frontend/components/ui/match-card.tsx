import { MatchResponse } from "@/lib/matches"
import { PillTone, StatusPill } from "./status-pill";
import { JSX } from "react";
import { PredictionStatus } from "@/lib/matches/types";
import Link from "next/link";
import Image from "next/image";
import { DEFAULT_TIMEZONE } from "@/lib/api/config";

export const getStatusTone = (status: PredictionStatus): PillTone => {
  if (status === "Open") {
    return "secondary";
  }

  if (status === "Locking soon") {
    return "primary";
  }

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
};

export const formatDateTime = (value: string, isUTC: boolean = true): string => {
  // match datetime is in UTC, so we need to convert it to DEFAULT_TIMEZONE
  const date = isUTC ? new Date(`${value}Z`) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone: DEFAULT_TIMEZONE
  }).format(date);
};

const formatGroupLabel = (group: string): string => {
  const normalizedGroup = group.trim();

  if (!normalizedGroup) {
    return "Group TBA";
  }

  if (/^group\s+/i.test(normalizedGroup)) {
    return normalizedGroup;
  }

  return `Group ${normalizedGroup}`;
};

const formatMatchGroup = (match: MatchResponse): string => {
  if (match.team1_group === match.team2_group) {
    return formatGroupLabel(match.team1_group);
  }

  return `${formatGroupLabel(match.team1_group)} / ${formatGroupLabel(
    match.team2_group,
  )}`;
};

const MatchDayNStatus = (match: MatchResponse) => {
  const status = getPredictionStatus(match);
  return <dl className="items-start justify-between gap-3">
    <div className="flex items-start justify-between gap-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
        Match day {match.match_day}
      </p>
      <StatusPill tone={getStatusTone(status)}>{status}</StatusPill>
    </div>
  </dl>
};

export const getMatchLabelWithFlag = (match: MatchResponse, width: string = "w-full"): JSX.Element => {
  return (
    <div className={`flex ${width} items-center gap-3`}>
      <div className="flex w-[47%] items-center justify-end gap-2 pr-2">
        <span>{match.team1_name}</span>
        {match.team1_flag_url ? (
          <Image width={30} height={30} className="min-h-[25px] w-auto rounded object-cover shadow-sm" decoding="async" loading="lazy" src={match.team1_flag_url} alt="flag" />
        ) : null}
      </div>
      <span className="w-[6%] text-sm text-center text-zinc-400 dark:text-zinc-500">vs</span>
      <div className="flex w-[47%] items-center justify-start gap-2 pl-2">
        {match.team2_flag_url ? (
          <Image width={30} height={30} className="min-h-[25px] w-auto rounded object-cover shadow-sm" decoding="async" loading="lazy" src={match.team2_flag_url} alt="flag" />
        ) : null}
        <span>{match.team2_name}</span>
      </div>
    </div>
  );
};

const MatchTitle = (match: MatchResponse) => {
  return <dl className="items-start justify-between gap-3 min-h-[60px] content-center">
    <div className="flex items-center justify-center">
      <h2 className="w-full mt-2 text-md font-semibold text-zinc-950 dark:text-zinc-50">
        {getMatchLabelWithFlag(match)}
      </h2>
    </div>
  </dl>
};

export const MatchVenue = (match: MatchResponse) => {
  return <dl>
    <div className="flex w-full flex-col mt-4 items-center justify-center">
      <Link href={`https://google.com/search?q=${match.venue_name?.trim()}`} target="_blank" className="flex items-center justify-center cursor-pointer p-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 transition">
        <svg xmlns="http://w3.org" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
        </svg>
      </Link>
      <dd className="mt-2 font-medium text-zinc-950 dark:text-zinc-50">{match.venue_name ? <Link target="_blank" href={`https://google.com/search?q=${match.venue_name?.trim()}`} className="text-tournament-primary-light hover:text-tournament-primary">{match.venue_name?.trim()}</Link> : "TBA"}</dd>
    </div>
  </dl>
};

export const SelectableMatchCard = (props: { match: MatchResponse; isSelected: boolean; isSaved: boolean; handleCardClick: (match: MatchResponse) => void }) => {
  const { match, isSelected, isSaved, handleCardClick } = props;

  return <article
    key={match.id}
    className={`cursor-pointer rounded-md border bg-white p-4 shadow-sm dark:bg-zinc-900 dark:shadow-zinc-950 ${isSelected ? "border-tournament-primary" : "border-zinc-200 dark:border-zinc-700"}`}
    onClick={() => {
      handleCardClick(match);
    }}
  >
    <>
      {MatchDayNStatus(match)}
      {MatchTitle(match)}
      {MatchVenue(match)}
    </>
    <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
      <div>
        <dt className="text-zinc-500 dark:text-zinc-400">Kickoff</dt>
        <dd className="mt-1 font-medium text-zinc-950 dark:text-zinc-50">
          {formatDateTime(match.match_datetime)}
        </dd>
      </div>
      <div className="justify-self-end">
        <dt className="text-zinc-500 dark:text-zinc-400">Prediction</dt>
        <dd className="mt-1 font-medium text-zinc-950 dark:text-zinc-50">
          {isSaved ? "Saved" : "Not Saved"}
        </dd>
      </div>
    </dl>
  </article>
};

export const MatchCard = (props: { match: MatchResponse; }) => {
  const { match } = props;

  return (
    <article className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-zinc-950">
      <>
        {MatchDayNStatus(match)}
        {MatchTitle(match)}
      </>
      <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-zinc-500 dark:text-zinc-400">Kickoff</dt>
          <dd className="mt-1 font-medium text-zinc-950 dark:text-zinc-50">{formatDateTime(match.match_datetime)}</dd>
        </div>
        <div className="justify-self-end">
          <dt className="text-zinc-500 dark:text-zinc-400">Group</dt>
          <dd className="mt-1 font-medium text-zinc-950 dark:text-zinc-50">{formatMatchGroup(match)}</dd>
        </div>
      </dl>
      {MatchVenue(match)}
      <div className="flex justify-end">
        <Link
          href="/predictions"
          className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-tournament-primary px-4 text-sm font-semibold text-white transition hover:bg-tournament-primary"
        >
          Predict
        </Link>
      </div>
    </article>
  );
};
