import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { sql, ensureSchema } from "@/lib/db";

interface BulkRow {
  source: string;
  guestName: string;
  guestPhone?: string;
  checkin: string;
  checkout: string;
  guestsCount?: number;
  totalPrice?: number | null;
  commissionAmount?: number;
  cleaningCost?: number;
  bookingReference?: string;
}

/**
 * Importação em massa (ex: colar de uma folha Excel). Ao contrário da reserva manual
 * normal (/api/backoffice/manual-booking), esta rota NUNCA gera código Nuki nem envia
 * SMS/email — importar dezenas de reservas (muitas vezes passadas) não deve disparar
 * notificações reais aos hóspedes. Para enviar a chave de uma reserva específica, use
 * a página "Nova reserva" normal depois de importar.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const rows: BulkRow[] = Array.isArray(body.bookings) ? body.bookings : [];

  if (rows.length === 0) {
    return NextResponse.json({ error: "Nenhuma reserva para importar." }, { status: 400 });
  }

  const errors: { index: number; guestName: string; error: string }[] = [];
  let created = 0;

  try {
    await ensureSchema();
  } catch (err) {
    console.error("Erro ao ligar à base de dados para importação:", err);
    return NextResponse.json(
      { error: "Não foi possível ligar à base de dados. Verifique se o projeto Supabase está ativo (não pausado)." },
      { status: 500 }
    );
  }

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.source || !r.guestName || !r.checkin || !r.checkout) {
      errors.push({ index: i, guestName: r.guestName ?? "", error: "Dados em falta." });
      continue;
    }
    try {
      const bookingId = randomUUID();
      await sql`
        INSERT INTO bookings
        (id, source, guest_name, guest_phone, checkin, checkout, guests_count,
         price_total, commission_amount, cleaning_cost, booking_reference, payment_status)
        VALUES (${bookingId}, ${r.source}, ${r.guestName}, ${r.guestPhone ?? null},
         ${r.checkin}, ${r.checkout}, ${r.guestsCount ?? 1}, ${r.totalPrice ?? null},
         ${r.commissionAmount ?? 0}, ${r.cleaningCost ?? 0}, ${r.bookingReference ?? null}, 'not_applicable')
      `;
      created++;
    } catch (err) {
      console.error("Erro ao importar reserva:", err);
      errors.push({ index: i, guestName: r.guestName, error: "Erro ao gravar na base de dados." });
    }
  }

  return NextResponse.json({ ok: true, created, errors });
}
