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

export interface DailySession {
  totalSleep: number;
  daySleep: number;
  nightSleep: number;
  longestSleep: number;
  naps: number;
  nightWakings: number;
  levels: SessionLevel[];
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

        dailyData.push({
          date: date.toISOString().split("T")[0],
          totalSleep: session.totalSleep || 0,
          daySleep: session.daySleep || 0,
          nightSleep: session.nightSleep || 0,
          longestSleep: session.longestSleep || 0,
          naps: session.naps || 0,
          nightWakings: session.nightWakings || 0,
          sessions: session.levels || [],
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
