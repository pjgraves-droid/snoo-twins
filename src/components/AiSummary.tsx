"use client";

import { useEffect, useState } from "react";
import { TwinData } from "@/lib/snoo-client";
import { Sparkles, RefreshCw } from "lucide-react";

interface AiSummaryProps {
  data: TwinData[];
}

export default function AiSummary({ data }: AiSummaryProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/ai-summary", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ data }),
        });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error || "Failed to generate AI summary");
          setSummary(null);
        } else {
          setSummary(json.summary);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to generate AI summary");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [data, nonce]);

  // Hide the block entirely if AI isn't configured, so the rule-based summary stands alone.
  if (error && !summary) {
    return null;
  }

  return (
    <section className="bg-gradient-to-br from-violet-950/40 to-zinc-900/40 border border-violet-800/40 rounded-xl sm:rounded-2xl p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-violet-300" />
        <h2 className="text-base sm:text-lg font-semibold">AI Summary</h2>
        <button
          onClick={() => setNonce((n) => n + 1)}
          disabled={loading}
          className="ml-auto p-1.5 rounded-lg text-violet-300/70 hover:text-violet-200 hover:bg-violet-900/40 transition-colors disabled:opacity-50"
          title="Regenerate"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && !summary ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-3 bg-violet-900/30 rounded w-full" />
          <div className="h-3 bg-violet-900/30 rounded w-11/12" />
          <div className="h-3 bg-violet-900/30 rounded w-4/5" />
        </div>
      ) : (
        <p className="text-zinc-200 text-sm sm:text-base leading-relaxed whitespace-pre-line">
          {summary}
        </p>
      )}
    </section>
  );
}
