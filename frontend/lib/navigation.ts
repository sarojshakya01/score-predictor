export type NavigationItem = {
  href: string;
  label: string;
};

export const primaryNavigation: NavigationItem[] = [
  { href: "/", label: "Home" },
  { href: "/predictions", label: "Predictions" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/groups", label: "Groups" },
  { href: "/brackets", label: "Brackets" },
  { href: "/rules", label: "Rules" },
];

export const adminNavigation: NavigationItem[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/matches", label: "Matches" },
  { href: "/admin/teams", label: "Teams" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/settings", label: "Settings" },
];
