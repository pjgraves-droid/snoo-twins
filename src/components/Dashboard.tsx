"use client";

import { useEffect, useState, useCallback } from "react";
import SleepChart from "./SleepChart";
import LevelDetailChart from "./LevelDetailChart";
import OvernightStretchChart from "./OvernightStretchChart";
import WakingsChart from "./WakingsChart";
import TotalSleepChart from "./TotalSleepChart";
import LongestStretchChart from "./LongestStretchChart";
import NapCountChart from "./NapCountChart";
import StatCard from "./StatCard";
import DailySummary from "./DailySummary";
import { TwinData, formatDuration } from "@/lib/snoo-client";
import { Moon, Sun, Baby, RefreshCw, Phone } from "lucide-react";

const COLORS = ["#3b82f6", "#ec4899"];
const COLOR_NAMES = ["blue", "pink"] as const;

function computeAverages(data: TwinData) {
  const validDays = data.dailyData.filter((d) => d.totalSleep > 0);
  if (validDays.length === 0) {
    return {
      avgTotalSleep: 0,
      avgDaySleep: 0,
      avgNightSleep: 0,
      avgLongestStretch: 0,
      avgNightWakings: 0,
      avgNaps: 0,
    };
  }
  const n = validDays.length;
  return {
    avgTotalSleep: validDays.reduce((s, d) => s + d.totalSleep, 0) / n,
    avgDaySleep: validDays.reduce((s, d) => s + d.daySleep, 0) / n,
    avgNightSleep: validDays.reduce((s, d) => s + d.nightSleep, 0) / n,
    avgLongestStretch: validDays.reduce((s, d) => s + d.longestSleep, 0) / n,
    avgNightWakings: validDays.reduce((s, d) => s + d.nightWakings, 0) / n,
    avgNaps: validDays.reduce((s, d) => s + d.naps, 0) / n,
  };
}

export default function Dashboard() {
  const [data, setData] = useState<TwinData[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(14);
  const [callStatus, setCallStatus] = useState<
    "idle" | "calling" | "ok" | "error"
  >("idle");
  const [callMsg, setCallMsg] = useState<string | null>(null);

  const testCall = useCallback(async () => {
    if (callStatus === "calling") return;
    setCallStatus("calling");
    setCallMsg(null);
    try {
      const res = await fetch("/api/test-call", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setCallStatus("error");
        setCallMsg(json.error || "Call failed");
      } else {
        setCallStatus("ok");
        setCallMsg(`Calling ${json.to}\u2026 your phone should ring shortly.`);
      }
    } catch (err) {
      setCallStatus("error");
      setCallMsg(err instanceof Error ? err.message : "Call failed");
    } finally {
      setTimeout(() => {
        setCallStatus("idle");
        setCallMsg(null);
      }, 8000);
    }
  }, [callStatus]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/snoo?days=${days}`);
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setData(json);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4" />
          <p className="text-zinc-400">Fetching Snoo data...</p>
          <p className="text-zinc-600 text-sm mt-1">
            Pulling {days} days of sleep history
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="bg-red-950/50 border border-red-800 rounded-2xl p-8 max-w-md text-center">
          <p className="text-red-400 font-semibold text-lg mb-2">Error</p>
          <p className="text-red-300 text-sm">{error}</p>
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm hover:bg-red-900 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-400">No Snoo data available</p>
      </div>
    );
  }

  const twins = data.map((twin, i) => ({
    ...twin,
    label: twin.baby.babyName || `Baby ${i + 1}`,
    color: COLORS[i] || COLORS[0],
    colorName: COLOR_NAMES[i] || COLOR_NAMES[0],
  }));

  const datasets = twins.map((t) => ({
    label: t.label,
    data: t.dailyData,
    color: t.color,
  }));

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Moon className="w-6 h-6 text-blue-400" />
              <Moon className="w-6 h-6 text-pink-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                Snoo Twins Dashboard
              </h1>
              <p className="text-zinc-500 text-xs">
                {twins.map((t) => t.label).join(" & ")} &middot; Sleep Analytics
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
            </select>
            <button
              onClick={testCall}
              disabled={callStatus === "calling"}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/90 border border-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              title="Place a test voice call to verify the alert pipeline"
            >
              <Phone className="w-4 h-4" />
              <span className="hidden sm:inline">
                {callStatus === "calling"
                  ? "Calling\u2026"
                  : callStatus === "ok"
                  ? "Call placed"
                  : "Test Voice"}
              </span>
            </button>
            <button
              onClick={fetchData}
              className="p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {callMsg && (
        <div
          className={`px-6 py-2 text-sm text-center ${
            callStatus === "error"
              ? "bg-red-950/60 text-red-300 border-b border-red-900"
              : "bg-emerald-950/60 text-emerald-300 border-b border-emerald-900"
          }`}
        >
          {callMsg}
        </div>
      )}

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* 24h written summary */}
        <DailySummary data={data} />

        {/* Stats per twin */}
        {twins.map((twin, idx) => {
          const avg = computeAverages(twin);
          const colorName = twin.colorName;
          return (
            <section key={idx}>
              <div className="flex items-center gap-2 mb-4">
                <Baby
                  className="w-5 h-5"
                  style={{ color: twin.color }}
                />
                <h2 className="text-lg font-semibold">{twin.label}</h2>
                {twin.baby.birthDate && (
                  <span className="text-zinc-600 text-xs ml-2">
                    DOB: {twin.baby.birthDate}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                <StatCard
                  label="Avg Total Sleep"
                  value={formatDuration(avg.avgTotalSleep)}
                  subtext="per day"
                  color={colorName}
                />
                <StatCard
                  label="Avg Night Sleep"
                  value={formatDuration(avg.avgNightSleep)}
                  subtext="per night"
                  color={colorName}
                />
                <StatCard
                  label="Avg Day Sleep"
                  value={formatDuration(avg.avgDaySleep)}
                  subtext="daytime naps"
                  color={colorName}
                />
                <StatCard
                  label="Avg Longest Stretch"
                  value={formatDuration(avg.avgLongestStretch)}
                  subtext="consecutive"
                  color={colorName}
                />
                <StatCard
                  label="Avg Night Wakings"
                  value={avg.avgNightWakings.toFixed(1)}
                  subtext="per night"
                  color={colorName}
                />
                <StatCard
                  label="Avg Naps"
                  value={avg.avgNaps.toFixed(1)}
                  subtext="per day"
                  color={colorName}
                />
              </div>
              <SleepChart
                data={twin.dailyData}
                title={`${twin.label} — Day vs Night Sleep`}
                color={colorName}
              />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                <LevelDetailChart
                  data={twin.dailyData}
                  title={`${twin.label} — Soothing Levels`}
                />
                <OvernightStretchChart
                  data={twin.dailyData}
                  title={`${twin.label} — Overnight Stretches`}
                  color={colorName}
                />
              </div>
            </section>
          );
        })}

        {/* Comparison charts */}
        {twins.length >= 2 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Sun className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-semibold">Twin Comparison</h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TotalSleepChart datasets={datasets} />
              <WakingsChart datasets={datasets} />
              <LongestStretchChart datasets={datasets} />
              <NapCountChart datasets={datasets} />
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-zinc-800 py-4 text-center text-zinc-600 text-xs">
        Data from Happiest Baby Snoo API &middot; Charts update on refresh
      </footer>
    </div>
  );
}
