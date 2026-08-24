import { db } from "./db";

function eachDate(checkin: string, checkout: string): string[] {
  const dates: string[] = [];
  const d = new Date(checkin);
  const end = new Date(checkout);
  while (d < end) {
    dates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

/** Devolve true se o intervalo [checkin, checkout) está livre em todas as fontes */
export function isRangeAvailable(checkin: string, checkout: string): boolean {
  const nights = eachDate(checkin, checkout);
  if (nights.length === 0) return false;

  // 1. Verifica reservas já confirmadas/pendentes no próprio site
  const localOverlap = db
    .prepare(
      `SELECT COUNT(*) as c FROM bookings
       WHERE payment_status IN ('paid', 'pending')
       AND NOT (checkout <= ? OR checkin >= ?)`
    )
    .get(checkin, checkout) as { c: number };
  if (localOverlap.c > 0) return false;

  // 2. Verifica datas bloqueadas vindas do iCal (Airbnb/Booking/VRBO)
  const placeholders = nights.map(() => "?").join(",");
  const blocked = db
    .prepare(`SELECT COUNT(*) as c FROM blocked_dates WHERE date IN (${placeholders})`)
    .get(...nights) as { c: number };

  return blocked.c === 0;
}

export function getBlockedDates(): string[] {
  const rows = db.prepare("SELECT DISTINCT date FROM blocked_dates").all() as { date: string }[];
  const local = db
    .prepare("SELECT checkin, checkout FROM bookings WHERE payment_status IN ('paid','pending')")
    .all() as { checkin: string; checkout: string }[];

  const set = new Set(rows.map((r) => r.date));
  for (const b of local) {
    for (const d of eachDate(b.checkin, b.checkout)) set.add(d);
  }
  return Array.from(set).sort();
}
