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

interface SleepChartProps {
  data: DailyData[];
  title: string;
  color: string;
}

function formatHours(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm shadow-xl">
      <p className="text-zinc-400 mb-1 font-medium">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {formatHours((entry.value as number) ?? 0)}
        </p>
      ))}
    </div>
  );
}

export default function SleepChart({ data, title, color }: SleepChartProps) {
  const chartData = data.map((d) => ({
    date: d.date.slice(5), // MM-DD
    daySleep: d.daySleep,
    nightSleep: d.nightSleep,
  }));

  const dayColor = color === "blue" ? "#60a5fa" : "#f472b6";
  const nightColor = color === "blue" ? "#3b82f6" : "#ec4899";

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl sm:rounded-2xl p-3 sm:p-6">
      <h3 className="text-sm sm:text-lg font-semibold text-zinc-100 mb-2 sm:mb-4">{title}</h3>
      <div className="h-[220px] sm:h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} barGap={0} barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis
            dataKey="date"
            stroke="#888"
            fontSize={10}
            tickLine={false}
            interval="preserveStartEnd"
            tick={{ fontSize: 9 }}
          />
          <YAxis
            stroke="#888"
            fontSize={10}
            width={30}
            tickLine={false}
            tickFormatter={(v: number) => `${Math.round(v / 3600)}h`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: "12px", color: "#aaa" }}
          />
          <Bar
            dataKey="nightSleep"
            name="Night Sleep"
            fill={nightColor}
            stackId="sleep"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="daySleep"
            name="Day Sleep"
            fill={dayColor}
            stackId="sleep"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}
