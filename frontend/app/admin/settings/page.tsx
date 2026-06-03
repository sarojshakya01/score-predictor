"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { ConfirmModal } from "@/components/ui/confirm-modal";
import { IconCancel, IconPencil, IconPlus, IconSave, IconSearch, IconTrash, IconX } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { getErrorMessage } from "@/lib/forms/error-message";
import {
  createSetting,
  deleteSetting,
  listSetting,
  updateSetting,
} from "@/lib/settings";
import type { SettingCreate, SettingResponse } from "@/lib/settings";

// ── helpers ───────────────────────────────────────────────────────────────────

const prettyJson = (v: Record<string, unknown>): string =>
  JSON.stringify(v, null, 2);

const tryParseJson = (raw: string): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } => {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || Array.isArray(parsed) || parsed === null) {
      return { ok: false, error: "Value must be a JSON object { … }" };
    }
    if (Object.keys(parsed).length === 0) {
      return { ok: false, error: "Value object must not be empty" };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, error: "Invalid JSON — please check your syntax" };
  }
};

// ── form state ────────────────────────────────────────────────────────────────

type FormState = {
  name: string;
  friendly_name: string;
  valueRaw: string; // textarea string — parsed on submit
};

const emptyForm: FormState = {
  name: "",
  friendly_name: "",
  valueRaw: "{\n  \n}",
};

const inputCls =
  "mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-tournament-primary focus:ring-2 focus:ring-emerald-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-400 dark:focus:ring-zinc-700";
const labelCls = "text-sm font-medium text-zinc-700 dark:text-zinc-300";

// ── component ─────────────────────────────────────────────────────────────────

const AdminSettingsPage = () => {
  const [settings, setSettings] = useState<SettingResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSettingId, setEditingSettingId] = useState<number | null>(null);
  const [formState, setFormState] = useState<FormState>(emptyForm);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [isDeletingId, setIsDeletingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SettingResponse | null>(null);

  // load
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const res = await listSetting({ limit: 100 });
        if (isMounted) setSettings(res.items);
      } catch (err) {
        if (isMounted) setLoadError(getErrorMessage(err, "Unable to load settings."));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    void load();
    return () => { isMounted = false; };
  }, []);

  // search
  const filteredSettings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return settings;
    return settings.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.friendly_name.toLowerCase().includes(q),
    );
  }, [settings, searchQuery]);

  // modal open/close
  const handleOpenCreateModal = () => {
    setEditingSettingId(null);
    setFormState(emptyForm);
    setJsonError(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (setting: SettingResponse) => {
    setEditingSettingId(setting.id);
    setFormState({
      name: setting.name,
      friendly_name: setting.friendly_name,
      valueRaw: prettyJson(setting.value),
    });
    setJsonError(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => setIsModalOpen(false);

  // field update
  const updateField = useCallback(
    (field: keyof FormState, val: string) => {
      setFormState((prev) => ({ ...prev, [field]: val }));
      if (field === "valueRaw") setJsonError(null);
    },
    [],
  );

  // pretty-print button
  const handlePrettyPrint = () => {
    const result = tryParseJson(formState.valueRaw);
    if (result.ok) {
      setFormState((prev) => ({ ...prev, valueRaw: prettyJson(result.value) }));
      setJsonError(null);
    } else {
      setJsonError(result.error);
    }
  };

  // submit
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const parsed = tryParseJson(formState.valueRaw);
    if (!parsed.ok) {
      setJsonError(parsed.error);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: SettingCreate = {
        name: formState.name,
        friendly_name: formState.friendly_name,
        value: parsed.value,
      };

      const saved = editingSettingId
        ? await updateSetting(editingSettingId, payload)
        : await createSetting(payload);

      setSettings((current) => {
        if (editingSettingId) {
          return current.map((s) => (s.id === saved.id ? saved : s));
        }
        return [...current, saved].sort((a, b) => a.name.localeCompare(b.name));
      });
      setIsModalOpen(false);
    } catch (err) {
      setFormError(getErrorMessage(err, "Unable to save setting."));
    } finally {
      setIsSubmitting(false);
    }
  };

  // delete
  const handleDeleteClick = (setting: SettingResponse) => setDeleteTarget(setting);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    setIsDeletingId(target.id);
    try {
      await deleteSetting(target.id);
      setSettings((current) => current.filter((s) => s.id !== target.id));
    } catch (err) {
      setLoadError(getErrorMessage(err, "Unable to delete setting."));
    } finally {
      setIsDeletingId(null);
    }
  };

  const isSearchActive = searchQuery.trim().length > 0;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      {/* header */}
      <section className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-zinc-950 dark:text-zinc-50">App Configurations</h2>
        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-tournament-primary px-4 text-sm font-semibold text-white transition hover:opacity-90"
        >
          <IconPlus className="h-4 w-4" />
          New Setting
        </button>
      </section>

      {/* search */}
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-zinc-400">
          <IconSearch className="h-4 w-4" />
        </span>
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name or friendly name..."
          className="h-10 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-9 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-tournament-primary focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:ring-emerald-900"
        />
        {isSearchActive && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setSearchQuery("")}
            className="absolute inset-y-0 right-3 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            <IconX className="h-4 w-4" />
          </button>
        )}
      </div>

      {loadError && (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-400">
          {loadError}
        </p>
      )}

      {/* table */}
      <section className="overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        {isSearchActive && (
          <div className="border-b border-zinc-100 px-5 py-2.5 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            {filteredSettings.length === 0
              ? `No settings match "${searchQuery}"`
              : `${filteredSettings.length} of ${settings.length} settings match "${searchQuery}"`}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-700">
            <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:bg-zinc-800/70 dark:text-zinc-400">
              <tr>
                <th className="px-5 py-3">S.N.</th>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Friendly Name</th>
                <th className="px-5 py-3">Value (JSON)</th>
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
                    <td className="px-5 py-4 text-zinc-500 dark:text-zinc-400">{idx + 1}</td>
                    <td className="px-5 py-4 font-mono text-xs font-medium text-zinc-950 dark:text-zinc-100">
                      {setting.name}
                    </td>
                    <td className="px-5 py-4 text-zinc-700 dark:text-zinc-300">{setting.friendly_name}</td>
                    <td className="max-w-xs px-5 py-4">
                      <pre className="max-h-[150px] overflow-x-auto whitespace-pre-wrap break-all rounded bg-zinc-50 px-2 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {prettyJson(setting.value)}
                      </pre>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          title="Edit"
                          type="button"
                          onClick={() => handleOpenEditModal(setting)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-emerald-700 transition hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950"
                        >
                          <IconPencil className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </button>
                        <button
                          title="Delete"
                          type="button"
                          disabled={isDeletingId === setting.id}
                          onClick={() => handleDeleteClick(setting)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-rose-700 transition hover:bg-rose-50 disabled:opacity-40 dark:text-rose-400 dark:hover:bg-rose-950"
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
                  <td colSpan={5} className="px-5 py-8 text-center text-zinc-500 dark:text-zinc-400">
                    {isSearchActive ? `No settings match "${searchQuery}".` : "No settings found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* delete confirm */}
      <ConfirmModal
        isOpen={deleteTarget !== null}
        title="Delete Setting"
        message={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        isDangerous
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* create / edit modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingSettingId ? "Edit Setting" : "New Setting"}
      >
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
          <label className="block">
            <span className={labelCls}>Name</span>
            <input
              type="text"
              required
              value={formState.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="e.g. game_rules"
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
              placeholder="e.g. Game Rules"
              className={inputCls}
            />
          </label>

          {/* JSON value editor */}
          <div className="block">
            <div className="flex items-center justify-between">
              <span className={labelCls}>Value (JSON)</span>
              <button
                type="button"
                onClick={handlePrettyPrint}
                className="text-xs font-medium text-tournament-primary hover:underline"
              >
                Format JSON
              </button>
            </div>
            <textarea
              rows={10}
              required
              spellCheck={false}
              value={formState.valueRaw}
              onChange={(e) => updateField("valueRaw", e.target.value)}
              placeholder={'{\n  "key": "value"\n}'}
              className={`mt-2 w-full rounded-md border font-mono text-xs ${jsonError
                ? "border-rose-400 focus:ring-rose-200 dark:border-rose-600 dark:focus:ring-rose-900"
                : "border-zinc-300 focus:border-tournament-primary focus:ring-emerald-100 dark:border-zinc-600 dark:focus:border-zinc-400 dark:focus:ring-zinc-700"
                } bg-white px-3 py-2 text-zinc-950 outline-none transition focus:ring-2 dark:bg-zinc-800 dark:text-zinc-100`}
            />
            {jsonError && (
              <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{jsonError}</p>
            )}
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              Must be a valid JSON object. Use <code className="font-mono">{"{ }"}</code> at the top level.
            </p>
          </div>

          {formError && (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-400">
              {formError}
            </p>
          )}

          <div className="mt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleCloseModal}
              className="inline-flex h-11 items-center gap-2 rounded-md border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              <IconCancel className="h-4 w-4" />
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-11 items-center gap-2 rounded-md bg-tournament-primary px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-zinc-400"
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
