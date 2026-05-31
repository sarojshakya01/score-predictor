export type PillTone = "primary" | "secondary" | "accent" | "green" | "red" | "zinc";

type StatusPillProps = {
  children: React.ReactNode;
  tone?: PillTone;
};

export const toneClasses: Record<NonNullable<StatusPillProps["tone"]>, string> = {
  primary: "border-tournament-primary bg-grad-tournament-primary text-white",
  secondary: "border-tournament-secondary bg-grad-tournament-secondary text-white",
  accent: "border-tournament-accent bg-grad-tournament-accent text-white",
  green: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  red: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-300",
  zinc: "border-zinc-200 bg-grad-tournament-light text-zinc-700 dark:border-zinc-700 dark:text-zinc-300",
};

export const toneClassesLight: Record<NonNullable<StatusPillProps["tone"]>, string> = {
  primary: "border-tournament-primary bg-grad-tournament-primary-light text-white",
  secondary: "border-tournament-secondary bg-grad-tournament-secondary-light text-white",
  accent: "border-tournament-accent bg-grad-tournament-accent-light text-white",
  green: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  red: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-300",
  zinc: "border-zinc-200 bg-grad-tournament-light text-zinc-700 dark:border-zinc-700 dark:text-zinc-300",
};

export const StatusPill = ({ children, tone = "zinc" }: StatusPillProps) => {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
};
