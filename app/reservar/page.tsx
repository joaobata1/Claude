"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import GuestForm, { useGuestForm } from "@/app/components/GuestForm";

const STORAGE_KEY = "aljezur-reserva-em-curso";

interface StoredState {
  step: "datas" | "hospedes" | "confirmado";
  checkin: string;
  checkout: string;
  guestsCount: number;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  paymentMethod: "mbway" | "card" | "transferencia";
  bookingId: string | null;
  releaseInfo: any;
  bankDetails: { iban: string; accountHolder: string; total: number; bookingNumber: number } | null;
}

function loadStoredState(): Partial<StoredState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Um dia [checkin, checkout) faz interseção com alguma data bloqueada? */
function rangeOverlapsBlocked(checkin: string, checkout: string, blocked: Set<string>): boolean {
  if (!checkin || !checkout) return false;
  const d = new Date(checkin);
  const end = new Date(checkout);
  while (d < end) {
    if (blocked.has(d.toISOString().slice(0, 10))) return true;
    d.setDate(d.getDate() + 1);
  }
  return false;
}

function Reservar() {
  const searchParams = useSearchParams();
  const stored = loadStoredState();
  const [step, setStep] = useState<"datas" | "hospedes" | "confirmado">(stored.step ?? "datas");
  const [checkin, setCheckin] = useState(stored.checkin ?? searchParams.get("checkin") ?? "");
  const [checkout, setCheckout] = useState(stored.checkout ?? searchParams.get("checkout") ?? "");
  const [guestsCount, setGuestsCount] = useState(stored.guestsCount ?? (Number(searchParams.get("guests")) || 2));
  const [guestName, setGuestName] = useState(stored.guestName ?? "");
  const [guestEmail, setGuestEmail] = useState(stored.guestEmail ?? "");
  const [guestPhone, setGuestPhone] = useState(stored.guestPhone ?? "");
  const [paymentMethod, setPaymentMethod] = useState<"mbway" | "card" | "transferencia">(
    stored.paymentMethod ?? "mbway"
  );
  const [bookingId, setBookingId] = useState<string | null>(stored.bookingId ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [releaseInfo, setReleaseInfo] = useState<any>(stored.releaseInfo ?? null);
  const [bankDetails, setBankDetails] = useState<StoredState["bankDetails"]>(stored.bankDetails ?? null);
  const [blockedDates, setBlockedDates] = useState<Set<string>>(new Set());

  const { guests, resize, update } = useGuestForm(guestsCount);

  // Guarda o progresso: sobrevive a recarregamentos da página (ex: ao voltar da app do MB WAY no telemóvel).
  useEffect(() => {
    const state: StoredState = {
      step,
      checkin,
      checkout,
      guestsCount,
      guestName,
      guestEmail,
      guestPhone,
      paymentMethod,
      bookingId,
      releaseInfo,
      bankDetails,
    };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // sessionStorage indisponível (ex: modo privado) — sem persistência, mas o resto continua a funcionar
    }
  }, [
    step,
    checkin,
    checkout,
    guestsCount,
    guestName,
    guestEmail,
    guestPhone,
    paymentMethod,
    bookingId,
    releaseInfo,
    bankDetails,
  ]);

  // Datas já ocupadas (reservas do site + OTAs), para avisar o cliente antes de submeter o formulário.
  useEffect(() => {
    fetch("/api/availability")
      .then((r) => r.json())
      .then((data) => setBlockedDates(new Set<string>(data.blockedDates ?? [])))
      .catch(() => {});
  }, []);

  const datesUnavailable = rangeOverlapsBlocked(checkin, checkout, blockedDates);

  async function handleBook() {
    setError(null);
    if (datesUnavailable) {
      setError("Essas datas já não estão disponíveis. Escolha outro intervalo.");
      return;
    }
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
      if (data.status === "redirect" && data.paymentUrl) {
        // Pagamento por cartão: o cliente introduz os dados do cartão numa página da ifthenpay.
        window.location.href = data.paymentUrl;
        return;
      }
      if (data.status === "bank_transfer") {
        setBankDetails({
          iban: data.iban ?? "",
          accountHolder: data.accountHolder ?? "",
          total: data.total,
          bookingNumber: data.bookingNumber,
        });
      }
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
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignorar
    }
  }

  return (
    <main className="max-w-lg mx-auto p-8">
      <h1 className="text-2xl font-semibold mb-6">Reservar — Aljezur Monte Clérigo</h1>

      {step === "datas" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Check-in</label>
              <input
                type="date"
                className="w-full border rounded px-3 py-2"
                value={checkin}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setCheckin(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Check-out</label>
              <input
                type="date"
                className="w-full border rounded px-3 py-2"
                value={checkout}
                min={checkin || new Date().toISOString().slice(0, 10)}
                onChange={(e) => setCheckout(e.target.value)}
              />
            </div>
          </div>

          {datesUnavailable && (
            <p className="text-red-600 text-sm">
              Essas datas já não estão disponíveis. Escolha outro intervalo.
            </p>
          )}

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
            <select
              className="w-full border rounded px-3 py-2"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as "mbway" | "card" | "transferencia")}
            >
              <option value="mbway">MB WAY</option>
              <option value="card">Cartão de crédito</option>
              <option value="transferencia">Transferência bancária</option>
            </select>
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            onClick={handleBook}
            disabled={loading || datesUnavailable || !checkin || !checkout}
            className="w-full bg-gray-900 text-white rounded py-3 font-medium disabled:opacity-50"
          >
            {loading ? "A processar..." : "Continuar para pagamento"}
          </button>
        </div>
      )}

      {step === "hospedes" && (
        <div className="space-y-6">
          {bankDetails ? (
            <div className="border border-amber-300 bg-amber-50 rounded-lg p-4 text-sm">
              <p className="font-medium text-amber-800 mb-2">
                Para confirmar a reserva, faça a transferência de €{bankDetails.total.toFixed(2)} para:
              </p>
              <p className="text-amber-800">IBAN: {bankDetails.iban}</p>
              {bankDetails.accountHolder && <p className="text-amber-800">Titular: {bankDetails.accountHolder}</p>}
              <p className="text-amber-800">Referência: reserva nº {bankDetails.bookingNumber}</p>
            </div>
          ) : (
            <p className="text-sm text-green-600">
              Pedido de pagamento enviado. Enquanto confirma, preencha os dados dos hóspedes (obrigatório por lei).
            </p>
          )}
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
          {bankDetails && (
            <div className="border border-amber-300 bg-amber-50 rounded-lg p-4 text-sm text-left mb-6 max-w-sm mx-auto">
              <p className="font-medium text-amber-800 mb-2">
                Não se esqueça de transferir €{bankDetails.total.toFixed(2)} para:
              </p>
              <p className="text-amber-800">IBAN: {bankDetails.iban}</p>
              {bankDetails.accountHolder && <p className="text-amber-800">Titular: {bankDetails.accountHolder}</p>}
              <p className="text-amber-800">Referência: reserva nº {bankDetails.bookingNumber}</p>
            </div>
          )}
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

export default function ReservarPage() {
  return (
    <Suspense>
      <Reservar />
    </Suspense>
  );
}
