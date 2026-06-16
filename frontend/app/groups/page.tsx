"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/ui/page-shell";
import { ApiError } from "@/lib/api";
import { listGroupTables } from "@/lib/groups";
import type { GroupTableResponse } from "@/lib/groups";

const formatGroupLabel = (group: string): string => {
  const normalizedGroup = group.trim();
  if (/^group\s+/i.test(normalizedGroup)) return normalizedGroup;
  return `Group ${normalizedGroup}`;
};

const formatGoalDifference = (goalDifference: number): string => {
  if (goalDifference > 0) return `+${goalDifference}`;
  return String(goalDifference);
};

const getLoadErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Unable to load group standings.";
};

const GroupsPage = () => {
  const [groupTables, setGroupTables] = useState<GroupTableResponse[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchGroups = async () => {
      try {
        const response = await listGroupTables();
        if (isMounted) setGroupTables(response.items);
      } catch (error) {
        if (isMounted) setLoadError(getLoadErrorMessage(error));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    void fetchGroups();
    return () => { isMounted = false; };
  }, []);

  return (
    <PageShell>
      {isLoading ? (
        <section className="grid gap-6 xl:grid-cols-2">
          {[...Array(6).keys()].map((item) => (
            <div
              key={item}
              className="h-[367px] animate-pulse rounded-md px-5 py-4 border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          ))}
        </section>
      ) : loadError ? (
        <section className="rounded-md border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-300" role="alert">
          {loadError}
        </section>
      ) : groupTables.length > 0 ? (
        <section className="grid gap-6 xl:grid-cols-2">
          {groupTables.map((group) => (
            <div key={group.group} className="overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
              <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-700">
                <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">{formatGroupLabel(group.group)}</h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{group.standings.length} teams</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-700">
                  <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    <tr>
                      <th className="px-5 py-3 min-w-[100px] md:min-w-[230px]">Team</th>
                      <th className="px-3 py-3 text-right">P</th>
                      <th className="px-3 py-3 text-right">W</th>
                      <th className="px-3 py-3 text-right">D</th>
                      <th className="px-3 py-3 text-right">L</th>
                      <th className="px-3 py-3 text-right">GD</th>
                      <th className="px-5 py-3 text-right">Pts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {group.standings.map((team) => (
                      <tr key={team.team_id}>
                        <td className="px-5 py-4 min-w-[100px] md:min-w-[230px] font-medium text-zinc-950 dark:text-zinc-50">
                          <span className="flex min-w-[80px] items-center gap-1">
                            <span className="inline-flex items-center justify-center rounded border border-zinc-200 bg-zinc-50 text-xs font-semibold text-zinc-600 relative dark:border-zinc-700 dark:bg-zinc-800">
                              <Image width={30} height={30} alt={team.fifa_code} className="object-cover rounded min-h-[25px] w-auto" src={team.flag_url} />
                            </span>
                            <span className="hidden pl-2 sm:table-cell xl:truncate xl:max-w-[140px]">{team.team}</span>
                            <span className="sm:hidden pl-2 xl:truncate xl:max-w-[140px]">{team.fifa_code}</span>
                            <span className="flex w-[100px]">(Rank: {team.fifa_rank})</span>
                          </span>
                        </td>
                        <td className="px-3 py-4 text-right text-zinc-700 dark:text-zinc-300">{team.played}</td>
                        <td className="px-3 py-4 text-right text-zinc-700 dark:text-zinc-300">{team.won}</td>
                        <td className="px-3 py-4 text-right text-zinc-700 dark:text-zinc-300">{team.drawn}</td>
                        <td className="px-3 py-4 text-right text-zinc-700 dark:text-zinc-300">{team.lost}</td>
                        <td className="px-3 py-4 text-right text-zinc-700 dark:text-zinc-300">{formatGoalDifference(team.goal_difference)}</td>
                        <td className="px-5 py-4 text-right font-semibold text-zinc-950 dark:text-zinc-50">{team.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </section>
      ) : (
        <section className="rounded-md border border-zinc-200 bg-white px-5 py-10 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">No group standings yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            Standings will appear after teams are available from the API.
          </p>
        </section>
      )}
    </PageShell>
  );
};

export default GroupsPage;
