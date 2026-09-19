"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import GuestForm, { useGuestForm } from "@/app/components/GuestForm";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";
import { useLocale } from "@/app/components/useLocale";
import { getDictionary, interpolate } from "@/lib/i18n";

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

function defaultCheckin(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultCheckout(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

function Reservar() {
  const searchParams = useSearchParams();
  const stored = loadStoredState();
  const [locale, setLocale] = useLocale();
  const t = getDictionary(locale).reservar;
  const [step, setStep] = useState<"datas" | "hospedes" | "confirmado">(stored.step ?? "datas");
  const [checkin, setCheckin] = useState(stored.checkin ?? searchParams.get("checkin") ?? defaultCheckin());
  const [checkout, setCheckout] = useState(stored.checkout ?? searchParams.get("checkout") ?? defaultCheckout());
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
  const [siteName, setSiteName] = useState("Aljezur - Monte Clérigo");

  const { guests, resize, update } = useGuestForm(guestsCount);

  useEffect(() => {
    fetch("/api/site-info")
      .then((r) => r.json())
      .then((data) => setSiteName(data.name))
      .catch(() => {});
  }, []);

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
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [checkedDates, setCheckedDates] = useState<{ checkin: string; checkout: string } | null>(null);
  const [priceBreakdown, setPriceBreakdown] = useState<{
    nights: number;
    nightsSubtotal: number;
    fees: { id: string; name: string; amount: number }[];
    total: number;
  } | null>(null);

  // Um resultado só é válido para as datas exatas com que foi pedido — assim que o
  // hóspede muda check-in/check-out, deixa de corresponder, sem precisar de um efeito.
  const availabilityChecked = checkedDates?.checkin === checkin && checkedDates?.checkout === checkout;

  async function checkAvailability() {
    setCheckingAvailability(true);
    setPriceBreakdown(null);
    const requestedCheckin = checkin;
    const requestedCheckout = checkout;
    try {
      const res = await fetch("/api/availability");
      const data = await res.json();
      const nextBlocked = new Set<string>(data.blockedDates ?? []);
      setBlockedDates(nextBlocked);
      if (!rangeOverlapsBlocked(requestedCheckin, requestedCheckout, nextBlocked)) {
        const priceRes = await fetch(`/api/pricing?checkin=${requestedCheckin}&checkout=${requestedCheckout}`);
        if (priceRes.ok) setPriceBreakdown(await priceRes.json());
      }
    } catch {
      // mantém o conjunto anterior se o pedido falhar
    }
    setCheckedDates({ checkin: requestedCheckin, checkout: requestedCheckout });
    setCheckingAvailability(false);
  }

  async function handleBook() {
    setError(null);
    if (datesUnavailable) {
      setError(t.datesUnavailable);
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
        setError(data.error ?? t.errorGeneric);
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
      setError(t.errorConnection);
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
      setError(data.error ?? t.errorSavingGuests);
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">
          {t.heading} — {siteName}
        </h1>
        <LanguageSwitcher active={locale} onChange={setLocale} />
      </div>

      {step === "datas" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">{getDictionary(locale).widget.checkin}</label>
              <input
                type="date"
                className="w-full border rounded px-3 py-2"
                value={checkin}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setCheckin(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">{getDictionary(locale).widget.checkout}</label>
              <input
                type="date"
                className="w-full border rounded px-3 py-2"
                value={checkout}
                min={checkin || new Date().toISOString().slice(0, 10)}
                onChange={(e) => setCheckout(e.target.value)}
              />
            </div>
          </div>

          <button
            onClick={checkAvailability}
            disabled={checkingAvailability || !checkin || !checkout}
            className="w-full border rounded py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            {checkingAvailability ? t.checkingAvailability : getDictionary(locale).widget.checkAvailability}
          </button>

          {datesUnavailable && <p className="text-red-600 text-sm">{t.datesUnavailable}</p>}
          {availabilityChecked && !datesUnavailable && (
            <div className="border rounded-lg p-3 bg-green-50 border-green-200">
              <p className="text-green-600 text-sm font-medium mb-2">{t.datesAvailable}</p>
              {priceBreakdown && (
                <div className="text-sm text-gray-700 space-y-1">
                  <div className="flex justify-between">
                    <span>{interpolate(t.nightsLabel, { nights: priceBreakdown.nights })}</span>
                    <span>€{priceBreakdown.nightsSubtotal.toFixed(2)}</span>
                  </div>
                  {priceBreakdown.fees.map((f) => (
                    <div key={f.id} className="flex justify-between text-gray-500">
                      <span>{f.name}</span>
                      <span>€{f.amount.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-medium border-t pt-1 mt-1">
                    <span>{t.totalLabel}</span>
                    <span>€{priceBreakdown.total.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-600 mb-1">{t.guestsCount}</label>
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
            <label className="block text-sm text-gray-600 mb-1">{t.holderName}</label>
            <input className="w-full border rounded px-3 py-2" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">{t.email}</label>
            <input className="w-full border rounded px-3 py-2" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">{t.phone}</label>
            <input className="w-full border rounded px-3 py-2" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">{t.paymentMethod}</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as "mbway" | "card" | "transferencia")}
            >
              <option value="mbway">{t.payMbway}</option>
              <option value="card">{t.payCard}</option>
              <option value="transferencia">{t.payTransfer}</option>
            </select>
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            onClick={handleBook}
            disabled={loading || datesUnavailable || !checkin || !checkout}
            className="w-full bg-gray-900 text-white rounded py-3 font-medium disabled:opacity-50"
          >
            {loading ? t.processing : t.continueToPayment}
          </button>
        </div>
      )}

      {step === "hospedes" && (
        <div className="space-y-6">
          {bankDetails ? (
            <div className="border border-amber-300 bg-amber-50 rounded-lg p-4 text-sm">
              <p className="font-medium text-amber-800 mb-2">
                {interpolate(t.transferInstructions, { amount: `€${bankDetails.total.toFixed(2)}` })}
              </p>
              <p className="text-amber-800">
                {t.transferIban}: {bankDetails.iban}
              </p>
              {bankDetails.accountHolder && (
                <p className="text-amber-800">
                  {t.transferHolder}: {bankDetails.accountHolder}
                </p>
              )}
              <p className="text-amber-800">{interpolate(t.transferReference, { number: bankDetails.bookingNumber })}</p>
            </div>
          ) : (
            <p className="text-sm text-green-600">{t.paymentSentGuestInfo}</p>
          )}
          <GuestForm guests={guests} onChange={update} locale={locale} />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button onClick={handleSaveGuests} disabled={loading} className="w-full bg-gray-900 text-white rounded py-3 font-medium">
            {loading ? t.saving : t.saveGuests}
          </button>
        </div>
      )}

      {step === "confirmado" && (
        <div className="text-center py-12">
          <p className="text-xl font-medium mb-2">{t.confirmed}</p>
          {bankDetails && (
            <div className="border border-amber-300 bg-amber-50 rounded-lg p-4 text-sm text-left mb-6 max-w-sm mx-auto">
              <p className="font-medium text-amber-800 mb-2">
                {interpolate(t.dontForgetTransfer, { amount: `€${bankDetails.total.toFixed(2)}` })}
              </p>
              <p className="text-amber-800">
                {t.transferIban}: {bankDetails.iban}
              </p>
              {bankDetails.accountHolder && (
                <p className="text-amber-800">
                  {t.transferHolder}: {bankDetails.accountHolder}
                </p>
              )}
              <p className="text-amber-800">{interpolate(t.transferReference, { number: bankDetails.bookingNumber })}</p>
            </div>
          )}
          {releaseInfo?.released ? (
            <p className="text-gray-500 text-sm">{t.accessReleased}</p>
          ) : releaseInfo?.reason === "waiting_guest_data" ? (
            <p className="text-gray-500 text-sm">{t.waitingGuestData}</p>
          ) : (
            <p className="text-gray-500 text-sm">{t.waitingPayment}</p>
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
