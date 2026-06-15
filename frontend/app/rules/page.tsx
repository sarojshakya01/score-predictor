"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/ui/page-shell";
import { getGameRules } from "@/lib/settings";
import type { GameRuleGroup, GameRuleEntry } from "@/lib/settings";

/** Replace the <points> placeholder. Notes (points === 0) are left as-is. */
const resolveInstruction = (entry: GameRuleEntry): string =>
  entry.instruction.replace("<points>", String(Math.abs(entry.points)));

const RulesPage = () => {
  const [groups, setGroups] = useState<GameRuleGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const res = await getGameRules();
        // sort by the order field defined in the JSON
        const sorted = [...res.rules].sort((a, b) => a.order - b.order);
        if (isMounted) setGroups(sorted);
      } catch {
        if (isMounted) setError("Failed to load rules. Please try again later.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    void load();
    return () => { isMounted = false; };
  }, []);

  return (
    <PageShell>
      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-300">
          {error}
        </div>
      )}

      {isLoading ? (
        <>
          <section className="grid gap-4 sm:grid-cols-1 lg:grid-cols-1">
            {[...Array(1).keys()].map((item) => (
              <div
                key={item}
                className="h-[285px] animate-pulse rounded-md px-5 py-4 border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
            ))}
          </section>
          <hr className="border-gray-300 dark:border-gray-700 my-2" />
          <section className="grid gap-4 sm:grid-cols-1 lg:grid-cols-1">
            {[...Array(1).keys()].map((item) => (
              <div
                key={item}
                className="h-[54px] animate-pulse rounded-md px-5 py-4 border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
            ))}
          </section>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
            {[...Array(4).keys()].map((item) => (
              <div
                key={item}
                className="h-[280px] animate-pulse rounded-md px-5 py-4 border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
            ))}
          </section>
        </>
      ) : groups.length === 0 && !error ? (
        <div className="text-sm text-zinc-500 dark:text-zinc-400">No rules configured yet.</div>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-1 lg:grid-cols-1">
            {groups.filter((group) => group.name === "winners").map((group) => (
              <article
                key={group.name}
                className="flex flex-col rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                {/* group header */}
                <header className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800 bg-gray-100 dark:bg-zinc-700">
                  <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-50">
                    {"Winner Prediction Rule"}
                  </h2>
                </header>
                <header className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
                  <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                    {group.friend_name}
                  </h2>
                </header>

                {/* rule entries */}
                <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
                  {[...group.rules]
                    .sort((a, b) => a.order - b.order)
                    .map((entry, idx) => {
                      const isNote = entry.points === 0;
                      return (
                        <li
                          key={idx}
                          className="flex items-start gap-3 px-4 py-3"
                        >
                          {isNote ? (
                            /* note row — no badge, italic muted text */
                            <p className="text-xs italic leading-5 text-yellow-700 dark:text-yellow-300">
                              {entry.instruction}
                            </p>
                          ) : (
                            <>
                              {/* points badge */}
                              <span
                                className={`mt-0.5 shrink-0 inline-flex min-w-[2.5rem] items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-bold tabular-nums ${entry.points > 0
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                                  : "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                                  }`}
                              >
                                {entry.points > 0 ? `+${entry.points}` : entry.points}
                              </span>
                              <p className="text-sm leading-5 text-zinc-700 dark:text-zinc-300">
                                {resolveInstruction(entry)}
                              </p>
                            </>
                          )}
                        </li>
                      );
                    })}
                </ul>
              </article>
            ))}
          </section>
          <hr className="border-gray-300 dark:border-gray-700 my-2" />
          <header className="border border-zinc-200 rounded-md px-4 py-3 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-700">
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-50">
              {"Match Prediction Rules"}
            </h2>
          </header>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
            {groups.filter((group) => group.name !== "winners").map((group) => (
              <article
                key={group.name}
                className="flex flex-col rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                {/* group header */}
                <header className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
                  <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                    {group.friend_name}
                  </h2>
                </header>

                {/* rule entries */}
                <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
                  {[...group.rules]
                    .sort((a, b) => a.order - b.order)
                    .map((entry, idx) => {
                      const isNote = entry.points === 0;
                      return (
                        <li
                          key={idx}
                          className="flex items-start gap-3 px-4 py-3"
                        >
                          {isNote ? (
                            /* note row — no badge, italic muted text */
                            <p className="text-xs italic leading-5 text-yellow-700 dark:text-yellow-300">
                              {entry.instruction}
                            </p>
                          ) : (
                            <>
                              {/* points badge */}
                              <span
                                className={`mt-0.5 shrink-0 inline-flex min-w-[2.5rem] items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-bold tabular-nums ${entry.points > 0
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                                  : "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                                  }`}
                              >
                                {entry.points > 0 ? `+${entry.points}` : entry.points}
                              </span>
                              <p className="text-sm leading-5 text-zinc-700 dark:text-zinc-300">
                                {resolveInstruction(entry)}
                              </p>
                            </>
                          )}
                        </li>
                      );
                    })}
                </ul>
              </article>
            ))}
          </section>
        </>
      )}
    </PageShell>
  );
};

export default RulesPage;
