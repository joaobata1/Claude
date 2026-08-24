"use client";

import { useState } from "react";
import GuestForm, { useGuestForm } from "@/app/components/GuestForm";

export default function Reservar() {
  const [step, setStep] = useState<"datas" | "hospedes" | "confirmado">("datas");
  const [checkin, setCheckin] = useState("");
  const [checkout, setCheckout] = useState("");
  const [guestsCount, setGuestsCount] = useState(2);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"mbway" | "card">("mbway");
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [releaseInfo, setReleaseInfo] = useState<any>(null);

  const { guests, resize, update } = useGuestForm(guestsCount);

  async function handleBook() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkin, checkout, guestsCount, guestName, guestEmail, guestPhone, paymentMethod }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao criar reserva.");
        setLoading(false);
        return;
      }
      setBookingId(data.bookingId);
      setStep("hospedes");
    } catch {
      setError("Erro de ligação. Tente novamente.");
    }
    setLoading(false);
  }

  async function handleSaveGuests() {
    if (!bookingId) return;
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/bookings/${bookingId}/guests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
    if (!res.ok) {
      setError(data.error ?? "Erro ao guardar dados dos hóspedes.");
      setLoading(false);
      return;
    }
    setReleaseInfo(data.release);
    setStep("confirmado");
    setLoading(false);
  }

  return (
    <main className="max-w-lg mx-auto p-8">
      <h1 className="text-2xl font-semibold mb-6">Reservar — Aljezur Monte Clérigo</h1>

      {step === "datas" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Check-in</label>
              <input type="date" className="w-full border rounded px-3 py-2" value={checkin} onChange={(e) => setCheckin(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Check-out</label>
              <input type="date" className="w-full border rounded px-3 py-2" value={checkout} onChange={(e) => setCheckout(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Número de hóspedes</label>
            <input
              type="number"
              min={1}
              max={6}
              className="w-full border rounded px-3 py-2"
              value={guestsCount}
              onChange={(e) => {
                const n = Number(e.target.value);
                setGuestsCount(n);
                resize(n);
              }}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Nome do titular da reserva</label>
            <input className="w-full border rounded px-3 py-2" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Email</label>
            <input className="w-full border rounded px-3 py-2" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Telefone (com indicativo, ex: 351912345678)</label>
            <input className="w-full border rounded px-3 py-2" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Método de pagamento</label>
            <select className="w-full border rounded px-3 py-2" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as any)}>
              <option value="mbway">MB WAY</option>
              <option value="card">Cartão de crédito</option>
            </select>
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button onClick={handleBook} disabled={loading} className="w-full bg-gray-900 text-white rounded py-3 font-medium">
            {loading ? "A processar..." : "Continuar para pagamento"}
          </button>
        </div>
      )}

      {step === "hospedes" && (
        <div className="space-y-6">
          <p className="text-sm text-green-600">Pedido de pagamento enviado. Enquanto confirma, preencha os dados dos hóspedes (obrigatório por lei).</p>
          <GuestForm guests={guests} onChange={update} />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button onClick={handleSaveGuests} disabled={loading} className="w-full bg-gray-900 text-white rounded py-3 font-medium">
            {loading ? "A guardar..." : "Concluir reserva"}
          </button>
        </div>
      )}

      {step === "confirmado" && (
        <div className="text-center py-12">
          <p className="text-xl font-medium mb-2">Reserva registada.</p>
          {releaseInfo?.released ? (
            <p className="text-gray-500 text-sm">
              O código de acesso já foi enviado por SMS e email.
            </p>
          ) : releaseInfo?.reason === "waiting_guest_data" ? (
            <p className="text-gray-500 text-sm">
              O pagamento foi confirmado, mas o código de acesso só é enviado depois de todos os hóspedes
              terem os dados preenchidos.
            </p>
          ) : (
            <p className="text-gray-500 text-sm">
              Assim que o pagamento for confirmado, vai receber o código de acesso por SMS e email.
            </p>
          )}
        </div>
      )}
    </main>
  );
}
