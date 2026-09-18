import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { sql, ensureSchema } from "@/lib/db";
import { sendGenericEmail } from "@/lib/notifications";
import {
  getTemplate,
  renderTemplate,
  buildTemplateVars,
  resolveGuestLanguage,
  MessageType,
} from "@/lib/message-templates";

const VALID_TYPES: (MessageType | "livre")[] = [
  "confirmacao",
  "chaves",
  "instrucoes",
  "cancelamento",
  "custom1",
  "custom2",
  "livre",
];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { type, body: freeBody, subject: freeSubject } = await req.json();
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "Tipo de mensagem inválido." }, { status: 400 });
  }
  if (type === "livre" && !String(freeBody ?? "").trim()) {
    return NextResponse.json({ error: "Escreva uma mensagem antes de enviar." }, { status: 400 });
  }

  await ensureSchema();
  const [booking] = await sql`SELECT * FROM bookings WHERE id = ${id}`;
  if (!booking) {
    return NextResponse.json({ error: "Reserva não encontrada." }, { status: 404 });
  }

  const language = resolveGuestLanguage(booking.guest_language);

  let subject: string;
  let text: string;
  if (type === "livre") {
    subject = String(freeSubject ?? "");
    text = String(freeBody);
  } else {
    const template = await getTemplate(type as MessageType, language);
    if (!template.body.trim()) {
      return NextResponse.json(
        { error: "Este modelo de mensagem ainda não está configurado — defina-o em Definições > Mensagens." },
        { status: 400 }
      );
    }
    const vars = await buildTemplateVars(booking);
    subject = renderTemplate(template.subject, vars);
    text = renderTemplate(template.body, vars);
  }

  const channel: "whatsapp" | "email" = booking.message_channel === "email" ? "email" : "whatsapp";

  async function logSend() {
    await sql`
      INSERT INTO message_log (id, booking_id, type, channel, language, automated, body)
      VALUES (${randomUUID()}, ${id}, ${type}, ${channel}, ${language}, 0, ${text})
    `;
    if (type === "chaves") {
      await sql`UPDATE bookings SET nuki_code_sent = 1 WHERE id = ${id}`;
    }
  }

  if (channel === "email") {
    const result = await sendGenericEmail({ to: booking.guest_email ?? "", subject, text });
    if (!result.sent) {
      const reason =
        result.reason === "not_configured"
          ? "O envio de email (Resend) não está configurado nas Definições."
          : result.reason === "no_email"
          ? "Esta reserva não tem um email de contacto."
          : "Falha ao enviar o email.";
      return NextResponse.json({ error: reason }, { status: 400 });
    }
    await logSend();
    return NextResponse.json({ ok: true, channel: "email" });
  }

  const digits = (booking.guest_phone ?? "").replace(/\D/g, "");
  if (!digits) {
    return NextResponse.json({ error: "Esta reserva não tem um número de telefone de contacto." }, { status: 400 });
  }
  await logSend();
  const link = `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  return NextResponse.json({ ok: true, channel: "whatsapp", link });
}
