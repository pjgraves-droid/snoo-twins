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
and re-arm once the level drops. Alerts only fire during **quiet hours
(10pm–7am, Australia/Sydney by default)** — outside that window the level is
still logged but no call/SMS is placed.

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
| `SNOO_ALERT_TIMEZONE` | `Australia/Sydney` | IANA tz the window hours are read in |
| `SNOO_ALERT_START_HOUR` | `22` | hour (0-23) the alert window opens (inclusive) |
| `SNOO_ALERT_END_HOUR` | `7` | hour (0-23) the alert window closes (exclusive) |
| `TWILIO_*` | (unset) | if set, sends real SMS/calls; if unset, **dry-run** (logs to console) |

The alert window wraps past midnight when the start hour is greater than the
end hour (e.g. `22`→`7` covers 22:00–06:59). Set the two hours equal for 24h
alerting.

### Dry run

With no `TWILIO_*` vars set, the worker prints alerts to the console instead of
sending them — useful to validate the level detection before wiring up Twilio.

## Deploying

Run it anywhere that keeps a process alive. It holds a single **outbound**
polling loop, needs **no inbound ports**, no database, and no persistent disk —
so the cheapest always-on option works fine. Pick one:

### Option A — Docker (recommended)

The included `Dockerfile` builds a minimal image (no runtime deps).

```bash
cd snoo-alerts
cp .env.example .env          # fill in HAPPIESTBABY_* (and TWILIO_* to go live)
docker build -t snoo-alerts .
docker run -d --name snoo-alerts --restart unless-stopped --env-file .env snoo-alerts
docker logs -f snoo-alerts    # watch alerts
```

Or with Compose (`docker-compose.yml` is included):

```bash
cd snoo-alerts
cp .env.example .env
docker compose up -d --build
docker compose logs -f
```

### Option B — systemd (VPS / Raspberry Pi)

A ready unit file is at `deploy/snoo-alerts.service`.

```bash
sudo mkdir -p /opt/snoo-alerts && sudo cp -r . /opt/snoo-alerts
cd /opt/snoo-alerts && npm install && npm run build
sudo cp .env.example /etc/snoo-alerts.env   # edit it, then: sudo chmod 600 /etc/snoo-alerts.env
sudo cp deploy/snoo-alerts.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now snoo-alerts
journalctl -u snoo-alerts -f                 # watch alerts
```

### Option C — Railway (recommended managed host)

The repo ships a `snoo-alerts/railway.json` that pins the Dockerfile builder and
an always-on restart policy, so deploying is just "point Railway at this folder
and add the env vars." There's no HTTP port — it runs purely as a background
worker.

**Via the Railway dashboard:**

1. New Project → **Deploy from GitHub repo** → pick `pjgraves-droid/snoo-twins`.
2. Open the service → **Settings** → set **Root Directory** to `snoo-alerts`.
   (This is what makes `railway.json` and the Dockerfile take effect.)
3. **Variables** → add at minimum:
   - `HAPPIESTBABY_EMAIL`
   - `HAPPIESTBABY_PASSWORD`

   Leave the `TWILIO_*` vars unset for now — the worker runs in **dry-run**
   (console) mode until they're provided. Add them later to go live (see the
   Twilio section in `.env.example`).
4. Deploy. Watch the **Deploy Logs** — you should see both Snoos and their
   current levels within ~10s.

**Via the Railway CLI** (from the repo root):

```bash
npm i -g @railway/cli
railway login
railway init                       # create/link a project
railway up --service snoo-alerts ./snoo-alerts
railway variables set HAPPIESTBABY_EMAIL=you@example.com HAPPIESTBABY_PASSWORD=...
```

> No public URL is needed or created — don't add a domain. If Railway prompts to
> expose a port, skip it; this is a worker, not a web service.

### Option D — Fly / Render

Same idea: point the platform at the `snoo-alerts/` directory (it auto-detects
the Dockerfile), set the env vars in the dashboard, and deploy it as a **worker /
background service** with an always-on restart policy.

### Sanity check before going live

Run once in the foreground and confirm you see your Snoos and their current
levels; it stays in dry-run (console) mode until `TWILIO_*` is set:

```bash
docker run --rm --env-file .env snoo-alerts   # Ctrl-C to stop
```

> Note: this uses Happiest Baby's undocumented cloud API (reverse-engineered).
> Endpoints/keys may change without notice.
