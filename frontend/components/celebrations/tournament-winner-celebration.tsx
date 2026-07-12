"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useCallback, useState } from "react";
import type { FireworksHandlers } from "@fireworks-js/react";

import { useFinalMatchWinner } from "@/components/celebrations/use-final-match-winner";

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

const Fireworks = dynamic(
  () => import("@fireworks-js/react").then((m) => m.Fireworks),
  { ssr: false },
);

type TournamentWinnerCelebrationProps = {
  className?: string;
};

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
    const data = COUNTRY_COLORS.find((cc) => cc.country === flagUrl.split("/").pop()) || { colors: [] };
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
  if (sorted.length === 1) {
    return { min: sorted[0], max: sorted[0] };
  }
  const randomIndex = Math.floor(Math.random() * sorted.length);
  return { min: sorted[randomIndex], max: sorted[randomIndex] };
}

export const TournamentWinnerCelebration = ({
  className = "",
}: TournamentWinnerCelebrationProps) => {
  const { winner } = useFinalMatchWinner();
  const fwRef = useRef<FireworksHandlers>(null);

  const [shouldRender, setShouldRender] = useState(true);
  // Controls CSS opacity class transition
  const [isFadingOut, setIsFadingOut] = useState(false);

  const applyFlagColors = useCallback(() => {
    if (!winner?.flagUrl || !fwRef.current) return;
    const hues = extractFlagHues(winner.flagUrl);
    const hueRange = huesToMinMax(hues);
    fwRef.current.updateOptions({
      hue: hueRange,
    });
  }, [winner?.flagUrl]);

  useEffect(() => {
    if (!shouldRender) return;

    const timer = setInterval(() => {
      void applyFlagColors();
    }, 1000);

    // Starts opacity fade-out at 4.5 seconds
    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, 6000);

    // Fully removes component from DOM at 5 seconds
    const stopTimer = setTimeout(() => {
      setShouldRender(false);
    }, 7000);

    return () => {
      clearInterval(timer);
      clearTimeout(fadeTimer);
      clearTimeout(stopTimer);
    };
  }, [applyFlagColors, shouldRender]);

  if (!winner || !shouldRender) return null;

  return (
    <Fireworks
      ref={fwRef}
      className={className}
      options={{
        acceleration: 1.05,
        friction: 0.97,
        gravity: 1.5,
        particles: 90,
        explosion: 6,
        flickering: 50,
        traceLength: 3,
        traceSpeed: 10,
        lineWidth: {
          explosion: { min: 1, max: 3 },
          trace: { min: 0.1, max: 1 },
        },
        lineStyle: "round",
        brightness: { min: 50, max: 80 },
        decay: { min: 0.01, max: 0.02 },
        rocketsPoint: { min: 10, max: 90 },
        delay: { min: 50, max: 100 },
        intensity: 30,
        hue: { min: 0, max: 360 },
        opacity: 0.5,
        autoresize: true,
        mouse: { click: false, move: false, max: 1 },
      }}
      style={{
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        position: "fixed",
        pointerEvents: "none",
        zIndex: 9999,
        background: "transparent",
        // CSS properties executing the transition smoothly
        transition: "opacity 500ms ease-out",
        opacity: isFadingOut ? 0 : 1,
      }}
    />
  );
};
