"use client";

import { useState } from "react";
import Image from "next/image";
import { MatchResponse } from "@/lib/matches";

export default function TeamWithFlag({ match, size, isHomeTeam }: { match: MatchResponse, size: string, isHomeTeam: boolean }) {
  let [isLoading, setIsLoading] = useState(true);

  if (isHomeTeam) {
    return (<div className={(size === "sm" ? "w-full" : "w-[47%]") + " flex items-center justify-end gap-2"}>
      <div className="flex group relative">
        <span className="inline-block w-full text-right pr-1 truncate max-w-[100px]">
          {isLoading ? "" : match.team1_name}
        </span>
        <div className="absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white opacity-0 transition-opacity duration-200 group-hover:visible group-hover:opacity-100">
          {match.team1_name}
          <div className="absolute top-full left-1/2 -mt-1 h-2 w-2 -translate-x-1/2 rotate-45 bg-slate-900"></div>
        </div>
      </div>

      {isLoading && (
        <div
          className={(size === "sm" ? "min-h-[18px] min-w-[25px]" : "min-h-[25px] min-w-[40px]") + " absolute shrink-0 animate-pulse rounded-md border border-zinc-200 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:shadow-zinc-950"}
        />
      )}
      {match.team1_flag_url ? (
        <Image width={30} height={30} className={(isLoading ? "opacity-0 " : "opacity-100 ") + (size === "sm" ? "min-h-[18px]" : "min-h-[25px]") + " w-auto rounded object-cover shadow-sm"} decoding="async" loading="lazy" src={match.team1_flag_url} alt="flag" onLoad={() => setIsLoading(false)} />
      ) : <div
        className={(size === "sm" ? "min-h-[18px] min-w-[25px]" : "min-h-[25px] min-w-[40px]") + " shrink-0 animate-pulse rounded-md border border-zinc-200 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:shadow-zinc-950"}
      />}

    </div>)
  }
  else {
    return (<div className={(size === "sm" ? "w-full" : "w-[47%]") + " flex items-center justify-start gap-2"}>
      {isLoading && (
        <div
          className={(size === "sm" ? "min-h-[18px] min-w-[25px]" : "min-h-[25px] min-w-[40px]") + " absolute shrink-0 animate-pulse rounded-md border border-zinc-200 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:shadow-zinc-950"}
        />
      )}
      {match.team2_flag_url ? (
        <Image width={30} height={30} className={(isLoading ? "opacity-0 " : "opacity-100 ") + (size === "sm" ? "min-h-[18px]" : "min-h-[25px]") + " w-auto rounded object-cover shadow-sm"} decoding="async" loading="lazy" src={match.team2_flag_url} alt="flag" onLoad={() => setIsLoading(false)} />
      ) : <div
        className={(size === "sm" ? "min-h-[18px] min-w-[25px]" : "min-h-[25px] max-w-[40px]") + " shrink-0 animate-pulse rounded-md border border-zinc-200 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:shadow-zinc-950"}
      />}
      <div className="flex group relative">
        <span className="inline-block w-full text-left pl-2 truncate max-w-[100px]">{isLoading ? "" : match.team2_name}</span>
        <div className="absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white opacity-0 transition-opacity duration-200 group-hover:visible group-hover:opacity-100">
          {match.team2_name}
          <div className="absolute top-full left-1/2 -mt-1 h-2 w-2 -translate-x-1/2 rotate-45 bg-slate-900"></div>
        </div>
      </div>
    </div>)
  }
}
