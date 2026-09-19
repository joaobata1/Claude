import { NextRequest, NextResponse } from "next/server";
import { syncAllIcalSources } from "@/lib/ical-sync";
import { isMachineAuthorized } from "@/lib/machine-auth";

// Busca vários feeds .ics externos + escreve na BD — pode ultrapassar o limite de 10s
// por omissão da Vercel, especialmente com o Supabase a "acordar" de uma pausa.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!(await isMachineAuthorized(req))) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const results = await syncAllIcalSources();
  return NextResponse.json({ synced: results });
}

export async function GET(req: NextRequest) {
  // Permite também acionar via GET para facilitar cron jobs simples (ex: cron-job.org)
  if (!(await isMachineAuthorized(req))) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const results = await syncAllIcalSources();
  return NextResponse.json({ synced: results });
}
