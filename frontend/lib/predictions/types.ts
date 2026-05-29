import type { GameDuration } from "@/lib/matches";

export type PredictionFields = {
  first_scoring_team_id: number | null;
  game_duration: GameDuration;
  is_goal_in_first_half: boolean | null;
  opening_team_id: number;
  red_card_count: number;
  team1_score: number;
  team2_score: number;
  yellow_card_count: number;
};

export type PredictionCreate = PredictionFields & {
  match_id: number;
};

export type PredictionUpdate = Partial<PredictionFields>;

export type PredictionResponse = PredictionFields & {
  created_at: string;
  id: number;
  match_id: number;
  predicted_datetime: string;
  updated_at: string;
  user_id: number;
};

export type PredictionListResponse = {
  items: PredictionResponse[];
  limit: number;
  offset: number;
  total: number;
};

export type ListCurrentUserPredictionsParams = {
  limit?: number;
  matchId?: number;
  offset?: number;
};
