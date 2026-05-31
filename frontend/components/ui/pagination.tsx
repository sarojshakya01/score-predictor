"use client";

import {
  IconChevronsLeft,
  IconChevronsRight,
  IconChevronLeft,
  IconChevronRight,
} from "@/components/ui/icons";

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
};

export const Pagination = ({ page, pageSize, total, onChange }: PaginationProps) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (totalPages <= 1) return null;

  const btnBase =
    "inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 transition hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:bg-zinc-700";

  return (
    <div className="flex items-center justify-between gap-3 px-1 py-3">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Page <span className="font-semibold text-zinc-700 dark:text-zinc-300">{page}</span> of{" "}
        <span className="font-semibold text-zinc-700 dark:text-zinc-300">{totalPages}</span>
        {" "}·{" "}
        <span className="font-semibold text-zinc-700 dark:text-zinc-300">{total}</span> total
      </p>
      <div className="flex items-center gap-1">
        <button type="button" aria-label="First page" className={btnBase} disabled={page <= 1} onClick={() => onChange(1)}>
          <IconChevronsLeft />
        </button>
        <button type="button" aria-label="Previous page" className={btnBase} disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <IconChevronLeft />
        </button>
        <button type="button" aria-label="Next page" className={btnBase} disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          <IconChevronRight />
        </button>
        <button type="button" aria-label="Last page" className={btnBase} disabled={page >= totalPages} onClick={() => onChange(totalPages)}>
          <IconChevronsRight />
        </button>
      </div>
    </div>
  );
};
