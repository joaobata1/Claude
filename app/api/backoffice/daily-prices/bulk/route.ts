import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { sql, ensureSchema } from "@/lib/db";

/** Aplica o mesmo preço a várias datas de uma vez (ex: popup de preços em massa do calendário). */
export async function POST(req: NextRequest) {
  const { channel, dates, price } = await req.json();

  if (!channel || !Array.isArray(dates) || dates.length === 0 || price === undefined || price === null) {
    return NextResponse.json({ error: "Dados em falta (channel, dates, price)." }, { status: 400 });
  }
  const priceNum = Number(price);
  if (isNaN(priceNum)) {
    return NextResponse.json({ error: "Preço inválido." }, { status: 400 });
  }

  const rows = dates.map((date: string) => ({ id: randomUUID(), channel: String(channel), date, price: priceNum }));

  try {
    await ensureSchema();
    await sql`
      INSERT INTO daily_prices ${sql(rows, "id", "channel", "date", "price")}
      ON CONFLICT (channel, date) DO UPDATE SET price = excluded.price
    `;
    return NextResponse.json({ ok: true, count: rows.length });
  } catch (err) {
    console.error("Erro ao aplicar preços em massa:", err);
    return NextResponse.json(
      { error: "Não foi possível ligar à base de dados. Verifique se o projeto Supabase está ativo (não pausado)." },
      { status: 500 }
    );
  }
}
