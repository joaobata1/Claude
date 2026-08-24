import { buildSIBAXMLRequest, parseSIBAXMLResponse, GuestDocumentType } from "node-siba";
import { db, getSetting } from "./db";

/**
 * Integração real com o SIBA via SOAP (biblioteca node-siba), usando os
 * dados da unidade hoteleira configurados no backoffice (ofício da AIMA).
 *
 * IMPORTANTE: só hóspedes ESTRANGEIROS são comunicados ao SIBA. Hóspedes de
 * nacionalidade portuguesa ficam apenas no Livro de Hóspedes (registo
 * interno, sem envio a nenhuma entidade) — não passam por este módulo.
 *
 * Endpoints:
 * - Produção: https://siba.sef.pt/baws/boletinsalojamento.asmx
 * - Testes:   https://siba.sef.pt/bawsdev/boletinsalojamento.asmx
 */

const SIBA_ENDPOINT = "https://siba.sef.pt/baws/boletinsalojamento.asmx";
const SOAP_ACTION = "http://sef.pt/EntregaBoletinsAlojamento";

function isPortuguese(nationality: string): boolean {
  const n = nationality.trim().toLowerCase();
  return n === "pt" || n === "portugal" || n === "portuguesa" || n === "português";
}

function mapDocumentType(type: string): GuestDocumentType {
  if (type === "passaporte") return GuestDocumentType.PASSPORT;
  if (type === "cc" || type === "bi") return GuestDocumentType.ID_CARD;
  return GuestDocumentType.OTHER;
}

function splitName(fullName: string): { firstName: string; surname?: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0] };
  return { firstName: parts.slice(0, -1).join(" "), surname: parts[parts.length - 1] };
}

interface HotelUnitSettings {
  nipc: string;
  establishment: string;
  accessKey: string;
  name: string;
  abbreviation: string;
  address: string;
  location: string;
  zipCode: string;
  zipZone: string;
  phone: string;
  contactName: string;
  contactEmail: string;
}

function getHotelUnitSettings(): HotelUnitSettings | null {
  const keys: (keyof HotelUnitSettings)[] = [
    "nipc", "establishment", "accessKey", "name", "abbreviation",
    "address", "location", "zipCode", "zipZone", "phone", "contactName", "contactEmail",
  ];
  const map: Record<string, string> = {
    nipc: "siba_nipc",
    establishment: "siba_estabelecimento",
    accessKey: "siba_chave_acesso",
    name: "siba_nome_unidade",
    abbreviation: "siba_abreviatura",
    address: "siba_morada",
    location: "siba_localidade",
    zipCode: "siba_codigo_postal",
    zipZone: "siba_zona_postal",
    phone: "siba_telefone",
    contactName: "siba_contacto_nome",
    contactEmail: "siba_contacto_email",
  };

  const values: any = {};
  for (const key of keys) {
    const v = getSetting(map[key]);
    if (!v) return null; // configuração incompleta
    values[key] = v;
  }
  return values as HotelUnitSettings;
}

/** Hóspedes estrangeiros com dados completos, com check-in na data indicada, ainda não submetidos */
function getForeignGuestsPending(date: string) {
  const rows = db
    .prepare(
      `SELECT g.*, b.id as booking_id, b.checkin, b.checkout
       FROM guests g
       JOIN bookings b ON b.id = g.booking_id
       WHERE b.checkin = ? AND b.siba_submitted = 0`
    )
    .all(date) as any[];

  return rows.filter((r) => r.nationality && !isPortuguese(r.nationality));
}

export function generateDailyReport(date: string): string {
  const guests = getForeignGuestsPending(date);
  if (guests.length === 0) return `Sem hóspedes estrangeiros para comunicar em ${date}.`;

  const lines = [`Boletim de Alojamento — check-ins em ${date} (apenas estrangeiros)`, ""];
  for (const g of guests) {
    lines.push(
      `Reserva ${g.booking_id} | ${g.full_name} | ${g.nationality} | ${g.document_type.toUpperCase()} ${g.document_number} | Nasc. ${g.birth_date} | ${g.checkin} a ${g.checkout}`
    );
  }
  return lines.join("\n");
}

export async function submitDailySiba(date: string) {
  const hotelUnit = getHotelUnitSettings();
  if (!hotelUnit) {
    return { submitted: false, reason: "Dados da unidade hoteleira SIBA incompletos no backoffice." };
  }

  const guests = getForeignGuestsPending(date);
  if (guests.length === 0) {
    return { submitted: true, count: 0 };
  }

  const xml = buildSIBAXMLRequest({
    number: Date.now(),
    issueDate: new Date(),
    hotelUnit,
    guests: guests.map((g) => {
      const { firstName, surname } = splitName(g.full_name);
      return {
        firstName,
        surname,
        nationality: g.nationality,
        birthDate: new Date(g.birth_date),
        checkInDate: new Date(g.checkin),
        checkOutDate: new Date(g.checkout),
        countryOfResidence: g.nationality, // simplificação: sem campo próprio no formulário atual
        placeOfResidence: "",
        document: {
          number: g.document_number,
          issuingCountry: g.nationality, // simplificação: assume país emissor = nacionalidade
          type: mapDocumentType(g.document_type),
        },
      };
    }),
  });

  const res = await fetch(SIBA_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: SOAP_ACTION },
    body: xml,
  });

  const responseText = await res.text();
  const parsed = parseSIBAXMLResponse(responseText);

  if (!parsed.isSuccess) {
    return { submitted: false, reason: `${parsed.code}: ${parsed.errorMessage ?? "erro desconhecido"}` };
  }

  const bookingIds = [...new Set(guests.map((g) => g.booking_id))];
  const markDone = db.prepare("UPDATE bookings SET siba_submitted = 1 WHERE id = ?");
  for (const id of bookingIds) markDone.run(id);

  return { submitted: true, count: guests.length };
}
