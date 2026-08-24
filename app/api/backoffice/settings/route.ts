import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting, SETTINGS_KEYS } from "@/lib/db";

export async function GET() {
  const values: Record<string, string | null> = {};
  for (const key of SETTINGS_KEYS) values[key] = getSetting(key);
  return NextResponse.json(values);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  for (const key of SETTINGS_KEYS) {
    if (key in body) setSetting(key, String(body[key]));
  }
  return NextResponse.json({ ok: true });
}
