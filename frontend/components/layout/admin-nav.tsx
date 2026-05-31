"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { adminNavigations } from "@/lib/navigation";

const isActivePath = (pathname: string, href: string): boolean => {
  if (href === "/admin") {
    return pathname === "/admin";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
};

export const AdminNav = () => {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin navigation" className="flex flex-wrap gap-2">
      {adminNavigations.map(({ label, icon: Icon, href }) => {
        const active = isActivePath(pathname, href);

        return (
          <Link
            key={href}
            href={href}
            className={`inline-flex h-10 px-2 gap-2 items-center rounded-md px-3 text-sm font-medium transition ${active
              ? "text-tournament-primary"
              : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-700"
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
