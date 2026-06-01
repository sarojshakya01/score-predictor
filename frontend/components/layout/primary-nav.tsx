"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { primaryNavigations } from "@/lib/navigation";

const isActivePath = (pathname: string, href: string): boolean => {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
};

type PrimaryNavProps = { mobile?: boolean };

export const PrimaryNav = ({ mobile = false }: PrimaryNavProps) => {
  const pathname = usePathname();

  if (mobile) {
    return (
      <nav aria-label="Primary navigation" className="flex flex-col gap-1">
        {primaryNavigations.map(({ href, label, icon: Icon }) => {
          const active = isActivePath(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition ${active
                ? "bg-zinc-100 text-tournament-primary-light dark:bg-zinc-800"
                : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                }`}
            >
              <Icon />
              {label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Primary navigation"
      className="flex gap-1 overflow-x-auto"
    >
      {primaryNavigations.map(({ href, label, icon: Icon }) => {
        const active = isActivePath(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-md px-2 text-sm font-medium transition ${active
              ? "text-tournament-primary-light"
              : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
              }`}
          >
            <Icon />
            {label}
          </Link>
        );
      })}
    </nav>
  );
};
