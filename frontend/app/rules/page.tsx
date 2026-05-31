"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/ui/page-shell";
import { listRules } from "@/lib/settings";
import type { RuleBand } from "@/lib/view-data";

const RulesPage = () => {
  const [ruleBands, setRuleBands] = useState<RuleBand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadRules = async () => {
      try {
        const response = await listRules();
        if (!isMounted) return;
        const bands = response.items.map(item => ({
          id: item.id,
          title: item.friendly_name,
          items: item.value.split(",").map(line => line.trim()).filter(line => line.length > 0)
        }));
        bands.sort((a, b) => (a.id - b.id));
        setRuleBands(bands);
      } catch {
        if (isMounted) setError("Failed to load rules.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    void loadRules();
    return () => { isMounted = false; };
  }, []);

  return (
    <PageShell
      eyebrow="Rules"
      subtitle="Scoring bands used for match predictions and leaderboard totals."
      title="Prediction Rules"
    >
      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="text-sm text-zinc-500 dark:text-zinc-400">Loading rules...</div>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {ruleBands.map((band) => (
            <article key={band.title} className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
              <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">{band.title}</h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                {band.items.map((item, index) => (
                  <li key={`${band.title}-${index}`} className="flex gap-3">
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-emerald-700 dark:bg-emerald-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>
      )}
    </PageShell>
  );
};

export default RulesPage;
