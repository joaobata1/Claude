import { NextRequest, NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";
import { getGuestsForBooking } from "@/lib/guests";

const EDITABLE_FIELDS = [
  "guest_name",
  "guest_email",
  "guest_phone",
  "checkin",
  "checkout",
  "guests_count",
  "price_total",
  "commission_amount",
  "cleaning_cost",
  "booking_reference",
  "payment_status",
  "guest_language",
  "message_channel",
] as const;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureSchema();
  const [booking] = await sql`SELECT * FROM bookings WHERE id = ${id}`;
  if (!booking) {
    return NextResponse.json({ error: "Reserva não encontrada." }, { status: 404 });
  }
  const guests = await getGuestsForBooking(id);
  const log = await sql`
    SELECT type, channel, language, automated, sent_at FROM message_log
    WHERE booking_id = ${id} ORDER BY sent_at DESC
  `;
  return NextResponse.json({ booking, guests, messageLog: log });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureSchema();
  const [existing] = await sql`SELECT id FROM bookings WHERE id = ${id}`;
  if (!existing) {
    return NextResponse.json({ error: "Reserva não encontrada." }, { status: 404 });
  }

  const body = await req.json();
  const updates: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in body) updates[field] = body[field];
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nenhum campo válido para atualizar." }, { status: 400 });
  }

  await sql`UPDATE bookings SET ${sql(updates)} WHERE id = ${id}`;
  const [booking] = await sql`SELECT * FROM bookings WHERE id = ${id}`;
  return NextResponse.json({ booking });
}
