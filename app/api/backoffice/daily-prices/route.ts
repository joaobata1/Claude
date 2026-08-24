import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db, getSetting } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  if (!start || !end) {
    return NextResponse.json({ error: "Indique start e end (YYYY-MM-DD)." }, { status: 400 });
  }

  const rows = db
    .prepare("SELECT channel, date, price FROM daily_prices WHERE date >= ? AND date <= ?")
    .all(start, end) as { channel: string; date: string; price: number }[];

  return NextResponse.json({ prices: rows });
}

export async function POST(req: NextRequest) {
  const { channel, date, price } = await req.json();
  if (!channel || !date || price === undefined || price === null) {
    return NextResponse.json({ error: "Dados em falta (channel, date, price)." }, { status: 400 });
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO daily_prices (id, channel, date, price) VALUES (?, ?, ?, ?)
     ON CONFLICT(channel, date) DO UPDATE SET price = excluded.price`
  ).run(id, channel, date, Number(price));

  return NextResponse.json({ ok: true });
}
