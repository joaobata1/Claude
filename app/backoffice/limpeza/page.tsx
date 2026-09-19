"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import LoadingSpinner from "@/app/components/LoadingSpinner";

interface CleaningRow {
  checkin: string;
  checkout: string;
  guestName: string;
  guestsCount: number;
  sameDayCleaning: boolean;
}

export default function Limpeza() {
  const [rows, setRows] = useState<CleaningRow[]>([]);
  const [cleaningPhone, setCleaningPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    Promise.all([
      fetch("/api/backoffice/bookings", { signal: controller.signal }).then((r) => r.json()),
      fetch("/api/backoffice/settings", { signal: controller.signal }).then((r) => r.json()),
    ])
      .then(([bookingsData, settingsData]) => {
        if (cancelled) return;
        setLoadError(null);
        const today = new Date().toISOString().slice(0, 10);
        const list = (bookingsData.bookings ?? [])
          .filter((b: any) => b.checkout >= today) // ainda relevante para limpeza (a decorrer ou futura)
          .map((b: any) => ({
            checkin: b.checkin,
            checkout: b.checkout,
            guestName: b.guestName,
            guestsCount: b.guestsCount,
            sameDayCleaning: b.requiresSameDayCleaning,
          }))
          .sort((a: CleaningRow, b: CleaningRow) => a.checkin.localeCompare(b.checkin));
        setRows(list);
        setCleaningPhone(settingsData.cleaning_contact_phone ?? "");
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(
          err?.name === "AbortError"
            ? "Demorou demasiado tempo a responder. Pode ser o Supabase a acordar de uma pausa — tente outra vez."
            : "Erro de ligação ao carregar a limpeza."
        );
        setLoading(false);
      });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [reloadToken]);

  function formatDate(iso: string) {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}`;
  }

  function buildMessageText(): string {
    const today = new Date().toISOString().slice(0, 10);
    const lines = [`Reservas — Aljezur Monte Clérigo (a partir de ${formatDate(today)})`, ""];
    for (const r of rows) {
      const cleaningNote = r.sameDayCleaning ? " ⚠️ LIMPEZA NO PRÓPRIO DIA (saída e entrada)" : "";
      lines.push(`• ${formatDate(r.checkin)} a ${formatDate(r.checkout)} — ${r.guestName} — ${r.guestsCount} pessoas${cleaningNote}`);
    }
    return lines.join("\n");
  }

  function handleCopy() {
    navigator.clipboard.writeText(buildMessageText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleSendWhatsapp() {
    const text = encodeURIComponent(buildMessageText());
    const digits = cleaningPhone.replace(/\D/g, "");
    const url = digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, "_blank");
  }

  return (
    <main className="max-w-3xl mx-auto p-8">
      <h1 className="text-2xl font-semibold mb-1">Tabela de limpezas</h1>
      <p className="text-sm text-gray-500 mb-6">
        Resumo de reservas a partir de hoje, pronto a enviar para quem faz a limpeza.
        {!cleaningPhone && (
          <>
            {" "}
            Não há um contacto WhatsApp configurado —{" "}
            <Link href="/backoffice" className="underline">
              adicione-o nas definições
            </Link>{" "}
            para o botão abrir diretamente a conversa certa.
          </>
        )}
      </p>

      {loading ? (
        <LoadingSpinner />
      ) : loadError ? (
        <div className="text-center py-16">
          <p className="text-red-600 text-sm mb-3">{loadError}</p>
          <button
            onClick={() => {
              setLoading(true);
              setReloadToken((t) => t + 1);
            }}
            className="border rounded px-4 py-2 text-sm hover:bg-gray-50"
          >
            Tentar outra vez
          </button>
        </div>
      ) : rows.length === 0 ? (
        <p className="text-gray-500 text-sm">Sem reservas futuras.</p>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2">Check-in</th>
                  <th className="text-left px-4 py-2">Check-out</th>
                  <th className="text-left px-4 py-2">Hóspede</th>
                  <th className="text-left px-4 py-2">Pessoas</th>
                  <th className="text-left px-4 py-2">Limpeza no dia</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={`border-t ${r.sameDayCleaning ? "bg-amber-50" : ""}`}>
                    <td className="px-4 py-2">{formatDate(r.checkin)}</td>
                    <td className="px-4 py-2">{formatDate(r.checkout)}</td>
                    <td className="px-4 py-2">{r.guestName}</td>
                    <td className="px-4 py-2">{r.guestsCount}</td>
                    <td className="px-4 py-2">{r.sameDayCleaning ? "🧹 Sim" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-gray-50 border rounded-lg p-4 mb-4 whitespace-pre-wrap text-sm font-mono text-gray-700">
            {buildMessageText()}
          </div>

          <div className="flex gap-3">
            <button onClick={handleSendWhatsapp} className="bg-green-600 text-white px-4 py-2 rounded font-medium">
              Enviar por WhatsApp
            </button>
            <button onClick={handleCopy} className="border px-4 py-2 rounded text-sm">
              {copied ? "Copiado!" : "Copiar texto"}
            </button>
          </div>
        </>
      )}
    </main>
  );
}
