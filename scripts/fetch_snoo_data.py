#!/usr/bin/env python3
"""
Standalone script to fetch Snoo sleep data and export to JSON/CSV.
Uses the current Happiest Baby API with AWS Cognito authentication.

Requires: HAPPIESTBABY_EMAIL and HAPPIESTBABY_PASSWORD env vars.

Usage:
  python fetch_snoo_data.py [--days 30] [--format json|csv]
"""
import argparse
import csv
import json
import os
import sys
from datetime import datetime, timedelta

import requests

API_BASE = "https://api-us-east-1-prod.happiestbaby.com"
COGNITO_ENDPOINT = "https://cognito-idp.us-east-1.amazonaws.com/"
CLIENT_ID = "6kqofhc8hm394ielqdkvli0oea"


def authenticate(email: str, password: str) -> str:
    headers = {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
    }
    payload = {
        "AuthFlow": "USER_PASSWORD_AUTH",
        "AuthParameters": {"USERNAME": email, "PASSWORD": password},
        "ClientId": CLIENT_ID,
    }
    res = requests.post(COGNITO_ENDPOINT, json=payload, headers=headers, timeout=30)
    res.raise_for_status()
    data = res.json()

    if "AuthenticationResult" not in data:
        print("Authentication failed - no token in response", file=sys.stderr)
        sys.exit(1)

    return data["AuthenticationResult"]["IdToken"]


def api_get(token: str, endpoint: str, params: dict | None = None):
    res = requests.get(
        f"{API_BASE}{endpoint}",
        params=params,
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )
    res.raise_for_status()
    return res.json()


def format_duration(seconds: int) -> str:
    h = seconds // 3600
    m = (seconds % 3600) // 60
    return f"{h}h {m}m"


def main():
    parser = argparse.ArgumentParser(description="Fetch Snoo sleep data")
    parser.add_argument("--days", type=int, default=30, help="Days of history")
    parser.add_argument("--format", choices=["json", "csv"], default="json")
    parser.add_argument("--output", type=str, default=None, help="Output file prefix")
    parser.add_argument("--timezone", type=str, default="Australia/Sydney")
    args = parser.parse_args()

    email = os.environ.get("HAPPIESTBABY_EMAIL")
    password = os.environ.get("HAPPIESTBABY_PASSWORD")

    if not email or not password:
        print("Set HAPPIESTBABY_EMAIL and HAPPIESTBABY_PASSWORD env vars", file=sys.stderr)
        sys.exit(1)

    print(f"Authenticating as {email}...", file=sys.stderr)
    token = authenticate(email, password)
    print("Authenticated successfully", file=sys.stderr)

    print("Fetching babies...", file=sys.stderr)
    babies = api_get(token, "/us/me/v10/babies")
    print(f"  Found {len(babies)} baby/babies:", file=sys.stderr)
    for b in babies:
        print(f"    - {b.get('babyName', 'Unknown')} (DOB: {b.get('birthDate', 'N/A')})", file=sys.stderr)

    all_results = []

    for baby in babies:
        baby_name = baby.get("babyName", "Unknown")
        baby_id = baby["_id"]
        print(f"\nFetching {args.days} days of sleep data for {baby_name}...", file=sys.stderr)

        daily_data = []
        now = datetime.now()
        for i in range(args.days, -1, -1):
            date = now - timedelta(days=i)
            start_time = date.strftime("%Y-%m-%d 06:00:00.000")
            try:
                session = api_get(
                    token,
                    f"/ss/me/v11/babies/{baby_id}/sessions/daily",
                    {
                        "detailedLevels": "true",
                        "levels": "true",
                        "startTime": start_time,
                        "timezone": args.timezone,
                    },
                )
                row = {
                    "date": date.strftime("%Y-%m-%d"),
                    "babyName": baby_name,
                    "totalSleep": session.get("totalSleep", 0),
                    "daySleep": session.get("daySleep", 0),
                    "nightSleep": session.get("nightSleep", 0),
                    "longestSleep": session.get("longestSleep", 0),
                    "naps": session.get("naps", 0),
                    "nightWakings": session.get("nightWakings", 0),
                }
                daily_data.append(row)
                total = format_duration(row["totalSleep"])
                print(
                    f"  {row['date']}: {total} total, "
                    f"{row['naps']} naps, {row['nightWakings']} wakings",
                    file=sys.stderr,
                )
            except requests.HTTPError as e:
                print(f"  {date.strftime('%Y-%m-%d')}: no data ({e})", file=sys.stderr)
                daily_data.append({
                    "date": date.strftime("%Y-%m-%d"),
                    "babyName": baby_name,
                    "totalSleep": 0, "daySleep": 0, "nightSleep": 0,
                    "longestSleep": 0, "naps": 0, "nightWakings": 0,
                })

        all_results.append({
            "baby": baby,
            "dailyData": daily_data,
        })

    output_prefix = args.output or f"snoo_data_{now.strftime('%Y%m%d')}"

    if args.format == "json":
        out_path = f"{output_prefix}.json" if not output_prefix.endswith(".json") else output_prefix
        with open(out_path, "w") as f:
            json.dump(all_results, f, indent=2)
        print(f"\nData saved to {out_path}", file=sys.stderr)
    else:
        # CSV: flatten all babies into one file
        all_rows = []
        for result in all_results:
            all_rows.extend(result["dailyData"])

        out_path = f"{output_prefix}.csv" if not output_prefix.endswith(".csv") else output_prefix
        if all_rows:
            with open(out_path, "w", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=all_rows[0].keys())
                writer.writeheader()
                writer.writerows(all_rows)
            print(f"\nData saved to {out_path}", file=sys.stderr)
        else:
            print("\nNo data to export", file=sys.stderr)


if __name__ == "__main__":
    main()
