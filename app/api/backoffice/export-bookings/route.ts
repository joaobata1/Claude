import { NextResponse } from "next/server";
import { getBookingsOverview } from "@/lib/bookings-overview";

const SOURCE_LABEL: Record<string, string> = {
  site: "Site próprio",
  airbnb: "Airbnb",
  booking: "Booking",
  vrbo: "VRBO",
};

function csvEscape(value: string | number | null): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (str.includes(";") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Formato português: vírgula decimal, ex. 225,81 */
function ptNumber(n: number): string {
  return n.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** DD-MM-YYYY, igual ao formato predominante na folha original */
function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

export async function GET() {
  const bookings = getBookingsOverview();

  // Ordem de colunas EXATAMENTE igual à folha de referência do utilizador
  const headers = [
    "Nome",
    "Check in",
    "Check Out",
    "Noites",
    "n. Dias entre reservas",
    "Adultos",
    "Crianças",
    "Obs",
    "Plataforma",
    "OBS",
    "RESERVA",
    "Contacto",
    "Valor",
    "Comissão",
    "Limpeza",
    "Liquido",
  ];

  const rows = bookings.map((b) => [
    b.guestName,
    formatDate(b.checkin),
    formatDate(b.checkout),
    ptNumber(b.nights),
    b.daysUntilNextBooking === null ? "" : b.daysUntilNextBooking === 0 ? "-" : ptNumber(b.daysUntilNextBooking),
    b.adultsCount,
    b.childrenCount,
    "", // Obs — campo de notas livres, sem equivalente no sistema ainda
    SOURCE_LABEL[b.source] ?? b.source,
    "", // OBS — campo de notas livres, sem equivalente no sistema ainda
    b.bookingReference ?? "",
    b.guestPhone ?? "",
    b.totalPrice != null ? ptNumber(b.totalPrice) : "",
    b.commissionAmount > 0 ? ptNumber(b.commissionAmount) : "",
    b.cleaningCost > 0 ? ptNumber(b.cleaningCost) : "",
    b.netTotal != null ? ptNumber(b.netTotal) : "",
  ]);

  const lines = [headers, ...rows].map((row) => row.map(csvEscape).join(";"));
  // BOM UTF-8 para o Excel interpretar acentos corretamente
  const csv = "\uFEFF" + lines.join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reservas-aljezur-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
