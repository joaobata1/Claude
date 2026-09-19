import { NextRequest, NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";
import { releaseAccessIfReady } from "@/lib/access-release";

export const maxDuration = 30;

/**
 * Configurar este URL no backoffice da ifthenpay como "callback URL".
 * A ifthenpay envia orderId + estado do pagamento.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const params = body ?? Object.fromEntries(new URL(req.url).searchParams);

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
