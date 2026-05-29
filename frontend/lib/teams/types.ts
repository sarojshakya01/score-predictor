export type TeamResponse = {
  created_at: string;
  fifa_code: string;
  flag_url: string;
  group: string;
  id: number;
  name: string;
  updated_at: string;
};

export type TeamListResponse = {
  items: TeamResponse[];
  limit: number;
  offset: number;
  total: number;
};

export type TeamCreate = Omit<TeamResponse, "id" | "created_at" | "updated_at" | "flag_url">;

export type TeamUpdate = Partial<TeamCreate>;

export type ListAdminTeamsParams = {
  group?: string;
  limit?: number;
  offset?: number;
  search?: string;
};
