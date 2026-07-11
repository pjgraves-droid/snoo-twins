# snoo-alerts

A small standalone worker that watches your Snoo bassinet(s) and fires an alert
(Twilio SMS or voice call) when a soothing **level is sustained** for a
configurable duration — e.g. "text me when a Snoo stays at LEVEL2 for 30s".

It is separate from the Next.js dashboard because alerting needs a **long-running
process** (a browser tab or serverless request can't stay subscribed 24/7).

## How it works

The Snoo cloud's devices endpoint (`GET /ds/me/v10/devices`) embeds each device's
live `activityState.state_machine.state` (`ONLINE`, `BASELINE`, `LEVEL1`–`LEVEL4`)
and updates in near-real-time via the device's AWS IoT connection. The worker
polls that endpoint and applies the rule below — no PubNub/MQTT client needed,
and no dependencies beyond Node 18+.

```
poll /ds/me/v10/devices every N seconds
        │
        ▼
for each watched, online device:
  state == TRIGGER_LEVEL  ──held ≥ SUSTAIN?──►  alert (respecting COOLDOWN)
        │ no
        ▼
  reset the sustain timer
```

The default rule (matching the initial request): **alert when a Snoo is at
`LEVEL2` continuously for ≥ 30 seconds**, then stay quiet for a cooldown window
and re-arm once the level drops.

## Setup

```bash
cd snoo-alerts
npm install
cp .env.example .env   # fill in HAPPIESTBABY_EMAIL / HAPPIESTBABY_PASSWORD
npm run build
npm start
```

For local iteration without a build step: `npm run dev` (uses ts-node if installed)
or run the compiled output with `node dist/index.js`.

## Configuration

All via environment variables (see `.env.example`):

| Var | Default | Meaning |
|-----|---------|---------|
| `HAPPIESTBABY_EMAIL` / `HAPPIESTBABY_PASSWORD` | — | account credentials (required) |
| `SNOO_TRIGGER_LEVEL` | `LEVEL2` | level that triggers an alert |
| `SNOO_SUSTAIN_SECONDS` | `30` | how long the level must be held |
| `SNOO_COOLDOWN_SECONDS` | `300` | min gap between alerts per device |
| `SNOO_POLL_INTERVAL_MS` | `10000` | poll frequency |
| `SNOO_DEVICE_FILTER` | (all) | comma list of serials/names to watch |
| `TWILIO_*` | (unset) | if set, sends real SMS/calls; if unset, **dry-run** (logs to console) |

### Dry run

With no `TWILIO_*` vars set, the worker prints alerts to the console instead of
sending them — useful to validate the level detection before wiring up Twilio.

## Deploying

Run it anywhere that keeps a process alive: a small VPS, a Docker container,
Railway/Fly/Render, or a systemd service. It holds a single outbound polling
loop and needs no inbound ports.

> Note: this uses Happiest Baby's undocumented cloud API (reverse-engineered).
> Endpoints/keys may change without notice.
