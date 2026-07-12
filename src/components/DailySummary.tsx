import { TwinData, SnooLevel, formatDuration } from "@/lib/snoo-client";
import { buildWindowSummary, WindowSection } from "@/lib/summary";
import { Sun, Moon, Sunrise } from "lucide-react";

interface DailySummaryProps {
  data: TwinData[];
}

function peakLevelBadge(level: SnooLevel): string {
  return level === "BASELINE" ? "baseline" : level.replace("LEVEL", "L");
}

function windowIcon(key: WindowSection["key"]) {
  if (key === "lastNight") return <Moon className="w-4 h-4 text-indigo-400" />;
  if (key === "today") return <Sunrise className="w-4 h-4 text-amber-400" />;
  return <Sun className="w-4 h-4 text-amber-400" />;
}

function SectionCard({ section }: { section: WindowSection }) {
  const isNight = section.key === "lastNight";

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-3">
        {windowIcon(section.key)}
        <h3 className="text-sm sm:text-base font-semibold">{section.label}</h3>
        <span className="text-zinc-500 text-[10px] sm:text-xs ml-auto">
          {section.rangeLabel}
        </span>
      </div>

      {section.twins.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-3">
          {section.twins.map((t) => {
            const valueColor =
              t.color === "blue" ? "text-blue-400" : "text-pink-400";
            const borderColor =
              t.color === "blue" ? "border-blue-500/30" : "border-pink-500/30";
            const s = t.stats;
            return (
              <div
                key={t.name}
                className={`bg-zinc-950/50 border ${borderColor} rounded-lg p-2.5 sm:p-3`}
              >
                <div className="flex items-center justify-between gap-1">
                  <p
                    className={`font-semibold ${valueColor} text-xs sm:text-sm truncate`}
                  >
                    {t.name}
                  </p>
                  {s.peakLevel && s.totalSleep >= 60 && (
                    <span className="text-[9px] sm:text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 whitespace-nowrap">
                      peak {peakLevelBadge(s.peakLevel)}
                    </span>
                  )}
                </div>
                <p className="text-lg sm:text-2xl font-bold mt-0.5">
                  {formatDuration(s.totalSleep)}
                </p>
                <p className="text-zinc-500 text-[10px] sm:text-xs">
                  {isNight
                    ? `${s.wakings} ${s.wakings === 1 ? "waking" : "wakings"}`
                    : `${s.sleepSessions} ${
                        s.sleepSessions === 1 ? "nap" : "naps"
                      }`}
                  {s.longestStretch >= 60 && (
                    <> · longest {formatDuration(s.longestStretch)}</>
                  )}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-1.5">
        {section.sentences.map((sentence, i) => (
          <p
            key={i}
            className="text-zinc-300 text-xs sm:text-sm leading-relaxed"
          >
            {sentence}
          </p>
        ))}
      </div>
    </div>
  );
}

export default function DailySummary({ data }: DailySummaryProps) {
  const sections = buildWindowSummary(data);

  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
      {sections.map((section) => (
        <SectionCard key={section.key} section={section} />
      ))}
    </section>
  );
}
