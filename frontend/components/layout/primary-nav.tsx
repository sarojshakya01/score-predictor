"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { primaryNavigations } from "@/lib/navigation";

const isActivePath = (pathname: string, href: string): boolean => {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
};

export const PrimaryNav = () => {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary navigation"
      className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
    >
      {primaryNavigations.map(({ href, label, icon: Icon }) => {
        const active = isActivePath(pathname, href);

        return (
          <Link
            key={href}
            href={href}
            className={`inline-flex h-10 px-2 gap-2 shrink-0 items-center rounded-md px-3 text-sm font-medium transition ${active
              ? "text-tournament-primary"
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
