import { apiFetch } from "@/lib/api";
import { authenticatedApiFetch } from "@/lib/auth";
import type {
  GameRulesResponse,
  ListSettingsParams,
  MatchDayResponse,
  SettingCreate,
  SettingListResponse,
  SettingResponse,
  SettingUpdate,
} from "@/lib/settings/types";

const toQueryString = (params: ListSettingsParams): string => {
  const searchParams = new URLSearchParams();
  if (params.offset !== undefined) searchParams.set("offset", String(params.offset));
  if (params.limit !== undefined) searchParams.set("limit", String(params.limit));
  if (params.search !== undefined) searchParams.set("search", params.search);
  return searchParams.toString();
};

export const listSetting = async (
  params: ListSettingsParams = {},
): Promise<SettingListResponse> => {
  const queryString = toQueryString(params);
  const path = queryString ? `/admin/settings?${queryString}` : "/admin/settings";
  return authenticatedApiFetch<SettingListResponse>(path, { method: "GET" });
};

export const getAdminSetting = async (settingId: number): Promise<SettingResponse> => {
  return authenticatedApiFetch<SettingResponse>(`/admin/settings/${settingId}`, {
    method: "GET",
  });
};

export const getGameRules = async (): Promise<GameRulesResponse> => {
  return apiFetch<GameRulesResponse>("/rules", { method: "GET" });
};

export const getMatchDay = async (): Promise<MatchDayResponse> => {
  return apiFetch<MatchDayResponse>("/matchday", { method: "GET" });
};

export const createSetting = async (data: SettingCreate): Promise<SettingResponse> => {
  return authenticatedApiFetch<SettingResponse, SettingCreate>("/admin/settings", {
    body: data,
    method: "POST",
  });
};

export const updateSetting = async (
  settingId: number,
  data: SettingUpdate,
): Promise<SettingResponse> => {
  return authenticatedApiFetch<SettingResponse, SettingUpdate>(
    `/admin/settings/${settingId}`,
    { body: data, method: "PUT" },
  );
};

export const deleteSetting = async (settingId: number): Promise<void> => {
  await authenticatedApiFetch<null>(`/admin/settings/${settingId}`, {
    method: "DELETE",
  });
};

export const settingService = {
  createSetting,
  deleteSetting,
  getAdminSetting,
  getGameRules,
  getMatchDay,
  listSetting,
  updateSetting,
};
