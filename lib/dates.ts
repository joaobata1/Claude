/**
 * Datas no formato YYYY-MM-DD, sempre no calendário de quem está a ver.
 *
 * O erro que isto corrige: construía-se a data em hora local (ex: `new Date(2026, 8, 1)`)
 * e depois formatava-se com `toISOString()`, que converte para UTC. Em Portugal (UTC+1 no
 * verão) a meia-noite local é 23:00 do dia anterior em UTC, por isso cada data saía um dia
 * atrasada: a grelha do calendário aparecia deslocada, os dias caíam debaixo do dia da
 * semana errado e os preços em massa eram gravados nas datas erradas. No servidor de teste,
 * que corre em UTC, o erro não se via.
 */

export function toISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

/** Soma (ou subtrai, com n negativo) dias a uma data YYYY-MM-DD. */
export function addDaysISO(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/**
 * O "hoje" do alojamento, para código que corre no servidor (a Vercel corre em UTC).
 * Perto da meia-noite, o dia em Portugal não é o mesmo que em UTC — e é o dia em
 * Portugal que interessa para check-ins, limpezas e mensagens automáticas.
 */
export function todayInLisbon(): string {
  // en-CA formata como YYYY-MM-DD
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Lisbon" });
}
