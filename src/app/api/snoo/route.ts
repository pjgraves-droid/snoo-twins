import { NextResponse } from "next/server";
import { fetchSnooData } from "@/lib/snoo-client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "30", 10);

  const email = process.env.HAPPIESTBABY_EMAIL;
  const password = process.env.HAPPIESTBABY_PASSWORD;

  if (!email || !password) {
    return NextResponse.json(
      { error: "HAPPIESTBABY_EMAIL and HAPPIESTBABY_PASSWORD env vars required" },
      { status: 500 }
    );
  }

  try {
    const data = await fetchSnooData(email, password, days);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
