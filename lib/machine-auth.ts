import { NextRequest } from "next/server";
import { COOKIE_NAME, verifySessionToken, timingSafeEqual } from "./auth";

/**
 * Endpoints que são chamados por máquinas (cron externo) e não pelo browser do backoffice.
 * Estavam completamente abertos: qualquer pessoa podia disparar o envio de emails a todos
 * os hóspedes, forçar a sincronização iCal ou submeter o relatório diário ao SIBA.
 *
 * Aceita duas provas de identidade:
 *  - o segredo CRON_SECRET (cabeçalho Authorization: Bearer ... ou ?key=...), para o cron;
 *  - a sessão do backoffice, para quando é o próprio administrador a carregar no botão.
 *
 * Sem CRON_SECRET definido no servidor, só a sessão do backoffice serve — nunca fica aberto.
 */
export async function isMachineAuthorized(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = req.headers.get("authorization") ?? "";
    const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7) : "";
    const fromQuery = new URL(req.url).searchParams.get("key") ?? "";
    const provided = bearer || fromQuery;
    if (provided && timingSafeEqual(provided, secret)) return true;
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  return verifySessionToken(token);
}
