export type LeaderboardEntryResponse = {
  first_goal_in_points: number;
  first_scoring_team_points: number;
  goal_difference_points: number;
  match_duration_points: number;
  name: string;
  kick_off_team_points: number;
  predicted_matches: number;
  rank: number;
  red_card_points: number;
  score_points: number;
  total_points: number;
  user_id: number;
  yellow_card_points: number;
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

export type RaceFrame = {
  user_id: number;
  user_name: string;
  acc_points: Array<{
    match_num: number;
    acc_points: number;
  }>;
}

export type LeaderboardResponse = {
  completed_matches: number;
  items: LeaderboardEntryResponse[];
  limit: number;
  offset: number;
  race_frames: RaceFrame[];
  total: number;
};

export type ListLeaderboardParams = {
  limit?: number;
  offset?: number;
};

export type UserPointsDetailsResponse = {
  match_id: number;
  match_label: string;
  match_day: number;
  team1_name: string;
  team1_name_short: string;
  team2_name: string;
  team2_name_short: string;
  team1_score: number;
  team2_score: number;
  predicted_team1_score: number;
  predicted_team2_score: number;
  score_points: number;
  goal_difference_points: number;
  // Yellow cards
  yellow_card_count: number | null;
  predicted_yellow_card_count: number;
  yellow_card_points: number;
  // Red cards
  red_card_count: number | null;
  predicted_red_card_count: number;
  red_card_points: number;
  // Kick-off team
  kick_off_team: string | null;
  predicted_kick_off_team: string;
  kick_off_team_points: number;
  // First scoring team
  first_scoring_team: string | null;
  predicted_first_scoring_team: string | null;
  first_scoring_team_points: number;
  // First goal in
  first_goal_in: string | null;
  predicted_first_goal_in: string | null;
  first_goal_in_points: number;
  // Match duration
  match_duration: string | null;
  predicted_match_duration: string;
  match_duration_points: number;
  total_points: number;
  match_stage: string | null;
};

export type UserPointsDetailsListResponse = {
  user_id: number;
  user_name: string;
  items: UserPointsDetailsResponse[];
  total_points: number;
  winner_points: number;
  runner_up_points: number;
  third_place_points: number;
};

export type MatchUserPointsDetailsResponse = {
  user_id: number;
  user_name: string;
  predicted_team1_score: number | null;
  predicted_team2_score: number | null;
  score_points: number;
  goal_difference_points: number;
  predicted_yellow_card_count: number | null;
  yellow_card_points: number;
  predicted_red_card_count: number | null;
  red_card_points: number;
  predicted_kick_off_team: string | null;
  kick_off_team_points: number;
  predicted_first_scoring_team: string | null;
  first_scoring_team_points: number;
  predicted_first_goal_in: string | null;
  first_goal_in_points: number;
  predicted_match_duration: string | null;
  match_duration_points: number;
  total_points: number;
};

export type MatchPointsDetailsResponse = {
  match_id: number;
  match_label: string;
  match_day: number;
  team1_name: string;
  team1_name_short: string;
  team2_name: string;
  team2_name_short: string;
  team1_score: number | null;
  team2_score: number | null;
  yellow_card_count: number | null;
  red_card_count: number | null;
  kick_off_team: string | null;
  first_scoring_team: string | null;
  first_goal_in: string | null;
  match_duration: string | null;
  items: MatchUserPointsDetailsResponse[];
  total: number;
};
