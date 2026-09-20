import { NextRequest, NextResponse } from "next/server";
import { parseBookingEmail } from "@/lib/ai-vision";

// Chamada a um modelo de IA: pode demorar mais do que os 10s por omissão da Vercel.
export const maxDuration = 60;

/**
 * Lê o texto de um email de reserva (Booking.com, Airbnb, VRBO) e devolve os campos.
 * Não cria nada: quem decide é o utilizador, depois de confirmar no formulário — assim
 * um email mal interpretado nunca cria sozinho uma reserva que bloqueie datas.
 * Protegido pela sessão do backoffice (ver proxy.ts).
 */
export async function POST(req: NextRequest) {
  const { text } = await req.json().catch(() => ({ text: null }));

  if (typeof text !== "string" || text.trim().length < 20) {
    return NextResponse.json({ error: "Cole o texto do email da reserva." }, { status: 400 });
  }

  try {
    const parsed = await parseBookingEmail(text);
    return NextResponse.json(parsed);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
