import { NextRequest, NextResponse } from "next/server";
import { getDateRatePlanMap, applyRatePlanToDates } from "@/lib/rate-plans";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  if (!start || !end) {
    return NextResponse.json({ error: "Indique start e end (YYYY-MM-DD)." }, { status: 400 });
  }

  const map = await getDateRatePlanMap(start, end);
  return NextResponse.json({ ratePlansByDate: Object.fromEntries(map) });
}

/** Aplica uma tarifa a várias datas de uma vez (ex: popup "Aplicar tarifa" do calendário). */
export async function POST(req: NextRequest) {
  const { ratePlanId, dates } = await req.json();
  if (!ratePlanId || !Array.isArray(dates) || dates.length === 0) {
    return NextResponse.json({ error: "Dados em falta (ratePlanId, dates)." }, { status: 400 });
  }

  try {
    await applyRatePlanToDates(String(ratePlanId), dates);
    return NextResponse.json({ ok: true, count: dates.length });
  } catch (err) {
    console.error("Erro ao aplicar tarifa em massa:", err);
    return NextResponse.json(
      { error: "Não foi possível ligar à base de dados. Verifique se o projeto Supabase está ativo (não pausado)." },
      { status: 500 }
    );
  }
}
