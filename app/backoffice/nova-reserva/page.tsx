"use client";

import { useState } from "react";
import GuestForm, { useGuestForm } from "@/app/components/GuestForm";

export default function NovaReserva() {
  const [manual, setManual] = useState({
    source: "airbnb",
    guestName: "",
    guestEmail: "",
    guestPhone: "",
    checkin: "",
    checkout: "",
    guestsCount: 1,
    totalPrice: "",
    commissionAmount: "",
    cleaningCost: "",
    bookingReference: "",
  });
  const [manualResult, setManualResult] = useState<string | null>(null);
  const { guests, resize, update } = useGuestForm(manual.guestsCount);
  const [parsingImage, setParsingImage] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  function fileToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        resolve({ base64, mediaType: file.type });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleBookingImage(file: File) {
    setParseError(null);
    setParsingImage(true);
    try {
      const { base64, mediaType } = await fileToBase64(file);
      const res = await fetch("/api/backoffice/parse-booking-screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mediaType }),
      });
      const data = await res.json();
      if (!res.ok) {
        setParseError(data.error ?? "Não foi possível ler a imagem.");
        setParsingImage(false);
        return;
      }

      const newGuestsCount = data.guestsCount ?? manual.guestsCount;
      setManual((prev) => ({
        ...prev,
        source: ["airbnb", "booking", "vrbo", "outros"].includes(data.source) ? data.source : prev.source,
        guestName: data.guestName ?? prev.guestName,
        guestEmail: data.guestEmail ?? prev.guestEmail,
        guestPhone: data.guestPhone ?? prev.guestPhone,
        checkin: data.checkin ?? prev.checkin,
        checkout: data.checkout ?? prev.checkout,
        guestsCount: newGuestsCount,
        totalPrice: data.totalPrice != null ? String(data.totalPrice) : prev.totalPrice,
        commissionAmount: data.commissionAmount != null ? String(data.commissionAmount) : prev.commissionAmount,
        cleaningCost: data.cleaningFee != null ? String(data.cleaningFee) : prev.cleaningCost,
        bookingReference: data.bookingReference ?? prev.bookingReference,
      }));
      resize(newGuestsCount);
    } catch {
      setParseError("Erro de ligação ao tentar ler a imagem.");
    }
    setParsingImage(false);
  }

  async function submitManualBooking() {
    setManualResult("A processar...");
    const res = await fetch("/api/backoffice/manual-booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...manual,
        totalPrice: manual.totalPrice ? parseFloat(manual.totalPrice) : null,
        commissionAmount: manual.commissionAmount ? parseFloat(manual.commissionAmount) : 0,
        cleaningCost: manual.cleaningCost ? parseFloat(manual.cleaningCost) : 0,
        guests: guests.map((g) => ({
          fullName: g.fullName,
          nationality: g.nationality,
          documentType: g.documentType,
          documentNumber: g.documentNumber,
          birthDate: g.birthDate,
          isLeadGuest: g.isLeadGuest,
        })),
      }),
    });
    const data = await res.json();
    if (data.release?.released) {
      setManualResult(`Reserva registada. Código Nuki: ${data.release.nukiCode} — enviado por SMS e email.`);
    } else if (data.release?.reason === "waiting_guest_data") {
      setManualResult(
        "Reserva registada, mas o código Nuki não foi enviado — está ativo o interruptor que obriga aos dados dos hóspedes primeiro. Preencha os dados em falta e volte a submeter."
      );
    } else if (data.warning) {
      setManualResult(data.warning);
    } else if (data.error) {
      setManualResult(data.error);
    } else {
      setManualResult("Reserva registada.");
    }
  }

  return (
    <main className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-semibold mb-1">Registar reserva manual</h1>
      <p className="text-sm text-gray-500 mb-6">
        Para reservas vindas do Airbnb, Booking, VRBO ou outra plataforma — estas não partilham dados de
        contacto reais via API. Introduza aqui os dados assim que receber a notificação de reserva — o
        código Nuki é gerado automaticamente.
      </p>

      <div
        onPaste={(e) => {
          const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
          const file = item?.getAsFile();
          if (file) handleBookingImage(file);
        }}
        className="border-2 border-dashed rounded-lg p-4 mb-6 text-center text-sm text-gray-500 bg-gray-50"
      >
        <p className="mb-2">
          Cole aqui uma screenshot da reserva (Ctrl+V) ou carregue um ficheiro — os dados são lidos
          automaticamente e o formulário abaixo é pré-preenchido.
        </p>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleBookingImage(file);
          }}
          className="text-xs"
        />
        {parsingImage && <p className="text-xs text-gray-400 mt-2">A ler a imagem...</p>}
        {parseError && <p className="text-xs text-red-600 mt-2">{parseError}</p>}
      </div>

      <div className="space-y-3">
        <select
          className="w-full border rounded px-3 py-2"
          value={manual.source}
          onChange={(e) => setManual({ ...manual, source: e.target.value })}
        >
          <option value="airbnb">Airbnb</option>
          <option value="booking">Booking.com</option>
          <option value="vrbo">VRBO</option>
          <option value="outros">Outros</option>
        </select>
        <input
          placeholder="Nome do hóspede"
          className="w-full border rounded px-3 py-2"
          value={manual.guestName}
          onChange={(e) => setManual({ ...manual, guestName: e.target.value })}
        />
        <input
          placeholder="Email (opcional)"
          className="w-full border rounded px-3 py-2"
          value={manual.guestEmail}
          onChange={(e) => setManual({ ...manual, guestEmail: e.target.value })}
        />
        <div className="flex gap-2">
          <input
            placeholder="Telefone"
            className="w-full border rounded px-3 py-2"
            value={manual.guestPhone}
            onChange={(e) => setManual({ ...manual, guestPhone: e.target.value })}
          />
          {manual.guestPhone.replace(/\D/g, "") && (
            <a
              href={`https://wa.me/${manual.guestPhone.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 flex items-center text-sm text-green-700 border border-green-200 bg-green-50 rounded px-3 hover:bg-green-100"
            >
              WhatsApp
            </a>
          )}
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Número de hóspedes</label>
          <input
            type="number"
            min={1}
            max={6}
            className="w-full border rounded px-3 py-2"
            value={manual.guestsCount}
            onChange={(e) => {
              const n = Number(e.target.value);
              setManual({ ...manual, guestsCount: n });
              resize(n);
            }}
          />
        </div>
        <div className="flex gap-3">
          <input
            type="date"
            className="w-full border rounded px-3 py-2"
            value={manual.checkin}
            onChange={(e) => setManual({ ...manual, checkin: e.target.value })}
          />
          <input
            type="date"
            className="w-full border rounded px-3 py-2"
            value={manual.checkout}
            onChange={(e) => setManual({ ...manual, checkout: e.target.value })}
          />
        </div>

        <div className="border-t pt-3 mt-1">
          <p className="text-sm font-medium text-gray-700 mb-2">Dados financeiros</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Preço total (€)</label>
              <input
                type="number"
                step={0.01}
                className="w-full border rounded px-3 py-2 text-sm"
                value={manual.totalPrice}
                onChange={(e) => setManual({ ...manual, totalPrice: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Comissão do canal (€)</label>
              <input
                type="number"
                step={0.01}
                className="w-full border rounded px-3 py-2 text-sm"
                value={manual.commissionAmount}
                onChange={(e) => setManual({ ...manual, commissionAmount: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Custo de limpeza (€)</label>
              <input
                type="number"
                step={0.01}
                className="w-full border rounded px-3 py-2 text-sm"
                value={manual.cleaningCost}
                onChange={(e) => setManual({ ...manual, cleaningCost: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nº de reserva na plataforma</label>
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={manual.bookingReference}
                onChange={(e) => setManual({ ...manual, bookingReference: e.target.value })}
              />
            </div>
          </div>
          {manual.totalPrice && (
            <p className="text-xs text-gray-500 mt-2">
              Total líquido estimado: €
              {(
                parseFloat(manual.totalPrice || "0") -
                parseFloat(manual.commissionAmount || "0") -
                parseFloat(manual.cleaningCost || "0")
              ).toFixed(2)}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6">
        <GuestForm guests={guests} onChange={update} />
      </div>
      <button onClick={submitManualBooking} className="mt-4 bg-black text-white px-4 py-2 rounded">
        Registar e gerar código Nuki
      </button>
      {manualResult && <p className="text-sm mt-2">{manualResult}</p>}
    </main>
  );
}
