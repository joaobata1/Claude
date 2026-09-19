/**
 * Identificador único seguro em qualquer browser.
 *
 * `crypto.randomUUID()` só existe no Safari do iOS a partir da versão 15.4 (e apenas em
 * contexto seguro). Como era chamado durante o primeiro render do calendário, num iPhone
 * mais antigo rebentava a hidratação: o React nunca montava a página e ficava à vista o
 * HTML pré-renderizado — ou seja, o "A carregar..." preso para sempre, sem forma de
 * recuperar. Estes ids são só para distinguir linhas na interface, não precisam de ser
 * criptograficamente fortes.
 */
export function newId(): string {
  const c = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
