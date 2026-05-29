"use client";

import { PageShell } from "@/components/ui/page-shell";
import { StatusPill } from "@/components/ui/status-pill";

const rounds = [
  {
    matches: ["Argentina 2 - 1 Brazil", "Germany 1 - 1 Spain", "France 3 - 0 Japan"],
    name: "Round of 32",
  },
  {
    matches: ["Argentina vs Spain", "France vs Portugal"],
    name: "Round of 16",
  },
  {
    matches: ["Quarter final 1", "Quarter final 2"],
    name: "Quarter final",
  },
  {
    matches: ["Semi final 1", "Semi final 2"],
    name: "Semi final",
  },
  {
    matches: ["Final"],
    name: "Final",
  },
] as const;

export default function BracketsPage() {
  return (
    <PageShell
      eyebrow="Brackets"
      subtitle="Knockout paths from the round of 32 through the final."
      title="Tournament Bracket"
    >
      <section className="overflow-x-auto rounded-md border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="grid min-w-[980px] grid-cols-5 gap-4">
          {rounds.map((round) => (
            <div key={round.name}>
              <div className="mb-4 flex h-10 items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  {round.name}
                </h2>
              </div>
              <div className="flex flex-col gap-4">
                {round.matches.map((match) => (
                  <div
                    key={match}
                    className="min-h-20 rounded-md border border-zinc-200 bg-zinc-50 p-3"
                  >
                    <p className="text-sm font-semibold text-zinc-950">
                      {match}
                    </p>
                    <div className="mt-3">
                      <StatusPill tone="zinc">Pending</StatusPill>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
