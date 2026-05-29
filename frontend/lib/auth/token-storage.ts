import type { AuthTokens } from "@/lib/auth/types";

const ACCESS_TOKEN_KEY = "football_predictor.access_token";
const REFRESH_TOKEN_KEY = "football_predictor.refresh_token";
const TOKEN_TYPE_KEY = "football_predictor.token_type";

function getStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  return getStorage()?.getItem(ACCESS_TOKEN_KEY) ?? null;
}

export function getRefreshToken(): string | null {
  return getStorage()?.getItem(REFRESH_TOKEN_KEY) ?? null;
}

export function getStoredAuthTokens(): AuthTokens | null {
  const storage = getStorage();
  const accessToken = getAccessToken();
  const refreshToken = getRefreshToken();

  if (!accessToken || !refreshToken) {
    return null;
  }

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type:
      storage?.getItem(TOKEN_TYPE_KEY) === "Bearer" ? "Bearer" : "bearer",
  };
}

export function setAuthTokens(tokens: AuthTokens): void {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  try {
    storage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
    storage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
    storage.setItem(TOKEN_TYPE_KEY, tokens.token_type);
  } catch {
    clearAuthTokens();
  }
}

export function clearAuthTokens(): void {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  try {
    storage.removeItem(ACCESS_TOKEN_KEY);
    storage.removeItem(REFRESH_TOKEN_KEY);
    storage.removeItem(TOKEN_TYPE_KEY);
  } catch {
    return;
  }
}
