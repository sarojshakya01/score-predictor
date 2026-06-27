"use client";

import Link from "next/link";

import { MetricCard } from "@/components/ui/metric-card";
import { useEffect, useState } from "react";
import { listAdminMatches, listUpcomingMatches, MatchResponse } from "@/lib/matches";
import { listAdminTeams, TeamResponse } from "@/lib/teams";
import { listAdminUsers } from "@/lib/users";
import { UserResponse } from "@/lib/auth";
import { toneClasses, toneClassesLight } from "@/components/ui/status-pill";
import { RoleName } from "@/lib/auth/types";

type TeamGoalStat = {
  goals: number;
  teamName: string;
};

const getGoalStats = (matches: MatchResponse[]) => {
  const teamGoals = new Map<number, TeamGoalStat>();
  let scoredMatches = 0;
  let totalGoals = 0;

  matches.forEach((match) => {
    if (match.team1_score === null && match.team2_score === null) return;

    const team1Goals = match.team1_score ?? 0;
    const team2Goals = match.team2_score ?? 0;
    scoredMatches += 1;
    totalGoals += team1Goals + team2Goals;

    const team1Stat = teamGoals.get(match.team1_id) ?? {
      goals: 0,
      teamName: match.team1_name,
    };
    team1Stat.goals += team1Goals;
    teamGoals.set(match.team1_id, team1Stat);

    const team2Stat = teamGoals.get(match.team2_id) ?? {
      goals: 0,
      teamName: match.team2_name,
    };
    team2Stat.goals += team2Goals;
    teamGoals.set(match.team2_id, team2Stat);
  });

  const highestScoringTeams = [...teamGoals.values()]
    .filter((team) => team.goals > 0)
    .sort((left, right) => right.goals - left.goals || left.teamName.localeCompare(right.teamName))
    .slice(0, 3);

  return { highestScoringTeams, scoredMatches, totalGoals };
};

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
          listAdminUsers({ limit: 500 }),
          listAdminMatches({ limit: 500 }),
          listAdminTeams({ limit: 500 }),
          listUpcomingMatches({ limit: 200 })
        ]);

        if (isMounted) {
          setUsers(userList.items.filter((user) => user.role === RoleName.USER));
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

  const goalStats = getGoalStats(matches);
  const highestScoringTeamsLabel = goalStats.highestScoringTeams.length
    ? goalStats.highestScoringTeams
      .map((team) => `${team.teamName} ${team.goals}`)
      .join(", ")
    : "No goals recorded yet";

  const adminMetrics = [
    {
      label: "Total Matches",
      value: isLoading ? "..." : `${upcomingMatches.length.toString()} matches locking today`,
      tone: toneClassesLight.primary,
    },
    {
      label: "Total Goals",
      value: isLoading
        ? "..."
        : `${goalStats.totalGoals.toString()} goals from ${goalStats.scoredMatches.toString()} scored matches`,
      tone: toneClassesLight.secondary,
    },
    {
      label: "Highest Scoring Teams",
      value: isLoading ? "..." : highestScoringTeamsLabel,
      tone: toneClassesLight.accent,
    },
  ];

  const adminQueues = [
    { href: "/admin/matches", tone: toneClasses.primary, label: "Matches", value: isLoading ? "..." : matches.length },
    { href: "/admin/users", tone: toneClasses.secondary, label: "Users", value: isLoading ? "..." : users.length },
    { href: "/admin/teams", tone: toneClasses.accent, label: "Teams", value: isLoading ? "..." : teams.length },
  ];

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
      <section className="flex flex-wrap items-center content-center min-h-[40px] justify-between gap-3">
        <div><h2 className="text-zinc-950 dark:text-zinc-50">App Configurations</h2></div>
      </section>
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
              <p className="text-lg font-semibold text-white">{item.label}</p>
              <p className="mt-2 text-3xl font-semibold tracking-normal">{item.value}</p>
            </Link>
          ))}
        </section>
      </section>
    </main>
  );
};

export default AdminPage;
