import { NextRequest, NextResponse } from "next/server";
import { sendGenericEmail } from "@/lib/notifications";
import { getSetting } from "@/lib/db";

export const maxDuration = 30;

/**
 * Envia um email de teste com a configuração atual, para se poder confirmar que o
 * Resend está bem configurado sem ter de esperar por uma reserva verdadeira.
 * Protegido pela sessão do backoffice (ver proxy.ts).
 */
export async function POST(req: NextRequest) {
  const { to } = await req.json().catch(() => ({ to: null }));
  const destino = typeof to === "string" ? to.trim() : "";

  if (!destino || !destino.includes("@")) {
    return NextResponse.json({ error: "Indique um email de destino válido." }, { status: 400 });
  }

  const remetente = (await getSetting("notification_from_email").catch(() => null)) ?? "(não configurado)";

  try {
    const resultado = await sendGenericEmail({
      to: destino,
      subject: "Teste de configuração de email",
      text:
        "Se está a ler isto, o envio de emails do seu site está a funcionar.\n\n" +
        `Remetente configurado: ${remetente}\n` +
        "Pode fechar esta mensagem — é só um teste.",
    });

    if (!resultado.sent) {
      return NextResponse.json({ error: resultado.reason, remetente }, { status: 400 });
    }

    return NextResponse.json({ ok: true, remetente, destino });
  } catch (err) {
    // Isto é uma ferramenta de diagnóstico: tem de dizer o que correu mal, nunca rebentar.
    console.error("Erro no teste de email:", err);
    return NextResponse.json(
      {
        error:
          "Não foi possível chegar à base de dados para ler as definições. Verifique se o projeto Supabase está ativo (não pausado).",
        remetente,
      },
      { status: 503 }
    );
  }
}
