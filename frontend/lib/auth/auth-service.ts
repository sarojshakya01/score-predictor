import { ApiError, apiFetch } from "@/lib/api";
import type { ApiFetchOptions } from "@/lib/api";
import {
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  setAuthTokens,
} from "@/lib/auth/token-storage";
import type {
  LoginRequest,
  RefreshTokenRequest,
  SignupRequest,
  TokenResponse,
  UserResponse,
} from "@/lib/auth/types";

export class MissingAuthTokenError extends Error {
  constructor(message = "Authentication token is missing.") {
    super(message);
    this.name = "MissingAuthTokenError";
  }
}

type AuthenticatedFetchOptions<TBody = unknown> = Omit<
  ApiFetchOptions<TBody>,
  "accessToken"
> & {
  accessToken?: string | null;
  refreshToken?: string | null;
  retryOnUnauthorized?: boolean;
};

function requireToken(token: string | null | undefined): string {
  if (!token) {
    throw new MissingAuthTokenError();
  }

  return token;
}

export async function signup(data: SignupRequest): Promise<TokenResponse> {
  const tokens = await apiFetch<TokenResponse, SignupRequest>("/auth/signup", {
    body: data,
    method: "POST",
  });

  setAuthTokens(tokens);
  return tokens;
}

export async function login(data: LoginRequest): Promise<TokenResponse> {
  const tokens = await apiFetch<TokenResponse, LoginRequest>("/auth/login", {
    body: data,
    method: "POST",
  });

  setAuthTokens(tokens);
  return tokens;
}

export async function refresh(
  refreshToken: string | null = getRefreshToken(),
): Promise<TokenResponse> {
  const token = requireToken(refreshToken);

  try {
    const tokens = await apiFetch<TokenResponse, RefreshTokenRequest>(
      "/auth/refresh",
      {
        body: { refresh_token: token },
        method: "POST",
      },
    );

    setAuthTokens(tokens);
    return tokens;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      clearAuthTokens();
    }

    throw error;
  }
}

export async function getCurrentUser(
  accessToken: string | null = getAccessToken(),
): Promise<UserResponse> {
  return apiFetch<UserResponse>("/auth/me", {
    accessToken: requireToken(accessToken),
    method: "GET",
  });
}

export async function authenticatedApiFetch<TResponse, TBody = unknown>(
  path: string,
  options: AuthenticatedFetchOptions<TBody> = {},
): Promise<TResponse> {
  const {
    accessToken = getAccessToken(),
    refreshToken = getRefreshToken(),
    retryOnUnauthorized = true,
    ...apiOptions
  } = options;

  const token = requireToken(accessToken);

  try {
    return await apiFetch<TResponse, TBody>(path, {
      ...apiOptions,
      accessToken: token,
    });
  } catch (error) {
    if (
      retryOnUnauthorized &&
      error instanceof ApiError &&
      error.status === 401
    ) {
      const refreshedTokens = await refresh(refreshToken);

      return apiFetch<TResponse, TBody>(path, {
        ...apiOptions,
        accessToken: refreshedTokens.access_token,
      });
    }

    throw error;
  }
}

export function logout(): void {
  clearAuthTokens();
}

export function isAuthenticated(): boolean {
  return Boolean(getAccessToken());
}

export const authService = {
  authenticatedApiFetch,
  getCurrentUser,
  isAuthenticated,
  login,
  logout,
  refresh,
  signup,
};
