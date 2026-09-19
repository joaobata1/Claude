"use client";

import { useEffect, useState } from "react";

interface CheckResult {
  nome: string;
  estado: "a-correr" | "ok" | "lento" | "falhou";
  ms: number;
  detalhe?: string;
}

interface Health {
  versao: { commit: string; mensagem: string | null; regiao: string };
  ligacaoBD: { ok: boolean; ms: number; error?: string };
  migracaoSchema: { ok: boolean; ms: number; error?: string };
  consultaReservas: { ok: boolean; ms: number; error?: string };
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Cada pedido tem o seu próprio limite de tempo, para se ver qual é o que pendura. */
async function testar(nome: string, url: string, limiteMs = 25000): Promise<CheckResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), limiteMs);
  const t0 = Date.now();
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    const ms = Date.now() - t0;
    if (!res.ok) {
      return { nome, estado: "falhou", ms, detalhe: `HTTP ${res.status}` };
    }
    await res.json().catch(() => null);
    return { nome, estado: ms > 5000 ? "lento" : "ok", ms };
  } catch (err) {
    const ms = Date.now() - t0;
    const abortado = (err as Error)?.name === "AbortError";
    return {
      nome,
      estado: "falhou",
      ms,
      detalhe: abortado ? `sem resposta em ${Math.round(limiteMs / 1000)}s` : "erro de ligação",
    };
  } finally {
    clearTimeout(timer);
  }
}

const COR: Record<CheckResult["estado"], string> = {
  "a-correr": "text-gray-400",
  ok: "text-green-700",
  lento: "text-amber-600",
  falhou: "text-red-600",
};

const SIMBOLO: Record<CheckResult["estado"], string> = {
  "a-correr": "…",
  ok: "OK",
  lento: "LENTO",
  falhou: "FALHOU",
};

export default function Diagnostico() {
  const [health, setHealth] = useState<Health | null>(null);
  const [healthErro, setHealthErro] = useState<string | null>(null);
  const [checks, setChecks] = useState<CheckResult[]>([]);
  const [aCorrer, setACorrer] = useState(true);
  const [token, setToken] = useState(0);

  useEffect(() => {
    let cancelado = false;

    (async () => {
      const inicio = hoje();
      const fim = `${new Date().getFullYear() + 1}-12-31`;

      try {
        const res = await fetch("/api/backoffice/health", { cache: "no-store" });
        const data = await res.json();
        if (!cancelado) setHealth(data);
      } catch {
        if (!cancelado) setHealthErro("O servidor não respondeu ao pedido de diagnóstico.");
      }

      // Em série, não em paralelo: assim vê-se exatamente qual é o passo que trava.
      const testes: [string, string][] = [
        ["Calendário (pedido único)", `/api/backoffice/calendar?start=${inicio}&end=${fim}`],
        ["Definições", "/api/backoffice/settings"],
        ["Reservas", "/api/backoffice/bookings"],
        ["Datas bloqueadas (OTAs)", "/api/backoffice/blocked-dates"],
        ["Disponibilidade (site público)", "/api/availability"],
      ];

      for (const [nome, url] of testes) {
        if (cancelado) return;
        setChecks((prev) => [...prev, { nome, estado: "a-correr", ms: 0 }]);
        const resultado = await testar(nome, url);
        if (cancelado) return;
        setChecks((prev) => prev.map((c) => (c.nome === nome ? resultado : c)));
      }

      if (!cancelado) setACorrer(false);
    })();

    return () => {
      cancelado = true;
    };
  }, [token]);

  return (
    <main className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-1">Diagnóstico</h1>
      <p className="text-sm text-gray-500 mb-6">
        Mostra que versão está publicada e mede cada pedido em separado. Tire uma captura desta página
        quando algo estiver lento ou preso.
      </p>

      <section className="border rounded-lg p-4 mb-5">
        <h2 className="font-medium mb-3">Versão publicada</h2>
        {healthErro ? (
          <p className="text-red-600 text-sm">{healthErro}</p>
        ) : !health ? (
          <p className="text-gray-400 text-sm">a verificar...</p>
        ) : (
          <div className="text-sm space-y-1">
            <p>
              <span className="text-gray-500">Commit:</span>{" "}
              <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">{health.versao.commit}</code>
            </p>
            {health.versao.mensagem && <p className="text-gray-600 text-xs">{health.versao.mensagem}</p>}
            <p>
              <span className="text-gray-500">Região do servidor:</span> {health.versao.regiao}
            </p>
          </div>
        )}
      </section>

      {health && (
        <section className="border rounded-lg p-4 mb-5">
          <h2 className="font-medium mb-3">Base de dados</h2>
          <div className="text-sm space-y-2">
            {(
              [
                ["Ligar + consulta simples", health.ligacaoBD],
                ["Verificação do schema", health.migracaoSchema],
                ["Contar reservas", health.consultaReservas],
              ] as const
            ).map(([nome, r]) => (
              <div key={nome} className="flex items-center justify-between gap-3">
                <span className="text-gray-700">{nome}</span>
                <span className={r.ok ? (r.ms > 3000 ? "text-amber-600" : "text-green-700") : "text-red-600"}>
                  {r.ok ? `${r.ms} ms` : `falhou (${r.error})`}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="border rounded-lg p-4 mb-5">
        <h2 className="font-medium mb-3">Pedidos do backoffice</h2>
        {checks.length === 0 ? (
          <p className="text-gray-400 text-sm">a verificar...</p>
        ) : (
          <div className="text-sm space-y-2">
            {checks.map((c) => (
              <div key={c.nome} className="flex items-center justify-between gap-3">
                <span className="text-gray-700">{c.nome}</span>
                <span className={COR[c.estado]}>
                  {SIMBOLO[c.estado]}
                  {c.estado !== "a-correr" && ` · ${c.ms} ms`}
                  {c.detalhe && ` · ${c.detalhe}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <button
        onClick={() => {
          setChecks([]);
          setHealth(null);
          setHealthErro(null);
          setACorrer(true);
          setToken((t) => t + 1);
        }}
        disabled={aCorrer}
        className="w-full bg-gray-900 text-white rounded py-2.5 font-medium disabled:opacity-60"
      >
        {aCorrer ? "A testar..." : "Testar outra vez"}
      </button>
    </main>
  );
}
