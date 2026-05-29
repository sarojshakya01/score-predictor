export type LeaderboardEntryResponse = {
  card_points: number;
  correct_results: number;
  duration_points: number;
  exact_scores: number;
  goal_difference_points: number;
  name: string;
  opening_team_points: number;
  predictions_made: number;
  rank: number;
  scored_predictions: number;
  total_points: number;
  user_id: number;
};

export type LeaderboardRaceUserResponse = {
  match_points: number;
  name: string;
  rank: number;
  total_points: number;
  user_id: number;
};

export type LeaderboardRaceFrameResponse = {
  frame: number;
  label: string;
  match_day: number | null;
  match_id: number | null;
  standings: LeaderboardRaceUserResponse[];
};

export type LeaderboardResponse = {
  completed_matches: number;
  items: LeaderboardEntryResponse[];
  limit: number;
  offset: number;
  race_frames: LeaderboardRaceFrameResponse[];
  scored_predictions: number;
  total: number;
};

export type ListLeaderboardParams = {
  limit?: number;
  offset?: number;
};
