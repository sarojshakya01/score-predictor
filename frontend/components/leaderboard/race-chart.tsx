'use client';

import { RaceFrame } from '@/lib/leaderboard/types';
import { Tooltip } from '@/components/ui/tooltip';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { useRef, useState } from 'react';

const TOP_PERFORMER = 20;
const BAR_ROW_HEIGHT = 20;
const CHART_VERTICAL_PADDING = 10;

export default function RaceChart({
  dataset,
  userId
}: {
  dataset: RaceFrame[];
  userId?: number | undefined;
}) {
  const chartRef = useRef<HighchartsReact.RefObject>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const matchValRef = useRef<HTMLButtonElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const startMatch = dataset[0].acc_points.length;
  const endMatch = dataset[0].acc_points.length;

  function getData(
    matchNum: number,
  ) {
    const output = dataset
      .map((user) => {
        return {
          name: user.user_id === userId ? 'You' : user.user_name,
          id: `user_${user.user_id}`,
          y: (user.acc_points.find((point) => point.match_num === matchNum)?.points || 0),
          sort_param1: (user.acc_points.find((point) => point.match_num === matchNum)?.winner_points || 0),
          sort_param2: (user.acc_points.find((point) => point.match_num === matchNum)?.runner_up_points || 0),
          sort_param3: (user.acc_points.find((point) => point.match_num === matchNum)?.third_place_points || 0),
          sort_param4: (user.acc_points.find((point) => point.match_num === matchNum)?.goal_difference_points || 0),
        };
      });

    const sortedOutput = output.sort((a, b) =>
      Number(b.y) - Number(a.y) ||
      Number(b.sort_param1) - Number(a.sort_param1) ||
      Number(b.sort_param2) - Number(a.sort_param2) ||
      Number(b.sort_param3) - Number(a.sort_param3) ||
      Number(b.sort_param4) - Number(a.sort_param4)
    );

    const slicedOutput = sortedOutput.slice(0, TOP_PERFORMER);

    if (userId && !slicedOutput.some((data) => data.id === `user_${userId}`)) {
      const you = dataset.find((ds) => ds.user_id === userId)
      slicedOutput.push({
        name: 'You',
        id: `user_${userId}`,
        y: (you?.acc_points.find((point) => point.match_num === matchNum)?.points || 0),
      });
    }

    const data = slicedOutput.map((item, index) => ({
      ...item,
      x: index // Direct binding of position to data value
    }));

    return data;
  }

  function pause() {
    const btn = btnRef.current!;
    const chart = chartRef.current?.chart as any; // eslint-disable-line
    btn.innerHTML = '▶️';
    clearTimeout(chart.sequenceTimer);
    chart.sequenceTimer = undefined;
  }

  function update(increment?: number) {
    const input = inputRef.current!;
    const chart = chartRef.current?.chart as any; // eslint-disable-line
    matchValRef.current!.innerText = String(input.value);

    if (increment) {
      input.value = String(parseInt(input.value, 10) + increment);
    }

    if (parseInt(input.value, 10) >= endMatch) {
      pause();
    }

    const matchNum = parseInt(input.value, 10);
    chart.series[0].update({ data: getData(matchNum), name: `Match ${matchNum}` });
  }

  const play = () => {
    const input = inputRef.current!;
    if (parseInt(input.value, 10) >= endMatch) {
      input.value = String(startMatch);
    }
    const btn = btnRef.current!;
    const chart = chartRef.current?.chart as any; // eslint-disable-line
    btn.innerHTML = '⏸️';
    chart.sequenceTimer = setInterval(() => {
      update(1);
      update();
    }, 1500);
  }

  const handleBtnClick = () => {
    const input = inputRef.current!;
    setIsPlaying(!isPlaying);
    if (parseInt(input.value, 10) >= endMatch) {
      input.value = String(0);
    }
    const chart = chartRef.current?.chart as any; // eslint-disable-line
    if (chart.sequenceTimer) {
      pause();
    } else {
      play();
    }
  }

  const handleSliderClick = () => {
    update();
    update();
  }

  const options: Highcharts.Options = {
    credits: { enabled: false },
    chart: {
      type: 'bar',
      animation: { duration: 1000 },
      marginRight: 50,
      height: TOP_PERFORMER * BAR_ROW_HEIGHT + TOP_PERFORMER * CHART_VERTICAL_PADDING,
    },
    title: {
      text: undefined,
    },
    legend: { enabled: false },
    xAxis: {
      type: 'category',
      uniqueNames: true,
      reversed: true
    },
    yAxis: {
      opposite: true,
      tickPixelInterval: 150,
      title: { text: undefined },
      labels: {
        useHTML: true,
      }
    },
    plotOptions: {
      bar: {
        grouping: false,
        // animation: false,
        pointPadding: 0,
        borderWidth: 0,
        colorByPoint: true,
        dataSorting: {
          enabled: true,
          matchByName: true
        },
        dataLabels: {
          enabled: true,
          useHTML: true,
          formatter: function () {
            const point = this as any; // eslint-disable-line
            if (point.id === `user_${userId}`) {
              return `<span class="font-bold text-zinc-950 dark:text-white text-lg">${point.y} (You)</span>`
            }
            return `${point.y}`;
          }
        },
      },
    },
    series: [
      {
        type: 'bar',
        pointPadding: 0.05,
        pointWidth: BAR_ROW_HEIGHT,
        maxPaddingWitdh: 2 * BAR_ROW_HEIGHT,
        name: 'Points',
        data: getData(startMatch),
      } as any, // eslint-disable-line
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
                ] as any, // eslint-disable-line
              },
            },
          },
        },
      ],
    },
  };

  const root = document.documentElement;

  if (root.classList.contains('dark')) {
    root.classList.remove('highcharts-light');
    root.classList.add('highcharts-dark');
  } else {
    root.classList.remove('highcharts-dark');
    root.classList.add('highcharts-light');
  }

  return (
    <section className="overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex flex-col gap-4 border-b border-zinc-200 px-5 py-4 lg:flex-row lg:justify-between dark:border-zinc-700 items-center">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">Leaderboard Race</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Match Number: <span ref={matchValRef}>{startMatch}</span></p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Tooltip content={isPlaying ? 'Pause' : 'Play'}>
            <button
              ref={btnRef}
              aria-label={isPlaying ? 'Pause leaderboard race' : 'Play leaderboard race'}
              className="inline-flex items-center justify-center cursor-pointer  transition"
              onClick={handleBtnClick}
            >
              {isPlaying ? '⏸️' : '▶️'}
            </button>
          </Tooltip>
          <input
            aria-label="Race chart frame"
            className="w-40 accent-emerald-700"
            ref={inputRef}
            type="range"
            defaultValue={startMatch}
            onClick={handleSliderClick}
            min={1}
            max={endMatch}
          />
        </div>
      </div>
      <HighchartsReact highcharts={Highcharts} options={options} ref={chartRef} />
    </section>
  );
}
