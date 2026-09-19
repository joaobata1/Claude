import { NextResponse } from "next/server";
import { getBookingsOverview } from "@/lib/bookings-overview";

// Ver nota em daily-prices/bulk/route.ts — a 1ª ligação depois de o Supabase
// "acordar" de uma pausa pode ultrapassar os 10s por omissão da Vercel.
export const maxDuration = 30;

export async function GET() {
  const bookings = await getBookingsOverview();
  return NextResponse.json({ bookings });
}
