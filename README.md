# Snoo Twins Dashboard

Sleep analytics dashboard for twin Snoo Smart Bassinets. Pulls data from the Happiest Baby cloud API and renders interactive comparison charts.

## Features

- **Per-baby sleep breakdown** — stacked bar charts showing day vs night sleep
- **Twin comparison** — overlay charts for total sleep, night wakings, longest stretch, and nap count
- **Summary stats** — average total sleep, night sleep, day sleep, longest stretch, night wakings, and naps
- **Configurable lookback** — 7, 14, 30, 60, or 90 day views
- **Standalone export script** — Python script to dump data to JSON or CSV

## Setup

```bash
npm install
```

Set your Happiest Baby credentials (the login you use in the Snoo app):

```bash
export HAPPIESTBABY_EMAIL="your-email@example.com"
export HAPPIESTBABY_PASSWORD="your-password"
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Standalone Data Export

```bash
pip install requests
python scripts/fetch_snoo_data.py --days 30 --format json
python scripts/fetch_snoo_data.py --days 30 --format csv
```

## How It Works

The Snoo bassinets don't expose a local network API. Instead, they sync data to the Happiest Baby cloud via WiFi. This app authenticates against `snoo-api.happiestbaby.com` using your account credentials and pulls:

- Daily aggregated sleep sessions (total, day, night split)
- Session-level detail (asleep, soothing, awake periods)
- Device info (serial number, firmware, WiFi network)
- Baby info (name, birth date, settings)

For accounts with multiple Snoos (twins), the app enumerates all devices and displays per-baby stats with comparison views.

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Recharts
- Happiest Baby REST API (unofficial/undocumented)
