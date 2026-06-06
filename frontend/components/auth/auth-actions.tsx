"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getCurrentUser, isAuthenticated, logout } from "@/lib/auth";
import type { UserResponse } from "@/lib/auth";
import { IconChevronDown, IconKey, IconLogin, IconLogout, IconUserPlus } from "@/components/ui/icons";
import { subscribeToSessionExpired } from "@/lib/auth/session-events";

export const AuthActions = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserResponse | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    return subscribeToSessionExpired(() => {
      setUser(null);
      setIsChecking(false);
      setIsMenuOpen(false);
    });
  }, []);

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
    router.replace("/");
    window.location.reload();
  };

  if (isChecking) {
    return (
      <div className="h-10 w-32 animate-pulse rounded-md border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800" />
    );
  }

  if (user) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 px-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300"
        >
          <span className="max-w-40 truncate">
            {user.first_name}
          </span>
          <IconChevronDown className="h-4 w-4" />
        </button>

        {isMenuOpen && (
          <div className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
            <Link
              href="/change-password"
              className="flex items-center gap-2 px-4 py-3 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              <IconKey className="h-4 w-4" />
              Change Password
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-red-600 hover:bg-zinc-100 dark:hover:bg-zinc-700"
            >
              <IconLogout className="h-4 w-4" />
              Logout
            </button>
          </div>
        )}
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
        className="inline-flex h-10 items-center gap-1.5 rounded-md bg-tournament-secondary px-3 text-sm font-semibold text-white transition hover:bg-tournament-secondary"
      >
        <IconUserPlus className="h-4 w-4" />
        Sign up
      </Link>
    </div>
  );
}
