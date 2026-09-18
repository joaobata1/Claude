import ical from "node-ical";
import { sql, ensureSchema, getSetting } from "./db";

export interface IcalSource {
  id: string;
  label: string;
  url: string;
  commissionPercent?: number; // comissão do canal, ex: 15 para 15%
}

async function getIcalSources(): Promise<IcalSource[]> {
  const raw = await getSetting("ical_sources");
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
  await ensureSchema();
  const sources = await getIcalSources();
  const results: Record<string, { label: string; nights: number } | { label: string; error: string }> = {};

  for (const source of sources) {
    try {
      const events = await ical.async.fromURL(source.url);
      await sql`DELETE FROM blocked_dates WHERE source = ${source.id}`;

      const rows: { id: string; source: string; date: string }[] = [];
      for (const key in events) {
        const ev = events[key] as any;
        if (!ev || ev.type !== "VEVENT" || !ev.start || !ev.end) continue;
        for (const date of eachDate(ev.start, ev.end)) {
          rows.push({ id: `${source.id}-${date}-${crypto.randomUUID()}`, source: source.id, date });
        }
      }
      if (rows.length > 0) {
        await sql`
          INSERT INTO blocked_dates ${sql(rows, "id", "source", "date")}
          ON CONFLICT (source, date) DO NOTHING
        `;
      }
      results[source.id] = { label: source.label || source.id, nights: rows.length };
    } catch (err: any) {
      console.error(`Erro ao importar iCal de ${source.label}:`, err);
      results[source.id] = { label: source.label || source.id, error: err.message ?? "erro desconhecido" };
    }
  }

  return results;
}

/**
 * Gera o feed .ics do próprio site para colar no Airbnb/Booking/VRBO/outros, evitando
 * duplicação de bloqueios: inclui só reservas com origem "site" (as feitas através do
 * motor de reservas), nunca as que já vieram de OTAs por importação manual ou iCal.
 */
export async function generateOwnIcalFeed(): Promise<string> {
  await ensureSchema();
  const bookings = await sql`
    SELECT * FROM bookings WHERE source = 'site' AND payment_status IN ('paid','pending')
  `;

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
