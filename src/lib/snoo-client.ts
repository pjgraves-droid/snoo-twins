const API_BASE = "https://api-us-east-1-prod.happiestbaby.com";
const COGNITO_ENDPOINT = "https://cognito-idp.us-east-1.amazonaws.com/";
const CLIENT_ID = "6kqofhc8hm394ielqdkvli0oea";

interface CognitoAuthResult {
  AuthenticationResult: {
    IdToken: string;
    AccessToken: string;
    RefreshToken: string;
    ExpiresIn: number;
  };
}

export interface SnooBaby {
  _id: string;
  babyName: string;
  birthDate: string;
  sex: string | null;
  settings?: {
    daytimeStart?: number;
    motionLimiter?: boolean;
    weaning?: boolean;
    responsivenessLevel?: string;
    minimalLevel?: string;
  };
}

export interface SessionLevel {
  sessionId: string;
  startTime: string;
  stateDuration: number;
  type: "asleep" | "soothing" | "awake";
  isActive: boolean;
}

/** A segment from the API's detailedLevels array (per-soothing-level breakdown). */
export interface DetailedLevelEntry {
  level: string;
  stateDuration: number;
  type?: string;
  startTime?: string;
}

/** The five soothing levels a Snoo cycles through, ordered from calmest to strongest. */
export const LEVEL_ORDER = [
  "BASELINE",
  "LEVEL1",
  "LEVEL2",
  "LEVEL3",
  "LEVEL4",
] as const;

export type SnooLevel = (typeof LEVEL_ORDER)[number];

export interface DailySession {
  totalSleep: number;
  daySleep: number;
  nightSleep: number;
  longestSleep: number;
  naps: number;
  nightWakings: number;
  levels: SessionLevel[];
  detailedLevels?: DetailedLevelEntry[];
  timezone: string | null;
}

export interface DailyData {
  date: string;
  totalSleep: number;
  daySleep: number;
  nightSleep: number;
  longestSleep: number;
  naps: number;
  nightWakings: number;
  sessions: SessionLevel[];
  /** Seconds spent at each soothing level over the day (from detailedLevels). */
  levelSeconds: Record<SnooLevel, number>;
  /** Highest soothing level reached that day (null if no data). */
  peakLevel: SnooLevel | null;
  /** The three longest continuous overnight sleep stretches, in seconds (desc). */
  longestStretches: number[];
}

export interface TwinData {
  baby: SnooBaby;
  dailyData: DailyData[];
}

let cachedToken: string | null = null;
let tokenExpiry = 0;

async function authenticate(email: string, password: string): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const res = await fetch(COGNITO_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
    },
    body: JSON.stringify({
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
      ClientId: CLIENT_ID,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Auth failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as CognitoAuthResult;

  if (!data.AuthenticationResult?.IdToken) {
    throw new Error("Authentication failed - no token in response");
  }

  cachedToken = data.AuthenticationResult.IdToken;
  tokenExpiry = Date.now() + (data.AuthenticationResult.ExpiresIn - 60) * 1000;
  return cachedToken;
}

async function apiGet<T>(
  token: string,
  endpoint: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(`${API_BASE}${endpoint}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${endpoint} (${res.status}): ${text}`);
  }

  return res.json() as Promise<T>;
}

function formatDateForSleepApi(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day} 06:00:00.000`;
}

function emptyLevelSeconds(): Record<SnooLevel, number> {
  return { BASELINE: 0, LEVEL1: 0, LEVEL2: 0, LEVEL3: 0, LEVEL4: 0 };
}

function computeLevelSeconds(
  detailed: DetailedLevelEntry[]
): Record<SnooLevel, number> {
  const out = emptyLevelSeconds();
  for (const d of detailed) {
    if ((LEVEL_ORDER as readonly string[]).includes(d.level)) {
      out[d.level as SnooLevel] += d.stateDuration || 0;
    }
  }
  return out;
}

function computePeakLevel(
  levelSeconds: Record<SnooLevel, number>
): SnooLevel | null {
  for (let i = LEVEL_ORDER.length - 1; i >= 0; i--) {
    const lvl = LEVEL_ORDER[i];
    if (levelSeconds[lvl] > 0) return lvl;
  }
  return null;
}

/** Local hour (0-23) parsed from an API timestamp like "2026-07-10 21:35:00.000". */
function localHour(startTime: string): number {
  const m = /\s(\d{2}):/.exec(startTime);
  return m ? parseInt(m[1], 10) : 12;
}

/**
 * The three longest continuous overnight sleep stretches (seconds, desc).
 *
 * A "stretch" is one sleep session's total asleep time — the API groups the
 * brief soothing bumps (level ups) that don't wake the baby into a single
 * session, so we sum the asleep segments per sessionId. This matches how the
 * API derives `longestSleep` (its value equals the largest such session sum).
 * "Overnight" = a session that begins between 6pm and 7am local time — the 6pm
 * start captures early bedtimes (babies here settle ~6:30pm) while excluding
 * daytime naps (daytimeStart is 7am).
 */
function computeLongestStretches(levels: SessionLevel[]): number[] {
  const bySession = new Map<string, { start: string; asleep: number }>();
  for (const l of levels) {
    const cur = bySession.get(l.sessionId) ?? {
      start: l.startTime,
      asleep: 0,
    };
    if (l.type === "asleep") cur.asleep += l.stateDuration || 0;
    if (l.startTime < cur.start) cur.start = l.startTime;
    bySession.set(l.sessionId, cur);
  }

  return Array.from(bySession.values())
    .filter((s) => {
      const h = localHour(s.start);
      return h >= 18 || h < 7;
    })
    .map((s) => s.asleep)
    .filter((asleep) => asleep >= 60)
    .sort((a, b) => b - a)
    .slice(0, 3);
}

export async function fetchSnooData(
  email: string,
  password: string,
  lookbackDays: number = 30
): Promise<TwinData[]> {
  const token = await authenticate(email, password);

  // Get list of babies
  const babies = await apiGet<SnooBaby[]>(token, "/us/me/v10/babies");

  if (!babies || babies.length === 0) {
    throw new Error("No babies found in your account");
  }

  const results: TwinData[] = [];

  // For each baby, pull daily sleep data
  for (const baby of babies) {
    const dailyData: DailyData[] = [];
    const now = new Date();

    for (let i = lookbackDays; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      try {
        const session = await apiGet<DailySession>(
          token,
          `/ss/me/v11/babies/${baby._id}/sessions/daily`,
          {
            detailedLevels: "true",
            levels: "true",
            startTime: formatDateForSleepApi(date),
            timezone: "Australia/Sydney",
          }
        );

        const levelSeconds = computeLevelSeconds(session.detailedLevels || []);

        dailyData.push({
          date: date.toISOString().split("T")[0],
          totalSleep: session.totalSleep || 0,
          daySleep: session.daySleep || 0,
          nightSleep: session.nightSleep || 0,
          longestSleep: session.longestSleep || 0,
          naps: session.naps || 0,
          nightWakings: session.nightWakings || 0,
          sessions: session.levels || [],
          levelSeconds,
          peakLevel: computePeakLevel(levelSeconds),
          longestStretches: computeLongestStretches(session.levels || []),
        });
      } catch {
        dailyData.push({
          date: date.toISOString().split("T")[0],
          totalSleep: 0,
          daySleep: 0,
          nightSleep: 0,
          longestSleep: 0,
          naps: 0,
          nightWakings: 0,
          sessions: [],
          levelSeconds: emptyLevelSeconds(),
          peakLevel: null,
          longestStretches: [],
        });
      }
    }

    results.push({ baby, dailyData });
  }

  return results;
}

export function secondsToHours(seconds: number): number {
  return Math.round((seconds / 3600) * 100) / 100;
}

export function formatDuration(seconds: number): string {
  if (!seconds) return "0h 0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}
