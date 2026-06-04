import { IconInfo } from "@/components/ui/icons";

const recentWorldCupEditions = [
  {
    quarterFinalists: "Netherlands, Brazil, England, Portugal",
    runnerUp: "France",
    semifinalists: "Croatia, Morocco",
    winner: "Argentina",
    year: "2022",
  },
  {
    quarterFinalists: "Uruguay, Brazil, Sweden, Russia",
    runnerUp: "Croatia",
    semifinalists: "Belgium, England",
    winner: "France",
    year: "2018",
  },
  {
    quarterFinalists: "Colombia, France, Costa Rica, Belgium",
    runnerUp: "Argentina",
    semifinalists: "Netherlands, Brazil",
    winner: "Germany",
    year: "2014",
  },
  {
    quarterFinalists: "Ghana, Brazil, Argentina, Paraguay",
    runnerUp: "Netherlands",
    semifinalists: "Germany, Uruguay",
    winner: "Spain",
    year: "2010",
  },
  {
    quarterFinalists: "Argentina, Ukraine, England, Brazil",
    runnerUp: "France",
    semifinalists: "Germany, Portugal",
    winner: "Italy",
    year: "2006",
  },
  {
    quarterFinalists: "England, USA, Spain, Senegal",
    runnerUp: "Germany",
    semifinalists: "South Korea, Turkey",
    winner: "Brazil",
    year: "2002",
  },
];

export const WorldCupHistoryTooltip = () => {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label="Recent World Cup finalists and quarterfinalists"
        className="grid h-8 w-8 place-items-center rounded-md border border-zinc-200 bg-white text-zinc-500 transition hover:border-tournament-primary hover:text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-tournament-primary dark:hover:text-emerald-300 dark:focus:ring-emerald-900"
      >
        <IconInfo className="h-4 w-4" />
      </button>
      <span
        role="tooltip"
        className="absolute left-0 top-10 z-30 hidden w-[40%] rounded-md border border-zinc-200 bg-white p-4 text-left shadow-xl group-focus-within:block group-hover:block dark:border-zinc-700 dark:bg-zinc-900 lg:left-auto lg:right-0"
      >
        <span className="block text-sm font-semibold text-zinc-950 dark:text-zinc-50">
          Recent World Cup editions
        </span>
        <span className="mt-3 grid max-h-80 gap-3 overflow-y-auto pr-1">
          {recentWorldCupEditions.map((edition) => (
            <span
              key={edition.year}
              className="block rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800"
            >
              <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300">
                {edition.year}
              </span>
              <span className="mt-2 grid gap-1 text-xs leading-5 text-zinc-600 dark:text-zinc-300">
                <span>
                  <span className="font-semibold text-zinc-950 dark:text-zinc-50">Winner:</span>{" "}
                  {edition.winner}
                </span>
                <span>
                  <span className="font-semibold text-zinc-950 dark:text-zinc-50">Runner-up:</span>{" "}
                  {edition.runnerUp}
                </span>
                <span>
                  <span className="font-semibold text-zinc-950 dark:text-zinc-50">Semifinalists:</span>{" "}
                  {edition.semifinalists}
                </span>
                <span>
                  <span className="font-semibold text-zinc-950 dark:text-zinc-50">Quarterfinalists:</span>{" "}
                  {edition.quarterFinalists}
                </span>
              </span>
            </span>
          ))}
        </span>
      </span>
    </span>
  );
};
