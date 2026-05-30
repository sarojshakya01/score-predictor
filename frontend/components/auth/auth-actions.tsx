"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getCurrentUser, isAuthenticated, logout } from "@/lib/auth";
import type { UserResponse } from "@/lib/auth";

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
      <div className="h-10 w-32 rounded-md border border-zinc-200 bg-zinc-50" />
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden max-w-40 truncate text-sm font-medium text-zinc-600 sm:inline">
          {user.first_name}
        </span>
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex cursor-pointer h-10 items-center cursor-pointer rounded-md bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
        >
          Logout
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/login"
        className="inline-flex h-10 items-center rounded-md bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
      >
        Login
      </Link>
      <Link
        href="/signup"
        className="inline-flex h-10 items-center rounded-md text-zinc-700 px-3 text-sm font-semibold text-white transition hover:bg-zinc-50"
      >
        Sign up
      </Link>
    </div>
  );
}
