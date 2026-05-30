import { PillTone } from "@/lib/matches/types";

type StatusPillProps = {
  children: React.ReactNode;
  tone?: PillTone;
};

const toneClasses: Record<NonNullable<StatusPillProps["tone"]>, string> = {
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  blue: "border-sky-200 bg-sky-50 text-sky-800",
  green: "border-emerald-200 bg-emerald-50 text-emerald-800",
  red: "border-rose-200 bg-rose-50 text-rose-800",
  zinc: "border-zinc-200 bg-zinc-50 text-zinc-700",
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
