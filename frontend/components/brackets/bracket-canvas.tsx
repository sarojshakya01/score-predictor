"use client";

import {
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Modal } from "@/components/ui/modal";
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

const CANVAS_PADDING_X = 14;
const CANVAS_PADDING_TOP = 60;
const CANVAS_PADDING_BOTTOM = 28;
const CARD_WIDTH = 114;
const CARD_HEIGHT = 60;
const COLUMN_GAP = 20;
const SLOT_PITCH = CARD_HEIGHT + 32;
const CARD_RADIUS = 8;
const SPLIT_STAGE_COUNT = 4;
const CENTER_COLUMN_INDEX = SPLIT_STAGE_COUNT;
const BRACKET_COLUMN_COUNT = SPLIT_STAGE_COUNT * 2 + 1;
const CENTER_MATCH_VERTICAL_OFFSET = CARD_HEIGHT + 48;

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
  const sortOrderMatchId = matches.length === 16 ? [75, 78, 73, 76, 84, 83, 82, 81, 74, 77, 79, 80, 87, 86, 85, 88] : matches.length === 8 ? [90, 89, 92, 91, 93, 94, 95, 96] : matches.length === 4 ? [97, 98, 99, 100] : matches.length === 2 ? [102, 101] : [];
  const orderMap = new Map(
    sortOrderMatchId.map((id, index) => [id, index])
  );
  const sortedMatches = [...matches].sort((a, b) => {
    const aOrder = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bOrder = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;

    return aOrder - bOrder;
  });

  return sortedMatches;
};

const fetchStageMatches = async (config: StageConfig): Promise<Pick<BracketRound, "matches" | "queryStage">> => {
  const primaryResponse = await listMatches({ limit: 64, matchStage: config.queryStage });
  if (primaryResponse.items.length > 0) return { matches: sortMatches(primaryResponse.items), queryStage: config.queryStage };
  return { matches: [], queryStage: config.queryStage };
};

const getFirstRoundSlotCount = (rounds: BracketRound[]): number => {
  return rounds.slice(0, SPLIT_STAGE_COUNT).reduce((maximum, round, roundIndex) => {
    const slotCount = Math.max(round.config.expectedMatches, round.matches.length);
    return Math.max(maximum, slotCount * 2 ** roundIndex);
  }, STAGES[0].expectedMatches);
};

const getColumnX = (columnIndex: number): number => {
  return CANVAS_PADDING_X + columnIndex * (CARD_WIDTH + COLUMN_GAP);
};

const getSplitRoundColumnIndex = (roundIndex: number, isRightSide: boolean): number => {
  return isRightSide ? BRACKET_COLUMN_COUNT - 1 - roundIndex : roundIndex;
};

const getSideSlotCenterY = (slotIndex: number, slotCount: number, firstRoundSideSlotCount: number): number => {
  const slotSpan = firstRoundSideSlotCount / slotCount;
  const centerSlot = (slotIndex + 0.5) * slotSpan - 0.5;
  return CANVAS_PADDING_TOP + centerSlot * SLOT_PITCH + SLOT_PITCH / 2;
};

const getSlotCenterY = (slot: BracketSlot): number => slot.y + slot.height / 2;

const getSlotEdgeX = (slot: BracketSlot, side: "left" | "right"): number => {
  return side === "left" ? slot.x : slot.x + slot.width;
};

const addConnector = (
  connectors: Connector[],
  startSlot: BracketSlot,
  endSlot: BracketSlot,
  direction: "left" | "right",
): void => {
  const startX = getSlotEdgeX(startSlot, direction === "right" ? "right" : "left");
  const endX = getSlotEdgeX(endSlot, direction === "right" ? "left" : "right");
  connectors.push({
    endX,
    endY: getSlotCenterY(endSlot),
    midX: startX + (endX - startX) / 2,
    startX,
    startY: getSlotCenterY(startSlot),
  });
};

const createBracketLayout = (rounds: BracketRound[]): BracketLayout => {
  const firstRoundSlotCount = getFirstRoundSlotCount(rounds);
  const firstRoundSideSlotCount = Math.ceil(firstRoundSlotCount / 2);
  const centerX = getColumnX(CENTER_COLUMN_INDEX);
  const centerY = CANVAS_PADDING_TOP + firstRoundSideSlotCount * SLOT_PITCH / 2;
  const sideHeight = CANVAS_PADDING_TOP + firstRoundSideSlotCount * SLOT_PITCH + CANVAS_PADDING_BOTTOM;
  const centerHeight = centerY + CENTER_MATCH_VERTICAL_OFFSET + CARD_HEIGHT / 2 + CANVAS_PADDING_BOTTOM;
  const width = CANVAS_PADDING_X * 2 + BRACKET_COLUMN_COUNT * CARD_WIDTH + (BRACKET_COLUMN_COUNT - 1) * COLUMN_GAP;
  const height = Math.max(sideHeight, centerHeight);

  const slotsByRound = rounds.map((round, roundIndex) => {
    const slotCount = Math.max(round.config.expectedMatches, round.matches.length);
    if (roundIndex >= SPLIT_STAGE_COUNT) {
      const centerMatchY = round.config.queryStage === "F"
        ? centerY - CENTER_MATCH_VERTICAL_OFFSET
        : centerY + CENTER_MATCH_VERTICAL_OFFSET;
      return Array.from({ length: slotCount }, (_, slotIndex) => ({
        height: CARD_HEIGHT,
        id: getSlotId(roundIndex, slotIndex),
        match: round.matches[slotIndex] ?? null,
        roundIndex,
        slotIndex,
        width: CARD_WIDTH,
        x: centerX,
        y: centerMatchY - CARD_HEIGHT / 2,
      }));
    }

    const leftSlotCount = Math.ceil(slotCount / 2);
    return Array.from({ length: slotCount }, (_, slotIndex) => {
      const isRightSide = slotIndex >= leftSlotCount;
      const sideSlotIndex = isRightSide ? slotIndex - leftSlotCount : slotIndex;
      const sideSlotCount = isRightSide ? slotCount - leftSlotCount : leftSlotCount;
      const x = getColumnX(getSplitRoundColumnIndex(roundIndex, isRightSide));
      const slotCenterY = getSideSlotCenterY(sideSlotIndex, sideSlotCount, firstRoundSideSlotCount);
      return {
        height: CARD_HEIGHT,
        id: getSlotId(roundIndex, slotIndex),
        match: round.matches[slotIndex] ?? null,
        roundIndex,
        slotIndex,
        width: CARD_WIDTH,
        x,
        y: slotCenterY - CARD_HEIGHT / 2,
      };
    });
  });

  const connectors: Connector[] = [];

  for (let roundIndex = 0; roundIndex < SPLIT_STAGE_COUNT - 1; roundIndex += 1) {
    const currentSlots = slotsByRound[roundIndex];
    const nextSlots = slotsByRound[roundIndex + 1];
    const currentLeftCount = Math.ceil(currentSlots.length / 2);
    const nextLeftCount = Math.ceil(nextSlots.length / 2);

    for (let nextIndex = 0; nextIndex < nextLeftCount; nextIndex += 1) {
      const nextSlot = nextSlots[nextIndex];
      const upperSlot = currentSlots[nextIndex * 2];
      const lowerSlot = currentSlots[nextIndex * 2 + 1];
      if (!upperSlot || !lowerSlot || !nextSlot) continue;
      addConnector(connectors, upperSlot, nextSlot, "right");
      addConnector(connectors, lowerSlot, nextSlot, "right");
    }

    const nextRightCount = nextSlots.length - nextLeftCount;
    for (let nextIndex = 0; nextIndex < nextRightCount; nextIndex += 1) {
      const nextSlot = nextSlots[nextLeftCount + nextIndex];
      const upperSlot = currentSlots[currentLeftCount + nextIndex * 2];
      const lowerSlot = currentSlots[currentLeftCount + nextIndex * 2 + 1];
      if (!upperSlot || !lowerSlot || !nextSlot) continue;
      addConnector(connectors, upperSlot, nextSlot, "left");
      addConnector(connectors, lowerSlot, nextSlot, "left");
    }
  }

  const semifinalSlots = slotsByRound[3] ?? [];
  const semifinalLeftCount = Math.ceil(semifinalSlots.length / 2);
  const leftSemifinalSlot = semifinalSlots[0];
  const rightSemifinalSlot = semifinalSlots[semifinalLeftCount];
  const thirdPlaceSlot = slotsByRound[4]?.[0];
  const finalSlot = slotsByRound[5]?.[0];

  if (leftSemifinalSlot && finalSlot) addConnector(connectors, leftSemifinalSlot, finalSlot, "right");
  if (rightSemifinalSlot && finalSlot) addConnector(connectors, rightSemifinalSlot, finalSlot, "left");
  if (leftSemifinalSlot && thirdPlaceSlot) addConnector(connectors, leftSemifinalSlot, thirdPlaceSlot, "right");
  if (rightSemifinalSlot && thirdPlaceSlot) addConnector(connectors, rightSemifinalSlot, thirdPlaceSlot, "left");

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

const getMatchStatus = (match: MatchResponse | null): { label: string; tone: PillTone } => {
  if (!match) return { label: "Pending", tone: "accent" };
  if (match.team1_score !== null && match.team2_score !== null) return { label: "Completed", tone: "secondary" };
  if (match.match_locked) return { label: "Locked", tone: "accent" };
  return { label: "Scheduled", tone: "primary" };
};

const getWinnerSide = (match: MatchResponse): "team1" | "team2" | null => {
  if (match.team1_score === null || match.team2_score === null || match.winner_id === null) return null;
  if (match.winner_id === match.team1_id) return "team1";
  if (match.winner_id === match.team2_id) return "team2";
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

const drawRoundHeader = (
  context: CanvasRenderingContext2D,
  label: string,
  loadedCount: number,
  expectedCount: number,
  x: number,
  isDark: boolean,
): void => {
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.font = "700 12px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  context.fillStyle = isDark ? "#94a3b8" : "#475569";
  context.fillText(label.toUpperCase(), x, 25);
  context.fillStyle = isDark ? "#64748b" : "#94a3b8";
  context.font = "500 11px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  context.fillText(`${loadedCount}/${expectedCount} matches`, x, 44);
};

const drawCenterLabel = (
  context: CanvasRenderingContext2D,
  label: string,
  slot: BracketSlot | undefined,
  isDark: boolean,
): void => {
  if (!slot) return;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "700 12px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  context.fillStyle = isDark ? "#94a3b8" : "#475569";
  context.fillText(label.toUpperCase(), slot.x + slot.width / 2, slot.y - 10);
  context.textAlign = "left";
};

const drawSlot = async (context: CanvasRenderingContext2D, slot: BracketSlot, selectedSlotId: string | null, hoveredSlotId: string | null, isDark: boolean): Promise<void> => {
  const match = slot.match;
  const isSelected = selectedSlotId === slot.id;
  const isHovered = hoveredSlotId === slot.id;
  const winnerSide = match ? getWinnerSide(match) : null;

  const cardBg = isDark ? ((match && !isHovered) ? "#1c1f2e" : "#0c0e14ff") : (match && !isHovered) ? "#ffffff" : "#f0f4f7ff";
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

  const flagMaxWidth = 20;
  const flagMaxHeight = 20;
  const teamTextWidth = slot.width - 62;

  if (match.team1_flag_url) {
    const flagSrc = await loadImage(match.team1_flag_url);
    if (flagSrc) {
      const scale = Math.min(flagMaxWidth / flagSrc.width, flagMaxHeight / flagSrc.height, 1);
      context.globalAlpha = winnerSide && winnerSide === "team2" ? 0.2 : 1.0;
      context.drawImage(flagSrc, slot.x + 10, slot.y + flagMaxHeight / 2, flagSrc.width * scale, flagSrc.height * scale);
      context.globalAlpha = 1;
    }

  } else {
    context.fillStyle = isDark ? "rgba(239, 223, 223, 0.15)" : "rgba(0, 0, 0, 0.15)";
    context.fillRect(slot.x + 10, slot.y + flagMaxHeight / 2, flagMaxWidth, flagMaxHeight - 6);
  }

  context.fillStyle = winnerSide === "team1" ? textPrimary : (winnerSide ? '#9d9d9d66' : textPrimary);
  context.fillText(truncateText(context, match.team1_name.length < 12 ? match.team1_name : match.team1_name_short, teamTextWidth), slot.x + flagMaxWidth + 15, slot.y + flagMaxHeight - 3);
  context.fillText(truncateText(context, match.team1_score?.toString() ?? "-", teamTextWidth), slot.x + flagMaxWidth + 10 + teamTextWidth + 15, slot.y + flagMaxHeight - 5);

  if (match.team2_flag_url) {
    const flagSrc = await loadImage(match.team2_flag_url);
    if (flagSrc) {
      const scale = Math.min(flagMaxWidth / flagSrc.width, flagMaxHeight / flagSrc.height, 1);
      context.globalAlpha = winnerSide && winnerSide === "team1" ? 0.2 : 1.0;
      context.drawImage(flagSrc, slot.x + 10, slot.y + 1.5 * flagMaxHeight + 5, flagSrc.width * scale, flagSrc.height * scale);
      context.globalAlpha = 1;
    }
  } else {
    context.fillStyle = isDark ? "rgba(239, 223, 223, 0.15)" : "rgba(0, 0, 0, 0.15)";
    context.fillRect(slot.x + 10, slot.y + 1.5 * flagMaxHeight + 5, flagMaxWidth, flagMaxHeight - 6);
  }

  context.fillStyle = winnerSide === "team2" ? textPrimary : (winnerSide ? '#9d9d9d66' : textPrimary);
  context.fillText(truncateText(context, match.team2_name.length < 12 ? match.team2_name : match.team2_name_short, teamTextWidth), slot.x + flagMaxWidth + 15, slot.y + 2 * flagMaxHeight + 2);
  context.fillText(match.team2_score?.toString() ?? "-", slot.x + flagMaxWidth + 10 + teamTextWidth + 15, slot.y + 2 * flagMaxHeight + 2);

  context.font = "500 10px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  context.fillStyle = textMuted;
  context.fillText(truncateText(context, formatDateTime(match.match_datetime), 90), slot.x + (CARD_WIDTH - 90) / 2, slot.y + 2 * flagMaxHeight + 30);

  if (match.match_stage === "F") {
    const trophySrc = await loadImage("/images/trophy.png");
    if (trophySrc) {
      const scale = Math.min(150 / trophySrc.width, 150 / trophySrc.height, 1);
      context.drawImage(trophySrc, slot.x + (CARD_WIDTH - 75) / 2, slot.y - 2.5 * CARD_HEIGHT, trophySrc.width * scale, trophySrc.height * scale);
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

  for (let roundIndex = 0; roundIndex < SPLIT_STAGE_COUNT; roundIndex += 1) {
    const stage = STAGES[roundIndex];
    const loadedCount = rounds[roundIndex]?.matches.length ?? 0;
    const leftExpectedCount = Math.ceil(stage.expectedMatches / 2);
    const rightExpectedCount = stage.expectedMatches - leftExpectedCount;
    const leftLoadedCount = Math.min(loadedCount, leftExpectedCount);
    const rightLoadedCount = Math.max(0, loadedCount - leftExpectedCount);

    drawRoundHeader(
      context,
      stage.label,
      leftLoadedCount,
      leftExpectedCount,
      getColumnX(getSplitRoundColumnIndex(roundIndex, false)),
      isDark,
    );
    drawRoundHeader(
      context,
      stage.label,
      rightLoadedCount,
      rightExpectedCount,
      getColumnX(getSplitRoundColumnIndex(roundIndex, true)),
      isDark,
    );
  }
  drawCenterLabel(context, "Final", layout.slotsByRound[5]?.[0], isDark);
  drawCenterLabel(context, "3rd Place", layout.slotsByRound[4]?.[0], isDark);

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

const MatchDetailPanel = ({
  match,
  round,
}: {
  match: MatchResponse | null;
  round: BracketRound | null;
}) => {
  const status = getMatchStatus(match);

  if (!match) {
    return (
      <div className="rounded-md bg-zinc-50 px-3 py-8 text-center text-sm text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
        No knockout match selected.
      </div>
    );
  }

  const team1Score = match.team1_score ?? "-";
  const team2Score = match.team2_score ?? "-";
  const team1Won = (match.team1_score ?? 0) > (match.team2_score ?? 0);
  const team2Won = (match.team2_score ?? 0) > (match.team1_score ?? 0);

  return (
    <div className="grid gap-4 text-sm">
      <div className="flex justify-between items-center">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
          {round?.config.label ?? "Knockout"}
        </p>
        <StatusPill tone={status.tone}>{status.label}</StatusPill>
      </div>
      <div className="flex items-center justify-center">
        <div className="flex">{getMatchLabelWithFlag(match, "w-auto")}</div>
      </div>
      <div className="flex items-center justify-center">
        <p className="mt-1 text-zinc-500 dark:text-zinc-400">{formatDateTime(match.match_datetime)}</p>
      </div>
      <div className="flex gap-3 items-center justify-between">
        <div className="rounded-md bg-zinc-50 px-3 py-2 dark:bg-zinc-800 w-[33%]">
          <div className="flex justify-center text-xs font-medium text-zinc-500 dark:text-zinc-400">Score</div>
          <div className="flex justify-center mt-1 font-semibold text-zinc-950 dark:text-zinc-50 flex">
            <StatusPill tone={team1Won ? "green" : "zinc"}>{team1Score}</StatusPill>
            <span className="mx-2">vs</span>
            <StatusPill tone={team2Won ? "green" : "zinc"}>{team2Score}</StatusPill>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center rounded-md bg-zinc-50 px-3 py-2 dark:bg-zinc-800 w-[33%]">
          <div className="flex justify-center text-xs font-medium text-zinc-500 dark:text-zinc-400">Venue</div>
          <div className="flex justify-center my-4">{MatchVenue(match)}</div>
        </div>
        <div className="flex flex-col items-center justify-center rounded-md bg-zinc-50 px-3 py-2 dark:bg-zinc-800 w-[33%]">
          <div className="flex justify-center text-xs font-medium text-zinc-500 dark:text-zinc-400">Match day</div>
          <div className="flex justify-center mt-1 font-semibold text-zinc-950 dark:text-zinc-50">{match.match_day}</div>
        </div>
      </div>
    </div>
  );
};

export const BracketCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const layoutRef = useRef<BracketLayout | null>(null);
  const [hoveredSlotId, setHoveredSlotId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
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
        return null;
      });
    } catch (error) {
      setLoadError(getErrorMessage(error, "Unable to load bracket matches."));
      setRounds(emptyRounds());
      setSelectedSlotId(null);
      setIsDetailOpen(false);
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
    if (slot) {
      setSelectedSlotId(slot.id);
      setIsDetailOpen(true);
    }
  };

  return (
    <div className="grid gap-4">
      {loadError ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-300">
          {loadError}
        </div>
      ) : null}

      {isLoading && (
        <section className="grid gap-4">
          <div className="h-[1080px] animate-pulse rounded-md px-5 py-4 border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800" />
        </section>
      )}

      <section className="grid gap-4">
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
      </section>

      <Modal isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} title="Match Detail">
        <MatchDetailPanel match={selectedMatch} round={selectedRound} />
      </Modal>
    </div>
  );
};
