import { randomUUID } from "crypto";
import { sql, ensureSchema } from "./db";
import { sendGenericEmail } from "./notifications";
import { getTemplate, renderTemplate, buildTemplateVars, resolveGuestLanguage } from "./message-templates";

/**
 * Envia a confirmação de reserva por email logo a seguir a uma reserva feita no site.
 * Só por email porque é o único canal que pode ser disparado sem intervenção humana —
 * o WhatsApp (wa.me) exige sempre um clique manual, por isso essa mensagem também fica
 * disponível para envio manual na ficha da reserva.
 */
export async function sendBookingConfirmationEmail(bookingId: string): Promise<void> {
  await ensureSchema();
  const [booking] = await sql`SELECT * FROM bookings WHERE id = ${bookingId}`;
  if (!booking || !booking.guest_email) return;

  const language = resolveGuestLanguage(booking.guest_language);
  const template = await getTemplate("confirmacao", language);
  if (!template.body.trim()) return;

  const vars = await buildTemplateVars(booking);
  const subject = renderTemplate(template.subject, vars);
  const text = renderTemplate(template.body, vars);

  const result = await sendGenericEmail({ to: booking.guest_email, subject, text });
  if (!result.sent) return;

  await sql`
    INSERT INTO message_log (id, booking_id, type, channel, language, automated, body)
    VALUES (${randomUUID()}, ${bookingId}, 'confirmacao', 'email', ${language}, 1, ${text})
  `;
}
