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

interface NapCountChartProps {
  datasets: { label: string; data: DailyData[]; color: string }[];
}

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm shadow-xl">
      <p className="text-zinc-400 mb-1 font-medium">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {entry.value} naps
        </p>
      ))}
    </div>
  );
}

export default function NapCountChart({ datasets }: NapCountChartProps) {
  const dateMap: Record<string, Record<string, number>> = {};
  for (const ds of datasets) {
    for (const d of ds.data) {
      const key = d.date.slice(5);
      if (!dateMap[key]) dateMap[key] = { _order: 0 };
      dateMap[key][ds.label] = d.naps;
    }
  }

  let order = 0;
  const allDates = datasets[0]?.data.map((d) => d.date.slice(5)) || [];
  for (const date of allDates) {
    if (dateMap[date]) dateMap[date]._order = order++;
  }

  const chartData = Object.entries(dateMap)
    .sort(([, a], [, b]) => a._order - b._order)
    .map(([date, values]) => {
      const { _order, ...rest } = values;
      void _order;
      return { date, ...rest };
    });

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl sm:rounded-2xl p-3 sm:p-6">
      <h3 className="text-sm sm:text-lg font-semibold text-zinc-100 mb-2 sm:mb-4">Daily Nap Count</h3>
      <div className="h-[200px] sm:h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} barGap={4}>
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
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: "12px", color: "#aaa" }} />
          {datasets.map((ds) => (
            <Bar
              key={ds.label}
              dataKey={ds.label}
              fill={ds.color}
              radius={[4, 4, 0, 0]}
              maxBarSize={20}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}
