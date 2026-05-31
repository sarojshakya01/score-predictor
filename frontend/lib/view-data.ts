export type MatchCard = {
  awayFlag: string | null;
  awayTeam: string;
  day: string;
  group: string;
  homeFlag: string | null;
  homeTeam: string;
  id: number;
  kickOff: string;
  lockState: "Open" | "Locking soon" | "Locked";
  venue: string;
};

export type LeaderboardRow = {
  name: string;
  points: number;
  rank: number;
  trend: string;
  exactScores: number;
};

export type GroupStanding = {
  drawn: number;
  goalDifference: number;
  lost: number;
  played: number;
  points: number;
  team: string;
  won: number;
};

export type GroupTable = {
  group: string;
  standings: GroupStanding[];
};

export type RuleBand = {
  items: string[];
  title: string;
};
