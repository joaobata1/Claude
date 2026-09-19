import { NextRequest, NextResponse } from "next/server";
import { sql, ensureSchema, getSetting } from "@/lib/db";
import { timingSafeEqual } from "@/lib/auth";
import { releaseAccessIfReady } from "@/lib/access-release";

export const maxDuration = 30;

/**
 * Configurar este URL no backoffice da ifthenpay como "callback URL", incluindo a chave
 * anti-phishing: .../api/pay/callback?chave=SUA_CHAVE
 *
 * A chave é obrigatória: sem ela, qualquer pessoa que soubesse o id de uma reserva podia
 * enviar "status=paid" para este endereço e marcar a reserva como paga sem pagar — o que
 * também dispararia a geração e o envio do código de entrada da porta. Por isso, se a
 * chave não estiver configurada, o pedido é recusado (nunca aceite às cegas).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const query = Object.fromEntries(new URL(req.url).searchParams);
  const params = body ?? query;

  const expectedKey = (await getSetting("ifthenpay_anti_phishing_key")) ?? "";
  if (!expectedKey.trim()) {
    console.error("Callback de pagamento recusado: chave anti-phishing não configurada no backoffice.");
    return NextResponse.json(
      { error: "Callback não configurado no servidor." },
      { status: 503 }
    );
  }
  const providedKey = (query.chave ?? query.key ?? params.chave ?? params.key ?? "").toString();
  if (!timingSafeEqual(providedKey, expectedKey)) {
    console.error("Callback de pagamento recusado: chave anti-phishing inválida.");
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const bookingId = params.orderId ?? params.id;
  const status = (params.status ?? "").toString().toLowerCase();

  if (!bookingId) {
    return NextResponse.json({ error: "orderId em falta." }, { status: 400 });
  }

  await ensureSchema();
  const [booking] = await sql`SELECT * FROM bookings WHERE id = ${bookingId}`;
  if (!booking) {
    return NextResponse.json({ error: "Reserva não encontrada." }, { status: 404 });
  }

  if (status === "success" || status === "paid" || status === "000") {
    await sql`UPDATE bookings SET payment_status = 'paid' WHERE id = ${bookingId}`;

    try {
      const result = await releaseAccessIfReady(bookingId);
      if (result.released) {
        console.log(`Código Nuki ${result.nukiCode} gerado e enviado para a reserva ${bookingId}`);
      } else if (result.reason === "waiting_guest_data") {
        console.log(`Reserva ${bookingId} paga, mas a aguardar dados dos hóspedes antes de enviar o código Nuki.`);
      }
    } catch (err) {
      console.error("Erro ao processar libertação de acesso após pagamento:", err);
    }

    return NextResponse.json({ ok: true });
  }

  await sql`UPDATE bookings SET payment_status = 'failed' WHERE id = ${bookingId}`;
  return NextResponse.json({ ok: true, status: "failed_recorded" });
}
