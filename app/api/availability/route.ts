import { NextResponse } from "next/server";
import { getBlockedDates } from "@/lib/availability";

export const maxDuration = 30;

/** Rota pública: datas já ocupadas (reservas do site + bloqueios vindos das OTAs), para o motor de reservas dar feedback imediato ao cliente. */
export async function GET() {
  const blockedDates = await getBlockedDates();
  return NextResponse.json({ blockedDates });
}
