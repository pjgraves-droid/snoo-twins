import type { TwilioConfig } from "./config.js";

export interface Notifier {
  send(subject: string, body: string): Promise<void>;
}

/** Dry-run notifier: logs what would be sent. Used when Twilio is unconfigured. */
export class ConsoleNotifier implements Notifier {
  async send(subject: string, body: string): Promise<void> {
    console.log(`\n🔔 [ALERT — dry run] ${subject}\n   ${body}\n`);
  }
}

/** Sends an SMS or places a voice call via the Twilio REST API (no SDK needed). */
export class TwilioNotifier implements Notifier {
  constructor(private readonly cfg: TwilioConfig) {}

  async send(subject: string, body: string): Promise<void> {
    // Twilio calls/SMS are temporarily disabled — the worker logs what it would
    // have sent instead of hitting the Twilio API. To re-enable, uncomment the
    // block below.
    console.log(
      `🔕 [ALERT — Twilio ${this.cfg.mode} DISABLED] would have notified ` +
        `${this.cfg.to}: ${subject} — ${body}`
    );

    // const auth = Buffer.from(`${this.cfg.accountSid}:${this.cfg.authToken}`).toString("base64");
    // const endpoint =
    //   this.cfg.mode === "call" ? "Calls.json" : "Messages.json";
    // const url = `https://api.twilio.com/2010-04-01/Accounts/${this.cfg.accountSid}/${endpoint}`;
    //
    // const form = new URLSearchParams();
    // form.set("To", this.cfg.to);
    // form.set("From", this.cfg.from);
    // if (this.cfg.mode === "call") {
    //   form.set("Url", this.cfg.voiceUrl);
    // } else {
    //   form.set("Body", `${subject} — ${body}`);
    // }
    //
    // const res = await fetch(url, {
    //   method: "POST",
    //   headers: {
    //     Authorization: `Basic ${auth}`,
    //     "Content-Type": "application/x-www-form-urlencoded",
    //   },
    //   body: form.toString(),
    // });
    //
    // if (!res.ok) {
    //   throw new Error(`Twilio ${this.cfg.mode} failed (${res.status}): ${await res.text()}`);
    // }
    // console.log(`🔔 [ALERT — Twilio ${this.cfg.mode}] sent to ${this.cfg.to}: ${subject}`);
  }
}

export function createNotifier(twilio: TwilioConfig | null): Notifier {
  return twilio ? new TwilioNotifier(twilio) : new ConsoleNotifier();
}
