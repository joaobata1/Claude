import { NextRequest, NextResponse } from "next/server";
import { getAllSettings } from "@/lib/db";
import { getBookingsOverview } from "@/lib/bookings-overview";
import { getBlockedDatesBySource } from "@/lib/availability";
import { sql, ensureSchema } from "@/lib/db";
import { getDateRatePlanMap } from "@/lib/rate-plans";

export const maxDuration = 30;

/**
 * Tudo o que o calendário precisa, num único pedido.
 * Antes eram 5 pedidos em paralelo: 5 arranques a frio na Vercel e 5 ligações
 * simultâneas ao Postgres, e bastava um deles pendurar para o calendário ficar
 * preso em "A carregar...". Aqui é uma só função e uma só ligação.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  if (!start || !end) {
    return NextResponse.json({ error: "Indique start e end (YYYY-MM-DD)." }, { status: 400 });
  }

  try {
    await ensureSchema();

    const [bookings, blocked, priceRows, settings, ratePlanMap] = await Promise.all([
      getBookingsOverview(),
      getBlockedDatesBySource(),
      sql<{ date: string; price: number }[]>`
        SELECT date, price FROM daily_prices WHERE channel = 'site' AND date >= ${start} AND date <= ${end}
      `,
      getAllSettings(),
      getDateRatePlanMap(start, end),
    ]);

    const prices: Record<string, number> = {};
    for (const row of priceRows) prices[row.date] = row.price;

    let ratePlans: unknown = null;
    try {
      ratePlans = settings.rate_plans ? JSON.parse(settings.rate_plans) : null;
    } catch {
      ratePlans = null;
    }

    return NextResponse.json({
      bookings: bookings.map((b) => ({
        id: b.id,
        checkin: b.checkin,
        checkout: b.checkout,
        guestName: b.guestName,
        source: b.source,
        paymentStatus: b.paymentStatus,
      })),
      blocked,
      prices,
      defaultPrice: parseFloat(settings.price_per_night ?? "0") || 0,
      ratePlans,
      ratePlansByDate: Object.fromEntries(ratePlanMap),
    });
  } catch (err) {
    console.error("Erro ao carregar o calendário:", err);
    return NextResponse.json(
      { error: "Não foi possível ligar à base de dados. Verifique se o projeto Supabase está ativo (não pausado)." },
      { status: 500 }
    );
  }
}
