export const USER_ROLES = ["ADMIN", "USER"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export type SignupRequest = {
  email: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  mobile_no: string;
  password: string;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type RefreshTokenRequest = {
  refresh_token: string;
};

export type EmailRequest = {
  email: string;
};

export type TokenRequest = {
  token: string;
};

export type ResetPasswordRequest = TokenRequest & {
  password: string;
};

export type ChangePasswordRequest = {
  current_password: string;
  new_password: string;
};

export type MessageResponse = {
  message: string;
};

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: "bearer" | "Bearer";
  message?: string | undefined;
};

export type UserResponse = {
  id: number;
  email: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  mobile_no: string;
  role: UserRole;
  is_active: boolean;
  winner_team_id: number | null;
  runner_up_team_id: number | null;
  third_place_team_id: number | null;
  created_at: string;
  updated_at: string;
  message?: string | undefined;
};

export type AuthTokens = Pick<
  TokenResponse,
  "access_token" | "refresh_token" | "token_type"
>;
