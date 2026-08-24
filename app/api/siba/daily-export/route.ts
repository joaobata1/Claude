import { NextRequest, NextResponse } from "next/server";
import { submitDailySiba, generateDailyReport } from "@/lib/siba";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const date = body.date ?? todayISO();
  const result = await submitDailySiba(date);
  return NextResponse.json(result);
}

/** Permite consultar o relatório do dia sem submeter, para conferência manual */
export async function GET(req: NextRequest) {
  const date = new URL(req.url).searchParams.get("date") ?? todayISO();
  const report = generateDailyReport(date);
  return new NextResponse(report, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
