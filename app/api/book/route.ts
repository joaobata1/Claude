import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { sql, ensureSchema, getSetting } from "@/lib/db";
import { isRangeAvailable } from "@/lib/availability";
import { createMbwayRequest, createCardPaymentLink } from "@/lib/ifthenpay";
import { sendBookingConfirmationEmail } from "@/lib/booking-messages";

class DatesUnavailableError extends Error {}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { checkin, checkout, guestsCount, guestName, guestEmail, guestPhone, paymentMethod } = body;

  if (!checkin || !checkout || !guestName || !guestPhone || !paymentMethod) {
    return NextResponse.json({ error: "Dados em falta." }, { status: 400 });
  }

  const isoDate = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoDate.test(checkin) || !isoDate.test(checkout) || checkin >= checkout) {
    return NextResponse.json({ error: "Datas inválidas." }, { status: 400 });
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
  let bookingNumber: number;
  try {
    [{ booking_number: bookingNumber }] = await sql.begin("isolation level serializable", async (tx) => {
      if (!(await isRangeAvailable(checkin, checkout, tx))) {
        throw new DatesUnavailableError();
      }
      return tx<{ booking_number: number }[]>`
        INSERT INTO bookings
        (id, source, guest_name, guest_email, guest_phone, checkin, checkout, guests_count, price_total, cleaning_cost, payment_status, payment_method)
        VALUES (${bookingId}, 'site', ${guestName}, ${guestEmail ?? null}, ${guestPhone}, ${checkin}, ${checkout}, ${guestsCount ?? 1}, ${total}, ${cleaningFee}, 'pending', ${paymentMethod})
        RETURNING booking_number
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

  sendBookingConfirmationEmail(bookingId).catch((err) => console.error("Falha ao enviar email de confirmação:", err));

  try {
    if (paymentMethod === "mbway") {
      const result = await createMbwayRequest({ bookingId, amount: total, guestPhone });
      await sql`UPDATE bookings SET ifthenpay_request_id = ${result.RequestId ?? ""} WHERE id = ${bookingId}`;
      return NextResponse.json({ bookingId, status: "mbway_sent", total });
    } else if (paymentMethod === "transferencia") {
      const iban = (await getSetting("bank_iban")) ?? "";
      const accountHolder = (await getSetting("bank_account_holder")) ?? "";
      return NextResponse.json({ bookingId, bookingNumber, status: "bank_transfer", total, iban, accountHolder });
    } else {
      const result = await createCardPaymentLink({ bookingId, amount: total, guestName });
      return NextResponse.json({ bookingId, status: "redirect", paymentUrl: result.url, total });
    }
  } catch (err: any) {
    // Sem isto, a reserva ficava "pending" para sempre — a bloquear estas datas no
    // calendário sem o cliente ter conseguido pagar de todo.
    await sql`UPDATE bookings SET payment_status = 'failed' WHERE id = ${bookingId}`;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
