import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { sql, ensureSchema, getSetting } from "@/lib/db";
import { sendGenericEmail } from "@/lib/notifications";
import { getTemplate, renderTemplate, buildTemplateVars, resolveGuestLanguage, MessageType } from "@/lib/message-templates";

// Percorre todas as reservas + envia emails — pode ultrapassar o limite de 10s por
// omissão da Vercel, especialmente com o Supabase a "acordar" de uma pausa.
export const maxDuration = 60;

interface AutomationRule {
  id: string;
  type: MessageType;
  daysOffset: number; // negativo = antes, positivo = depois
  relativeTo: "checkin" | "checkout";
  enabled: boolean;
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function getRules(): Promise<AutomationRule[]> {
  const raw = await getSetting("automation_rules");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((r) => r.enabled && r.type && r.relativeTo) : [];
  } catch {
    return [];
  }
}

/**
 * Envia automaticamente mensagens agendadas (X dias antes/depois do check-in ou check-out),
 * configuradas em Definições > Mensagens. Só é possível automatizar por completo o canal
 * email (Resend) — o WhatsApp não tem aqui uma API programável (só o link manual wa.me), por
 * isso reservas com canal WhatsApp ficam de fora e aparecem como lembrete na página da reserva.
 * Pensado para ser chamado por um cron externo (ex: cron-job.org), uma vez por dia.
 */
export async function GET() {
  await ensureSchema();
  const rules = await getRules();
  if (rules.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0, note: "Sem regras de automação configuradas." });
  }

  const today = new Date().toISOString().slice(0, 10);
  const bookings = await sql`SELECT * FROM bookings WHERE message_channel = 'email'`;

  let sent = 0;
  let skipped = 0;
  const details: { bookingId: string; type: string; result: string }[] = [];

  for (const booking of bookings) {
    for (const rule of rules) {
      const base = rule.relativeTo === "checkin" ? booking.checkin : booking.checkout;
      if (!base) continue;
      if (addDaysIso(base, rule.daysOffset) !== today) continue;

      const [already] = await sql`
        SELECT 1 FROM message_log WHERE booking_id = ${booking.id} AND type = ${rule.type} LIMIT 1
      `;
      if (already) {
        skipped++;
        continue;
      }

      const language = resolveGuestLanguage(booking.guest_language);
      const template = await getTemplate(rule.type, language);
      if (!template.body.trim()) {
        skipped++;
        details.push({ bookingId: booking.id, type: rule.type, result: "modelo vazio" });
        continue;
      }

      const vars = await buildTemplateVars(booking);
      const text = renderTemplate(template.body, vars);
      const result = await sendGenericEmail({
        to: booking.guest_email ?? "",
        subject: renderTemplate(template.subject, vars),
        text,
      });

      if (result.sent) {
        await sql`
          INSERT INTO message_log (id, booking_id, type, channel, language, automated, body)
          VALUES (${randomUUID()}, ${booking.id}, ${rule.type}, 'email', ${language}, 1, ${text})
        `;
        if (rule.type === "chaves") {
          await sql`UPDATE bookings SET nuki_code_sent = 1 WHERE id = ${booking.id}`;
        }
        sent++;
        details.push({ bookingId: booking.id, type: rule.type, result: "enviado" });
      } else {
        skipped++;
        details.push({ bookingId: booking.id, type: rule.type, result: result.reason ?? "falhou" });
      }
    }
  }

  return NextResponse.json({ sent, skipped, details });
}
