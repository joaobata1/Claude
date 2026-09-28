"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { BookingOverviewRow, SemaphoreColor } from "@/lib/bookings-overview";
import LoadingSpinner from "@/app/components/LoadingSpinner";

const SEMAPHORE_COLOR: Record<SemaphoreColor, string> = {
  green: "#2E9E5B",
  red: "#D14343",
  amber: "#E0A020",
  gray: "#B4B2A9",
};

function Dot({ color, title }: { color: SemaphoreColor; title: string }) {
  return (
    <span
      title={title}
      style={{
        display: "inline-block",
        width: 12,
        height: 12,
        borderRadius: "50%",
        backgroundColor: SEMAPHORE_COLOR[color],
      }}
    />
  );
}

const SOURCE_LABEL: Record<string, string> = {
  site: "Site próprio",
  airbnb: "Airbnb",
  booking: "Booking.com",
  vrbo: "VRBO",
  outros: "Outros",
};

function whatsappLink(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}`;
}

function WhatsappButton({ phone }: { phone: string | null }) {
  const link = whatsappLink(phone);
  if (!link) return <span className="text-gray-300 text-xs">—</span>;
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-green-700 border border-green-200 bg-green-50 rounded px-2 py-1 hover:bg-green-100"
      title="Abrir conversa no WhatsApp"
    >
      WhatsApp
    </a>
  );
}

/** "2026-08-18" -> "18/08/26": a folha tem muitas colunas e a data por extenso ocupava duas linhas. */
function dataCurta(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a.slice(2)}`;
}

export default function Reservas() {
  const router = useRouter();
  const [bookings, setBookings] = useState<BookingOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [mostrarCanceladas, setMostrarCanceladas] = useState(false);
  const [aReativar, setAReativar] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    fetch(`/api/backoffice/bookings${mostrarCanceladas ? "?canceladas=1" : ""}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setLoadError(null);
        setBookings(data.bookings ?? []);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(
          err?.name === "AbortError"
            ? "Demorou demasiado tempo a responder. Pode ser o Supabase a acordar de uma pausa — tente outra vez."
            : "Erro de ligação ao carregar as reservas."
        );
        setLoading(false);
      });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [reloadToken, mostrarCanceladas]);

  /**
   * Devolve a reserva ao estado normal da sua origem: as das plataformas não passam
   * por pagamento no site ("não aplicável"), as do próprio site voltam a "pendente".
   */
  async function reativar(b: BookingOverviewRow) {
    setAReativar(b.id);
    const estado = b.source === "site" ? "pending" : "not_applicable";
    try {
      await fetch(`/api/backoffice/bookings/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_status: estado }),
      });
      setReloadToken((t) => t + 1);
    } catch {
      setLoadError("Não foi possível reativar a reserva.");
    }
    setAReativar(null);
  }

  return (
    <main className="max-w-7xl mx-auto px-5 py-6 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Folha de reservas</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setLoading(true);
              setMostrarCanceladas((v) => !v);
            }}
            className={`text-sm rounded px-3 py-2 border ${
              mostrarCanceladas ? "bg-gray-900 text-white border-gray-900" : "hover:bg-gray-50"
            }`}
          >
            {mostrarCanceladas ? "Ocultar canceladas" : "Ver canceladas"}
          </button>
          <a
            href="/api/backoffice/export-bookings"
            className="text-sm bg-gray-900 text-white rounded px-3 py-2 hover:bg-gray-800"
          >
            Exportar (CSV)
          </a>
        </div>
      </div>

      <div className="flex items-center gap-6 text-xs text-gray-500 mb-4 flex-wrap">
        <span className="flex items-center gap-1.5"><Dot color="green" title="" /> OK</span>
        <span className="flex items-center gap-1.5"><Dot color="amber" title="" /> Parcial</span>
        <span className="flex items-center gap-1.5"><Dot color="red" title="" /> Pendente</span>
        <span className="flex items-center gap-1.5"><Dot color="gray" title="" /> Não aplicável</span>
        <span className="flex items-center gap-1.5">🧹 Limpeza obrigatória no dia (entrada e saída sem intervalo)</span>
      </div>

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
      ) : bookings.length === 0 ? (
        <p className="text-gray-500 text-sm">Ainda não há reservas registadas.</p>
      ) : (
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-[13px]">
            <thead className="bg-gray-50 text-gray-500 text-[11px] uppercase">
              <tr>
                <th className="text-left px-2 py-2">Nº</th>
                <th className="text-left px-2 py-2">Entrada</th>
                <th className="text-left px-2 py-2">Saída</th>
                <th className="text-left px-2 py-2">Origem</th>
                <th className="text-left px-2 py-2">Hóspede</th>
                <th className="text-left px-2 py-2 hidden lg:table-cell">Telefone</th>
                <th className="text-center px-2 py-2" title="Número de pessoas">Pax</th>
                <th className="text-right px-2 py-2">Total</th>
                <th className="text-right px-2 py-2 hidden xl:table-cell">Comissão</th>
                <th className="text-right px-2 py-2 hidden xl:table-cell">Limpeza</th>
                <th className="text-right px-2 py-2">Líquido</th>
                <th className="text-center px-1.5 py-2" title="Pagamento">Pag.</th>
                <th className="text-center px-1.5 py-2" title="Dados dos hóspedes para o SIBA">SIBA</th>
                <th className="text-center px-1.5 py-2" title="Submissão ao SIBA">Sub.</th>
                <th className="text-center px-1.5 py-2" title="Chaves enviadas">Chav.</th>
                <th className="text-center px-1.5 py-2" title="Limpeza no próprio dia">🧹</th>
                <th className="text-center px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr
                  key={b.id}
                  onClick={() => router.push(`/backoffice/reservas/${b.id}`)}
                  className={`border-t cursor-pointer hover:bg-gray-50 ${
                    b.paymentStatus === "cancelled"
                      ? "bg-gray-50 text-gray-400"
                      : b.requiresSameDayCleaning
                      ? "bg-amber-50"
                      : ""
                  }`}
                >
                  <td className="px-2 py-2 text-gray-500">#{b.bookingNumber}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{dataCurta(b.checkin)}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{dataCurta(b.checkout)}</td>
                  <td className="px-2 py-2">{SOURCE_LABEL[b.source] ?? b.source}</td>
                  <td className="px-2 py-2">{b.guestName}</td>
                  <td className="px-2 py-2 text-gray-500 hidden lg:table-cell whitespace-nowrap">{b.guestPhone ?? "—"}</td>
                  <td className="px-2 py-2 text-center">{b.guestsCount}</td>
                  <td className="px-2 py-2 text-right">{b.totalPrice != null ? `€${b.totalPrice.toFixed(2)}` : "—"}</td>
                  <td className="px-2 py-2 text-right text-gray-500 hidden xl:table-cell">
                    {b.commissionAmount > 0 ? `-€${b.commissionAmount.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-2 py-2 text-right text-gray-500 hidden xl:table-cell">
                    {b.cleaningCost > 0 ? `-€${b.cleaningCost.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-2 py-2 text-right font-medium">
                    {b.netTotal != null ? `€${b.netTotal.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-1.5 py-2 text-center">
                    <Dot
                      color={b.paymentSemaphore}
                      title={
                        b.paymentStatus === "paid"
                          ? "Pago"
                          : b.paymentStatus === "not_applicable"
                          ? "Não aplicável (reserva OTA)"
                          : b.paymentStatus === "failed"
                          ? "Pagamento falhado"
                          : "Pagamento pendente"
                      }
                    />
                  </td>
                  <td className="px-1.5 py-2 text-center">
                    <Dot
                      color={b.sibaDataSemaphore}
                      title={`${b.guestsCompleteCount} de ${b.guestsCount} hóspedes com dados completos`}
                    />
                  </td>
                  <td className="px-1.5 py-2 text-center">
                    <Dot
                      color={b.sibaSubmissionSemaphore}
                      title={
                        !b.hasForeignGuests
                          ? "Sem hóspedes estrangeiros registados"
                          : b.sibaSubmitted
                          ? "Submetido ao SIBA"
                          : "Por submeter ao SIBA"
                      }
                    />
                  </td>
                  <td className="px-1.5 py-2 text-center">
                    <Dot color={b.keysSentSemaphore} title={b.keysSentSemaphore === "green" ? "Código Nuki enviado" : "Código Nuki ainda não enviado"} />
                  </td>
                  <td className="px-2 py-2 text-center">
                    {b.requiresSameDayCleaning ? (
                      <span
                        title={
                          [
                            b.turnover.arrivalSameDayAsOtherCheckout ? "Entrada no dia de saída de outra reserva" : null,
                            b.turnover.departureSameDayAsOtherCheckin ? "Saída no dia de entrada de outra reserva" : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        }
                      >
                        🧹
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    {b.paymentStatus === "cancelled" ? (
                      <button
                        onClick={() => reativar(b)}
                        disabled={aReativar === b.id}
                        className="text-xs border border-gray-900 text-gray-900 rounded px-2 py-1 hover:bg-gray-900 hover:text-white disabled:opacity-50"
                      >
                        {aReativar === b.id ? "..." : "Reativar"}
                      </button>
                    ) : (
                      <WhatsappButton phone={b.guestPhone} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
