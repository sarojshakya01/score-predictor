export type GroupStandingResponse = {
  drawn: number;
  fifa_code: string;
  flag_url: string;
  goal_difference: number;
  goals_against: number;
  goals_for: number;
  lost: number;
  played: number;
  points: number;
  team: string;
  team_id: number;
  won: number;
};

export type GroupTableResponse = {
  group: string;
  standings: GroupStandingResponse[];
};

export type GroupTableListResponse = {
  items: GroupTableResponse[];
  total: number;
};
