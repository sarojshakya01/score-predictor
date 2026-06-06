import { ApiError } from "@/lib/api";
import { MissingAuthTokenError, SessionExpiredError } from "@/lib/auth";

export const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof MissingAuthTokenError) {
    return "Please log in before continuing.";
  }

  if (error instanceof SessionExpiredError) {
    return "Your session has expired. Please login again.";
  }

  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
};
