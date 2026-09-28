import { NextRequest, NextResponse } from "next/server";
import { getBookingsOverview } from "@/lib/bookings-overview";

// Ver nota em daily-prices/bulk/route.ts — a 1ª ligação depois de o Supabase
// "acordar" de uma pausa pode ultrapassar os 10s por omissão da Vercel.
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  // As canceladas só vêm quando pedidas — a folha de reservas tem um botão para as ver.
  const incluirCanceladas = new URL(req.url).searchParams.get("canceladas") === "1";
  const bookings = await getBookingsOverview({ incluirCanceladas });
  return NextResponse.json({ bookings });
}
