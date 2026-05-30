"use client";

import Link from "next/link";

import { MetricCard, toneClasses } from "@/components/ui/metric-card";
import { useEffect, useState } from "react";
import { listAdminMatches, listUpcomingMatches, MatchResponse } from "@/lib/matches";
import { listAdminTeams, TeamResponse } from "@/lib/teams";
import { listAdminUsers } from "@/lib/users";
import { UserResponse } from "@/lib/auth";

const AdminPage = () => {

  const [teams, setTeams] = useState<TeamResponse[]>([]);
  const [matches, setMatches] = useState<MatchResponse[]>([]);
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [upcomingMatches, setUpComingMatches] = useState<MatchResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadInitialPageData = async () => {
      setIsLoading(true);

      try {
        const [userList, matchList, teamList, upcomingMatchList] = await Promise.all([
          listAdminUsers({ limit: 100 }),
          listAdminMatches({ limit: 100 }),
          listAdminTeams({ limit: 100 }),
          listUpcomingMatches({ limit: 100 })
        ]);

        if (isMounted) {
          setUsers(userList.items.filter((user) => user.role === "USER"));
          setMatches(matchList.items);
          setTeams(teamList.items);
          setUpComingMatches(upcomingMatchList.items);
        }
      } catch {
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadInitialPageData();

    return () => {
      isMounted = false;
    };
  }, []);

  const adminMetrics = [
    {
      label: "Total Matches",
      value: isLoading ? "..." : `${upcomingMatches.length.toString()} matches locking today`,
      tone: "blue",
    },
    {
      label: "Total Users",
      value: isLoading ? "..." : `${users.length.toString()} users are competing for the title`,
      tone: "green",
    },
    {
      label: "Total Teams",
      value: isLoading ? "..." : `${teams.length.toString()} teams left in the tournament`,
      tone: "amber",
    },
  ] as const;

  const adminQueues = [
    { href: "/admin/matches", tone: toneClasses.blue, label: "Matches", value: isLoading ? "..." : matches.length },
    { href: "/admin/users", tone: toneClasses.green, label: "Users", value: isLoading ? "..." : users.length },
    { href: "/admin/teams", tone: toneClasses.amber, label: "Teams", value: isLoading ? "..." : teams.length },
  ] as const;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
        <section className="grid gap-4 md:grid-cols-1">
          {adminMetrics.map((metric) => (
            <MetricCard key={metric.label} metric={metric} />
          ))}
        </section>

        <section className="grid gap-4 md:grid-cols-1">
          {adminQueues.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md border p-5 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 ${item.tone}`}
            >
              <p className="text-lg font-semibold text-zinc-950">{item.label}</p>
              <p className="mt-2 text-3xl font-semibold tracking-normal">{item.value}</p>
            </Link>
          ))}
        </section>
      </section>
    </main>
  );
};

export default AdminPage;
