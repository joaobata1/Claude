"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { BookingOverviewRow, SemaphoreColor } from "@/lib/bookings-overview";

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

export default function Reservas() {
  const router = useRouter();
  const [bookings, setBookings] = useState<BookingOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/backoffice/bookings")
      .then((r) => r.json())
      .then((data) => {
        setBookings(data.bookings ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <main className="max-w-7xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Folha de reservas</h1>
        <a
          href="/api/backoffice/export-bookings"
          className="text-sm bg-gray-900 text-white rounded px-4 py-2 hover:bg-gray-800"
        >
          Exportar para Excel (CSV)
        </a>
      </div>

      <div className="flex items-center gap-6 text-xs text-gray-500 mb-4 flex-wrap">
        <span className="flex items-center gap-1.5"><Dot color="green" title="" /> OK</span>
        <span className="flex items-center gap-1.5"><Dot color="amber" title="" /> Parcial</span>
        <span className="flex items-center gap-1.5"><Dot color="red" title="" /> Pendente</span>
        <span className="flex items-center gap-1.5"><Dot color="gray" title="" /> Não aplicável</span>
        <span className="flex items-center gap-1.5">🧹 Limpeza obrigatória no dia (entrada e saída sem intervalo)</span>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">A carregar...</p>
      ) : bookings.length === 0 ? (
        <p className="text-gray-500 text-sm">Ainda não há reservas registadas.</p>
      ) : (
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Nº</th>
                <th className="text-left px-4 py-3">Check-in</th>
                <th className="text-left px-4 py-3">Check-out</th>
                <th className="text-left px-4 py-3">Origem</th>
                <th className="text-left px-4 py-3">Hóspede</th>
                <th className="text-left px-4 py-3">Telefone</th>
                <th className="text-left px-4 py-3">Nº pessoas</th>
                <th className="text-right px-4 py-3">Preço total</th>
                <th className="text-right px-4 py-3">Comissão</th>
                <th className="text-right px-4 py-3">Limpeza</th>
                <th className="text-right px-4 py-3">Total líquido</th>
                <th className="text-center px-4 py-3">Pagamento</th>
                <th className="text-center px-4 py-3">Dados SIBA</th>
                <th className="text-center px-4 py-3">Submissão SIBA</th>
                <th className="text-center px-4 py-3">Chaves enviadas</th>
                <th className="text-center px-4 py-3">Limpeza</th>
                <th className="text-center px-4 py-3">Contacto</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr
                  key={b.id}
                  onClick={() => router.push(`/backoffice/reservas/${b.id}`)}
                  className={`border-t cursor-pointer hover:bg-gray-50 ${b.requiresSameDayCleaning ? "bg-amber-50" : ""}`}
                >
                  <td className="px-4 py-3 text-gray-500">#{b.bookingNumber}</td>
                  <td className="px-4 py-3">{b.checkin}</td>
                  <td className="px-4 py-3">{b.checkout}</td>
                  <td className="px-4 py-3">{SOURCE_LABEL[b.source] ?? b.source}</td>
                  <td className="px-4 py-3">{b.guestName}</td>
                  <td className="px-4 py-3 text-gray-500">{b.guestPhone ?? "—"}</td>
                  <td className="px-4 py-3">{b.guestsCount}</td>
                  <td className="px-4 py-3 text-right">{b.totalPrice != null ? `€${b.totalPrice.toFixed(2)}` : "—"}</td>
                  <td className="px-4 py-3 text-right text-gray-500">
                    {b.commissionAmount > 0 ? `-€${b.commissionAmount.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">
                    {b.cleaningCost > 0 ? `-€${b.cleaningCost.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {b.netTotal != null ? `€${b.netTotal.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
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
                  <td className="px-4 py-3 text-center">
                    <Dot
                      color={b.sibaDataSemaphore}
                      title={`${b.guestsCompleteCount} de ${b.guestsCount} hóspedes com dados completos`}
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
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
                  <td className="px-4 py-3 text-center">
                    <Dot color={b.keysSentSemaphore} title={b.keysSentSemaphore === "green" ? "Código Nuki enviado" : "Código Nuki ainda não enviado"} />
                  </td>
                  <td className="px-4 py-3 text-center">
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
                  <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <WhatsappButton phone={b.guestPhone} />
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
