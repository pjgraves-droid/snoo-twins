"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  TooltipProps,
} from "recharts";
import { DailyData, LEVEL_ORDER } from "@/lib/snoo-client";
import ChartModeToggle, { ChartMode } from "./ChartModeToggle";

interface LevelDetailChartProps {
  data: DailyData[];
  title: string;
}

// Calm → intense heat scale so escalation is visually obvious.
const LEVEL_COLORS: Record<string, string> = {
  BASELINE: "#22c55e",
  LEVEL1: "#a3e635",
  LEVEL2: "#eab308",
  LEVEL3: "#f97316",
  LEVEL4: "#ef4444",
};

const LEVEL_LABELS: Record<string, string> = {
  BASELINE: "Baseline",
  LEVEL1: "Level 1",
  LEVEL2: "Level 2",
  LEVEL3: "Level 3",
  LEVEL4: "Level 4",
};

function formatMinutes(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const shown = payload.filter((e) => ((e.value as number) ?? 0) > 0);
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm shadow-xl">
      <p className="text-zinc-400 mb-1 font-medium">{label}</p>
      {shown.length === 0 ? (
        <p className="text-zinc-500">No soothing recorded</p>
      ) : (
        shown
          .slice()
          .reverse()
          .map((entry) => (
            <p key={entry.name} style={{ color: entry.color }}>
              {entry.name}: {formatMinutes((entry.value as number) ?? 0)}
            </p>
          ))
      )}
    </div>
  );
}

export default function LevelDetailChart({ data, title }: LevelDetailChartProps) {
  const [mode, setMode] = useState<ChartMode>("stacked");
  const stacked = mode === "stacked";
  const chartData = data.map((d) => ({
    date: d.date.slice(5), // MM-DD
    ...d.levelSeconds,
  }));

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 sm:p-6">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="text-base sm:text-lg font-semibold text-zinc-100">
          {title}
        </h3>
        <ChartModeToggle mode={mode} onChange={setMode} />
      </div>
      <p className="text-zinc-500 text-xs mb-4">
        Time spent at each soothing level (how hard the Snoo worked each day)
      </p>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} barGap={stacked ? 0 : 1} barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis
            dataKey="date"
            stroke="#888"
            fontSize={11}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            stroke="#888"
            fontSize={11}
            tickLine={false}
            tickFormatter={(v: number) => `${Math.round(v / 3600)}h`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "#ffffff08" }} />
          <Legend wrapperStyle={{ fontSize: "12px", color: "#aaa" }} />
          {LEVEL_ORDER.map((lvl, i) => (
            <Bar
              key={lvl}
              dataKey={lvl}
              name={LEVEL_LABELS[lvl]}
              stackId={stacked ? "levels" : undefined}
              fill={LEVEL_COLORS[lvl]}
              radius={
                stacked && i !== LEVEL_ORDER.length - 1
                  ? [0, 0, 0, 0]
                  : [4, 4, 0, 0]
              }
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
