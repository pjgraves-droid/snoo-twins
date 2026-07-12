import { NextResponse } from "next/server";

/** Min seconds between test calls, to stop repeated clicks from spamming the phone. */
const COOLDOWN_SECONDS = 30;

// Module-scoped timestamp of the last placed call (best-effort; resets on cold start).
let lastCallAt = 0;

export async function POST() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  const to = process.env.TWILIO_TO;
  const voiceUrl = process.env.TWILIO_VOICE_TWIML_URL;

  if (!accountSid || !authToken || !from || !to || !voiceUrl) {
    return NextResponse.json(
      {
        error:
          "Twilio is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM, TWILIO_TO and TWILIO_VOICE_TWIML_URL.",
      },
      { status: 503 }
    );
  }

  const now = Date.now();
  const sinceLast = (now - lastCallAt) / 1000;
  if (sinceLast < COOLDOWN_SECONDS) {
    return NextResponse.json(
      { error: `Please wait ${Math.ceil(COOLDOWN_SECONDS - sinceLast)}s before testing again.` },
      { status: 429 }
    );
  }
  lastCallAt = now;

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;

  const form = new URLSearchParams();
  form.set("To", to);
  form.set("From", from);
  form.set("Url", voiceUrl);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    if (!res.ok) {
      lastCallAt = 0; // failed — don't hold the cooldown against the user
      const detail = await res.text();
      return NextResponse.json(
        { error: `Twilio call failed (${res.status}): ${detail}` },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, to });
  } catch (err) {
    lastCallAt = 0;
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
