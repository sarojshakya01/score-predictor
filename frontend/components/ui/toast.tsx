"use client";

import { useCallback, useEffect, useState } from "react";
import type { ComponentType, ReactNode } from "react";

import { IconCheck, IconInfo, IconWarning, IconX } from "@/components/ui/icons";

export type ToastTone = "success" | "error" | "info";

export type ToastMessage = {
  action?: ReactNode;
  durationMs?: number;
  id: string;
  message: string;
  title?: string;
  tone: ToastTone;
};

type ToastInput = Omit<ToastMessage, "id"> & {
  id?: string;
};

type ToastViewportProps = {
  onDismiss: (id: string) => void;
  toasts: ToastMessage[];
};

let toastCounter = 0;

const toneClasses: Record<ToastTone, {
  border: string;
  icon: string;
  Icon: ComponentType<{ className?: string }>;
}> = {
  error: {
    border: "border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100",
    icon: "text-rose-600 dark:text-rose-300",
    Icon: IconWarning,
  },
  info: {
    border: "border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-100",
    icon: "text-sky-600 dark:text-sky-300",
    Icon: IconInfo,
  },
  success: {
    border: "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100",
    icon: "text-emerald-600 dark:text-emerald-300",
    Icon: IconCheck,
  },
};

export const useToast = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((toast: ToastInput) => {
    const id = toast.id ?? `toast-${Date.now()}-${toastCounter++}`;
    setToasts((current) => [
      ...current.filter((currentToast) => currentToast.id !== id),
      {
        durationMs: 4500,
        ...toast,
        id,
      },
    ]);
    return id;
  }, []);

  return { dismissToast, showToast, toasts };
};

const ToastItem = ({
  onDismiss,
  toast,
}: {
  onDismiss: (id: string) => void;
  toast: ToastMessage;
}) => {
  const tone = toneClasses[toast.tone];
  const ToastIcon = tone.Icon;

  useEffect(() => {
    if (toast.durationMs === 0) {
      return;
    }

    const timeout = window.setTimeout(() => {
      onDismiss(toast.id);
    }, toast.durationMs ?? 4500);

    return () => window.clearTimeout(timeout);
  }, [onDismiss, toast.durationMs, toast.id]);

  return (
    <div
      className={[
        "pointer-events-auto flex w-full items-start gap-3 rounded-md border px-4 py-3 shadow-lg shadow-zinc-900/10 backdrop-blur dark:shadow-black/30",
        tone.border,
      ].join(" ")}
      role="status"
    >
      <ToastIcon className={`mt-0.5 h-5 w-5 shrink-0 ${tone.icon}`} />
      <div className="min-w-0 flex-1">
        {toast.title ? (
          <p className="text-sm font-semibold">{toast.title}</p>
        ) : null}
        <p className={toast.title ? "mt-1 text-sm" : "text-sm"}>{toast.message}</p>
        {toast.action ? <div className="mt-2">{toast.action}</div> : null}
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(toast.id)}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-current/70 transition hover:bg-black/5 hover:text-current dark:hover:bg-white/10"
      >
        <IconX className="h-4 w-4" />
      </button>
    </div>
  );
};

export const ToastViewport = ({ onDismiss, toasts }: ToastViewportProps) => {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      aria-relevant="additions text"
      className="fixed right-4 top-4 z-[70] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3 sm:right-6 sm:top-6"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} onDismiss={onDismiss} toast={toast} />
      ))}
    </div>
  );
};
