import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateGuestsForSave, saveGuestsForBooking, getGuestsForBooking, GuestInput } from "@/lib/guests";
import { releaseAccessIfReady } from "@/lib/access-release";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const guests = getGuestsForBooking(bookingId);
  return NextResponse.json({ guests });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const booking = db.prepare("SELECT * FROM bookings WHERE id = ?").get(bookingId) as any;
  if (!booking) {
    return NextResponse.json({ error: "Reserva não encontrada." }, { status: 404 });
  }

  const body = await req.json();
  const guests: GuestInput[] = body.guests ?? [];

  const error = validateGuestsForSave(guests);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  const savedCount = saveGuestsForBooking(bookingId, guests);

  // Se o pagamento já estava confirmado e só faltavam os dados dos hóspedes, liberta agora.
  const release = await releaseAccessIfReady(bookingId);

  return NextResponse.json({ ok: true, savedCount, release });
}
