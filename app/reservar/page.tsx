"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import GuestForm, { useGuestForm } from "@/app/components/GuestForm";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";
import { useLocale } from "@/app/components/useLocale";
import { getDictionary, interpolate } from "@/lib/i18n";
import { todayISO, addDaysISO } from "@/lib/dates";

const STORAGE_KEY = "aljezur-reserva-em-curso";
const MAX_GUESTS = 6;

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
  let d = checkin;
  while (d < checkout) {
    if (blocked.has(d)) return true;
    d = addDaysISO(d, 1);
  }
  return false;
}

function defaultCheckin(): string {
  return todayISO();
}

function defaultCheckout(): string {
  return addDaysISO(todayISO(), 7);
}

function nextDay(iso: string): string {
  return addDaysISO(iso, 1);
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
  const [checkedDates, setCheckedDates] = useState<{ checkin: string; checkout: string; guests: number } | null>(null);
  const [priceFailed, setPriceFailed] = useState(false);
  const [priceBreakdown, setPriceBreakdown] = useState<{
    nights: number;
    nightsSubtotal: number;
    fees: { id: string; name: string; amount: number }[];
    discountPercent: number | null;
    discountAmount: number;
    total: number;
    minNights: number | null;
    maxNights: number | null;
    cancellationDays: number | null;
    occupancyDiscountAmount: number;
    occupancyMaxGuests: number | null;
  } | null>(null);

  // Um resultado só é válido para as datas exatas com que foi pedido — assim que o
  // hóspede muda check-in/check-out, deixa de corresponder, sem precisar de um efeito.
  // Inclui o número de hóspedes: como ele altera o preço, mudá-lo invalida o resultado
  // anterior e obriga a verificar de novo — nunca se mostra um preço de outra ocupação.
  const availabilityChecked =
    checkedDates?.checkin === checkin &&
    checkedDates?.checkout === checkout &&
    checkedDates?.guests === guestsCount;

  // Saída anterior (ou igual) à entrada não é um intervalo: sem isto, a procura de datas
  // ocupadas não percorria noite nenhuma, dava "livre", e o ecrã anunciava datas
  // disponíveis para uma estadia impossível — e sem preço, porque o cálculo falhava.
  const invalidRange = !!checkin && !!checkout && checkout <= checkin;

  const nightsOutOfRange =
    !!priceBreakdown &&
    ((priceBreakdown.minNights != null && priceBreakdown.nights < priceBreakdown.minNights) ||
      (priceBreakdown.maxNights != null && priceBreakdown.nights > priceBreakdown.maxNights));

  function changeGuests(value: number) {
    const n = Math.min(MAX_GUESTS, Math.max(1, Number.isFinite(value) ? value : 1));
    setGuestsCount(n);
    resize(n);
  }

  /** Mantém a saída sempre depois da entrada, empurrando-a uma noite se for preciso. */
  function changeCheckin(value: string) {
    setCheckin(value);
    if (value && checkout && checkout <= value) setCheckout(nextDay(value));
  }

  async function checkAvailability() {
    if (invalidRange) return;
    setCheckingAvailability(true);
    setPriceBreakdown(null);
    setPriceFailed(false);
    const requestedCheckin = checkin;
    const requestedCheckout = checkout;
    const requestedGuests = guestsCount;
    try {
      const res = await fetch("/api/availability");
      const data = await res.json();
      const nextBlocked = new Set<string>(data.blockedDates ?? []);
      setBlockedDates(nextBlocked);
      if (!rangeOverlapsBlocked(requestedCheckin, requestedCheckout, nextBlocked)) {
        const priceRes = await fetch(
          `/api/pricing?checkin=${requestedCheckin}&checkout=${requestedCheckout}&guests=${requestedGuests}`
        );
        if (priceRes.ok) setPriceBreakdown(await priceRes.json());
        else setPriceFailed(true);
      }
    } catch {
      setPriceFailed(true);
    }
    setCheckedDates({ checkin: requestedCheckin, checkout: requestedCheckout, guests: requestedGuests });
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
        if (data.minNights) setError(interpolate(t.minNightsError, { nights: data.minNights }));
        else if (data.maxNights) setError(interpolate(t.maxNightsError, { nights: data.maxNights }));
        else setError(data.error ?? t.errorGeneric);
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
    <main className="max-w-lg mx-auto px-5 py-8">
      <div className="flex items-center justify-between gap-3 mb-2">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <span aria-hidden>←</span> {t.backToSite}
        </Link>
        <LanguageSwitcher active={locale} onChange={setLocale} />
      </div>
      <h1 className="text-2xl font-semibold mb-1">{t.heading}</h1>
      <p className="text-sm text-gray-500 mb-6">{siteName}</p>

      {step === "datas" && (
        <div className="space-y-5">
          <section className="rounded-xl border bg-white p-4 shadow-sm space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                  {getDictionary(locale).widget.checkin}
                </label>
                <input
                  type="date"
                  className="w-full border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
                  value={checkin}
                  min={todayISO()}
                  onChange={(e) => changeCheckin(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                  {getDictionary(locale).widget.checkout}
                </label>
                <input
                  type="date"
                  className="w-full border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
                  value={checkout}
                  min={checkin ? nextDay(checkin) : todayISO()}
                  onChange={(e) => setCheckout(e.target.value)}
                />
              </div>
            </div>

            {/* Os hóspedes vêm ANTES do preço: o valor por noite é o da casa cheia e há
                desconto para menos gente, por isso o preço não faz sentido sem este número. */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                {t.guestsCount}
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => changeGuests(guestsCount - 1)}
                  disabled={guestsCount <= 1}
                  aria-label="Menos um hóspede"
                  className="w-11 h-11 shrink-0 rounded-lg border text-lg hover:bg-gray-50 disabled:opacity-40"
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  max={MAX_GUESTS}
                  className="flex-1 text-center border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  value={guestsCount}
                  onChange={(e) => changeGuests(Number(e.target.value))}
                />
                <button
                  type="button"
                  onClick={() => changeGuests(guestsCount + 1)}
                  disabled={guestsCount >= MAX_GUESTS}
                  aria-label="Mais um hóspede"
                  className="w-11 h-11 shrink-0 rounded-lg border text-lg hover:bg-gray-50 disabled:opacity-40"
                >
                  +
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">{t.guestsHint}</p>
            </div>

            <button
              onClick={checkAvailability}
              disabled={checkingAvailability || !checkin || !checkout || invalidRange}
              className="w-full bg-gray-900 text-white rounded-lg py-3 text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {checkingAvailability ? t.checkingAvailability : getDictionary(locale).widget.checkAvailability}
            </button>

            {invalidRange && <p className="text-red-600 text-sm">{t.invalidDateRange}</p>}
            {!invalidRange && datesUnavailable && <p className="text-red-600 text-sm">{t.datesUnavailable}</p>}
            {!invalidRange && availabilityChecked && !datesUnavailable && priceFailed && (
              <p className="text-red-600 text-sm">{t.priceUnavailable}</p>
            )}
          </section>

          {!invalidRange && availabilityChecked && !datesUnavailable && !priceFailed && (
            <section className="rounded-xl border border-green-200 bg-green-50/70 p-4">
              <p className="text-green-700 text-sm font-medium mb-3 flex items-center gap-1.5">
                <span aria-hidden>✓</span> {t.datesAvailable}
              </p>
              {priceBreakdown && (
                <div className="text-sm text-gray-700 space-y-1.5">
                  <div className="flex justify-between">
                    <span>{interpolate(t.nightsLabel, { nights: priceBreakdown.nights })}</span>
                    <span className="tabular-nums">€{priceBreakdown.nightsSubtotal.toFixed(2)}</span>
                  </div>
                  {priceBreakdown.occupancyDiscountAmount > 0 && (
                    <div className="flex justify-between text-green-700">
                      <span>
                        {interpolate(t.occupancyDiscountNotice, { guests: priceBreakdown.occupancyMaxGuests ?? 0 })}
                      </span>
                      <span className="tabular-nums">−€{priceBreakdown.occupancyDiscountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {priceBreakdown.discountPercent && (
                    <div className="flex justify-between text-green-700">
                      <span>
                        {interpolate(
                          priceBreakdown.nights >= 28 ? t.monthlyDiscountNotice : t.weeklyDiscountNotice,
                          { percent: priceBreakdown.discountPercent }
                        )}
                      </span>
                      <span className="tabular-nums">−€{priceBreakdown.discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {priceBreakdown.fees.map((f) => (
                    <div key={f.id} className="flex justify-between text-gray-500">
                      <span>{f.name}</span>
                      <span className="tabular-nums">€{f.amount.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-semibold text-base text-gray-900 border-t border-green-200 pt-2 mt-2">
                    <span>{t.totalLabel}</span>
                    <span className="tabular-nums">€{priceBreakdown.total.toFixed(2)}</span>
                  </div>
                  {priceBreakdown.cancellationDays != null && (
                    <p className="text-xs text-gray-500 pt-1">
                      {interpolate(t.cancellationNotice, { days: priceBreakdown.cancellationDays })}
                    </p>
                  )}
                </div>
              )}
              {nightsOutOfRange && priceBreakdown && (
                <p className="text-red-600 text-sm mt-2">
                  {priceBreakdown.minNights != null && priceBreakdown.nights < priceBreakdown.minNights
                    ? interpolate(t.minNightsError, { nights: priceBreakdown.minNights })
                    : interpolate(t.maxNightsError, { nights: priceBreakdown.maxNights ?? 0 })}
                </p>
              )}
            </section>
          )}

          <section className="rounded-xl border bg-white p-4 shadow-sm space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                {t.holderName}
              </label>
              <input
                className="w-full border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                {t.email}
              </label>
              <input
                type="email"
                inputMode="email"
                className="w-full border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                {t.phone}
              </label>
              <input
                type="tel"
                inputMode="tel"
                className="w-full border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                {t.paymentMethod}
              </label>
              <select
                className="w-full border rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as "mbway" | "card" | "transferencia")}
              >
                <option value="mbway">{t.payMbway}</option>
                <option value="card">{t.payCard}</option>
                <option value="transferencia">{t.payTransfer}</option>
              </select>
            </div>
          </section>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            onClick={handleBook}
            disabled={loading || datesUnavailable || !checkin || !checkout || invalidRange || nightsOutOfRange}
            className="w-full bg-gray-900 text-white rounded-lg py-3.5 font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
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
