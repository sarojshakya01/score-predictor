import { authenticatedApiFetch } from "@/lib/auth";
import type {
  ListAdminSettingsParams,
  SettingCreate,
  SettingListResponse,
  SettingResponse,
  SettingUpdate,
} from "@/lib/settings/types";

function toQueryString(params: ListAdminSettingsParams): string {
  const searchParams = new URLSearchParams();

  if (params.offset !== undefined) {
    searchParams.set("offset", String(params.offset));
  }

  if (params.limit !== undefined) {
    searchParams.set("limit", String(params.limit));
  }

  if (params.search !== undefined) {
    searchParams.set("search", params.search);
  }

  return searchParams.toString();
}

export async function listAdminSettings(
  params: ListAdminSettingsParams = {},
): Promise<SettingListResponse> {
  const queryString = toQueryString(params);
  const path = queryString ? `/admin/settings?${queryString}` : "/admin/settings";

  return authenticatedApiFetch<SettingListResponse>(path, {
    method: "GET",
  });
}

export async function createSetting(data: SettingCreate): Promise<SettingResponse> {
  return authenticatedApiFetch<SettingResponse, SettingCreate>("/admin/settings", {
    body: data,
    method: "POST",
  });
}

export async function updateSetting(
  settingId: number,
  data: SettingUpdate,
): Promise<SettingResponse> {
  return authenticatedApiFetch<SettingResponse, SettingUpdate>(
    `/admin/settings/${settingId}`,
    {
      body: data,
      method: "PUT",
    },
  );
}

export async function deleteSetting(settingId: number): Promise<void> {
  await authenticatedApiFetch<null>(`/admin/settings/${settingId}`, {
    method: "DELETE",
  });
}

export const settingService = {
  createSetting,
  deleteSetting,
  listAdminSettings,
  updateSetting,
};
