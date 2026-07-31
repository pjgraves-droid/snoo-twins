import { NextResponse } from "next/server";
import { TwinData } from "@/lib/snoo-client";
import { buildAiSummaryInput } from "@/lib/summary";

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `You are a warm, concise sleep-tracking assistant for parents of newborn twins.
You receive structured Snoo bassinet sleep data (all durations in MINUTES) for both babies:
- Three windows: "Yesterday" (7am-7pm the day before), "Last Night" (7pm-7am) and "Today" (7am until now, capped at 7pm).
- A recent daily trend (most recent last) for spotting patterns.

Write a natural-language summary of 3-5 sentences covering the twins' recent sleep behaviour and any
notable patterns or trends (e.g. improving or worsening night sleep, longer/shorter stretches, more or
fewer wakings) and how the two twins compare. Convert minutes to hours/minutes (e.g. "8h 59m") when
citing durations. Be factual and encouraging.

Rules:
- Do NOT give medical advice, diagnoses, or recommendations about sleep training, feeding, or health.
  Describe patterns only.
- If a window has hasElapsed=false or no data, do not invent numbers for it.
- Snoo peak levels go BASELINE < LEVEL1 < LEVEL2 < LEVEL3 < LEVEL4; higher means the bassinet worked
  harder to soothe, BASELINE means calm.
- Output plain prose only — no markdown headings, no bullet lists.`;

// Small in-process cache so repeated renders within a short window don't re-bill the API.
let cache: { key: string; summary: string; at: number } | null = null;
const CACHE_TTL_MS = 60_000;

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "AI summary is not configured. Set ANTHROPIC_API_KEY in the environment.",
      },
      { status: 503 }
    );
  }

  let data: TwinData[];
  try {
    const body = await request.json();
    data = body.data;
    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: "No twin data provided." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const input = buildAiSummaryInput(data);
  const key = JSON.stringify(input.twins);

  if (cache && cache.key === key && Date.now() - cache.at < CACHE_TTL_MS) {
    return NextResponse.json({ summary: cache.summary, cached: true });
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Sleep data (JSON, durations in minutes):\n${JSON.stringify(
              input
            )}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json(
        { error: `Anthropic request failed (${res.status}): ${detail}` },
        { status: 502 }
      );
    }

    const json = (await res.json()) as {
      content?: { type: string; text?: string }[];
    };
    const summary = (json.content || [])
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text)
      .join("")
      .trim();

    if (!summary) {
      return NextResponse.json(
        { error: "Anthropic returned an empty response." },
        { status: 502 }
      );
    }

    cache = { key, summary, at: Date.now() };
    return NextResponse.json({ summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
