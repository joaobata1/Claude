import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { sql, ensureSchema } from "@/lib/db";
import { validateGuestsForSave, saveGuestsForBooking, GuestInput } from "@/lib/guests";
import { releaseAccessIfReady } from "@/lib/access-release";

export const maxDuration = 30;

/**
 * Usado no backoffice quando chega uma reserva do Airbnb/Booking/VRBO.
 * Os dados dos hóspedes podem ficar incompletos nesta fase (o interruptor
 * "obrigar dados dos hóspedes" decide se isso bloqueia o envio do código Nuki).
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    source,
    guestName,
    guestEmail,
    guestPhone,
    checkin,
    checkout,
    guestsCount,
    guests,
    totalPrice,
    commissionAmount,
    cleaningCost,
    bookingReference,
  } = body;

  if (!source || !guestName || !checkin || !checkout) {
    return NextResponse.json({ error: "Dados em falta." }, { status: 400 });
  }
  if (!["airbnb", "booking", "vrbo", "outros"].includes(source)) {
    return NextResponse.json({ error: "Origem inválida." }, { status: 400 });
  }

  const guestList: GuestInput[] = guests ?? [];
  const guestsError = validateGuestsForSave(guestList);
  if (guestsError) {
    return NextResponse.json({ error: guestsError }, { status: 400 });
  }

  await ensureSchema();
  const bookingId = randomUUID();

  await sql`
    INSERT INTO bookings
    (id, source, guest_name, guest_email, guest_phone, checkin, checkout, guests_count,
     price_total, commission_amount, cleaning_cost, booking_reference, payment_status)
    VALUES (${bookingId}, ${source}, ${guestName}, ${guestEmail ?? null}, ${guestPhone ?? null}, ${checkin}, ${checkout}, ${guestsCount ?? 1},
     ${totalPrice ?? null}, ${commissionAmount ?? 0}, ${cleaningCost ?? 0}, ${bookingReference ?? null}, 'not_applicable')
  `;

  await saveGuestsForBooking(bookingId, guestList);

  try {
    const release = await releaseAccessIfReady(bookingId);
    return NextResponse.json({ bookingId, release });
  } catch (err: any) {
    return NextResponse.json(
      { bookingId, warning: `Reserva guardada, mas falhou geração do código Nuki: ${err.message}` },
      { status: 207 }
    );
  }
}
