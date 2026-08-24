import { randomUUID } from "crypto";
import { db } from "./db";

/**
 * Campos do Boletim de Alojamento (SIBA - AIMA). O preenchimento pode ser
 * parcial: só os hóspedes cujos dados estejam completos são guardados e,
 * mais tarde, submetidos ao SIBA. Hóspedes deixados em branco são
 * simplesmente ignorados (não geram erro).
 */
export interface GuestInput {
  fullName: string;
  nationality: string;
  documentType: "cc" | "bi" | "passaporte" | "titulo_residencia" | "outro" | "";
  documentNumber: string;
  birthDate: string; // YYYY-MM-DD
  isLeadGuest?: boolean;
}

export const DOCUMENT_TYPES: { value: GuestInput["documentType"]; label: string }[] = [
  { value: "cc", label: "Cartão de Cidadão" },
  { value: "bi", label: "Bilhete de Identidade" },
  { value: "passaporte", label: "Passaporte" },
  { value: "titulo_residencia", label: "Título de Residência" },
  { value: "outro", label: "Outro documento" },
];

function isGuestEmpty(g: GuestInput): boolean {
  return !g.fullName?.trim() && !g.nationality?.trim() && !g.documentNumber?.trim() && !g.birthDate;
}

function isGuestComplete(g: GuestInput): boolean {
  return !!(g.fullName?.trim() && g.nationality?.trim() && g.documentType && g.documentNumber?.trim() && g.birthDate);
}

/**
 * Valida a lista de hóspedes recebida do formulário: aceita que fique
 * incompleta (menos hóspedes do que o total da reserva), mas rejeita
 * entradas "a meio" (algum campo preenchido, outros em falta), porque
 * isso normalmente indica um erro de preenchimento.
 */
export function validateGuestsForSave(guests: GuestInput[]): string | null {
  if (!Array.isArray(guests)) return "Formato de hóspedes inválido.";
  for (let i = 0; i < guests.length; i++) {
    const g = guests[i];
    if (isGuestEmpty(g)) continue;
    if (!isGuestComplete(g)) {
      return `Complete todos os campos do hóspede ${i + 1}, ou deixe-o em branco.`;
    }
  }
  return null;
}

/** Guarda apenas os hóspedes cujos dados estão completos; ignora os deixados em branco */
export function saveGuestsForBooking(bookingId: string, guests: GuestInput[]) {
  db.prepare("DELETE FROM guests WHERE booking_id = ?").run(bookingId);

  const complete = guests.filter(isGuestComplete);
  const insert = db.prepare(
    `INSERT INTO guests (id, booking_id, full_name, nationality, document_type, document_number, birth_date, is_lead_guest)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const g of complete) {
    insert.run(
      randomUUID(),
      bookingId,
      g.fullName.trim(),
      g.nationality.trim(),
      g.documentType,
      g.documentNumber.trim(),
      g.birthDate,
      g.isLeadGuest ? 1 : 0
    );
  }
  return complete.length;
}

export function getGuestsForBooking(bookingId: string) {
  return db.prepare("SELECT * FROM guests WHERE booking_id = ?").all(bookingId) as any[];
}

/** Quantos hóspedes completos já estão guardados para esta reserva */
export function countCompleteGuests(bookingId: string): number {
  const row = db.prepare("SELECT COUNT(*) as c FROM guests WHERE booking_id = ?").get(bookingId) as { c: number };
  return row.c;
}
