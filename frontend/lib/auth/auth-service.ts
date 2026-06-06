import { ApiError, apiFetch } from "@/lib/api";
import type { ApiFetchOptions } from "@/lib/api";
import {
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  setAuthTokens,
} from "@/lib/auth/token-storage";
import { notifySessionExpired } from "@/lib/auth/session-events";
import type {
  ChangePasswordRequest,
  EmailRequest,
  LoginRequest,
  MessageResponse,
  RefreshTokenRequest,
  ResetPasswordRequest,
  SignupRequest,
  TokenResponse,
  TokenRequest,
  UserResponse,
} from "@/lib/auth/types";

export class MissingAuthTokenError extends Error {
  constructor(message = "Authentication token is missing.") {
    super(message);
    this.name = "MissingAuthTokenError";
  }
}

export class SessionExpiredError extends Error {
  constructor(message = "Authentication session has expired.") {
    super(message);
    this.name = "SessionExpiredError";
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

const requireToken = (token: string | null | undefined): string => {
  if (!token) {
    throw new MissingAuthTokenError();
  }

  return token;
};

export const signup = async (data: SignupRequest): Promise<TokenResponse> => {
  const token = await apiFetch<TokenResponse, SignupRequest>("/auth/signup", {
    body: data,
    method: "POST",
  });

  if (token.access_token) {
    setAuthTokens(token);
  }

  return token;
};

export const login = async (data: LoginRequest): Promise<TokenResponse> => {
  const tokens = await apiFetch<TokenResponse, LoginRequest>("/auth/login", {
    body: data,
    method: "POST",
  });

  setAuthTokens(tokens);
  return tokens;
};

export const refresh = async (
  refreshToken: string | null = getRefreshToken(),
): Promise<TokenResponse> => {
  if (!refreshToken) {
    clearAuthTokens();
    notifySessionExpired();
    throw new SessionExpiredError();
  }

  try {
    const tokens = await apiFetch<TokenResponse, RefreshTokenRequest>(
      "/auth/refresh",
      {
        body: { refresh_token: refreshToken },
        method: "POST",
      },
    );

    setAuthTokens(tokens);
    return tokens;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      clearAuthTokens();
      notifySessionExpired();
      throw new SessionExpiredError();
    }

    throw error;
  }
};

export const verifyEmail = async (data: TokenRequest): Promise<MessageResponse> => {
  return apiFetch<MessageResponse, TokenRequest>("/auth/verify-email", {
    body: data,
    method: "POST",
  });
};

export const resendVerification = async (
  data: EmailRequest,
): Promise<MessageResponse> => {
  return apiFetch<MessageResponse, EmailRequest>("/auth/resend-verification", {
    body: data,
    method: "POST",
  });
};

export const forgotPassword = async (
  data: EmailRequest,
): Promise<MessageResponse> => {
  return apiFetch<MessageResponse, EmailRequest>("/auth/forgot-password", {
    body: data,
    method: "POST",
  });
};

export const resetPassword = async (
  data: ResetPasswordRequest,
): Promise<MessageResponse> => {
  return apiFetch<MessageResponse, ResetPasswordRequest>("/auth/reset-password", {
    body: data,
    method: "POST",
  });
};

export const changePassword = async (
  data: ChangePasswordRequest,
): Promise<MessageResponse> => {
  return authenticatedApiFetch<MessageResponse, ChangePasswordRequest>(
    "/auth/change-password",
    {
      body: data,
      method: "POST",
    },
  );
};

export const getCurrentUser = async (
  accessToken: string | null = getAccessToken(),
): Promise<UserResponse> => {
  return authenticatedApiFetch<UserResponse>("/auth/me", {
    accessToken,
    method: "GET",
  });
};

export const authenticatedApiFetch = async <TResponse, TBody = unknown>(
  path: string,
  options: AuthenticatedFetchOptions<TBody> = {},
): Promise<TResponse> => {
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

      try {
        return await apiFetch<TResponse, TBody>(path, {
          ...apiOptions,
          accessToken: refreshedTokens.access_token,
        });
      } catch (retryError) {
        if (retryError instanceof ApiError && retryError.status === 401) {
          clearAuthTokens();
          notifySessionExpired();
          throw new SessionExpiredError();
        }

        throw retryError;
      }
    }

    throw error;
  }
};

export const logout = (): void => {
  clearAuthTokens();
};

export const isAuthenticated = (): boolean => {
  return Boolean(getAccessToken());
};

export const authService = {
  authenticatedApiFetch,
  changePassword,
  forgotPassword,
  getCurrentUser,
  isAuthenticated,
  login,
  logout,
  refresh,
  resendVerification,
  resetPassword,
  signup,
  verifyEmail,
};
