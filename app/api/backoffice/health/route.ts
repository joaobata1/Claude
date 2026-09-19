import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";

export const maxDuration = 30;

async function timed<T>(fn: () => Promise<T>): Promise<{ ok: boolean; ms: number; error?: string }> {
  const t0 = Date.now();
  try {
    await fn();
    return { ok: true, ms: Date.now() - t0 };
  } catch (err) {
    return { ok: false, ms: Date.now() - t0, error: (err as Error)?.message ?? "erro desconhecido" };
  }
}

/**
 * Diagnóstico: diz que versão está publicada e mede cada passo em separado, para se
 * perceber onde é que o tempo se perde em produção (ligação à base de dados, migração
 * do schema, ou as consultas em si). Nunca lança — a ideia é responder sempre.
 */
export async function GET() {
  const connect = await timed(() => sql`SELECT 1`);
  const schema = await timed(() => ensureSchema());
  const bookingsQuery = await timed(() => sql`SELECT count(*) FROM bookings`);

  return NextResponse.json({
    versao: {
      commit: (process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7),
      mensagem: process.env.VERCEL_GIT_COMMIT_MESSAGE?.split("\n")[0] ?? null,
      regiao: process.env.VERCEL_REGION ?? "local",
    },
    ligacaoBD: connect,
    migracaoSchema: schema,
    consultaReservas: bookingsQuery,
  });
}
