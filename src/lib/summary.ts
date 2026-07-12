import { TwinData, DailyData, SnooLevel, formatDuration } from "./snoo-client";

/** Like formatDuration but omits the hours segment when it's zero (e.g. "29m" not "0h 29m"). */
function formatDurationCompact(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export interface TwinSummary {
  name: string;
  color: string;
  date: string;
  totalSleep: number;
  nightSleep: number;
  daySleep: number;
  longestSleep: number;
  naps: number;
  nightWakings: number;
  /** Change in total sleep vs the prior day, in seconds (null if no prior data) */
  totalSleepDelta: number | null;
  /** Highest soothing level reached (null if no data). */
  peakLevel: SnooLevel | null;
  /** The three longest overnight sleep stretches, in seconds (desc). */
  longestStretches: number[];
}

/** Human-friendly phrase describing the peak soothing level reached. */
function peakLevelPhrase(name: string, peak: SnooLevel | null): string | null {
  switch (peak) {
    case "BASELINE":
      return `${name} stayed calm all day — the Snoo never needed to go above baseline.`;
    case "LEVEL1":
      return `${name} only needed gentle soothing — the Snoo peaked at Level 1.`;
    case "LEVEL2":
      return `The Snoo escalated to Level 2 at its peak for ${name}.`;
    case "LEVEL3":
      return `The Snoo escalated to Level 3 at its peak for ${name}.`;
    case "LEVEL4":
      return `The Snoo reached its highest setting (Level 4) for ${name} at some point.`;
    default:
      return null;
  }
}

export interface DailySummary {
  date: string | null;
  twins: TwinSummary[];
  /** Natural-language sentences describing the last 24 hours. */
  sentences: string[];
}

const COLORS = ["blue", "pink"];

function mostRecentValidIndex(daily: DailyData[]): number {
  for (let i = daily.length - 1; i >= 0; i--) {
    if (daily[i].totalSleep > 0) return i;
  }
  return -1;
}

function formatDelta(deltaSeconds: number): string {
  const abs = Math.abs(deltaSeconds);
  const formatted = formatDurationCompact(abs);
  if (deltaSeconds > 0) return `${formatted} more than the day before`;
  return `${formatted} less than the day before`;
}

function humanDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function buildDailySummary(data: TwinData[]): DailySummary {
  const twins: TwinSummary[] = [];

  data.forEach((twin, i) => {
    const idx = mostRecentValidIndex(twin.dailyData);
    if (idx < 0) return;
    const day = twin.dailyData[idx];
    const prev = idx > 0 ? twin.dailyData[idx - 1] : null;
    const totalSleepDelta =
      prev && prev.totalSleep > 0 ? day.totalSleep - prev.totalSleep : null;

    twins.push({
      name: twin.baby.babyName || `Baby ${i + 1}`,
      color: COLORS[i] || COLORS[0],
      date: day.date,
      totalSleep: day.totalSleep,
      nightSleep: day.nightSleep,
      daySleep: day.daySleep,
      longestSleep: day.longestSleep,
      naps: day.naps,
      nightWakings: day.nightWakings,
      totalSleepDelta,
      peakLevel: day.peakLevel,
      longestStretches: day.longestStretches,
    });
  });

  if (twins.length === 0) {
    return {
      date: null,
      twins: [],
      sentences: ["No sleep data available for the last 24 hours yet."],
    };
  }

  const sentences: string[] = [];

  for (const t of twins) {
    let s = `${t.name} slept ${formatDuration(t.totalSleep)} total — ${formatDuration(
      t.nightSleep
    )} overnight and ${formatDuration(t.daySleep)} across ${t.naps} ${
      t.naps === 1 ? "nap" : "naps"
    }.`;
    s += ` Longest stretch was ${formatDuration(t.longestSleep)}, with ${
      t.nightWakings
    } night ${t.nightWakings === 1 ? "waking" : "wakings"}.`;
    if (t.totalSleepDelta !== null && Math.abs(t.totalSleepDelta) >= 60) {
      s += ` That's ${formatDelta(t.totalSleepDelta)}.`;
    }
    sentences.push(s);

    // Top overnight stretches (6pm–7am)
    if (t.longestStretches.length > 0) {
      const list = t.longestStretches
        .map((sec, i) => `#${i + 1} ${formatDurationCompact(sec)}`)
        .join(", ");
      sentences.push(`${t.name}'s longest overnight stretches: ${list}.`);
    }

    // Peak soothing level reached
    const peak = peakLevelPhrase(t.name, t.peakLevel);
    if (peak) sentences.push(peak);
  }

  // Comparison sentence for twins
  if (twins.length >= 2) {
    const [a, b] = twins;
    const diff = a.totalSleep - b.totalSleep;
    if (Math.abs(diff) < 60) {
      sentences.push(
        `${a.name} and ${b.name} slept about the same amount today.`
      );
    } else {
      const more = diff > 0 ? a : b;
      const less = diff > 0 ? b : a;
      sentences.push(
        `${more.name} slept ${formatDurationCompact(
          Math.abs(diff)
        )} more than ${less.name} today.`
      );
    }

    // Who woke more
    const wakingDiff = a.nightWakings - b.nightWakings;
    if (wakingDiff !== 0) {
      const calmer = wakingDiff > 0 ? b : a;
      const restless = wakingDiff > 0 ? a : b;
      sentences.push(
        `${calmer.name} had a calmer night (${calmer.nightWakings} wakings vs ${restless.name}'s ${restless.nightWakings}).`
      );
    }
  }

  return {
    date: twins[0].date,
    twins,
    sentences,
  };
}

export function summaryDateLabel(date: string | null): string {
  if (!date) return "Last 24 hours";
  return humanDate(date);
}
