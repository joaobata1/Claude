import { NextRequest, NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";
import { validateGuestsForSave, saveGuestsForBooking, getGuestsForBooking, GuestInput } from "@/lib/guests";
import { releaseAccessIfReady } from "@/lib/access-release";

export const maxDuration = 30;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const guests = await getGuestsForBooking(bookingId);
  return NextResponse.json({ guests });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  await ensureSchema();
  const [booking] = await sql`SELECT * FROM bookings WHERE id = ${bookingId}`;
  if (!booking) {
    return NextResponse.json({ error: "Reserva não encontrada." }, { status: 404 });
  }

  const body = await req.json();
  const guests: GuestInput[] = body.guests ?? [];

  const error = validateGuestsForSave(guests);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  const savedCount = await saveGuestsForBooking(bookingId, guests);

  // Se o pagamento já estava confirmado e só faltavam os dados dos hóspedes, liberta agora.
  const release = await releaseAccessIfReady(bookingId);

  return NextResponse.json({ ok: true, savedCount, release });
}
