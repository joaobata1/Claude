import ical from "node-ical";
import { db, getSetting } from "./db";

export interface IcalSource {
  id: string;
  label: string;
  url: string;
  commissionPercent?: number; // comissão do canal, ex: 15 para 15%
}

function getIcalSources(): IcalSource[] {
  const raw = getSetting("ical_sources");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s) => s.url?.trim()) : [];
  } catch {
    return [];
  }
}

function eachDate(start: Date, end: Date): string[] {
  const dates: string[] = [];
  const d = new Date(start);
  while (d < end) {
    dates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

/** Corre periodicamente (cron / rota agendada) para importar disponibilidade de todos os links iCal configurados */
export async function syncAllIcalSources() {
  const sources = getIcalSources();
  const results: Record<string, { label: string; nights: number } | { label: string; error: string }> = {};

  for (const source of sources) {
    try {
      const events = await ical.async.fromURL(source.url);
      db.prepare("DELETE FROM blocked_dates WHERE source = ?").run(source.id);

      const insert = db.prepare(
        "INSERT OR IGNORE INTO blocked_dates (id, source, date) VALUES (?, ?, ?)"
      );

      let count = 0;
      for (const key in events) {
        const ev = events[key] as any;
        if (!ev || ev.type !== "VEVENT" || !ev.start || !ev.end) continue;
        for (const date of eachDate(ev.start, ev.end)) {
          insert.run(`${source.id}-${date}-${crypto.randomUUID()}`, source.id, date);
          count++;
        }
      }
      results[source.id] = { label: source.label || source.id, nights: count };
    } catch (err: any) {
      console.error(`Erro ao importar iCal de ${source.label}:`, err);
      results[source.id] = { label: source.label || source.id, error: err.message ?? "erro desconhecido" };
    }
  }

  return results;
}

/** Gera o feed .ics do próprio site para colar no Airbnb/Booking/VRBO/outros */
export function generateOwnIcalFeed(): string {
  const bookings = db
    .prepare("SELECT * FROM bookings WHERE payment_status IN ('paid','pending')")
    .all() as any[];

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Aljezur Monte Clerigo//Booking Site//PT",
  ];

  for (const b of bookings) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${b.id}@aljezur-booking`,
      `DTSTART;VALUE=DATE:${b.checkin.replace(/-/g, "")}`,
      `DTEND;VALUE=DATE:${b.checkout.replace(/-/g, "")}`,
      `SUMMARY:Reservado (site próprio) - ${b.guest_name}`,
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
