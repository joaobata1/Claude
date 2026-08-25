import { sql, ensureSchema } from "./db";
import { computeTurnoverFlags, TurnoverFlags } from "./turnover";

export type SemaphoreColor = "green" | "red" | "amber" | "gray";

export interface BookingOverviewRow {
  id: string;
  source: string;
  guestName: string;
  guestPhone: string | null;
  guestEmail: string | null;
  checkin: string;
  checkout: string;
  guestsCount: number;
  paymentStatus: string;
  paymentSemaphore: SemaphoreColor;
  guestsCompleteCount: number;
  sibaDataSemaphore: SemaphoreColor;
  sibaSubmitted: boolean;
  hasForeignGuests: boolean;
  sibaSubmissionSemaphore: SemaphoreColor;
  keysSentSemaphore: SemaphoreColor;
  turnover: TurnoverFlags;
  requiresSameDayCleaning: boolean;
  totalPrice: number | null;
  commissionAmount: number;
  cleaningCost: number;
  netTotal: number | null;
  bookingReference: string | null;
  nights: number;
  daysUntilNextBooking: number | null; // null = não há reserva seguinte conhecida
  adultsCount: number;
  childrenCount: number;
}

function paymentSemaphore(status: string): SemaphoreColor {
  if (status === "paid" || status === "not_applicable") return "green";
  if (status === "failed") return "red";
  return "red"; // pending
}

function guestDataSemaphore(complete: number, total: number): SemaphoreColor {
  if (total === 0) return "gray";
  if (complete >= total) return "green";
  if (complete > 0) return "amber";
  return "red";
}

function submissionSemaphore(hasForeignGuests: boolean, submitted: boolean): SemaphoreColor {
  if (!hasForeignGuests) return "gray"; // não aplicável — sem hóspedes estrangeiros ainda registados
  return submitted ? "green" : "red";
}

const PORTUGUESE_VARIANTS = new Set(["pt", "portugal", "portuguesa", "português"]);

function countNights(checkin: string, checkout: string): number {
  const ms = new Date(checkout).getTime() - new Date(checkin).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

/** Idade em anos completos numa data de referência (usa-se a data de check-in) */
function ageAt(birthDateIso: string, referenceIso: string): number {
  const birth = new Date(birthDateIso);
  const ref = new Date(referenceIso);
  let age = ref.getFullYear() - birth.getFullYear();
  const hadBirthdayThisYear =
    ref.getMonth() > birth.getMonth() || (ref.getMonth() === birth.getMonth() && ref.getDate() >= birth.getDate());
  if (!hadBirthdayThisYear) age -= 1;
  return age;
}

/**
 * Dias entre o check-out desta reserva e o check-in da próxima reserva conhecida
 * (de qualquer origem). 0 significa entrada e saída no mesmo dia (limpeza imediata).
 * null quando não há nenhuma reserva futura conhecida a seguir a esta.
 */
function daysUntilNext(thisCheckout: string, allBookings: { checkin: string }[]): number | null {
  let closest: string | null = null;
  for (const b of allBookings) {
    if (b.checkin < thisCheckout) continue;
    if (closest === null || b.checkin < closest) closest = b.checkin;
  }
  if (closest === null) return null;
  const ms = new Date(closest).getTime() - new Date(thisCheckout).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export async function getBookingsOverview(): Promise<BookingOverviewRow[]> {
  await ensureSchema();
  const bookings = (await sql`SELECT * FROM bookings ORDER BY checkin ASC`) as any[];

  const turnoverMap = computeTurnoverFlags(
    bookings.map((b) => ({ id: b.id, checkin: b.checkin, checkout: b.checkout }))
  );

  return Promise.all(bookings.map(async (b) => {
    const guests = (await sql`SELECT * FROM guests WHERE booking_id = ${b.id}`) as any[];
    const guestsCompleteCount = guests.length; // só se guardam hóspedes completos, ver lib/guests.ts
    const hasForeignGuests = guests.some((g) => !PORTUGUESE_VARIANTS.has((g.nationality || "").trim().toLowerCase()));
    const turnover = turnoverMap[b.id] ?? { arrivalSameDayAsOtherCheckout: false, departureSameDayAsOtherCheckin: false };

    const commissionAmount = b.commission_amount ?? 0;
    const cleaningCost = b.cleaning_cost ?? 0;
    const netTotal = b.price_total != null ? b.price_total - commissionAmount - cleaningCost : null;

    // Adultos/crianças calculados a partir da data de nascimento de cada hóspede
    // guardado (ver lib/guests.ts). Se ainda não houver hóspedes com dados
    // completos, assume-se que o total de hóspedes da reserva são adultos —
    // é a melhor estimativa possível sem essa informação.
    let adultsCount: number;
    let childrenCount: number;
    if (guests.length > 0) {
      childrenCount = guests.filter((g) => ageAt(g.birth_date, b.checkin) < 18).length;
      adultsCount = guests.length - childrenCount;
    } else {
      adultsCount = b.guests_count;
      childrenCount = 0;
    }

    return {
      id: b.id,
      source: b.source,
      guestName: b.guest_name,
      guestPhone: b.guest_phone,
      guestEmail: b.guest_email,
      checkin: b.checkin,
      checkout: b.checkout,
      guestsCount: b.guests_count,
      paymentStatus: b.payment_status,
      paymentSemaphore: paymentSemaphore(b.payment_status),
      guestsCompleteCount,
      sibaDataSemaphore: guestDataSemaphore(guestsCompleteCount, b.guests_count),
      sibaSubmitted: !!b.siba_submitted,
      hasForeignGuests,
      sibaSubmissionSemaphore: submissionSemaphore(hasForeignGuests, !!b.siba_submitted),
      keysSentSemaphore: b.nuki_code_sent ? "green" : "red",
      turnover,
      requiresSameDayCleaning: turnover.arrivalSameDayAsOtherCheckout || turnover.departureSameDayAsOtherCheckin,
      totalPrice: b.price_total ?? null,
      commissionAmount,
      cleaningCost,
      netTotal,
      bookingReference: b.booking_reference ?? null,
      nights: countNights(b.checkin, b.checkout),
      daysUntilNextBooking: daysUntilNext(
        b.checkout,
        bookings.filter((other) => other.id !== b.id)
      ),
      adultsCount,
      childrenCount,
    };
  }));
}
