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

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: "bearer" | "Bearer";
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
  created_at: string;
  updated_at: string;
};

export type AuthTokens = Pick<
  TokenResponse,
  "access_token" | "refresh_token" | "token_type"
>;
