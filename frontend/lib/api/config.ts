const DEFAULT_API_BASE_URL = "http://localhost:8000/api/v1";

export const DEFAULT_TIMEZONE = 'Asia/Kathmandu';
export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL
).replace(/\/+$/, "");

export const buildApiUrl = (path: string): string => {
  const normalizedPath = path.replace(/^\/+/, "");
  return `${API_BASE_URL}/${normalizedPath}`;
};
