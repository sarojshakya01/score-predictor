"use client";

import { PageShell } from "@/components/ui/page-shell";
import { ruleBands } from "@/lib/view-data";

export default function RulesPage() {
  return (
    <PageShell
      eyebrow="Rules"
      subtitle="Scoring bands used for match predictions and leaderboard totals."
      title="Prediction Rules"
    >
      <section className="grid gap-4 lg:grid-cols-2">
        {ruleBands.map((band) => (
          <article
            key={band.title}
            className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm"
          >
            <h2 className="text-lg font-semibold text-zinc-950">
              {band.title}
            </h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-zinc-700">
              {band.items.map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-emerald-700" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </PageShell>
  );
}
