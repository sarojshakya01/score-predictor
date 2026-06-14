export type PillTone = "primary" | "secondary" | "accent" | "green" | "red" | "yellow" | "zinc";

type StatusPillProps = {
  children: React.ReactNode;
  tone?: PillTone;
  urgency?: "alarm" | "warn" | "none"
};

export const toneClasses: Record<NonNullable<StatusPillProps["tone"]>, string> = {
  primary: "border-tournament-primary bg-grad-tournament-primary text-white",
  secondary: "border-tournament-secondary bg-grad-tournament-secondary text-white",
  accent: "border-tournament-accent bg-grad-tournament-accent text-white",
  green: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  red: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-300",
  zinc: "border-zinc-200 bg-grad-tournament-light text-zinc-700 dark:border-zinc-700 dark:text-zinc-300",
  yellow: "border-yellow-500 bg-amber-100 text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
};

export const toneClassesLight: Record<NonNullable<StatusPillProps["tone"]>, string> = {
  primary: "border-tournament-primary bg-grad-tournament-primary-light text-white",
  secondary: "border-tournament-secondary bg-grad-tournament-secondary-light text-white",
  accent: "border-tournament-accent bg-grad-tournament-accent-light text-white",
  green: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  red: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-300",
  zinc: "border-zinc-200 bg-grad-tournament-light text-zinc-700 dark:border-zinc-700 dark:text-zinc-300",
  yellow: "border-yellow-500 bg-amber-100 text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
};

/** Border-pulse helper for the article outline. */
const urgencyBorderClass = (urgency: "alarm" | "warn" | "none"): string => {
  if (urgency === "alarm") return "border-red-400 dark:border-red-500";
  if (urgency === "warn") return "border-amber-400 dark:border-amber-500";
  return "";
};

const urgencyBorderStyle = (urgency: "alarm" | "warn" | "none"): React.CSSProperties => {
  if (urgency === "none") return {};
  const duration = urgency === "alarm" ? "1.4s" : "2.8s";
  return { animation: `lock-pulse-border ${duration} ease-in-out infinite` };
};


/**
 * Injects the keyframe CSS once into <head>.
 * Safe to call multiple times – the style tag is only added once.
 */
const ensureKeyframes = () => {
  if (typeof document === "undefined") return;
  if (document.getElementById("match-card-keyframes")) return;
  const style = document.createElement("style");
  style.id = "match-card-keyframes";
  style.textContent = `
    @keyframes lock-sweep {
      0%   { transform: translateX(-100%); opacity: 1; }
      60%  { opacity: 1; }
      100% { transform: translateX(100%); opacity: 0.4; }
    }
    @keyframes lock-pulse-border {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.35; }
    }
  `;
  document.head.appendChild(style);
};


export const StatusPill = ({ children, tone = "zinc", urgency = "none" }: StatusPillProps) => {
  return (
    <>
      {urgency !== "none" && typeof window !== "undefined" && ensureKeyframes()}
      <span
        className={`${urgencyBorderClass(urgency)} inline-flex items-center rounded-full border px-2 sm:px-2.5 py-1 text-xs font-medium ${toneClasses[tone]} truncate`}
        style={urgencyBorderStyle(urgency)}
      >
        <span className="hidden sm:inline-flex">{children}</span>
        <span className="sm:hidden inline-flex">{typeof children === 'string' ? children.substring(0, 10) : children}</span>
      </span>
    </>
  );
};
