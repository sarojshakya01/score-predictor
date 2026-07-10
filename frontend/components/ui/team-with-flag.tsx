"use client";

import { useState } from "react";
import Image from "next/image";
import { MatchResponse } from "@/lib/matches";
import { Tooltip } from "./tooltip";

const TeamWithFlag = ({ match, size, isHomeTeam }: { match: MatchResponse, size: string, isHomeTeam: boolean }) => {
  const [isLoading1, setIsLoading1] = useState(match.team1_flag_url ? true : false);
  const [isLoading2, setIsLoading2] = useState(match.team2_flag_url ? true : false);

  if (isHomeTeam) {
    return (<div className={(size === "sm" ? "w-full" : "w-[47%]") + " flex items-center justify-end gap-2"}>
      <div className="flex group relative">
        <Tooltip content={match.team1_name} side="top">
          <span className="inline-block w-full text-right pr-1 truncate max-w-[100px]">
            {isLoading1 ? "" : match.team1_name}
          </span>
        </Tooltip>
      </div>

      {isLoading1 && (
        <div
          className={(size === "sm" ? "min-h-[18px] min-w-[25px]" : "min-h-[25px] min-w-[40px]") + " absolute shrink-0 animate-pulse rounded-md border border-zinc-200 shadow-sm dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 dark:shadow-zinc-950"}
        />
      )}
      {match.team1_flag_url ? (
        <Image width={30} height={30} className={(isLoading1 ? "opacity-0 " : "opacity-100 ") + (size === "sm" ? "min-h-[18px]" : "min-h-[25px]") + " w-auto rounded object-cover shadow-sm"} decoding="async" loading="lazy" src={match.team1_flag_url} alt="flag" onLoad={() => setIsLoading1(false)} />
      ) : <div
        className={(size === "sm" ? "min-h-[18px] min-w-[25px] w-[25px]" : "min-h-[25px] min-w-[40px] w-[40px]") + " shrink-0 rounded-md border border-zinc-200 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:shadow-zinc-950"}
      />}

    </div>)
  } else {
    return (<div className={(size === "sm" ? "w-full" : "w-[47%]") + " flex items-center justify-start gap-2"}>
      {isLoading2 && (
        <div
          className={(size === "sm" ? "min-h-[18px] min-w-[25px]" : "min-h-[25px] min-w-[40px]") + " absolute shrink-0 animate-pulse rounded-md border border-zinc-200 shadow-sm dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 dark:shadow-zinc-950"}
        />
      )}
      {match.team2_flag_url ? (
        <Image width={30} height={30} className={(isLoading2 ? "opacity-0 " : "opacity-100 ") + (size === "sm" ? "min-h-[18px]" : "min-h-[25px]") + " w-auto rounded object-cover shadow-sm"} decoding="async" loading="lazy" src={match.team2_flag_url} alt="flag" onLoad={() => setIsLoading2(false)} />
      ) : <div
        className={(size === "sm" ? "min-h-[18px] min-w-[25px] w-[25px]" : "min-h-[25px] max-w-[40px] w-[40px]") + " shrink-0 rounded-md border border-zinc-200 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:shadow-zinc-950"}
      />}
      <div className="flex group relative">
        {/* <Tooltip content={match.team2_name} side="top"> */}
        <span className="inline-block w-full text-left pl-2 truncate max-w-[100px]">{isLoading2 ? "" : match.team2_name}</span>
        {/* </Tooltip> */}
      </div>
    </div>)
  }
}

export default TeamWithFlag;
