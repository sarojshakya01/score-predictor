import { apiFetch } from "@/lib/api";
import type { HomeSummaryResponse } from "@/lib/home/types";

export async function getHomeSummary(): Promise<HomeSummaryResponse> {
  return apiFetch<HomeSummaryResponse>("/home/summary", {
    method: "GET",
  });
}

export const homeService = {
  getHomeSummary,
};
