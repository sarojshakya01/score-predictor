"use client";

import {
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { PillTone, StatusPill } from "@/components/ui/status-pill";
import { getErrorMessage } from "@/lib/forms/error-message";
import { listMatches } from "@/lib/matches";
import type { MatchResponse } from "@/lib/matches";
import { formatDateTime, getMatchLabelWithFlag, MatchVenue } from "../ui/match-card";

type StageConfig = { expectedMatches: number; label: string; queryStage: string };
type BracketRound = { config: StageConfig; matches: MatchResponse[]; queryStage: string };
type BracketSlot = { height: number; id: string; match: MatchResponse | null; roundIndex: number; slotIndex: number; width: number; x: number; y: number };
type Connector = { endX: number; endY: number; midX: number; startX: number; startY: number };
type BracketLayout = { connectors: Connector[]; height: number; slots: BracketSlot[]; slotsByRound: BracketSlot[][]; width: number };

const STAGES: StageConfig[] = [
  { expectedMatches: 16, label: "Round of 32", queryStage: "R32" },
  { expectedMatches: 8, label: "Round of 16", queryStage: "R16" },
  { expectedMatches: 4, label: "Quarterfinals", queryStage: "QF" },
  { expectedMatches: 2, label: "Semifinals", queryStage: "SF" },
  { expectedMatches: 1, label: "3rd Place", queryStage: "3P" },
  { expectedMatches: 1, label: "Final", queryStage: "F" },
];

const CANVAS_PADDING_X = 32;
const CANVAS_PADDING_TOP = 82;
const CANVAS_PADDING_BOTTOM = 54;
const CARD_WIDTH = 170;
const CARD_HEIGHT = 90;
const COLUMN_GAP = 78;
const SLOT_PITCH = 50;
const CARD_RADIUS = 8;

const imageCache = new Map<string, Promise<HTMLImageElement | null>>();

const loadImage = (url: string): Promise<HTMLImageElement | null> => {
  if (!url) return Promise.resolve(null);
  const cached = imageCache.get(url);
  if (cached) return cached;
  const promise = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
  imageCache.set(url, promise);
  return promise;
};

const emptyRounds = (): BracketRound[] => STAGES.map((config) => ({ config, matches: [], queryStage: config.queryStage }));
const getSlotId = (roundIndex: number, slotIndex: number): string => `${roundIndex}:${slotIndex}`;

const sortMatches = (matches: MatchResponse[]): MatchResponse[] => {
  return [...matches].sort((left, right) => {
    const leftTime = new Date(`${left.match_datetime}Z`).getTime();
    const rightTime = new Date(`${right.match_datetime}Z`).getTime();
    if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) return leftTime - rightTime || left.id - right.id;
    return left.id - right.id;
  });
};

const fetchStageMatches = async (config: StageConfig): Promise<Pick<BracketRound, "matches" | "queryStage">> => {
  const primaryResponse = await listMatches({ limit: 64, matchStage: config.queryStage });
  if (primaryResponse.items.length > 0) return { matches: sortMatches(primaryResponse.items), queryStage: config.queryStage };
  return { matches: [], queryStage: config.queryStage };
};

const getFirstRoundSlotCount = (rounds: BracketRound[]): number => {
  return rounds.reduce((maximum, round, roundIndex) => {
    const slotCount = Math.max(round.config.expectedMatches, round.matches.length);
    return Math.max(maximum, slotCount * 2 ** roundIndex);
  }, STAGES[0].expectedMatches);
};

const createBracketLayout = (rounds: BracketRound[]): BracketLayout => {
  const firstRoundSlotCount = getFirstRoundSlotCount(rounds);
  const width = CANVAS_PADDING_X * 2 + STAGES.length * CARD_WIDTH + (STAGES.length - 1) * COLUMN_GAP;
  const height = CANVAS_PADDING_TOP + firstRoundSlotCount * SLOT_PITCH + CANVAS_PADDING_BOTTOM;

  const slotsByRound = rounds.map((round, roundIndex) => {
    const slotCount = Math.max(round.config.expectedMatches, round.matches.length);
    const slotSpan = firstRoundSlotCount / slotCount;
    const x = CANVAS_PADDING_X + roundIndex * (CARD_WIDTH + COLUMN_GAP);
    return Array.from({ length: slotCount }, (_, slotIndex) => {
      const centerSlot = (slotIndex + 0.5) * slotSpan - 0.5;
      const centerY = CANVAS_PADDING_TOP + centerSlot * SLOT_PITCH + SLOT_PITCH / 2;
      return { height: CARD_HEIGHT, id: getSlotId(roundIndex, slotIndex), match: round.matches[slotIndex] ?? null, roundIndex, slotIndex, width: CARD_WIDTH, x, y: centerY - CARD_HEIGHT / 2 };
    });
  });

  const connectors: Connector[] = [];
  let semifinalSlots: BracketSlot[] = [];
  let thirdPlaceSlot: BracketSlot = {} as BracketSlot;
  let finalSlot: BracketSlot = {} as BracketSlot;

  for (const slots of slotsByRound) {
    if (slots.some((slot) => slot.match?.match_stage === 'SF')) semifinalSlots = slots;
    if (slots.some((slot) => slot.match?.match_stage === '3P')) thirdPlaceSlot = slots[0];
    if (slots.some((slot) => slot.match?.match_stage === 'F')) finalSlot = slots[0];
  }

  if (semifinalSlots?.length === 2 && Object.keys(thirdPlaceSlot).length && Object.keys(finalSlot).length) {
    const startX = semifinalSlots[0].x + semifinalSlots[0].width;
    const midX = startX + COLUMN_GAP / 2;
    connectors.push({ startX, startY: semifinalSlots[0].y + semifinalSlots[0].height / 2, midX, endX: finalSlot.x - CARD_WIDTH - COLUMN_GAP, endY: (semifinalSlots[0].y + semifinalSlots[1].y) / 2 - semifinalSlots[0].height });
    if (semifinalSlots?.length === 2 && thirdPlaceSlot && finalSlot) {
      finalSlot.y = (semifinalSlots[0].y + semifinalSlots[1].y) / 2 - 3 / 2 * semifinalSlots[0].height;
      finalSlot.x = thirdPlaceSlot.x;
      thirdPlaceSlot.y = semifinalSlots[1].y - (semifinalSlots[1].y - semifinalSlots[0].y) / 3;
    }
  }

  for (let roundIndex = 0; roundIndex < slotsByRound.length - 2; roundIndex += 1) {
    const currentSlots = slotsByRound[roundIndex];
    const nextSlots = slotsByRound[roundIndex + 1];
    nextSlots.forEach((nextSlot, nextIndex) => {
      const upperSlot = currentSlots[nextIndex * 2];
      const lowerSlot = currentSlots[nextIndex * 2 + 1];
      if (!upperSlot || !lowerSlot) return;
      const startX = upperSlot.x + upperSlot.width;
      const midX = startX + COLUMN_GAP / 2;
      const endX = nextSlot.x;
      const endY = nextSlot.y + nextSlot.height / 2;
      connectors.push({ endX, endY, midX, startX, startY: upperSlot.y + upperSlot.height / 2 });
      connectors.push({ endX, endY, midX, startX, startY: lowerSlot.y + lowerSlot.height / 2 });
    });
  }

  const flatSlots = slotsByRound.flat().filter((slot) => slot.match);
  return { connectors, height, slots: flatSlots, slotsByRound, width };
};

const findSlot = (rounds: BracketRound[], slotId: string | null): BracketSlot | null => {
  if (!slotId) return null;
  const [roundIndexValue, slotIndexValue] = slotId.split(":");
  const roundIndex = Number(roundIndexValue);
  const slotIndex = Number(slotIndexValue);
  if (!Number.isInteger(roundIndex) || !Number.isInteger(slotIndex)) return null;
  const round = rounds[roundIndex];
  if (!round) return null;
  return { height: CARD_HEIGHT, id: slotId, match: round.matches[slotIndex] ?? null, roundIndex, slotIndex, width: CARD_WIDTH, x: 0, y: 0 };
};

const findFirstMatchSlotId = (rounds: BracketRound[]): string | null => {
  for (let roundIndex = 0; roundIndex < rounds.length; roundIndex += 1) {
    const slotIndex = rounds[roundIndex].matches.findIndex(Boolean);
    if (slotIndex !== -1) return getSlotId(roundIndex, slotIndex);
  }
  return null;
};

const getMatchStatus = (match: MatchResponse | null): { label: string; tone: PillTone } => {
  if (!match) return { label: "Pending", tone: "accent" };
  if (match.team1_score !== null && match.team2_score !== null) return { label: "Completed", tone: "secondary" };
  if (match.match_locked) return { label: "Locked", tone: "accent" };
  return { label: "Scheduled", tone: "primary" };
};

const getWinnerSide = (match: MatchResponse): "team1" | "team2" | null => {
  if (match.team1_score === null || match.team2_score === null) return null;
  if (match.team1_score > match.team2_score) return "team1";
  if (match.team2_score > match.team1_score) return "team2";
  return null;
};

const truncateText = (context: CanvasRenderingContext2D, text: string, maxWidth: number): string => {
  if (context.measureText(text).width <= maxWidth) return text;
  let nextText = text;
  while (nextText.length > 1 && context.measureText(`${nextText}...`).width > maxWidth) nextText = nextText.slice(0, -1);
  return `${nextText}...`;
};

const drawRoundedRectangle = (context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void => {
  const nextRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + nextRadius, y);
  context.lineTo(x + width - nextRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + nextRadius);
  context.lineTo(x + width, y + height - nextRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - nextRadius, y + height);
  context.lineTo(x + nextRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - nextRadius);
  context.lineTo(x, y + nextRadius);
  context.quadraticCurveTo(x, y, x + nextRadius, y);
  context.closePath();
};

const drawConnector = (context: CanvasRenderingContext2D, connector: Connector): void => {
  context.beginPath();
  context.moveTo(connector.startX, connector.startY);
  context.lineTo(connector.midX, connector.startY);
  context.lineTo(connector.midX, connector.endY);
  context.lineTo(connector.endX, connector.endY);
  context.stroke();
};

const drawSlot = async (context: CanvasRenderingContext2D, slot: BracketSlot, selectedSlotId: string | null, hoveredSlotId: string | null, isDark: boolean): Promise<void> => {
  const match = slot.match;
  const isSelected = selectedSlotId === slot.id;
  const isHovered = hoveredSlotId === slot.id;
  const winnerSide = match ? getWinnerSide(match) : null;

  const cardBg = isDark ? (match ? "#1c1f2e" : "#151721") : (match ? "#ffffff" : "#f8fafc");
  const borderColor = isSelected ? "#047857" : isHovered ? "#d97706" : (isDark ? "#3f3f46" : "#d4d4d8");
  const textPrimary = isDark ? "#f4f4f5" : "#18181b";
  const textMuted = isDark ? "#a1a1aa" : "#71717a";
  const textSection = isDark ? "#94a3b8" : "#475569";

  context.save();
  context.shadowColor = isDark ? "rgba(0,0,0,0.4)" : "rgba(15, 23, 42, 0.08)";
  context.shadowBlur = isHovered || isSelected ? 12 : 6;
  context.shadowOffsetY = isHovered || isSelected ? 5 : 2;
  drawRoundedRectangle(context, slot.x, slot.y, slot.width, slot.height, CARD_RADIUS);
  context.fillStyle = cardBg;
  context.fill();
  context.restore();

  drawRoundedRectangle(context, slot.x, slot.y, slot.width, slot.height, CARD_RADIUS);
  context.strokeStyle = borderColor;
  context.lineWidth = isSelected ? 1.5 : 1;
  context.stroke();

  context.fillStyle = isSelected ? "#047857" : textSection;
  context.font = "600 13px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  context.textBaseline = "middle";

  if (!match) {
    context.fillStyle = textMuted;
    context.fillText("TBD", slot.x + 14, slot.y + 27);
    context.fillText("TBD", slot.x + 14, slot.y + 50);
    context.font = "500 11px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    return;
  }

  const flagMaxWidth = 26;
  const flagMaxHeight = 26;
  const teamTextWidth = slot.width - 72;

  if (match.team1_flag_url) {
    const flagSrc = await loadImage(match.team1_flag_url);
    if (flagSrc) {
      const scale = Math.min(flagMaxWidth / flagSrc.width, flagMaxHeight / flagSrc.height, 1);
      context.drawImage(flagSrc, slot.x + 10, slot.y + flagMaxHeight / 2, flagSrc.width * scale, flagSrc.height * scale);
    }
  }

  context.fillStyle = winnerSide === "team1" ? "#047857" : textPrimary;
  context.fillText(truncateText(context, match.team1_name.length < 12 ? match.team1_name : match.team1_name_short, teamTextWidth), slot.x + flagMaxWidth + 15, slot.y + flagMaxHeight - 3);
  context.fillText(truncateText(context, match.team1_score?.toString() ?? "-", teamTextWidth), slot.x + flagMaxWidth + 10 + teamTextWidth + 15, slot.y + flagMaxHeight);

  if (match.team2_flag_url) {
    const flagSrc = await loadImage(match.team2_flag_url);
    if (flagSrc) {
      const scale = Math.min(flagMaxWidth / flagSrc.width, flagMaxHeight / flagSrc.height, 1);
      context.drawImage(flagSrc, slot.x + 10, slot.y + 1.5 * flagMaxHeight + 5, flagSrc.width * scale, flagSrc.height * scale);
    }
  }

  context.fillStyle = winnerSide === "team2" ? "#047857" : textPrimary;
  context.fillText(truncateText(context, match.team2_name.length < 12 ? match.team2_name : match.team2_name_short, teamTextWidth), slot.x + flagMaxWidth + 15, slot.y + 2 * flagMaxHeight + 2);
  context.fillText(match.team2_score?.toString() ?? "-", slot.x + flagMaxWidth + 10 + teamTextWidth + 15, slot.y + 2 * flagMaxHeight + 5);

  context.font = "500 10px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  context.fillStyle = textMuted;
  context.fillText(truncateText(context, formatDateTime(match.match_datetime), teamTextWidth), slot.x + flagMaxWidth + 15, slot.y + 2 * flagMaxHeight + 22);

  if (match.match_stage === "F") {
    const trophySrc = await loadImage("/images/trophy.png");
    if (trophySrc) {
      const scale = Math.min(150 / trophySrc.width, 150 / trophySrc.height, 1);
      context.drawImage(trophySrc, slot.x + 0.5 * CARD_WIDTH, slot.y - 0.5 * CARD_HEIGHT + 3, trophySrc.width * scale, trophySrc.height * scale);
    }
  }
};

const drawBracket = async (canvas: HTMLCanvasElement, rounds: BracketRound[], selectedSlotId: string | null, hoveredSlotId: string | null, isDark: boolean): Promise<BracketLayout | null> => {
  const context = canvas.getContext("2d");
  if (!context) return null;

  const layout = createBracketLayout(rounds);
  const ratio = window.devicePixelRatio || 1;

  canvas.width = layout.width * ratio;
  canvas.height = layout.height * ratio;
  canvas.style.width = `${layout.width}px`;
  canvas.style.height = `${layout.height}px`;

  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, layout.width, layout.height);
  context.fillStyle = isDark ? "#0f1117" : "#f8fafc";
  context.fillRect(0, 0, layout.width, layout.height);

  context.strokeStyle = isDark ? "#3f3f46" : "#cbd5e1";
  context.lineWidth = 2;
  layout.connectors.forEach((connector) => drawConnector(context, connector));

  context.textBaseline = "middle";
  context.font = "700 12px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  context.fillStyle = isDark ? "#94a3b8" : "#475569";
  STAGES.forEach((stage, roundIndex) => {
    let loadedCount = rounds[roundIndex]?.matches.length ?? 0;
    if (stage.queryStage === 'F') return;
    if (stage.queryStage === '3P') { stage.label = "3rd Place & Final"; stage.expectedMatches = 2; loadedCount = 2; }
    const x = CANVAS_PADDING_X + roundIndex * (CARD_WIDTH + COLUMN_GAP);
    context.fillText(stage.label.toUpperCase(), x, 34);
    context.fillStyle = isDark ? "#64748b" : "#94a3b8";
    context.font = "500 11px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    context.fillText(`${loadedCount}/${stage.expectedMatches} matches`, x, 54);
    context.font = "700 12px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    context.fillStyle = isDark ? "#94a3b8" : "#475569";
  });

  for (const slot of layout.slots) {
    await drawSlot(context, slot, selectedSlotId, hoveredSlotId, isDark);
  }

  return layout;
};

const getCanvasPoint = (canvas: HTMLCanvasElement, event: PointerEvent<HTMLCanvasElement>): { x: number; y: number } => {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
};

const hitTestSlot = (slots: BracketSlot[], point: { x: number; y: number }): BracketSlot | null => {
  return slots.find((slot) => point.x >= slot.x && point.x <= slot.x + slot.width && point.y >= slot.y && point.y <= slot.y + slot.height) ?? null;
};

export const BracketCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const layoutRef = useRef<BracketLayout | null>(null);
  const [hoveredSlotId, setHoveredSlotId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rounds, setRounds] = useState<BracketRound[]>(emptyRounds);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);

  // Detect dark mode from the html element class
  useEffect(() => {
    const update = () => setIsDark(document.documentElement.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const loadBracket = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const nextRounds = await Promise.all(
        STAGES.map(async (config) => {
          const stageMatches = await fetchStageMatches(config);
          return { config, matches: stageMatches.matches, queryStage: stageMatches.queryStage };
        }),
      );
      setRounds(nextRounds);
      setSelectedSlotId((currentSlotId) => {
        if (findSlot(nextRounds, currentSlotId)) return currentSlotId;
        return findFirstMatchSlotId(nextRounds);
      });
    } catch (error) {
      setLoadError(getErrorMessage(error, "Unable to load bracket matches."));
      setRounds(emptyRounds());
      setSelectedSlotId(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void loadBracket(); }, 0);
    return () => { window.clearTimeout(timeoutId); };
  }, [loadBracket]);

  useEffect(() => {
    (async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      layoutRef.current = await drawBracket(canvas, rounds, selectedSlotId, hoveredSlotId, isDark);
    })();
  }, [hoveredSlotId, rounds, selectedSlotId, isDark]);

  const selectedSlot = useMemo(() => findSlot(rounds, selectedSlotId), [rounds, selectedSlotId]);
  const selectedMatch = selectedSlot?.match ?? null;
  const selectedRound = selectedSlot !== null ? rounds[selectedSlot.roundIndex] : null;
  const selectedStatus = getMatchStatus(selectedMatch);

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const layout = layoutRef.current;
    if (!canvas || !layout) return;
    const slot = hitTestSlot(layout.slots, getCanvasPoint(canvas, event));
    setHoveredSlotId(slot?.id ?? null);
    canvas.style.cursor = slot ? "pointer" : "default";
  };

  const handlePointerLeave = () => {
    setHoveredSlotId(null);
    if (canvasRef.current) canvasRef.current.style.cursor = "default";
  };

  const handleCanvasClick = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const layout = layoutRef.current;
    if (!canvas || !layout) return;
    const slot = hitTestSlot(layout.slots, getCanvasPoint(canvas, event));
    if (slot) setSelectedSlotId(slot.id);
  };

  return (
    <div className="grid gap-4">
      {loadError ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-300">
          {loadError}
        </div>
      ) : null}

      {isLoading && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300">
          Loading bracket matches...
        </div>
      )}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="overflow-auto rounded-md border border-zinc-200 bg-slate-50 shadow-sm dark:border-zinc-700 dark:bg-zinc-950">
          <canvas
            ref={canvasRef}
            aria-label="Interactive knockout bracket chart"
            role="img"
            onClick={handleCanvasClick}
            onPointerLeave={handlePointerLeave}
            onPointerMove={handlePointerMove}
          />
        </div>

        <aside className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Match Detail</h2>
            <StatusPill tone={selectedStatus.tone}>{selectedStatus.label}</StatusPill>
          </div>

          {selectedMatch ? (
            <div className="mt-5 grid gap-4 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
                  {selectedRound?.config.label ?? "Knockout"}
                </p>
                <div className="flex my-4">{getMatchLabelWithFlag(selectedMatch, "w-auto")}</div>
                <p className="mt-1 text-zinc-500 dark:text-zinc-400">{formatDateTime(selectedMatch.match_datetime)}</p>
              </div>
              <dl className="grid gap-3">
                <div className="rounded-md bg-zinc-50 px-3 py-2 dark:bg-zinc-800">
                  <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Score</dt>
                  <dd className="mt-1 font-semibold text-zinc-950 dark:text-zinc-50 flex">
                    {StatusPill({ children: selectedMatch.team1_score || "-", tone: (selectedMatch?.team1_score || 0) > (selectedMatch?.team2_score || 0) ? "green" : "zinc" })}
                    <span className="mx-2">vs</span>
                    {StatusPill({ children: selectedMatch.team2_score || "-", tone: (selectedMatch?.team2_score || 0) > (selectedMatch?.team1_score || 0) ? "green" : "zinc" })}
                  </dd>
                </div>
                <div className="rounded-md bg-zinc-50 px-3 py-2 dark:bg-zinc-800">
                  <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Venue</dt>
                  <div className="flex w-[30%] my-4">{MatchVenue(selectedMatch)}</div>
                </div>
                <div className="rounded-md bg-zinc-50 px-3 py-2 dark:bg-zinc-800">
                  <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Match day</dt>
                  <dd className="mt-1 font-semibold text-zinc-950 dark:text-zinc-50">{selectedMatch.match_day}</dd>
                </div>
              </dl>
            </div>
          ) : (
            <div className="mt-5 rounded-md bg-zinc-50 px-3 py-8 text-center text-sm text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              No knockout match selected.
            </div>
          )}
        </aside>
      </section>
    </div>
  );
};
