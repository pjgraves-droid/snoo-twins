"use client";

import { Layers, BarChart3 } from "lucide-react";

export type ChartMode = "stacked" | "grouped";

interface ChartModeToggleProps {
  mode: ChartMode;
  onChange: (mode: ChartMode) => void;
}

const OPTIONS: { value: ChartMode; label: string; Icon: typeof Layers }[] = [
  { value: "stacked", label: "Stacked", Icon: Layers },
  { value: "grouped", label: "Grouped", Icon: BarChart3 },
];

export default function ChartModeToggle({ mode, onChange }: ChartModeToggleProps) {
  return (
    <div className="inline-flex rounded-lg border border-zinc-700 bg-zinc-800/60 p-0.5">
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = mode === value;
        return (
          <button
            key={value}
            onClick={() => onChange(value)}
            aria-pressed={active}
            title={`${label} view`}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              active
                ? "bg-zinc-700 text-zinc-100"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
