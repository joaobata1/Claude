import { NextRequest, NextResponse } from "next/server";
import { submitDailySiba, generateDailyReport } from "@/lib/siba";
import { todayInLisbon as todayISO } from "@/lib/dates";
import { isMachineAuthorized } from "@/lib/machine-auth";

export const maxDuration = 30;



export async function POST(req: NextRequest) {
  if (!(await isMachineAuthorized(req))) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const date = body.date ?? todayISO();
  const result = await submitDailySiba(date);
  return NextResponse.json(result);
}

/** Permite consultar o relatório do dia sem submeter, para conferência manual */
export async function GET(req: NextRequest) {
  // O relatório contém dados pessoais dos hóspedes (nome, documento, nascimento):
  // nunca pode ser acessível sem autenticação.
  if (!(await isMachineAuthorized(req))) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const date = new URL(req.url).searchParams.get("date") ?? todayISO();
  const report = await generateDailyReport(date);
  return new NextResponse(report, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
