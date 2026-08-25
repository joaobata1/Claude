import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { sql, ensureSchema, getSetting } from "@/lib/db";
import { isRangeAvailable } from "@/lib/availability";
import { createMbwayRequest, createCardPaymentLink } from "@/lib/ifthenpay";

class DatesUnavailableError extends Error {}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { checkin, checkout, guestsCount, guestName, guestEmail, guestPhone, paymentMethod } = body;

  if (!checkin || !checkout || !guestName || !guestPhone || !paymentMethod) {
    return NextResponse.json({ error: "Dados em falta." }, { status: 400 });
  }

  const nights =
    (new Date(checkout).getTime() - new Date(checkin).getTime()) / (1000 * 60 * 60 * 24);
  const pricePerNight = parseFloat((await getSetting("price_per_night")) ?? "0");
  const cleaningFee = parseFloat((await getSetting("cleaning_fee")) ?? "0");
  const total = nights * pricePerNight + cleaningFee;

  await ensureSchema();
  const bookingId = randomUUID();

  // Verificação de disponibilidade + escrita da reserva na mesma transação serializable:
  // evita que duas reservas em simultâneo para as mesmas datas passem ambas a verificação
  // antes de qualquer uma delas ser gravada (double-booking).
  try {
    await sql.begin("isolation level serializable", async (tx) => {
      if (!(await isRangeAvailable(checkin, checkout, tx))) {
        throw new DatesUnavailableError();
      }
      await tx`
        INSERT INTO bookings
        (id, source, guest_name, guest_email, guest_phone, checkin, checkout, guests_count, price_total, cleaning_cost, payment_status, payment_method)
        VALUES (${bookingId}, 'site', ${guestName}, ${guestEmail}, ${guestPhone}, ${checkin}, ${checkout}, ${guestsCount ?? 1}, ${total}, ${cleaningFee}, 'pending', ${paymentMethod})
      `;
    });
  } catch (err: any) {
    // 40001 = serialization_failure — a Postgres deteta o conflito com outra reserva em
    // curso na mesma transação e recusa fazer commit; tratamos como "não disponível".
    if (err instanceof DatesUnavailableError || err?.code === "40001") {
      return NextResponse.json({ error: "Datas indisponíveis." }, { status: 409 });
    }
    throw err;
  }

  try {
    if (paymentMethod === "mbway") {
      const result = await createMbwayRequest({ bookingId, amount: total, guestPhone });
      await sql`UPDATE bookings SET ifthenpay_request_id = ${result.RequestId ?? ""} WHERE id = ${bookingId}`;
      return NextResponse.json({ bookingId, status: "mbway_sent", total });
    } else {
      const result = await createCardPaymentLink({ bookingId, amount: total, guestName });
      return NextResponse.json({ bookingId, status: "redirect", paymentUrl: result.url, total });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
