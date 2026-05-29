export const GAME_DURATIONS = ["90", "120", "PENALTY"] as const;

export type GameDuration = (typeof GAME_DURATIONS)[number];

export type MatchResponse = {
  created_at: string;
  first_scoring_team_id: number | null;
  game_duration: GameDuration | null;
  id: number;
  is_goal_in_first_half: boolean | null;
  match_datetime: string;
  match_day: number;
  match_locked: boolean;
  match_reminder_sent: boolean;
  opening_team_id: number | null;
  red_card_count: number | null;
  team1_id: number;
  team1_group: string;
  team1_name: string;
  team1_score: number | null;
  team2_id: number;
  team2_group: string;
  team2_name: string;
  team2_score: number | null;
  updated_at: string;
  venue_name: string | null;
  yellow_card_count: number | null;
};

export type MatchFields = {
  first_scoring_team_id: number | null;
  game_duration: GameDuration | null;
  is_goal_in_first_half: boolean | null;
  match_datetime: string;
  match_day: number;
  match_locked: boolean;
  match_reminder_sent: boolean;
  opening_team_id: number | null;
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

export type ListAdminMatchesParams = {
  limit?: number;
  matchDay?: number;
  matchLocked?: boolean;
  offset?: number;
};
