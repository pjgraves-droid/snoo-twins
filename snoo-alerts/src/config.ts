export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  from: string;
  to: string;
  /** "sms" sends a text; "call" places a voice call using a TwiML URL. */
  mode: "sms" | "call";
  /** TwiML URL used when mode is "call". */
  voiceUrl: string;
}

export interface Config {
  email: string;
  password: string;
  /** How often to poll the devices endpoint, in ms. */
  pollIntervalMs: number;
  /** Soothing level that triggers an alert (e.g. "LEVEL2"). */
  triggerLevel: string;
  /** How long the level must be continuously held before alerting, in seconds. */
  sustainSeconds: number;
  /** Minimum time between alerts for the same device, in seconds. */
  cooldownSeconds: number;
  /**
   * Optional allow-list of device serials or names (case-insensitive substring)
   * to watch. Empty means watch every device on the account.
   */
  deviceFilter: string[];
  /** Twilio settings, or null to run in dry-run (console-only) mode. */
  twilio: TwilioConfig | null;
}

function req(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

function num(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Environment variable ${name} must be a positive number, got "${v}"`);
  }
  return n;
}

function loadTwilio(): TwilioConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  const to = process.env.TWILIO_TO;

  // If none of the Twilio vars are set, run in dry-run mode.
  if (!accountSid && !authToken && !from && !to) {
    return null;
  }

  // If some but not all are set, fail loudly rather than half-configuring.
  if (!accountSid || !authToken || !from || !to) {
    throw new Error(
      "Partial Twilio configuration: set all of TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM, TWILIO_TO (or none to run in dry-run mode)."
    );
  }

  const mode = (process.env.TWILIO_MODE ?? "sms").toLowerCase();
  if (mode !== "sms" && mode !== "call") {
    throw new Error(`TWILIO_MODE must be "sms" or "call", got "${mode}"`);
  }

  const voiceUrl = process.env.TWILIO_VOICE_TWIML_URL ?? "";
  if (mode === "call" && !voiceUrl) {
    throw new Error('TWILIO_MODE="call" requires TWILIO_VOICE_TWIML_URL to be set.');
  }

  return { accountSid, authToken, from, to, mode, voiceUrl };
}

export function loadConfig(): Config {
  const deviceFilter = (process.env.SNOO_DEVICE_FILTER ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    email: req("HAPPIESTBABY_EMAIL"),
    password: req("HAPPIESTBABY_PASSWORD"),
    pollIntervalMs: num("SNOO_POLL_INTERVAL_MS", 10_000),
    triggerLevel: (process.env.SNOO_TRIGGER_LEVEL ?? "LEVEL2").toUpperCase(),
    sustainSeconds: num("SNOO_SUSTAIN_SECONDS", 30),
    cooldownSeconds: num("SNOO_COOLDOWN_SECONDS", 300),
    deviceFilter,
    twilio: loadTwilio(),
  };
}
