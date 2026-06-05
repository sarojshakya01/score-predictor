import type { MatchDuration } from "@/lib/matches";
import { FirstGoalIn } from "../matches/types";

export type PredictionFields = {
  first_goal_in: FirstGoalIn | null;
  first_scoring_team_id: number | null;
  kick_off_team_id: number | null;
  match_duration: MatchDuration | null;
  red_card_count: number | null;
  team1_score: number;
  team2_score: number;
  yellow_card_count: number | null;
  winner_team_id: number | null;
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
