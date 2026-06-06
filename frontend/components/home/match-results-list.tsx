import Image from "next/image";

import { formatDateTime } from "@/components/ui/match-card";
import type { MatchResponse } from "@/lib/matches";

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

          return (
            <div
              key={match.id}
              className="relative flex min-h-44 w-60 shrink-0 flex-col justify-between rounded-md border border-zinc-200 bg-zinc-50 p-3 text-left shadow-sm dark:border-zinc-700 dark:bg-zinc-800"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
                    Match day {match.match_day}
                  </p>
                </div>
                <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                  {formatDateTime(match.match_datetime)}
                </p>
              </div>

              <div className="mt-4 grid gap-2">
                <TeamScoreRow
                  flagUrl={match.team1_flag_url}
                  isWinner={team1Won}
                  name={match.team1_name}
                  score={match.team1_score}
                />
                <TeamScoreRow
                  flagUrl={match.team2_flag_url}
                  isWinner={team2Won}
                  name={match.team2_name}
                  score={match.team2_score}
                />
              </div>

              <p className="mt-4 truncate text-xs text-center text-zinc-500 dark:text-zinc-400">
                {match.venue_name || "Venue TBA"}
              </p>
            </div>
          );
        })}
      </div>
    </article>
  );
};
