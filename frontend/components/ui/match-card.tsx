import Link from "next/link";

import { StatusPill } from "@/components/ui/status-pill";
import type { MatchCard as MatchCardType } from "@/lib/view-data";

type MatchCardProps = {
  match: MatchCardType;
};

function getLockTone(lockState: MatchCardType["lockState"]) {
  if (lockState === "Open") {
    return "green";
  }

  if (lockState === "Locking soon") {
    return "amber";
  }

  return "red";
}

export function MatchCard({ match }: MatchCardProps) {
  return (
    <article className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            {match.day}
          </p>
          <h2 className="mt-2 text-lg font-semibold text-zinc-950">
            {match.homeTeam} vs {match.awayTeam}
          </h2>
        </div>
        <StatusPill tone={getLockTone(match.lockState)}>
          {match.lockState}
        </StatusPill>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-zinc-500">Kickoff</dt>
          <dd className="mt-1 font-medium text-zinc-950">{match.kickOff}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Group</dt>
          <dd className="mt-1 font-medium text-zinc-950">{match.group}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-zinc-500">Venue</dt>
          <dd className="mt-1 font-medium text-zinc-950">{match.venue}</dd>
        </div>
      </dl>
      <Link
        href="/predictions"
        className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800"
      >
        Predict
      </Link>
    </article>
  );
}
