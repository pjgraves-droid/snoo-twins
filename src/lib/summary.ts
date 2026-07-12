import {
  TwinData,
  WindowStats,
  SummaryWindowKey,
  SnooLevel,
  formatDuration,
} from "./snoo-client";

/** Like formatDuration but omits the hours segment when it's zero (e.g. "29m" not "0h 29m"). */
function formatDurationCompact(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Short phrase describing the peak soothing level reached in a window. */
function peakLevelPhrase(peak: SnooLevel | null): string | null {
  switch (peak) {
    case "BASELINE":
      return "The Snoo stayed at baseline.";
    case "LEVEL1":
      return "The Snoo peaked at Level 1.";
    case "LEVEL2":
      return "The Snoo peaked at Level 2.";
    case "LEVEL3":
      return "The Snoo peaked at Level 3.";
    case "LEVEL4":
      return "The Snoo reached Level 4.";
    default:
      return null;
  }
}

export interface WindowTwinStat {
  name: string;
  color: string;
  stats: WindowStats;
}

export interface WindowSection {
  key: SummaryWindowKey;
  label: string;
  rangeLabel: string;
  twins: WindowTwinStat[];
  /** Natural-language sentences describing this window. */
  sentences: string[];
}

const COLORS = ["blue", "pink"];

function twinSentence(t: WindowTwinStat, isNight: boolean): string {
  const s = t.stats;
  if (!s.hasElapsed) {
    return `${t.name}: this window hasn't started yet.`;
  }
  if (s.totalSleep < 60) {
    return `${t.name}: no sleep recorded${isNight ? " overnight" : ""} yet.`;
  }

  let str = `${t.name} slept ${formatDuration(s.totalSleep)}`;
  if (isNight) {
    str += ` with ${s.wakings} ${s.wakings === 1 ? "waking" : "wakings"}.`;
  } else {
    str += ` across ${s.sleepSessions} ${
      s.sleepSessions === 1 ? "nap" : "naps"
    }.`;
  }
  if (s.longestStretch >= 60) {
    str += ` Longest stretch ${formatDurationCompact(s.longestStretch)}.`;
  }
  const peak = peakLevelPhrase(s.peakLevel);
  if (peak) str += ` ${peak}`;
  return str;
}

function comparisonSentence(twins: WindowTwinStat[]): string | null {
  if (twins.length < 2) return null;
  const [a, b] = twins;
  if (!a.stats.hasElapsed || !b.stats.hasElapsed) return null;
  if (a.stats.totalSleep < 60 && b.stats.totalSleep < 60) return null;

  const diff = a.stats.totalSleep - b.stats.totalSleep;
  if (Math.abs(diff) < 60) {
    return `${a.name} and ${b.name} slept about the same.`;
  }
  const more = diff > 0 ? a : b;
  const less = diff > 0 ? b : a;
  return `${more.name} slept ${formatDurationCompact(
    Math.abs(diff)
  )} more than ${less.name}.`;
}

export function buildWindowSummary(data: TwinData[]): WindowSection[] {
  const twinMeta = data.map((twin, i) => ({
    name: twin.baby.babyName || `Baby ${i + 1}`,
    color: COLORS[i] || COLORS[0],
    windows: twin.windows || [],
  }));

  const order: SummaryWindowKey[] = ["yesterday", "lastNight", "today"];

  return order.map((key) => {
    const twins: WindowTwinStat[] = [];
    let label = "";
    let rangeLabel = "";

    for (const meta of twinMeta) {
      const stats = meta.windows.find((w) => w.key === key);
      if (!stats) continue;
      label = stats.label;
      rangeLabel = stats.rangeLabel;
      twins.push({ name: meta.name, color: meta.color, stats });
    }

    const isNight = key === "lastNight";
    const sentences = twins.map((t) => twinSentence(t, isNight));
    const cmp = comparisonSentence(twins);
    if (cmp) sentences.push(cmp);

    return { key, label, rangeLabel, twins, sentences };
  });
}
