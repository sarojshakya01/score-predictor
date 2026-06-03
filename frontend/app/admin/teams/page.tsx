"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { Modal } from "@/components/ui/modal";
import { getErrorMessage } from "@/lib/forms/error-message";
import {
  createTeam,
  deleteTeam,
  listAdminTeams,
  updateTeam,
} from "@/lib/teams";
import type { TeamCreate, TeamResponse } from "@/lib/teams";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import Image from "next/image";
import { IconCancel, IconPencil, IconPlus, IconSave, IconSearch, IconTrash, IconX } from "@/components/ui/icons";
import { Pagination } from "@/components/ui/pagination";

const emptyFormState: TeamCreate = {
  name: "",
  group: "",
  fifa_code: "",
  fifa_rank: 0,
};

const PAGE_SIZE = 20;

const inputCls = "mt-2 h-11 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none transition focus:border-tournament-primary focus:ring-2 focus:ring-emerald-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:ring-emerald-900";
const labelCls = "text-sm font-medium text-zinc-700 dark:text-zinc-300";

const AdminTeamsPage = () => {
  const [teams, setTeams] = useState<TeamResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<number | null>(null);
  const [formState, setFormState] = useState<TeamCreate>(emptyFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [isDeletingId, setIsDeletingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TeamResponse | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadTeams = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const teamList = await listAdminTeams({ limit: 100 });
        if (isMounted) {
          setTeams(teamList.items);
        }
      } catch (error) {
        if (isMounted) {
          setLoadError(getErrorMessage(error, "Unable to load teams."));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadTeams();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredTeams = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter((t) =>
      t.name.toLowerCase().includes(q) ||
      t.group.toLowerCase().includes(q) ||
      t.fifa_code.toLowerCase().includes(q) ||
      String(t.fifa_rank).includes(q)
    );
  }, [teams, searchQuery]);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  const handleOpenCreateModal = () => {
    setEditingTeamId(null);
    setFormState(emptyFormState);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (team: TeamResponse) => {
    setEditingTeamId(team.id);
    setFormState({
      name: team.name,
      group: team.group,
      fifa_code: team.fifa_code,
      fifa_rank: team.fifa_rank
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const updateField = (field: keyof TeamCreate, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const savedTeam = editingTeamId
        ? await updateTeam(editingTeamId, formState)
        : await createTeam(formState);

      setTeams((current) => {
        if (editingTeamId) {
          return current.map((t) => (t.id === savedTeam.id ? savedTeam : t));
        }
        return [...current, savedTeam].sort((a, b) =>
          a.name.localeCompare(b.name)
        );
      });
      setIsModalOpen(false);
    } catch (error) {
      setFormError(getErrorMessage(error, "Unable to save team."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (team: TeamResponse) => {
    setDeleteTarget(team);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const team = deleteTarget;
    setDeleteTarget(null);
    setIsDeletingId(team.id);
    try {
      await deleteTeam(team.id);
      setTeams((current) => current.filter((t) => t.id !== team.id));
    } catch (error) {
      setLoadError(getErrorMessage(error, "Unable to delete team."));
    } finally {
      setIsDeletingId(null);
    }
  };

  const pagedTeams = filteredTeams.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const isSearchActive = searchQuery.trim().length > 0;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-zinc-950 dark:text-zinc-50">Tournament Teams</h2></div>
        <button
          className="inline-flex h-10 items-center gap-2 cursor-pointer rounded-md bg-tournament-primary px-4 text-sm font-semibold text-white transition hover:bg-tournament-primary"
          type="button"
          onClick={handleOpenCreateModal}
        >
          <IconPlus className="h-4 w-4" />
          New Team
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
          placeholder="Search by name, group, FIFA code, or rank..."
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
        <section className="rounded-md border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-800 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-300">
          {loadError}
        </section>
      ) : null}

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={filteredTeams.length}
        onChange={setPage}
      />

      <section className="overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        {isSearchActive && (
          <div className="border-b border-zinc-100 px-5 py-2.5 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            {filteredTeams.length === 0
              ? `No teams match "${searchQuery}"`
              : `${filteredTeams.length} of ${teams.length} team${teams.length !== 1 ? "s" : ""} match "${searchQuery}"`}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-700">
            <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              <tr>
                <th className="px-5 py-3">S.N.</th>
                <th className="px-5 py-3">Team</th>
                <th className="px-5 py-3">FIFA code</th>
                <th className="px-5 py-3">Group</th>
                <th className="px-5 py-3">FIFA Rank</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-zinc-500 dark:text-zinc-400">
                    Loading teams…
                  </td>
                </tr>
              ) : pagedTeams.length > 0 ? (
                pagedTeams.map((team, idx) => (
                  <tr key={team.id} className="transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40">
                    <td className="px-5 py-4 font-medium text-zinc-950 dark:text-zinc-50">{idx + 1}</td>
                    <td className="px-5 py-4 font-medium text-zinc-950 dark:text-zinc-50">
                      <div className="flex items-center gap-2">
                        <Image width={30} height={30} className="min-h-[25px] w-auto rounded object-cover shadow-sm" decoding="async" loading="lazy" src={team.flag_url} alt="flag" />
                        <span className="ml-2">{team.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-zinc-700 dark:text-zinc-300">{team.fifa_code}</td>
                    <td className="px-5 py-4 text-zinc-700 dark:text-zinc-300">{team.group}</td>
                    <td className="px-5 py-4 text-zinc-700 dark:text-zinc-300">{team.fifa_rank}</td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          title="Edit"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-emerald-700 hover:bg-emerald-50 cursor-pointer transition dark:text-emerald-400 dark:hover:bg-emerald-950"
                          onClick={() => handleOpenEditModal(team)}
                        >
                          <IconPencil className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-rose-700 hover:bg-rose-50 cursor-pointer transition disabled:opacity-40 dark:text-rose-400 dark:hover:bg-rose-950"
                          disabled={isDeletingId === team.id}
                          onClick={() => handleDeleteClick(team)}
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
                  <td colSpan={6} className="px-5 py-8 text-center text-zinc-500 dark:text-zinc-400">
                    {isSearchActive ? `No teams match "${searchQuery}".` : "No teams found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={filteredTeams.length}
        onChange={setPage}
      />

      <ConfirmModal
        isOpen={deleteTarget !== null}
        title="Delete Team"
        message={deleteTarget ? `Are you sure you want to delete ${deleteTarget.name}? This action cannot be undone.` : ""}
        confirmLabel="Delete"
        isDangerous
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => setDeleteTarget(null)}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingTeamId ? "Edit Team" : "New Team"}
      >
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
          <label className="block">
            <span className={labelCls}>Name</span>
            <input type="text" required value={formState.name} onChange={(e) => updateField("name", e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>Group</span>
            <input type="text" required value={formState.group} onChange={(e) => updateField("group", e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>FIFA code</span>
            <input type="text" required maxLength={3} minLength={2} value={formState.fifa_code} onChange={(e) => updateField("fifa_code", e.target.value)} className={inputCls + " uppercase"} />
          </label>
          <label className="block">
            <span className={labelCls}>FIFA rank</span>
            <input min={0} type="number" required value={formState.fifa_rank} onChange={(e) => updateField("fifa_rank", e.target.value)} className={inputCls} />
          </label>

          {formError ? (
            <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-300">
              {formError}
            </p>
          ) : null}

          <div className="mt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleCloseModal}
              className="inline-flex h-11 px-4 items-center gap-2 justify-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-700"
            >
              <IconCancel className="h-4 w-4" />
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-11 px-4 items-center gap-2 justify-center rounded-md bg-tournament-primary px-4 text-sm font-semibold text-white transition hover:bg-tournament-primary disabled:cursor-not-allowed disabled:bg-zinc-400"
            >
              <IconSave className="h-4 w-4" />
              {isSubmitting ? "Saving…" : "Save Team"}
            </button>
          </div>
        </form>
      </Modal>
    </main>
  );
};

export default AdminTeamsPage;
