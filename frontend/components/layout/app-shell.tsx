"use client";

import Link from "next/link";

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

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href={isAdmin ? "/admin" : "/"} className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-md text-sm font-bold text-white">
                <Image src="/images/football.png" width={50} height={50} alt="Football Icon" className="min-h-[25px] w-auto " />
              </span>
              <span>
                <span className="block text-base font-semibold text-zinc-950 dark:text-zinc-50">
                  Match Predictor
                </span>
                <span className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {isAdmin ? "Admin Panel" : "Tournament picks and rankings"}
                </span>
              </span>
            </Link>
            {isAdmin ? <AdminNav /> : <PrimaryNav />}
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <AuthActions />
            </div>
          </div>
        </div>
      </header>
      {children}
      <footer className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-sm text-zinc-500 dark:text-zinc-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>&copy; {new Date().getFullYear()} Match Predictor. All rights reserved.</p>
          <p>Predictions lock one hour before kickoff.</p>
        </div>
      </footer>
    </div>
  );
};
