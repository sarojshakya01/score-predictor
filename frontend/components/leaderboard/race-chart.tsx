'use client';

import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { useEffect, useMemo, useRef } from 'react';

const FLOAT = /^-?\d+\.?\d*$/;
let patched = false;

function applyHighchartsPatch() {
  if (patched) return;
  patched = true;

  (Highcharts as any).Fx.prototype.textSetter = function () {
    const chart = (Highcharts as any).charts[this.elem.renderer.chartIndex];
    let thousandsSep = chart.numberFormatter('1000.0')[1];
    if (/[0-9]/.test(thousandsSep)) thousandsSep = ' ';
    const replaceRegEx = new RegExp(thousandsSep, 'g');
    let startValue = this.start.replace(replaceRegEx, ''),
      endValue = this.end.replace(replaceRegEx, ''),
      currentValue = this.end.replace(replaceRegEx, '');
    if ((startValue || '').match(FLOAT)) {
      startValue = parseInt(startValue, 10);
      endValue = parseInt(endValue, 10);
      currentValue = chart.numberFormatter(
        Math.round(startValue + (endValue - startValue) * this.pos),
        0,
      );
    }
    this.elem.endText = this.end;
    this.elem.attr(this.prop, currentValue, null, true);
  };

  (Highcharts as any).SVGElement.prototype.textGetter = function () {
    const ct = this.text.element.textContent || '';
    return this.endText ? this.endText : ct.substring(0, ct.length / 2);
  };

  (Highcharts as any).wrap(
    (Highcharts as any).Series.prototype,
    'drawDataLabels',
    function (this: any, proceed: any) {
      const attr = (Highcharts as any).SVGElement.prototype.attr;
      const chart = this.chart;
      if (chart.sequenceTimer) {
        this.points.forEach((point: any) =>
          (point.dataLabels || []).forEach(
            (label: any) =>
            (label.attr = function (hash: any) {
              if (hash && hash.text !== undefined && chart.isResizing === 0) {
                const text = hash.text;
                delete hash.text;
                return this.attr(hash).animate({ text });
              }
              return attr.apply(this, arguments);
            }),
          ),
        );
      }
      const ret = proceed.apply(this, Array.prototype.slice.call(arguments, 1));
      this.points.forEach((p: any) =>
        (p.dataLabels || []).forEach((d: any) => (d.attr = attr)),
      );
      return ret;
    },
  );
}

const startMatch = 1;
const nbr = 20;
const barRowHeight = 28;
const chartVerticalPadding = 120;

// ── Pre-compute top-N names across ALL matches so the set never changes ──────
function getStableNames(
  dataset: Record<string, Record<string, number>>,
  totalMatches: number,
  limit: number,
): string[] {
  const nameSet = new Set<string>();
  for (let m = startMatch; m <= totalMatches; m++) {
    Object.entries(dataset)
      .map(([name, data]) => ({ name, pts: Number(data[`Match ${m}`] ?? 0) }))
      .sort((a, b) => b.pts - a.pts)
      .slice(0, limit)
      .forEach((e) => nameSet.add(e.name));
  }
  return Array.from(nameSet);
}

// getData — keep the highest cumulative score first so it renders at the top.
type RacePoint = {
  id: string;
  name: string;
  x: number;
  y: number;
};

type RankMap = Record<string, number>;

function buildRankMap(data: RacePoint[]): RankMap {
  return data.reduce<RankMap>((ranks, point, index) => {
    ranks[point.name] = index;
    return ranks;
  }, {});
}

function getData(
  dataset: Record<string, Record<string, number>>,
  stableNames: string[],
  match: number,
  previousOrder: RankMap = {},
): RacePoint[] {
  return stableNames
    .map((name) => ({
      id: name,
      name,
      y: Number(dataset[name]?.[`Match ${match}`] ?? 0),
    }))
    .sort((a, b) => {
      if (b.y !== a.y) {
        return b.y - a.y;
      }
      const previousRankA = previousOrder[a.name];
      const previousRankB = previousOrder[b.name];
      if (previousRankA !== undefined || previousRankB !== undefined) {
        return (
          (previousRankA ?? Number.MAX_SAFE_INTEGER) -
          (previousRankB ?? Number.MAX_SAFE_INTEGER)
        );
      }
      return a.name.localeCompare(b.name);
    })
    .slice(0, nbr)
    .map((point, index) => {
      return {
        ...point,
        x: index,
      };
    });
}

function getCategories(data: RacePoint[]): string[] {
  return data.map((point) => point.name);
}

export default function RaceChart({
  dataset,
}: {
  dataset: Record<string, Record<string, number>>;
}) {
  const chartRef = useRef<HighchartsReact.RefObject>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const endMatch = Object.keys(dataset[Object.keys(dataset)[0]]).length;

  // Stable name set computed once — never changes between frames
  const stableNames = useMemo(() => getStableNames(dataset, endMatch, nbr), [dataset]);
  const initialData = useMemo(() => getData(dataset, stableNames, startMatch), [dataset, stableNames]);
  const previousOrderRef = useRef<RankMap>(buildRankMap(initialData));

  useEffect(() => {
    applyHighchartsPatch();
  }, []);

  useEffect(() => {
    previousOrderRef.current = buildRankMap(initialData);
  }, [initialData]);

  useEffect(() => {
    if (!chartRef.current?.chart || !inputRef.current) return;
    const chart = chartRef.current.chart as any;
    const input = inputRef.current;
    const handleSliderClick = () => update();
    input.addEventListener('click', handleSliderClick);
    return () => {
      input.removeEventListener('click', handleSliderClick);
      if (chart.sequenceTimer) clearInterval(chart.sequenceTimer);
    };
  }, []);

  function pause() {
    const btn = btnRef.current!;
    const chart = chartRef.current?.chart as any;
    btn.innerHTML = '▶️';
    clearTimeout(chart.sequenceTimer);
    chart.sequenceTimer = undefined;
  }

  function update(increment?: number) {
    const input = inputRef.current!;
    const chart = chartRef.current?.chart as any;

    if (increment) {
      input.value = String(parseInt(input.value, 10) + increment);
    }

    if (parseInt(input.value, 10) >= endMatch) {
      pause();
    }

    const matchNum = parseInt(input.value, 10);
    const data = getData(dataset, stableNames, matchNum, previousOrderRef.current);

    chart.series[0].name = input.value;
    chart.xAxis[0].setCategories(getCategories(data), false);
    console.log(111, data)
    chart.series[0].setData(
      data,
      true,
      { duration: 1500 },
      true,
    );
    previousOrderRef.current = buildRankMap(data);
  }

  function play() {
    const chart = chartRef.current?.chart as any;
    chart.sequenceTimer = setInterval(() => {
      update(1);
    }, 1500);
  }

  function handleBtnClick() {
    const btn = btnRef.current!;
    const chart = chartRef.current?.chart as any;
    if (chart.sequenceTimer) {
      pause();
      btn.innerHTML = '▶️';
    } else {
      // Restart from beginning if at end
      if (inputRef.current && parseInt(inputRef.current.value, 10) >= endMatch) {
        inputRef.current.value = String(startMatch);
        previousOrderRef.current = buildRankMap(initialData);
        update();
      }
      play();
      btn.innerHTML = '⏸️';
    }
  }

  const options: Highcharts.Options = {
    credits: { enabled: false },
    chart: {
      animation: { duration: 1500 },
      marginRight: 50,
      height: Math.max(320, initialData.length * barRowHeight + chartVerticalPadding),
    },
    title: {
      text: undefined,
    },
    legend: { enabled: false },
    xAxis: {
      type: 'category',
      categories: getCategories(initialData),
      reversed: true,
    },
    yAxis: {
      opposite: true,
      tickPixelInterval: 150,
      title: { text: undefined },
    },
    plotOptions: {
      bar: {
        animation: false,
        groupPadding: 0,
        pointPadding: 0.22,
        borderWidth: 0,
        colorByPoint: true,
        dataLabels: { enabled: true },
      },
    },
    series: [
      {
        type: 'bar',
        name: String(startMatch),
        data: initialData,
      },
    ],
    responsive: {
      rules: [
        {
          condition: { maxWidth: 550 },
          chartOptions: {
            xAxis: { visible: false },
            subtitle: { x: 0 },
            plotOptions: {
              series: {
                dataLabels: [
                  { enabled: true, y: 8 },
                  {
                    enabled: true,
                    format: '{point.name}',
                    y: -8,
                    style: { fontWeight: 'normal', opacity: 0.7 },
                  },
                ] as any,
              },
            },
          },
        },
      ],
    },
  };

  return (
    <section className="overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex flex-col gap-4 border-b border-zinc-200 px-5 py-4 lg:flex-row lg:justify-between dark:border-zinc-700 items-center">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">Leaderboard Race</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Match Number: {startMatch}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            ref={btnRef}
            className="inline-flex items-center justify-center cursor-pointer  transition"
            title="play"
            onClick={handleBtnClick}
          >
            ▶️
          </button>
          <input
            aria-label="Race chart frame"
            className="w-40 accent-emerald-700"
            ref={inputRef}
            type="range"
            defaultValue={startMatch}
            min={startMatch}
            max={endMatch}
          />
        </div>
      </div>
      <div className="p-4">
        <HighchartsReact highcharts={Highcharts} options={options} ref={chartRef} />
      </div>
    </section>
  );
}
