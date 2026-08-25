import { sql, ensureSchema, getSetting } from "./db";
import { createNukiAccessCode } from "./nuki";
import { sendNukiCodeToGuest } from "./notifications";
import { countCompleteGuests } from "./guests";

export type ReleaseStatus =
  | { released: true; nukiCode: string }
  | { released: false; reason: "already_sent" | "payment_pending" | "waiting_guest_data" };

async function requireGuestsBeforeCheckin(): Promise<boolean> {
  return (await getSetting("require_guests_before_checkin")) === "true";
}

/**
 * Verifica se a reserva está pronta para receber o código Nuki + instruções,
 * e envia-as se estiver. Chamado sempre que algo muda: pagamento confirmado,
 * reserva manual criada, ou dados de hóspedes guardados/atualizados.
 *
 * Regras:
 * - Nunca envia duas vezes.
 * - Pagamento tem de estar confirmado (ou não aplicável, no caso de OTAs).
 * - Se o interruptor "obrigar dados dos hóspedes" estiver ON, só envia
 *   quando o número de hóspedes completos guardados == guests_count da reserva.
 * - Se estiver OFF, envia assim que o pagamento estiver ok, independentemente
 *   dos dados dos hóspedes (que continuam a poder ser preenchidos depois,
 *   para efeitos de submissão ao SIBA).
 */
export async function releaseAccessIfReady(bookingId: string): Promise<ReleaseStatus> {
  await ensureSchema();
  const [booking] = await sql`SELECT * FROM bookings WHERE id = ${bookingId}`;
  if (!booking) throw new Error("Reserva não encontrada.");

  if (booking.nuki_code_sent) {
    return { released: false, reason: "already_sent" };
  }

  const paymentOk = booking.payment_status === "paid" || booking.payment_status === "not_applicable";
  if (!paymentOk) {
    return { released: false, reason: "payment_pending" };
  }

  if (await requireGuestsBeforeCheckin()) {
    const complete = await countCompleteGuests(bookingId);
    if (complete < booking.guests_count) {
      return { released: false, reason: "waiting_guest_data" };
    }
  }

  const pin = await createNukiAccessCode({
    bookingId,
    guestName: booking.guest_name,
    checkinDate: booking.checkin,
    checkoutDate: booking.checkout,
  });

  await sendNukiCodeToGuest({
    guestName: booking.guest_name,
    guestPhone: booking.guest_phone,
    guestEmail: booking.guest_email,
    checkin: booking.checkin,
    checkout: booking.checkout,
    nukiCode: pin,
  });

  await sql`UPDATE bookings SET nuki_code_sent = 1 WHERE id = ${bookingId}`;

  return { released: true, nukiCode: pin };
}
