"use client";

import Link from "next/link";
import { useState } from "react";

import { AuthActions } from "@/components/auth/auth-actions";
import { PrimaryNav } from "@/components/layout/primary-nav";
import { AdminNav } from "@/components/layout/admin-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useAuth } from "@/components/auth/auth-context";
import Image from "next/image";

type AppShellProps = {
  children: React.ReactNode;
};

export const AppShell = ({ children }: AppShellProps) => {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

          {/* ── Top bar ─────────────────────────────────────── */}
          <div className="flex h-16 items-center justify-between gap-3">
            {/* Logo */}
            <Link
              href={isAdmin ? "/admin" : "/"}
              className="flex shrink-0 items-center gap-2.5"
            >
              <Image
                src="/images/wc2026.png"
                width={36}
                height={36}
                alt="Football Icon"
                className="hidden dark:block h-[35px] w-auto"
              />
              <Image
                src="/images/wc2026_black.png"
                width={36}
                height={36}
                alt="Football Icon"
                className="dark:hidden h-[35px] w-auto"
              />
              <span className="hidden sm:block">
                <span className="block text-sm font-semibold text-zinc-950 dark:text-zinc-50 leading-tight">
                  Match Predictor
                </span>
                <span className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 leading-tight">
                  {isAdmin ? "Admin Panel" : "Make predictions"}
                </span>
              </span>
            </Link>

            {/* Desktop nav (hidden on mobile) */}
            <div className="hidden lg:flex flex-1 justify-center">
              {isAdmin ? <AdminNav /> : <PrimaryNav />}
            </div>

            {/* Right-side controls */}
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <AuthActions />

              {/* Hamburger – mobile only */}
              <button
                type="button"
                aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
                onClick={() => setMobileNavOpen((v) => !v)}
                className="lg:hidden grid h-9 w-9 place-items-center rounded-md border border-zinc-200 bg-transparent text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                {mobileNavOpen ? (
                  // X icon
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                ) : (
                  // Hamburger icon
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="4" y1="6" x2="20" y2="6" />
                    <line x1="4" y1="12" x2="20" y2="12" />
                    <line x1="4" y1="18" x2="20" y2="18" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* ── Mobile nav drawer ───────────────────────────── */}
          {mobileNavOpen && (
            <div
              className="lg:hidden border-t border-zinc-200 dark:border-zinc-800 py-3"
              onClick={() => setMobileNavOpen(false)}
            >
              {isAdmin ? <AdminNav mobile /> : <PrimaryNav mobile />}
            </div>
          )}
        </div>
      </header>

      {children}

      <footer className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-sm text-zinc-500 dark:text-zinc-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>&copy; {new Date().getFullYear()} Match Predictor. All rights reserved.</p>
          <p>Predictions lock one hour before kickoff.</p>
        </div>
      </footer>
    </div>
  );
};
