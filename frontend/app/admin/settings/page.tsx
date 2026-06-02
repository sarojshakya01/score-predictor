"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { Modal } from "@/components/ui/modal";
import { getErrorMessage } from "@/lib/forms/error-message";
import {
  createSetting,
  deleteSetting,
  listSetting,
  updateSetting,
} from "@/lib/settings";
import type { SettingCreate, SettingResponse } from "@/lib/settings";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { IconCancel, IconPencil, IconPlus, IconSave, IconSearch, IconTrash, IconX } from "@/components/ui/icons";

const emptyFormState: SettingCreate = {
  name: "",
  friendly_name: "",
  value: "",
};

const inputCls = "mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-tournament-primary focus:ring-2 focus:ring-emerald-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-400 dark:focus:ring-zinc-700";
const labelCls = "text-sm font-medium text-zinc-700 dark:text-zinc-300";

const AdminSettingsPage = () => {
  const [settings, setSettings] = useState<SettingResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSettingId, setEditingSettingId] = useState<number | null>(null);
  const [formState, setFormState] = useState<SettingCreate>(emptyFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [isDeletingId, setIsDeletingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SettingResponse | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const settingList = await listSetting({ limit: 100 });
        if (isMounted) {
          setSettings(settingList.items);
        }
      } catch (error) {
        if (isMounted) {
          setLoadError(getErrorMessage(error, "Unable to load settings."));
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void loadSettings();
    return () => { isMounted = false; };
  }, []);

  const filteredSettings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return settings;
    return settings.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      s.friendly_name.toLowerCase().includes(q) ||
      s.value.toLowerCase().includes(q)
    );
  }, [settings, searchQuery]);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
  };

  const handleOpenCreateModal = () => {
    setEditingSettingId(null);
    setFormState(emptyFormState);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (setting: SettingResponse) => {
    setEditingSettingId(setting.id);
    setFormState({
      name: setting.name,
      friendly_name: setting.friendly_name,
      value: setting.value,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => setIsModalOpen(false);

  const updateField = (field: keyof SettingCreate, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
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
        return [...current, savedSetting].sort((a, b) => a.name.localeCompare(b.name));
      });
      setIsModalOpen(false);
    } catch (error) {
      setFormError(getErrorMessage(error, "Unable to save setting."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (setting: SettingResponse) => {
    setDeleteTarget(setting);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const setting = deleteTarget;
    setDeleteTarget(null);
    setIsDeletingId(setting.id);
    try {
      await deleteSetting(setting.id);
      setSettings((current) => current.filter((s) => s.id !== setting.id));
    } catch (error) {
      setLoadError(getErrorMessage(error, "Unable to delete setting."));
    } finally {
      setIsDeletingId(null);
    }
  };

  const isSearchActive = searchQuery.trim().length > 0;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-zinc-950 dark:text-zinc-50">App Configurations</h2></div>
        <button
          className="inline-flex h-10 items-center gap-2 rounded-md bg-tournament-primary px-4 text-sm font-semibold text-white transition cursor-pointer hover:bg-tournament-primary"
          type="button"
          onClick={handleOpenCreateModal}
        >
          <IconPlus className="h-4 w-4" />
          New Setting
        </button>
      </section>

      {/* Search bar */}
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-zinc-400 dark:text-zinc-500">
          <IconSearch className="h-4 w-4" />
        </span>
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by name, friendly name, or value…"
          className="h-10 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-9 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-tournament-primary focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:ring-emerald-900"
        />
        {isSearchActive && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => handleSearch("")}
            className="absolute inset-y-0 right-3 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            <IconX className="h-4 w-4" />
          </button>
        )}
      </div>

      {loadError ? (
        <section className="rounded-md border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-400">
          {loadError}
        </section>
      ) : null}

      <section className="overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        {isSearchActive && (
          <div className="border-b border-zinc-100 px-5 py-2.5 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            {filteredSettings.length === 0
              ? `No settings match "${searchQuery}"`
              : `${filteredSettings.length} of ${settings.length} setting${settings.length !== 1 ? "s" : ""} match "${searchQuery}"`}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-700">
            <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:bg-zinc-800/70 dark:text-zinc-400">
              <tr>
                <th className="px-5 py-3">S.N.</th>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Friendly Name</th>
                <th className="px-5 py-3">Value</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-zinc-500 dark:text-zinc-400">
                    Loading settings…
                  </td>
                </tr>
              ) : filteredSettings.length > 0 ? (
                filteredSettings.map((setting, idx) => (
                  <tr key={setting.id} className="transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40">
                    <td className="px-5 py-4 text-zinc-700 dark:text-zinc-300">{idx + 1}</td>
                    <td className="px-5 py-4 font-medium text-zinc-950 dark:text-zinc-100">
                      {setting.name}
                    </td>
                    <td className="px-5 py-4 text-zinc-700 dark:text-zinc-300">{setting.friendly_name}</td>
                    <td className="max-w-xs truncate px-5 py-4 text-zinc-700 dark:text-zinc-300">{setting.value}</td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          title="Edit"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-emerald-700 hover:bg-emerald-50 cursor-pointer transition dark:text-emerald-400 dark:hover:bg-emerald-950"
                          type="button"
                          onClick={() => handleOpenEditModal(setting)}
                        >
                          <IconPencil className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </button>
                        <button
                          title="Delete"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-rose-700 hover:bg-rose-50 cursor-pointer transition disabled:opacity-40 dark:text-rose-400 dark:hover:bg-rose-950"
                          disabled={isDeletingId === setting.id}
                          type="button"
                          onClick={() => handleDeleteClick(setting)}
                        >
                          <IconTrash className="h-4 w-4" />
                          <span className="sr-only">Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-zinc-500 dark:text-zinc-400">
                    {isSearchActive ? `No settings match "${searchQuery}".` : "No settings found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <ConfirmModal
        isOpen={deleteTarget !== null}
        title="Delete Setting"
        message={deleteTarget ? `Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.` : ""}
        confirmLabel="Delete"
        isDangerous
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => setDeleteTarget(null)}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingSettingId ? "Edit setting" : "New setting"}
      >
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
          <label className="block">
            <span className={labelCls}>Name</span>
            <input
              type="text"
              required
              value={formState.name}
              onChange={(e) => updateField("name", e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className={labelCls}>Friendly Name</span>
            <input
              type="text"
              required
              value={formState.friendly_name}
              onChange={(e) => updateField("friendly_name", e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className={labelCls}>Value</span>
            <textarea
              rows={4}
              required
              value={formState.value}
              onChange={(e) => updateField("value", e.target.value)}
              className="mt-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-950 outline-none transition focus:border-tournament-primary focus:ring-2 focus:ring-emerald-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-400 dark:focus:ring-zinc-700"
            />
          </label>

          {formError ? (
            <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-400">
              {formError}
            </p>
          ) : null}

          <div className="mt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleCloseModal}
              className="inline-flex h-11 px-4 items-center gap-2 justify-center rounded-md border cursor-pointer border-zinc-200 bg-white text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:bg-zinc-700"
            >
              <IconCancel className="h-4 w-4" />
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-11 px-4 items-center gap-2 cursor-pointer rounded-md bg-tournament-primary px-4 text-sm font-semibold text-white transition hover:bg-tournament-primary disabled:cursor-not-allowed disabled:bg-zinc-400"
            >
              <IconSave className="h-4 w-4" />
              {isSubmitting ? "Saving…" : "Save Setting"}
            </button>
          </div>
        </form>
      </Modal>
    </main>
  );
};

export default AdminSettingsPage;
