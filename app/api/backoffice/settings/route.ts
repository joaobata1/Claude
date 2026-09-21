import { NextRequest, NextResponse } from "next/server";
import { getAllSettings, setSetting, SETTINGS_KEYS } from "@/lib/db";

export const maxDuration = 30;

export async function GET() {
  try {
    const all = await getAllSettings();
    const values: Record<string, string | null> = {};
    for (const key of SETTINGS_KEYS) values[key] = all[key] ?? null;
    return NextResponse.json(values);
  } catch (err) {
    console.error("Erro ao ler definições:", err);
    return NextResponse.json(
      { error: "Não foi possível ligar à base de dados. Verifique se o projeto Supabase está ativo (não pausado)." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  try {
    for (const key of SETTINGS_KEYS) {
      if (!(key in body)) continue;
      // Um campo em branco tem de ficar em branco: `String(null)` gravava o texto "null",
      // que depois passava por um valor configurado (chave de API inválida, imagem partida).
      const value = body[key];
      await setSetting(key, value === null || value === undefined ? "" : String(value));
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Erro ao guardar definições:", err);
    return NextResponse.json(
      { error: "Não foi possível ligar à base de dados. Verifique se o projeto Supabase está ativo (não pausado)." },
      { status: 500 }
    );
  }
}
