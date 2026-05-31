"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getCurrentUser, isAuthenticated, logout } from "@/lib/auth";
import type { UserResponse } from "@/lib/auth";
import { IconLogin, IconLogout, IconUserPlus } from "@/components/ui/icons";

export const AuthActions = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserResponse | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadCurrentUser = async () => {
      if (!isAuthenticated()) {
        if (isMounted) {
          setUser(null);
          setIsChecking(false);
        }
        return;
      }

      try {
        const currentUser = await getCurrentUser();
        if (isMounted) {
          setUser(currentUser);
        }
      } catch {
        logout();
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsChecking(false);
        }
      }
    };

    void loadCurrentUser();

    return () => {
      isMounted = false;
    };
  }, [pathname]);

  const handleLogout = () => {
    logout();
    setUser(null);
    router.replace("/login");
    window.location.reload();
  };

  if (isChecking) {
    return (
      <div className="h-10 w-32 animate-pulse rounded-md border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800" />
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden max-w-40 truncate text-sm font-medium text-zinc-600 dark:text-zinc-400 sm:inline">
          {user.first_name}
        </span>
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex cursor-pointer h-10 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-700"
        >
          <IconLogout className="h-4 w-4" />
          Logout
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/login"
        className="inline-flex h-10 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-700"
      >
        <IconLogin className="h-4 w-4" />
        Login
      </Link>
      <Link
        href="/signup"
        className="inline-flex h-10 items-center gap-1.5 rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
      >
        <IconUserPlus className="h-4 w-4" />
        Sign up
      </Link>
    </div>
  );
}
