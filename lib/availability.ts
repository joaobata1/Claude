import { sql, ensureSchema } from "./db";

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
export async function isRangeAvailable(checkin: string, checkout: string): Promise<boolean> {
  await ensureSchema();
  const nights = eachDate(checkin, checkout);
  if (nights.length === 0) return false;

  // 1. Verifica reservas já confirmadas/pendentes no próprio site
  const [localOverlap] = await sql<{ c: number }[]>`
    SELECT COUNT(*) as c FROM bookings
    WHERE payment_status IN ('paid', 'pending')
    AND NOT (checkout <= ${checkin} OR checkin >= ${checkout})
  `;
  if (Number(localOverlap.c) > 0) return false;

  // 2. Verifica datas bloqueadas vindas do iCal (Airbnb/Booking/VRBO)
  const [blocked] = await sql<{ c: number }[]>`
    SELECT COUNT(*) as c FROM blocked_dates WHERE date IN ${sql(nights)}
  `;

  return Number(blocked.c) === 0;
}

export async function getBlockedDates(): Promise<string[]> {
  await ensureSchema();
  const rows = await sql<{ date: string }[]>`SELECT DISTINCT date FROM blocked_dates`;
  const local = await sql<{ checkin: string; checkout: string }[]>`
    SELECT checkin, checkout FROM bookings WHERE payment_status IN ('paid','pending')
  `;

  const set = new Set(rows.map((r) => r.date));
  for (const b of local) {
    for (const d of eachDate(b.checkin, b.checkout)) set.add(d);
  }
  return Array.from(set).sort();
}
