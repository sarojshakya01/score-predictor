import Image from "next/image";
import Link from "next/link";

import { IconHighlight } from "@/components/ui/icons";
import { formatDateTime, isMatchPlayedOrLive } from "@/components/ui/match-card";
import { Tooltip } from "@/components/ui/tooltip";
import type { MatchResponse } from "@/lib/matches";
import defaultFlag from "@/public/images/default-flag.png";

const getHighlightsUrl = (match: MatchResponse): string | null => {
  return match.highlights_url ?? null;
};

const TeamScoreRow = ({
  flagUrl,
  isWinner,
  name,
  score,
}: {
  flagUrl: string;
  isWinner: boolean;
  name: string;
  score: number | null;
}) => {
  return (
    <div
      className={[
        "flex items-center justify-between gap-3 rounded-md px-2 py-2",
        isWinner ? "bg-emerald-200 dark:bg-emerald-900/70" : "",
      ].join(" ")}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Image
          width={28}
          height={28}
          className="min-h-[26px] w-auto shrink-0 rounded object-cover shadow-sm"
          decoding="async"
          loading="lazy"
          src={flagUrl}
          alt={`${name} flag`}
        />
        <p
          className={[
            "truncate text-sm",
            isWinner
              ? "font-semibold text-emerald-700 dark:text-emerald-200"
              : "font-medium text-zinc-800 dark:text-zinc-200",
          ].join(" ")}
        >
          {name}
        </p>
      </div>
      <span className="shrink-0 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        {score ?? "-"}
      </span>
    </div>
  );
};

export const MatchResultsList = ({ matches }: { matches: MatchResponse[] }) => {
  if (matches.length === 0) {
    return (
      <div className="rounded-md border border-zinc-200 bg-white px-5 py-10 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          No results yet
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500 dark:text-zinc-400">
          Completed match results will appear here.
        </p>
      </div>
    );
  }

  return (
    <article className={[
      "overflow-hidden",
      "rounded-md border-zinc-200 border dark:border-zinc-700",
      "shadow-sm dark:shadow-zinc-950",
      "bg-white dark:bg-zinc-900"
    ].join(" ")}>
      <div className="flex gap-3 overflow-x-auto p-4">
        {matches.map((match) => {
          const team1Won = match.winner_id === match.team1_id;
          const team2Won = match.winner_id === match.team2_id;
          const highlightsUrl = getHighlightsUrl(match);
          const { isMatchLive } = isMatchPlayedOrLive(match);

          if (isMatchLive) return null;

          return (
            <div
              key={match.id}
              className="relative flex min-h-44 w-60 shrink-0 cursor-pointer flex-col justify-between rounded-md border border-zinc-200 bg-zinc-50 p-3 text-left shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 focus:border-emerald-400 focus:bg-emerald-50 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/40 dark:focus:border-emerald-700 dark:focus:bg-emerald-950/40"
            >
              <Link
                href="/results"
                aria-label={`View results for ${match.team1_name} vs ${match.team2_name}`}
                className="absolute inset-0 z-10 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-emerald-700 dark:focus:ring-offset-zinc-900"
              />

              <div className="pointer-events-none relative z-20 flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
                    Match day {match.match_day}
                  </p>
                </div>
                <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                  {formatDateTime(match.match_datetime)}
                </p>
              </div>

              <div className="pointer-events-none relative z-20 mt-4 grid gap-2">
                <TeamScoreRow
                  flagUrl={match.team1_flag_url === "default" ? defaultFlag.src : match.team1_flag_url}
                  isWinner={team1Won}
                  name={match.team1_name}
                  score={match.team1_score}
                />
                <TeamScoreRow
                  flagUrl={match.team2_flag_url === "default" ? defaultFlag.src : match.team2_flag_url}
                  isWinner={team2Won}
                  name={match.team2_name}
                  score={match.team2_score}
                />
              </div>

              <div className="pointer-events-none relative z-20 mt-4 flex items-center justify-between gap-3">
                <p className="min-w-0 truncate text-xs text-zinc-500 dark:text-zinc-400">
                  {match.venue_name || "Venue TBA"}
                </p>
                {highlightsUrl ? (
                  <Tooltip content="Watch match highlights">
                    <Link
                      href={highlightsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Watch highlights for ${match.team1_name} vs ${match.team2_name}`}
                      className={[
                        "pointer-events-auto relative z-30 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition",
                        "bg-gray-200 dark:bg-blue-700",
                        "ring-1 ring-inset ring-gray-200 dark:ring-gray-500",
                        "hover:bg-gray-300 dark:hover:bg-blue-600",
                        "text-blue-600 hover:text-blue-700 dark:text-blue-300 "
                      ].join(" ")}
                    >
                      <IconHighlight className="h-4 w-4" />
                    </Link>
                  </Tooltip>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
};
