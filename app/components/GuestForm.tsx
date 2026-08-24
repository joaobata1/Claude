"use client";

import { useState } from "react";

export interface GuestFormData {
  fullName: string;
  nationality: string;
  documentType: string;
  documentNumber: string;
  birthDate: string;
  isLeadGuest: boolean;
}

const DOCUMENT_TYPES = [
  { value: "cc", label: "Cartão de Cidadão" },
  { value: "bi", label: "Bilhete de Identidade" },
  { value: "passaporte", label: "Passaporte" },
  { value: "titulo_residencia", label: "Título de Residência" },
  { value: "outro", label: "Outro documento" },
];

function emptyGuest(isLead = false): GuestFormData {
  return { fullName: "", nationality: "", documentType: "cc", documentNumber: "", birthDate: "", isLeadGuest: isLead };
}

export function useGuestForm(guestsCount: number) {
  const [guests, setGuests] = useState<GuestFormData[]>(
    Array.from({ length: guestsCount }, (_, i) => emptyGuest(i === 0))
  );

  function resize(newCount: number) {
    setGuests((prev) => {
      const next = [...prev];
      while (next.length < newCount) next.push(emptyGuest(next.length === 0));
      while (next.length > newCount) next.pop();
      if (!next.some((g) => g.isLeadGuest) && next.length > 0) next[0].isLeadGuest = true;
      return next;
    });
  }

  function update(index: number, field: keyof GuestFormData, value: string | boolean) {
    setGuests((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  return { guests, resize, update };
}

export default function GuestForm({
  guests,
  onChange,
}: {
  guests: GuestFormData[];
  onChange: (index: number, field: keyof GuestFormData, value: string | boolean) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Dados dos hóspedes</h3>
        <p className="text-sm text-gray-500">
          Obrigatório por lei (boletim de alojamento / SIBA-AIMA) para todos os hóspedes, incluindo menores.
        </p>
      </div>

      {guests.map((guest, i) => (
        <div key={i} className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-medium text-sm">Hóspede {i + 1}</p>
            <label className="flex items-center gap-2 text-xs text-gray-500">
              <input
                type="radio"
                name="lead-guest"
                checked={guest.isLeadGuest}
                onChange={() => onChange(i, "isLeadGuest", true)}
              />
              Titular da reserva
            </label>
          </div>

          <input
            placeholder="Nome completo"
            className="w-full border rounded px-3 py-2 text-sm"
            value={guest.fullName}
            onChange={(e) => onChange(i, "fullName", e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Nacionalidade"
              className="w-full border rounded px-3 py-2 text-sm"
              value={guest.nationality}
              onChange={(e) => onChange(i, "nationality", e.target.value)}
            />
            <input
              type="date"
              className="w-full border rounded px-3 py-2 text-sm"
              value={guest.birthDate}
              onChange={(e) => onChange(i, "birthDate", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <select
              className="w-full border rounded px-3 py-2 text-sm"
              value={guest.documentType}
              onChange={(e) => onChange(i, "documentType", e.target.value)}
            >
              {DOCUMENT_TYPES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            <input
              placeholder="Número do documento"
              className="w-full border rounded px-3 py-2 text-sm"
              value={guest.documentNumber}
              onChange={(e) => onChange(i, "documentNumber", e.target.value)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
