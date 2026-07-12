"use client";

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
import { DailyData } from "@/lib/snoo-client";

interface OvernightStretchChartProps {
  data: DailyData[];
  title: string;
  color: string;
}

const KEYS = ["s1", "s2", "s3"] as const;
const LABELS: Record<string, string> = {
  s1: "Longest",
  s2: "2nd",
  s3: "3rd",
};

function formatHM(seconds: number): string {
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
        <p className="text-zinc-500">No overnight sleep recorded</p>
      ) : (
        shown.map((entry) => (
          <p key={entry.name} style={{ color: entry.color }}>
            {LABELS[entry.dataKey as string] ?? entry.name}:{" "}
            {formatHM((entry.value as number) ?? 0)}
          </p>
        ))
      )}
    </div>
  );
}

export default function OvernightStretchChart({
  data,
  title,
  color,
}: OvernightStretchChartProps) {
  const chartData = data.map((d) => ({
    date: d.date.slice(5), // MM-DD
    s1: d.longestStretches[0] ?? 0,
    s2: d.longestStretches[1] ?? 0,
    s3: d.longestStretches[2] ?? 0,
  }));

  // Three shades of the twin's colour: darkest = longest stretch.
  const shades =
    color === "blue"
      ? ["#2563eb", "#60a5fa", "#bfdbfe"]
      : ["#db2777", "#f472b6", "#fbcfe8"];

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 sm:p-6">
      <h3 className="text-base sm:text-lg font-semibold text-zinc-100 mb-1">
        {title}
      </h3>
      <p className="text-zinc-500 text-xs mb-4">
        Three longest continuous sleep stretches overnight (6pm–7am), stacked
      </p>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} barCategoryGap="20%">
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
          {KEYS.map((k, i) => (
            <Bar
              key={k}
              dataKey={k}
              name={LABELS[k]}
              stackId="stretch"
              fill={shades[i]}
              radius={i === KEYS.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
