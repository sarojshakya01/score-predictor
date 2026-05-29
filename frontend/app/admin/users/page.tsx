"use client";

import { FormEvent, useEffect, useState } from "react";

import { Modal } from "@/components/ui/modal";
import { StatusPill } from "@/components/ui/status-pill";
import { USER_ROLES } from "@/lib/auth";
import type { UserRole } from "@/lib/auth";
import { getErrorMessage } from "@/lib/forms/error-message";
import {
  createUser,
  deleteUser,
  listAdminUsers,
  updateUser,
} from "@/lib/users";
import type { UserCreate, UserResponse } from "@/lib/users";

const emptyFormState: UserCreate = {
  email: "",
  first_name: "",
  middle_name: "",
  last_name: "",
  mobile_no: "",
  password: "",
  role: "USER",
  is_active: true,
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [formState, setFormState] = useState<UserCreate>(emptyFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [isDeletingId, setIsDeletingId] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadUsers() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const userList = await listAdminUsers({ limit: 100 });
        if (isMounted) {
          setUsers(userList.items);
        }
      } catch (error) {
        if (isMounted) {
          setLoadError(getErrorMessage(error, "Unable to load users."));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadUsers();

    return () => {
      isMounted = false;
    };
  }, []);

  function handleOpenCreateModal() {
    setEditingUserId(null);
    setFormState(emptyFormState);
    setFormError(null);
    setIsModalOpen(true);
  }

  function handleOpenEditModal(user: UserResponse) {
    setEditingUserId(user.id);
    setFormState({
      email: user.email,
      first_name: user.first_name,
      middle_name: user.middle_name || "",
      last_name: user.last_name,
      mobile_no: user.mobile_no,
      password: "", // Leave blank so backend doesn't update unless typed
      role: user.role,
      is_active: user.is_active,
    });
    setFormError(null);
    setIsModalOpen(true);
  }

  function handleCloseModal() {
    setIsModalOpen(false);
  }

  function updateField(field: keyof UserCreate, value: string | boolean) {
    setFormState((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      // Don't send empty string for password on edit
      const payload = { ...formState };
      if (editingUserId && !payload.password) {
        delete payload.password;
      }

      const savedUser = editingUserId
        ? await updateUser(editingUserId, payload)
        : await createUser(payload);

      setUsers((current) => {
        if (editingUserId) {
          return current.map((u) => (u.id === savedUser.id ? savedUser : u));
        }
        return [...current, savedUser].sort((a, b) =>
          a.first_name.localeCompare(b.first_name)
        );
      });
      setIsModalOpen(false);
    } catch (error) {
      setFormError(getErrorMessage(error, "Unable to save user."));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(user: UserResponse) {
    if (!window.confirm(`Delete user ${user.email}?`)) {
      return;
    }

    setIsDeletingId(user.id);
    try {
      await deleteUser(user.id);
      setUsers((current) => current.filter((u) => u.id !== user.id));
    } catch (error) {
      alert(getErrorMessage(error, "Unable to delete user."));
    } finally {
      setIsDeletingId(null);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div><h2>Active Users</h2></div>
        <button
          className="inline-flex h-10 items-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800"
          type="button"
          onClick={handleOpenCreateModal}
        >
          New User
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
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-zinc-500">
                    Loading users...
                  </td>
                </tr>
              ) : users.length > 0 ? (
                users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-5 py-4 font-medium text-zinc-950">
                      {[user.first_name, user.middle_name, user.last_name]
                        .filter(Boolean)
                        .join(" ")}
                    </td>
                    <td className="px-5 py-4 text-zinc-700">{user.email}</td>
                    <td className="px-5 py-4">
                      <StatusPill tone={user.role === "ADMIN" ? "blue" : "zinc"}>
                        {user.role}
                      </StatusPill>
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill tone={user.is_active ? "green" : "zinc"}>
                        {user.is_active ? "Active" : "Inactive"}
                      </StatusPill>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          className="font-semibold text-emerald-700 hover:text-emerald-900"
                          onClick={() => handleOpenEditModal(user)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="font-semibold text-rose-700 hover:text-rose-900 disabled:text-zinc-400"
                          disabled={isDeletingId === user.id}
                          onClick={() => void handleDelete(user)}
                        >
                          {isDeletingId === user.id ? "Deleting" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-zinc-500">
                    No users found.
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
        title={editingUserId ? "Edit user" : "New user"}
      >
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">Email</span>
            <input
              type="email"
              required
              value={formState.email}
              onChange={(e) => updateField("email", e.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">First name</span>
              <input
                type="text"
                required
                value={formState.first_name}
                onChange={(e) => updateField("first_name", e.target.value)}
                className="mt-2 h-11 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">Middle name</span>
              <input
                type="text"
                value={formState.middle_name || ""}
                onChange={(e) => updateField("middle_name", e.target.value)}
                className="mt-2 h-11 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">Last name</span>
              <input
                type="text"
                required
                value={formState.last_name}
                onChange={(e) => updateField("last_name", e.target.value)}
                className="mt-2 h-11 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">Mobile no</span>
              <input
                type="text"
                required
                value={formState.mobile_no}
                onChange={(e) => updateField("mobile_no", e.target.value)}
                className="mt-2 h-11 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">Role</span>
              <select
                required
                value={formState.role}
                onChange={(e) => updateField("role", e.target.value as UserRole)}
                className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              >
                {USER_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">
                {editingUserId ? "New Password (optional)" : "Password"}
              </span>
              <input
                type="password"
                required={!editingUserId}
                minLength={8}
                value={formState.password || ""}
                onChange={(e) => updateField("password", e.target.value)}
                className="mt-2 h-11 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          </div>
          <label className="flex items-center gap-3 rounded-md border border-zinc-200 px-3 py-3 text-sm font-medium text-zinc-700">
            <input
              type="checkbox"
              checked={formState.is_active}
              onChange={(e) => updateField("is_active", e.target.checked)}
              className="h-4 w-4 accent-emerald-700"
            />
            Active user account
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
              {isSubmitting ? "Saving..." : "Save user"}
            </button>
          </div>
        </form>
      </Modal>
    </main>
  );
}
