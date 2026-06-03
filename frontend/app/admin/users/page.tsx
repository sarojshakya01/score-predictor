"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

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
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { IconCancel, IconPencil, IconPlus, IconSave, IconSearch, IconTrash, IconX } from "@/components/ui/icons";
import { Pagination } from "@/components/ui/pagination";

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

const PAGE_SIZE = 20;

const inputCls = "mt-2 h-11 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none transition focus:border-tournament-primary focus:ring-2 focus:ring-emerald-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:ring-emerald-900";
const selectCls = "mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-tournament-primary focus:ring-2 focus:ring-emerald-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:ring-emerald-900";
const labelCls = "text-sm font-medium text-zinc-700 dark:text-zinc-300";

const AdminUsersPage = () => {
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [formState, setFormState] = useState<UserCreate>(emptyFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [isDeletingId, setIsDeletingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserResponse | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadUsers = async () => {
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
    };

    void loadUsers();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const fullName = [u.first_name, u.middle_name, u.last_name].filter(Boolean).join(" ").toLowerCase();
      return (
        fullName.includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) ||
        u.mobile_no.toLowerCase().includes(q)
      );
    });
  }, [users, searchQuery]);

  // Reset to page 1 when search changes
  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  const handleOpenCreateModal = () => {
    setEditingUserId(null);
    setFormState(emptyFormState);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: UserResponse) => {
    setEditingUserId(user.id);
    setFormState({
      email: user.email,
      first_name: user.first_name,
      middle_name: user.middle_name || "",
      last_name: user.last_name,
      mobile_no: user.mobile_no,
      password: "",
      role: user.role,
      is_active: user.is_active,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const updateField = (field: keyof UserCreate, value: string | boolean) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
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
  };

  const handleDeleteClick = (user: UserResponse) => {
    setDeleteTarget(user);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const user = deleteTarget;
    setDeleteTarget(null);
    setIsDeletingId(user.id);
    try {
      await deleteUser(user.id);
      setUsers((current) => current.filter((u) => u.id !== user.id));
    } catch (error) {
      setLoadError(getErrorMessage(error, "Unable to delete user."));
    } finally {
      setIsDeletingId(null);
    }
  };

  const pagedUsers = filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const isSearchActive = searchQuery.trim().length > 0;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-zinc-950 dark:text-zinc-50">Active Users</h2></div>
        <button
          className="inline-flex h-10 items-center gap-2 cursor-pointer rounded-md bg-tournament-primary px-4 text-sm font-semibold text-white transition hover:bg-tournament-primary"
          type="button"
          onClick={handleOpenCreateModal}
        >
          <IconPlus className="h-4 w-4" />
          New User
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
          placeholder="Search by name, email, role, or mobile..."
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
        total={filteredUsers.length}
        onChange={setPage}
      />

      <section className="overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        {isSearchActive && (
          <div className="border-b border-zinc-100 px-5 py-2.5 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            {filteredUsers.length === 0
              ? `No users match "${searchQuery}"`
              : `${filteredUsers.length} of ${users.length} user${users.length !== 1 ? "s" : ""} match "${searchQuery}"`}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-700">
            <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              <tr>
                <th className="px-5 py-3">S.N.</th>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-zinc-500 dark:text-zinc-400">
                    Loading users…
                  </td>
                </tr>
              ) : pagedUsers.length > 0 ? (
                pagedUsers.map((user, idx) => (
                  <tr key={user.id} className="transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40">
                    <td className="px-5 py-4 text-left text-zinc-700 dark:text-zinc-300">{idx + 1}</td>
                    <td className="px-5 py-4 font-medium text-zinc-950 dark:text-zinc-50">
                      {[user.first_name, user.middle_name, user.last_name]
                        .filter(Boolean)
                        .join(" ")}
                    </td>
                    <td className="px-5 py-4 text-zinc-700 dark:text-zinc-300">{user.email}</td>
                    <td className="px-5 py-4">
                      <StatusPill tone={user.role === "ADMIN" ? "primary" : "secondary"}>
                        {user.role === "ADMIN" ? "Admin" : "Player"}
                      </StatusPill>
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill tone={user.is_active ? "primary" : "accent"}>
                        {user.is_active ? "Active" : "Inactive"}
                      </StatusPill>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          title="Edit"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-emerald-700 hover:bg-emerald-50 cursor-pointer transition dark:text-emerald-400 dark:hover:bg-emerald-950"
                          onClick={() => handleOpenEditModal(user)}
                        >
                          <IconPencil className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-rose-700 hover:bg-rose-50 cursor-pointer transition disabled:opacity-40 dark:text-rose-400 dark:hover:bg-rose-950"
                          disabled={isDeletingId === user.id}
                          onClick={() => handleDeleteClick(user)}
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
                    {isSearchActive ? `No users match "${searchQuery}".` : "No users found."}
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
        total={filteredUsers.length}
        onChange={setPage}
      />

      <ConfirmModal
        isOpen={deleteTarget !== null}
        title="Delete User"
        message={deleteTarget ? `Are you sure you want to delete ${deleteTarget.email}? This action cannot be undone.` : ""}
        confirmLabel="Delete"
        isDangerous
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => setDeleteTarget(null)}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingUserId ? "Edit User" : "New User"}
      >
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
          <label className="block">
            <span className={labelCls}>Email</span>
            <input
              autoComplete="email"
              type="email"
              required
              value={formState.email}
              onChange={(e) => updateField("email", e.target.value)}
              className={inputCls}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={labelCls}>First name</span>
              <input
                autoComplete="name"
                type="text"
                required
                value={formState.first_name}
                onChange={(e) => updateField("first_name", e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Middle name</span>
              <input
                autoComplete="middle-name"
                type="text"
                value={formState.middle_name || ""}
                onChange={(e) => updateField("middle_name", e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Last name</span>
              <input
                autoComplete="family-name"
                type="text"
                required
                value={formState.last_name}
                onChange={(e) => updateField("last_name", e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Mobile no</span>
              <input
                autoComplete="tel"
                type="text"
                required
                value={formState.mobile_no}
                onChange={(e) => updateField("mobile_no", e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Role</span>
              <select
                required
                value={formState.role}
                onChange={(e) => updateField("role", e.target.value as UserRole)}
                className={selectCls}
              >
                {USER_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={labelCls}>
                {editingUserId ? "New Password (optional)" : "Password"}
              </span>
              <input
                autoComplete="new-password"
                type="password"
                required={!editingUserId}
                minLength={8}
                value={formState.password || ""}
                onChange={(e) => updateField("password", e.target.value)}
                className={inputCls}
              />
            </label>
          </div>
          <label className="flex items-center gap-3 cursor-pointer rounded-md border border-zinc-200 px-3 py-3 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
            <input
              autoComplete=""
              type="checkbox"
              checked={formState.is_active}
              onChange={(e) => updateField("is_active", e.target.checked)}
              className="h-4 w-4 accent-emerald-700"
            />
            Active user account
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
              className="inline-flex h-11 px-4 items-center gap-2 justify-center cursor-pointer rounded-md border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-700"
            >
              <IconCancel className="h-4 w-4" />
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-11 px-4 items-center gap-2 justify-center cursor-pointer rounded-md bg-tournament-primary px-4 text-sm font-semibold text-white transition hover:bg-tournament-primary disabled:cursor-not-allowed disabled:bg-zinc-400"
            >
              <IconSave className="h-4 w-4" />
              {isSubmitting ? "Saving…" : "Save User"}
            </button>
          </div>
        </form>
      </Modal>
    </main>
  );
};

export default AdminUsersPage;
