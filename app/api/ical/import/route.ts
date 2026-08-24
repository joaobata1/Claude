import { NextResponse } from "next/server";
import { syncAllIcalSources } from "@/lib/ical-sync";

export async function POST() {
  const results = await syncAllIcalSources();
  return NextResponse.json({ synced: results });
}

export async function GET() {
  // Permite também acionar via GET para facilitar cron jobs simples (ex: cron-job.org)
  const results = await syncAllIcalSources();
  return NextResponse.json({ synced: results });
}
