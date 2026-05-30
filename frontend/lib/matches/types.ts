export const match_durations = ["90", "120", "PENALTY"] as const;
export const match_stages = [
  "GROUP",
  "R32",
  "R16",
  "QF",
  "SF",
  "3P",
  "F",
] as const;

export type GameDuration = (typeof match_durations)[number];
export type MatchStage = (typeof match_stages)[number];

export type MatchResponse = {
  created_at: string;
  first_scoring_team_id: number | null;
  match_duration: GameDuration | null;
  id: number;
  is_goal_in_first_half: boolean | null;
  match_datetime: string;
  match_day: number;
  match_locked: boolean;
  match_reminder_sent: boolean;
  match_stage: MatchStage;
  kick_off_team_id: number | null;
  red_card_count: number | null;
  team1_id: number;
  team1_group: string;
  team1_name: string;
  team1_short_name: string;
  team1_score: number | null;
  team1_flag_url: string;
  team2_id: number;
  team2_group: string;
  team2_name: string;
  team2_short_name: string;
  team2_score: number | null;
  team2_flag_url: string;
  updated_at: string;
  venue_name: string | null;
  yellow_card_count: number | null;
};

export type MatchFields = {
  first_scoring_team_id: number | null;
  match_duration: GameDuration | null;
  is_goal_in_first_half: boolean | null;
  match_datetime: string;
  match_day: number;
  match_locked: boolean;
  match_reminder_sent: boolean;
  match_stage: string;
  kick_off_team_id: number | null;
  red_card_count: number | null;
  team1_id: number;
  team1_score: number | null;
  team2_id: number;
  team2_score: number | null;
  venue_name: string | null;
  yellow_card_count: number | null;
};

export type MatchCreate = MatchFields;

export type MatchUpdate = Partial<MatchFields>;

export type MatchListResponse = {
  items: MatchResponse[];
  limit: number;
  offset: number;
  total: number;
};

export type ListUpcomingMatchesParams = {
  includeLocked?: boolean;
  limit?: number;
  offset?: number;
};

export type ListMatchesParams = {
  limit?: number;
  matchDay?: number;
  matchLocked?: boolean;
  matchStage?: string;
  offset?: number;
};

export type PredictionStatus = "Open" | "Locking soon" | "Locked";

export type PillTone = "amber" | "blue" | "green" | "red" | "zinc";
