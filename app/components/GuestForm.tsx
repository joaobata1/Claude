"use client";

import { useState } from "react";
import { getDictionary, interpolate, type Locale } from "@/lib/i18n";

export interface GuestFormData {
  fullName: string;
  nationality: string;
  documentType: string;
  documentNumber: string;
  birthDate: string;
  isLeadGuest: boolean;
}

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
  locale = "pt",
}: {
  guests: GuestFormData[];
  onChange: (index: number, field: keyof GuestFormData, value: string | boolean) => void;
  locale?: Locale;
}) {
  const t = getDictionary(locale).guestForm;
  const documentTypes = [
    { value: "cc", label: t.docCC },
    { value: "bi", label: t.docBI },
    { value: "passaporte", label: t.docPassport },
    { value: "titulo_residencia", label: t.docResidence },
    { value: "outro", label: t.docOther },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{t.title}</h3>
        <p className="text-sm text-gray-500">{t.subtitle}</p>
      </div>

      {guests.map((guest, i) => (
        <div key={i} className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-medium text-sm">{interpolate(t.guestLabel, { number: i + 1 })}</p>
            <label className="flex items-center gap-2 text-xs text-gray-500">
              <input
                type="radio"
                name="lead-guest"
                checked={guest.isLeadGuest}
                onChange={() => onChange(i, "isLeadGuest", true)}
              />
              {t.leadGuest}
            </label>
          </div>

          <input
            placeholder={t.fullName}
            className="w-full border rounded px-3 py-2 text-sm"
            value={guest.fullName}
            onChange={(e) => onChange(i, "fullName", e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder={t.nationality}
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
              {documentTypes.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            <input
              placeholder={t.documentNumber}
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
