"use client";

import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

type TooltipSide = "top" | "bottom" | "left" | "right";

type TooltipProps = {
  children: ReactNode;
  className?: string;
  content: ReactNode;
  side?: TooltipSide;
};

const getTransform = (side: TooltipSide): string => {
  if (side === "bottom") return "translate(-50%, 0)";
  if (side === "left") return "translate(-100%, -50%)";
  if (side === "right") return "translate(0, -50%)";
  return "translate(-50%, -100%)";
};

export const Tooltip = ({
  children,
  className,
  content,
  side = "top",
}: TooltipProps) => {
  const id = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const offset = 8;

    if (side === "bottom") {
      setPosition({ left: rect.left + rect.width / 2, top: rect.bottom + offset });
      return;
    }

    if (side === "left") {
      setPosition({ left: rect.left - offset, top: rect.top + rect.height / 2 });
      return;
    }

    if (side === "right") {
      setPosition({ left: rect.right + offset, top: rect.top + rect.height / 2 });
      return;
    }

    setPosition({ left: rect.left + rect.width / 2, top: rect.top - offset });
  }, [side]);

  useEffect(() => {
    if (!isOpen) return;

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  return (
    <span
      ref={triggerRef}
      aria-describedby={isOpen ? id : undefined}
      className={["inline-flex", className].filter(Boolean).join(" ")}
      onBlur={() => setIsOpen(false)}
      onFocus={() => {
        setIsOpen(true);
        updatePosition();
      }}
      onMouseEnter={() => {
        setIsOpen(true);
        updatePosition();
      }}
      onMouseLeave={() => setIsOpen(false)}
    >
      {children}
      {typeof document !== "undefined" && isOpen
        ? createPortal(
          <span
            id={id}
            role="tooltip"
            className={[
              "pointer-events-none fixed z-[1000] max-w-64 rounded-md px-2.5 py-1.5 text-center text-xs font-medium leading-5 shadow-lg",
              "text-zinc-950 dark:text-zinc-50",
              "bg-gray-200 dark:bg-zinc-500 "
            ].join(" ")}
            style={{
              left: position.left,
              top: position.top,
              transform: getTransform(side),
            }}
          >
            {content}
          </span>,
          document.body,
        )
        : null}
    </span>
  );
};
