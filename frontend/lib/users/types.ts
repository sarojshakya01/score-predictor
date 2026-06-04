import type { UserRole } from "@/lib/auth";

export type UserResponse = {
  created_at: string;
  email: string;
  first_name: string;
  id: number;
  is_active: boolean;
  last_name: string;
  middle_name: string | null;
  mobile_no: string;
  role: UserRole;
  runner_up_team_id: number | null;
  third_place_team_id: number | null;
  updated_at: string;
  winner_team_id: number | null;
};

export type UserListResponse = {
  items: UserResponse[];
  limit: number;
  offset: number;
  total: number;
};

export type UserCreate = {
  email: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  mobile_no: string;
  password?: string;
  role?: UserRole;
  is_active?: boolean;
  winner_team_id?: number | null;
  runner_up_team_id?: number | null;
  third_place_team_id?: number | null;
};

export type UserUpdate = Partial<UserCreate>;

export type ListUsersParams = {
  is_active?: boolean;
  limit?: number;
  offset?: number;
  role?: UserRole;
  search?: string;
};
