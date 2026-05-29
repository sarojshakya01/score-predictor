"use client";

import { FormEvent, useEffect, useState } from "react";

import { Modal } from "@/components/ui/modal";
import { getErrorMessage } from "@/lib/forms/error-message";
import {
  createTeam,
  deleteTeam,
  listAdminTeams,
  updateTeam,
} from "@/lib/teams";
import type { TeamCreate, TeamResponse } from "@/lib/teams";

const emptyFormState: TeamCreate = {
  name: "",
  group: "",
  fifa_code: "",
};

export default function AdminTeamsPage() {
  const [teams, setTeams] = useState<TeamResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<number | null>(null);
  const [formState, setFormState] = useState<TeamCreate>(emptyFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [isDeletingId, setIsDeletingId] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadTeams() {
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
    }

    void loadTeams();

    return () => {
      isMounted = false;
    };
  }, []);

  function handleOpenCreateModal() {
    setEditingTeamId(null);
    setFormState(emptyFormState);
    setFormError(null);
    setIsModalOpen(true);
  }

  function handleOpenEditModal(team: TeamResponse) {
    setEditingTeamId(team.id);
    setFormState({
      name: team.name,
      group: team.group,
      fifa_code: team.fifa_code,
    });
    setFormError(null);
    setIsModalOpen(true);
  }

  function handleCloseModal() {
    setIsModalOpen(false);
  }

  function updateField(field: keyof TeamCreate, value: string) {
    setFormState((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
  }

  async function handleDelete(team: TeamResponse) {
    if (!window.confirm(`Delete team ${team.name}?`)) {
      return;
    }

    setIsDeletingId(team.id);
    try {
      await deleteTeam(team.id);
      setTeams((current) => current.filter((t) => t.id !== team.id));
    } catch (error) {
      alert(getErrorMessage(error, "Unable to delete team."));
    } finally {
      setIsDeletingId(null);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div><h2>Tournament Teams</h2></div>
        <button
          className="inline-flex h-10 items-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800"
          type="button"
          onClick={handleOpenCreateModal}
        >
          New Team
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
                <th className="px-5 py-3">Team</th>
                <th className="px-5 py-3">Group</th>
                <th className="px-5 py-3">Country code</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-zinc-500">
                    Loading teams...
                  </td>
                </tr>
              ) : teams.length > 0 ? (
                teams.map((team) => (
                  <tr key={team.id}>
                    <td className="px-5 py-4 font-medium text-zinc-950">
                      {team.name}
                    </td>
                    <td className="px-5 py-4 text-zinc-700">{team.group}</td>
                    <td className="px-5 py-4 text-zinc-700">{team.fifa_code}</td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          className="font-semibold text-emerald-700 hover:text-emerald-900"
                          onClick={() => handleOpenEditModal(team)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="font-semibold text-rose-700 hover:text-rose-900 disabled:text-zinc-400"
                          disabled={isDeletingId === team.id}
                          onClick={() => void handleDelete(team)}
                        >
                          {isDeletingId === team.id ? "Deleting" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-zinc-500">
                    No teams found.
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
        title={editingTeamId ? "Edit team" : "New team"}
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
            <span className="text-sm font-medium text-zinc-700">Group</span>
            <input
              type="text"
              required
              value={formState.group}
              onChange={(e) => updateField("group", e.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">FIFA code</span>
            <input
              type="text"
              required
              maxLength={3}
              minLength={2}
              value={formState.fifa_code}
              onChange={(e) => updateField("fifa_code", e.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100 uppercase"
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
              {isSubmitting ? "Saving..." : "Save team"}
            </button>
          </div>
        </form>
      </Modal>
    </main>
  );
}
