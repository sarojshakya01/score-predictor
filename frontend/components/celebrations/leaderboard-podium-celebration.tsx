"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useMemo, useState, useEffect, useRef, useCallback, type CSSProperties } from "react";

import { useFinalMatchWinner } from "@/components/celebrations/use-final-match-winner";
import type { LeaderboardEntryResponse } from "@/lib/leaderboard";
import type { FireworksHandlers } from "@fireworks-js/react";

const Fireworks = dynamic(
  () => import("@fireworks-js/react").then((m) => m.Fireworks),
  { ssr: false },
);

type PodiumEntry = Pick<
  LeaderboardEntryResponse,
  "name" | "rank" | "total_points" | "user_id"
>;

type LeaderboardPodiumCelebrationProps = {
  items: PodiumEntry[];
};

type PodiumSlot = {
  accent: string;
  textSize: string;
  barClassName: string;
  delay: string;
  item: PodiumEntry;
  label: string;
  orderClassName: string;
  ringClassName: string;
};

const COUNTRY_COLORS = [
  { country: "ARG", colors: ["#6CACE4", "#FFFFFF"] },
  { country: "FRA", colors: ["#000091", "#FFFFFF", "#E1000F"] },
  { country: "ESP", colors: ["#AA151B", "#F1BF00"] },
  { country: "ENG", colors: ["#CE1124", "#FFFFFF"] },
  { country: "BRA", colors: ["#009739", "#FEDD00", "#FFFFFF", "#012169"] },
  { country: "GER", colors: ["#000000", "#DD0000", "#FFCC00"] },
  { country: "NED", colors: ["#C8102E", "#FFFFFF", "#003DA5"] },
  { country: "POR", colors: ["#046A38", "#DA291C"] },
  { country: "URU", colors: ["#001489", "#FFFFFF", "#FFCD00"] },
  { country: "ITA", colors: ["#008C45", "#FFFFFF", "#CD212A"] },
  { country: "BEL", colors: ["#2D2926", "#FFCD00", "#C8102E"] },
  { country: "MAR", colors: ["#C1272D", "#006233"] },
];

const extractFlagHues = (flagUrl: string): number[] => {
  try {
    const hexToRgb = (hex: string) => {
      const cleanHex = hex.replace('#', '');
      const r = parseInt(cleanHex.substring(0, 2), 16);
      const g = parseInt(cleanHex.substring(2, 4), 16);
      const b = parseInt(cleanHex.substring(4, 6), 16);
      return { r, g, b };
    };

    const rgbToHue = (r: number, g: number, b: number) => {
      const rPrime = r / 255;
      const gPrime = g / 255;
      const bPrime = b / 255;
      const max = Math.max(rPrime, gPrime, bPrime);
      const min = Math.min(rPrime, gPrime, bPrime);
      const delta = max - min;
      if (delta === 0) return 0;
      let h = 0;
      if (max === rPrime) {
        h = ((gPrime - bPrime) / delta) % 6;
      } else if (max === gPrime) {
        h = (bPrime - rPrime) / delta + 2;
      } else if (max === bPrime) {
        h = (rPrime - gPrime) / delta + 4;
      }
      h = Math.round(h * 60);
      if (h < 0) h += 360;
      return h;
    };

    const hues = new Array<number>();
    const filename = flagUrl.split("/").pop() || "";
    // Match the country code (e.g. ARG.png or ARG)
    const countryCode = filename.split(".")[0];
    const data = COUNTRY_COLORS.find((cc) => cc.country === countryCode) || { colors: [] };
    for (let i = 0; i < data.colors.length; i += 1) {
      const { r, g, b } = hexToRgb(data.colors[i]);
      hues.push(rgbToHue(r, g, b));
    }
    return hues.length > 0 ? hues : [];
  } catch {
    return [];
  }
};

const huesToMinMax = (hues: number[]): { min: number; max: number } => {
  if (hues.length === 0) return { min: 0, max: 360 };
  const sorted = [...hues].sort((a, b) => a - b).filter((h) => h > 0);
  if (sorted.length === 0) return { min: 0, max: 360 };
  if (sorted.length === 1) {
    return { min: sorted[0], max: sorted[0] };
  }
  const randomIndex = Math.floor(Math.random() * sorted.length);
  return { min: sorted[randomIndex], max: sorted[randomIndex] };
};

const sortLeaderboardItems = (items: PodiumEntry[]) => {
  return [...items].sort((first, second) => {
    if (first.rank !== second.rank) {
      return first.rank - second.rank;
    }

    if (first.total_points !== second.total_points) {
      return second.total_points - first.total_points;
    }

    return first.name.localeCompare(second.name);
  });
};

export const LeaderboardPodiumCelebration = ({
  items,
}: LeaderboardPodiumCelebrationProps) => {
  const { winner: finalWinner } = useFinalMatchWinner();
  const fwRef = useRef<FireworksHandlers>(null);
  const podium = useMemo(() => sortLeaderboardItems(items).slice(0, 3), [items]);
  const slots = useMemo(
    () =>
      [
        podium[1]
          ? {
            accent: "text-zinc-600 dark:text-zinc-200",
            textSize: "text-xs",
            barClassName: "h-25 text-md bg-gradient-to-t from-zinc-400 to-zinc-100 dark:from-zinc-500 dark:to-zinc-300",
            item: podium[1],
            label: "Runner-up",
            orderClassName: "order-2 md:order-1",
            ringClassName: "ring-zinc-300/80 dark:ring-zinc-500/70",
          }
          : null,
        podium[0]
          ? {
            accent: "text-amber-700 dark:text-amber-200",
            textSize: "text-sm",
            barClassName: "h-30 text-xl bg-gradient-to-t from-amber-500 to-yellow-200 dark:from-amber-600 dark:to-yellow-300",
            item: podium[0],
            label: "Winner",
            orderClassName: "order-1 md:order-2",
            ringClassName: "ring-amber-300/90 dark:ring-amber-400/80",
          }
          : null,
        podium[2]
          ? {
            accent: "text-orange-700 dark:text-orange-200",
            textSize: "text-xs",
            barClassName: "h-22 text-sm bg-gradient-to-t from-orange-700 to-orange-200 dark:from-orange-700 dark:to-orange-300",
            item: podium[2],
            label: "2nd runner-up",
            orderClassName: "order-3 md:order-3",
            ringClassName: "ring-orange-300/80 dark:ring-orange-500/70",
          }
          : null,
      ].filter((slot): slot is PodiumSlot => slot !== null),
    [podium],
  );

  const applyFlagColors = useCallback(() => {
    if (!finalWinner?.flagUrl || !fwRef.current) return;
    const hues = extractFlagHues(finalWinner.flagUrl);
    const hueRange = huesToMinMax(hues);
    fwRef.current.updateOptions({
      hue: hueRange,
    });
  }, [finalWinner?.flagUrl]);

  useEffect(() => {
    if (!finalWinner) return;

    const timer = setInterval(() => {
      applyFlagColors();
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [applyFlagColors, finalWinner]);

  if (!finalWinner || podium.length === 0) {
    return null;
  }

  return (
    <section className="relative isolate overflow-hidden rounded-md border border-amber-200 px-4 py-5 shadow-sm dark:border-zinc-700 md:px-5 bg-[linear-gradient(135deg,rgba(254,243,199,0.85),rgba(236,253,245,0.72),rgba(239,246,255,0.78))] dark:bg-[linear-gradient(135deg,rgba(41,25,7,0.72),rgba(6,48,42,0.56),rgba(17,24,39,0.92))]">
      {/* Container-scoped Fireworks */}
      <Fireworks
        ref={fwRef}
        options={{
          acceleration: 1.05,
          friction: 0.97,
          gravity: 1.5,
          particles: 50, // fewer particles since it's constrained to a card container
          explosion: 5,
          flickering: 30,
          traceLength: 2,
          traceSpeed: 8,
          lineWidth: {
            explosion: { min: 1, max: 2 },
            trace: { min: 0.1, max: 0.8 },
          },
          lineStyle: "round",
          brightness: { min: 50, max: 80 },
          decay: { min: 0.015, max: 0.03 },
          rocketsPoint: { min: 20, max: 80 },
          delay: { min: 60, max: 120 },
          intensity: 15,
          hue: { min: 0, max: 360 },
          opacity: 0.45,
          autoresize: true,
          mouse: { click: false, move: false, max: 1 },
        }}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          background: "transparent",
        }}
      />

      {/* <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-200">
            Final Standings
          </p>
          <h2 className="mt-1 text-lg font-bold tracking-normal text-zinc-950 dark:text-white">
            Leaderboard Champions
          </h2>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/70 bg-white/75 px-3 py-2 text-sm font-semibold text-zinc-800 shadow-sm backdrop-blur dark:border-white/15 dark:bg-white/10 dark:text-white">
          World Champion:<Image
            alt={`${finalWinner.name} flag`}
            className="h-5 w-8 rounded-sm border border-zinc-200 object-cover dark:border-white/20"
            height={22}
            src={finalWinner.flagUrl}
            width={32}
          />
          {finalWinner.name}
        </div>
      </div> */}

      <div className="relative -z-1 grid gap-3 md:grid-cols-3 md:items-end">
        {slots.map((slot) => (
          <article
            key={slot.item.user_id}
            className={[
              "leaderboard-podium-card rounded-md border border-white/70 bg-white/88 px-3 py-2 shadow-sm ring-2 backdrop-blur dark:border-white/10 dark:bg-zinc-950/70",
              slot.orderClassName,
              slot.ringClassName,
              slot.barClassName
            ].join(" ")}
          >
            <div className="flex items-center justify-between gap-3">
              <span className={`inline-flex h-${9 - slot.item.rank} w-${9 - slot.item.rank} items-center justify-center rounded-full bg-zinc-950 text-sm font-bold text-white dark:bg-white dark:text-zinc-950`}>
                {slot.item.rank}
              </span>
              <span className={`${slot.textSize} font-semibold uppercase tracking-[0.16em] ${slot.accent}`}>
                {slot.label}
              </span>
            </div>
            <p className="flex items-center justify-center mt-1 truncate font-bold tracking-normal text-zinc-950 dark:text-white">
              {slot.item.name}
            </p>
            <p className="flex items-center justify-center mt-1 font-semibold text-zinc-500 dark:text-zinc-400">
              {slot.item.total_points} pts
            </p>
          </article>
        ))}
      </div>
    </section>
  );
};

