import { randomUUID } from "crypto";
import { sql, ensureSchema } from "./db";

/**
 * Trava as tentativas de adivinhar a palavra-passe do backoffice.
 *
 * O registo fica na base de dados, e não em memória, porque na Vercel cada pedido pode
 * cair numa instância diferente — um contador em memória seria reposto a cada pedido e
 * não travava nada.
 *
 * Em caso de falha da base de dados isto deixa passar (fail-open) de propósito: a
 * palavra-passe continua a ser verificada na mesma, e mais vale perder a travagem do
 * que ficar sem conseguir entrar no backoffice quando a base de dados está em baixo.
 */

const MAX_TENTATIVAS = 8;
const JANELA_MINUTOS = 15;

/** IP de quem faz o pedido, atrás do proxy da Vercel. */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for") ?? "";
  const first = forwarded.split(",")[0]?.trim();
  return first || req.headers.get("x-real-ip") || "desconhecido";
}

export interface EstadoTravagem {
  bloqueado: boolean;
  minutosEmFalta: number;
}

export async function estadoDeTravagem(ip: string): Promise<EstadoTravagem> {
  try {
    await ensureSchema();
    const [row] = await sql<{ total: number; mais_antiga: Date | null }[]>`
      SELECT count(*)::int AS total, min(attempted_at) AS mais_antiga
      FROM login_attempts
      WHERE ip = ${ip} AND attempted_at > now() - (${JANELA_MINUTOS} || ' minutes')::interval
    `;
    if (!row || row.total < MAX_TENTATIVAS) return { bloqueado: false, minutosEmFalta: 0 };

    const desde = row.mais_antiga ? new Date(row.mais_antiga).getTime() : Date.now();
    const passados = (Date.now() - desde) / 60000;
    return { bloqueado: true, minutosEmFalta: Math.max(1, Math.ceil(JANELA_MINUTOS - passados)) };
  } catch (err) {
    console.error("Não foi possível verificar as tentativas de login:", err);
    return { bloqueado: false, minutosEmFalta: 0 };
  }
}

export async function registarFalha(ip: string): Promise<void> {
  try {
    await ensureSchema();
    await sql`INSERT INTO login_attempts (id, ip) VALUES (${randomUUID()}, ${ip})`;
    // Limpeza oportunista: o registo não precisa de guardar histórico.
    await sql`DELETE FROM login_attempts WHERE attempted_at < now() - interval '1 day'`;
  } catch (err) {
    console.error("Não foi possível registar a tentativa de login falhada:", err);
  }
}

export async function limparTentativas(ip: string): Promise<void> {
  try {
    await sql`DELETE FROM login_attempts WHERE ip = ${ip}`;
  } catch (err) {
    console.error("Não foi possível limpar as tentativas de login:", err);
  }
}
