import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { releaseAccessIfReady } from "@/lib/access-release";

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

  const booking = db.prepare("SELECT * FROM bookings WHERE id = ?").get(bookingId) as any;
  if (!booking) {
    return NextResponse.json({ error: "Reserva não encontrada." }, { status: 404 });
  }

  if (status === "success" || status === "paid" || status === "000") {
    db.prepare("UPDATE bookings SET payment_status = 'paid' WHERE id = ?").run(bookingId);

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

  db.prepare("UPDATE bookings SET payment_status = 'failed' WHERE id = ?").run(bookingId);
  return NextResponse.json({ ok: true, status: "failed_recorded" });
}
