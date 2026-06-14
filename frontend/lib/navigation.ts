import { IconBracket, IconDashboard, IconGroups, IconHome, IconLeaderboard, IconMatches, IconMatchResults, IconPredictions, IconRules, IconSettings, IconTeams, IconUsers } from "@/components/ui/icons";

type NavigationItem = {
  href: string;
  label: string;
  icon: React.ComponentType;
};

export const primaryNavigations: NavigationItem[] = [
  { href: "/", label: "Home", icon: IconHome },
  { href: "/predictions", label: "Predictions", icon: IconPredictions },
  { href: "/leaderboard", label: "Leaderboard", icon: IconLeaderboard },
  { href: "/results", label: "Results", icon: IconMatchResults },
  { href: "/groups", label: "Groups", icon: IconGroups },
  { href: "/brackets", label: "Brackets", icon: IconBracket },
  { href: "/rules", label: "Rules", icon: IconRules },
];

export const adminNavigations: NavigationItem[] = [
  { href: "/admin", label: "Dashboard", icon: IconDashboard },
  { href: "/admin/matches", label: "Matches", icon: IconMatches },
  { href: "/admin/teams", label: "Teams", icon: IconTeams },
  { href: "/admin/users", label: "Users", icon: IconUsers },
  { href: "/admin/settings", label: "Settings", icon: IconSettings },
];
