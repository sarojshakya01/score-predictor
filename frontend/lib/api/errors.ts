type ApiErrorParams = {
  message: string;
  payload: unknown;
  status: number;
  statusText: string;
};

export class ApiError extends Error {
  readonly payload: unknown;
  readonly status: number;
  readonly statusText: string;

  constructor({ message, payload, status, statusText }: ApiErrorParams) {
    super(message);
    this.name = "ApiError";
    this.payload = payload;
    this.status = status;
    this.statusText = statusText;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getValidationMessage(detail: unknown): string | null {
  if (!isRecord(detail)) {
    return null;
  }

  if (typeof detail.msg === "string") {
    return detail.msg;
  }

  if (typeof detail.message === "string") {
    return detail.message;
  }

  return null;
}

export function getApiErrorMessage(
  payload: unknown,
  fallback: string,
): string {
  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }

  if (!isRecord(payload)) {
    return fallback;
  }

  if (typeof payload.detail === "string" && payload.detail.trim()) {
    return payload.detail;
  }

  if (Array.isArray(payload.detail)) {
    const messages = payload.detail
      .map(getValidationMessage)
      .filter((message): message is string => Boolean(message));

    if (messages.length > 0) {
      return messages.join(", ");
    }
  }

  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message;
  }

  return fallback;
}
