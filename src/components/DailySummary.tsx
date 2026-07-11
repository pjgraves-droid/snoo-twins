import { TwinData, formatDuration } from "@/lib/snoo-client";
import { buildDailySummary, summaryDateLabel } from "@/lib/summary";
import { FileText } from "lucide-react";

interface DailySummaryProps {
  data: TwinData[];
}

export default function DailySummary({ data }: DailySummaryProps) {
  const summary = buildDailySummary(data);

  return (
    <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl sm:rounded-2xl p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-3 sm:mb-4">
        <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
        <h2 className="text-base sm:text-lg font-semibold">Last 24 Hours</h2>
        <span className="text-zinc-500 text-[10px] sm:text-xs ml-auto">
          {summaryDateLabel(summary.date)}
        </span>
      </div>

      {summary.twins.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          {summary.twins.map((t) => {
            const valueColor =
              t.color === "blue" ? "text-blue-400" : "text-pink-400";
            const borderColor =
              t.color === "blue" ? "border-blue-500/30" : "border-pink-500/30";
            return (
              <div
                key={t.name}
                className={`bg-zinc-950/50 border ${borderColor} rounded-lg p-3`}
              >
                <p className={`font-semibold ${valueColor} text-sm sm:text-base`}>
                  {t.name}
                </p>
                <p className="text-xl sm:text-2xl font-bold mt-1">
                  {formatDuration(t.totalSleep)}
                </p>
                <p className="text-zinc-500 text-[10px] sm:text-xs">
                  total sleep · {t.nightWakings} wakings
                </p>
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-2">
        {summary.sentences.map((sentence, i) => (
          <p
            key={i}
            className="text-zinc-300 text-sm sm:text-base leading-relaxed"
          >
            {sentence}
          </p>
        ))}
      </div>
    </section>
  );
}
