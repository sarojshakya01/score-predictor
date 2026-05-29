import { buildApiUrl } from "@/lib/api/config";
import { ApiError, getApiErrorMessage } from "@/lib/api/errors";

export type ApiFetchOptions<TBody = unknown> = Omit<
  RequestInit,
  "body" | "headers"
> & {
  accessToken?: string | null;
  body?: TBody;
  headers?: HeadersInit;
};

function isBodyInit(value: unknown): value is BodyInit {
  return (
    typeof value === "string" ||
    value instanceof ArrayBuffer ||
    value instanceof URLSearchParams ||
    (typeof Blob !== "undefined" && value instanceof Blob) ||
    (typeof FormData !== "undefined" && value instanceof FormData) ||
    (typeof ReadableStream !== "undefined" && value instanceof ReadableStream)
  );
}

function serializeBody(body: unknown): BodyInit | undefined {
  if (body === undefined) {
    return undefined;
  }

  if (isBodyInit(body)) {
    return body;
  }

  return JSON.stringify(body);
}

function shouldSetJsonContentType(body: unknown): boolean {
  return body !== undefined && !isBodyInit(body);
}

async function parseResponse(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  const text = await response.text();
  return text.trim() ? text : null;
}

export async function apiFetch<TResponse, TBody = unknown>(
  path: string,
  options: ApiFetchOptions<TBody> = {},
): Promise<TResponse> {
  const { accessToken, body, headers, ...requestOptions } = options;
  const requestHeaders = new Headers(headers);

  if (!requestHeaders.has("Accept")) {
    requestHeaders.set("Accept", "application/json");
  }

  if (shouldSetJsonContentType(body) && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }

  if (accessToken) {
    requestHeaders.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(buildApiUrl(path), {
    cache: "no-store",
    ...requestOptions,
    body: serializeBody(body),
    headers: requestHeaders,
  });
  const payload = await parseResponse(response);

  if (!response.ok) {
    throw new ApiError({
      message: getApiErrorMessage(
        payload,
        response.statusText || "API request failed",
      ),
      payload,
      status: response.status,
      statusText: response.statusText,
    });
  }

  return payload as TResponse;
}
