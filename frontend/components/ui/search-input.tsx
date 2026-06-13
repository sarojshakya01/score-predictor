"use client";

import { IconSearch, IconSearchClear } from "./icons";

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  resultCount?: number;
  totalCount?: number;
};

export const SearchInput = ({
  value,
  onChange,
  placeholder = "Search…",
  resultCount,
  totalCount,
}: SearchInputProps) => {
  const showCount = resultCount !== undefined && totalCount !== undefined;

  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <div className="relative">
        {/* Search icon */}
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-zinc-400 dark:text-zinc-500">
          <IconSearch />
        </span>

        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-10 w-full rounded-md border border-zinc-300 bg-white pl-9 pr-9 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-tournament-primary focus:ring-2 focus:ring-emerald-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:ring-emerald-900 sm:w-64"
        />

        {/* Clear button */}
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute inset-y-0 right-3 flex items-center text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition"
          >
            <IconSearchClear />
          </button>
        )}
      </div>

      {showCount && (
        <span className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
          {value
            ? `${resultCount} of ${totalCount}`
            : `${totalCount} total`}
        </span>
      )}
    </div>
  );
};
