import { NextRequest, NextResponse } from "next/server";
import { calculateBookingPrice } from "@/lib/pricing";

export const maxDuration = 30;

/** Endpoint público — calcula o preço total (noites com preço do calendário + taxas) para a página de reserva. */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const checkin = searchParams.get("checkin");
  const checkout = searchParams.get("checkout");
  if (!checkin || !checkout || checkin >= checkout) {
    return NextResponse.json({ error: "Indique checkin e checkout válidos." }, { status: 400 });
  }
  const breakdown = await calculateBookingPrice(checkin, checkout);
  return NextResponse.json(breakdown);
}
