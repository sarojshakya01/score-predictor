"use client";

import { FormEvent, useEffect, useState } from "react";

import { Modal } from "@/components/ui/modal";
import { getErrorMessage } from "@/lib/forms/error-message";
import {
  createSetting,
  deleteSetting,
  listAdminSettings,
  updateSetting,
} from "@/lib/settings";
import type { SettingCreate, SettingResponse } from "@/lib/settings";

const emptyFormState: SettingCreate = {
  name: "",
  value: "",
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SettingResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSettingId, setEditingSettingId] = useState<number | null>(null);
  const [formState, setFormState] = useState<SettingCreate>(emptyFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [isDeletingId, setIsDeletingId] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const settingList = await listAdminSettings({ limit: 100 });
        if (isMounted) {
          setSettings(settingList.items);
        }
      } catch (error) {
        if (isMounted) {
          setLoadError(getErrorMessage(error, "Unable to load settings."));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  function handleOpenCreateModal() {
    setEditingSettingId(null);
    setFormState(emptyFormState);
    setFormError(null);
    setIsModalOpen(true);
  }

  function handleOpenEditModal(setting: SettingResponse) {
    setEditingSettingId(setting.id);
    setFormState({
      name: setting.name,
      value: setting.value,
    });
    setFormError(null);
    setIsModalOpen(true);
  }

  function handleCloseModal() {
    setIsModalOpen(false);
  }

  function updateField(field: keyof SettingCreate, value: string) {
    setFormState((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const savedSetting = editingSettingId
        ? await updateSetting(editingSettingId, formState)
        : await createSetting(formState);

      setSettings((current) => {
        if (editingSettingId) {
          return current.map((s) => (s.id === savedSetting.id ? savedSetting : s));
        }
        return [...current, savedSetting].sort((a, b) =>
          a.name.localeCompare(b.name)
        );
      });
      setIsModalOpen(false);
    } catch (error) {
      setFormError(getErrorMessage(error, "Unable to save setting."));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(setting: SettingResponse) {
    if (!window.confirm(`Delete setting ${setting.name}?`)) {
      return;
    }

    setIsDeletingId(setting.id);
    try {
      await deleteSetting(setting.id);
      setSettings((current) => current.filter((s) => s.id !== setting.id));
    } catch (error) {
      alert(getErrorMessage(error, "Unable to delete setting."));
    } finally {
      setIsDeletingId(null);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div><h2>App Configurations</h2></div>
        <button
          className="inline-flex h-10 items-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800"
          type="button"
          onClick={handleOpenCreateModal}
        >
          New Setting
        </button>
      </section>

      {loadError ? (
        <section className="rounded-md border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-800">
          {loadError}
        </section>
      ) : null}

      <section className="overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Value</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {isLoading ? (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-zinc-500">
                    Loading settings...
                  </td>
                </tr>
              ) : settings.length > 0 ? (
                settings.map((setting) => (
                  <tr key={setting.id}>
                    <td className="px-5 py-4 font-medium text-zinc-950">
                      {setting.name}
                    </td>
                    <td className="px-5 py-4 text-zinc-700">{setting.value}</td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          className="font-semibold text-emerald-700 hover:text-emerald-900"
                          onClick={() => handleOpenEditModal(setting)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="font-semibold text-rose-700 hover:text-rose-900 disabled:text-zinc-400"
                          disabled={isDeletingId === setting.id}
                          onClick={() => void handleDelete(setting)}
                        >
                          {isDeletingId === setting.id ? "Deleting" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-zinc-500">
                    No settings found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingSettingId ? "Edit setting" : "New setting"}
      >
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">Name</span>
            <input
              type="text"
              required
              value={formState.name}
              onChange={(e) => updateField("name", e.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">Value</span>
            <input
              type="text"
              required
              value={formState.value}
              onChange={(e) => updateField("value", e.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          {formError ? (
            <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {formError}
            </p>
          ) : null}

          <div className="mt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleCloseModal}
              className="inline-flex h-11 items-center justify-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-11 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
            >
              {isSubmitting ? "Saving..." : "Save setting"}
            </button>
          </div>
        </form>
      </Modal>
    </main>
  );
}
