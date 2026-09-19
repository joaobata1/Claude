import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { sql, ensureSchema } from "@/lib/db";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  if (!start || !end) {
    return NextResponse.json({ error: "Indique start e end (YYYY-MM-DD)." }, { status: 400 });
  }

  await ensureSchema();
  const rows = await sql<{ channel: string; date: string; price: number }[]>`
    SELECT channel, date, price FROM daily_prices WHERE date >= ${start} AND date <= ${end}
  `;

  return NextResponse.json({ prices: rows });
}

export async function POST(req: NextRequest) {
  const { channel, date, price } = await req.json();
  if (!channel || !date || price === undefined || price === null) {
    return NextResponse.json({ error: "Dados em falta (channel, date, price)." }, { status: 400 });
  }

  await ensureSchema();
  const id = randomUUID();
  await sql`
    INSERT INTO daily_prices (id, channel, date, price) VALUES (${id}, ${channel}, ${date}, ${Number(price)})
    ON CONFLICT (channel, date) DO UPDATE SET price = excluded.price
  `;

  return NextResponse.json({ ok: true });
}
