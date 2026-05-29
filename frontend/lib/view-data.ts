export type MatchCard = {
  awayTeam: string;
  day: string;
  group: string;
  homeTeam: string;
  id: number;
  kickOff: string;
  lockState: "Open" | "Locking soon" | "Locked";
  venue: string;
};

export type Metric = {
  label: string;
  value: string;
  tone: "blue" | "green" | "amber" | "red";
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

export const ruleBands: RuleBand[] = [
  {
    title: "Exact score",
    items: ["15 points for exact score", "5 points when only the winning team is correct"],
  },
  {
    title: "Goal difference",
    items: [
      "5 points for exact goal difference",
      "3 points when goal difference misses by 1",
      "2 points when goal difference misses by 2",
      "1 point when goal difference misses by 3",
    ],
  },
  {
    title: "Game duration",
    items: ["5 points for 90 minutes", "10 points for 120 minutes", "15 points for penalty shootout"],
  },
  {
    title: "Cards and opening team",
    items: [
      "3 points for correct opening team",
      "Up to 5 points for yellow cards",
      "Red card scoring ranges from -2 to 10 points",
    ],
  },
];
