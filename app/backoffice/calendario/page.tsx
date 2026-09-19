"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getAllHolidaysByDate, type Holiday, type HolidayCountry } from "../../../lib/holidays";
import LoadingSpinner from "../../components/LoadingSpinner";

const HOLIDAY_DOT_COLOR: Record<HolidayCountry, string> = {
  PT: "bg-sky-500",
  DE: "bg-violet-500",
  ES: "bg-orange-500",
};

const HOLIDAY_LABEL: Record<HolidayCountry, string> = {
  PT: "Feriado em Portugal",
  DE: "Feriado na Alemanha",
  ES: "Feriado em Espanha",
};

interface BookingLite {
  id: string;
  checkin: string;
  checkout: string;
  guestName: string;
  source: string;
  paymentStatus: string;
}

interface DateRange {
  id: string;
  start: string;
  end: string;
}

interface RatePlan {
  id: string;
  name: string;
  color: string;
  isDefault?: boolean;
}

const SOURCE_LABEL: Record<string, string> = {
  site: "Site",
  airbnb: "Airbnb",
  booking: "Booking",
  vrbo: "VRBO",
  outros: "Outros",
};

interface CellColor {
  bg: string;
  text: string;
}

const SOURCE_COLOR: Record<string, CellColor> = {
  site: { bg: "bg-indigo-100", text: "text-indigo-700" },
  airbnb: { bg: "bg-red-100", text: "text-red-700" },
  booking: { bg: "bg-blue-100", text: "text-blue-700" },
  vrbo: { bg: "bg-green-200", text: "text-green-800" },
  outros: { bg: "bg-gray-200", text: "text-gray-700" },
};

const FALLBACK_BLOCKED_COLOR: CellColor = { bg: "bg-amber-50", text: "text-amber-700" };

const DEFAULT_RATE_PLAN: RatePlan = { id: "normal", name: "Normal", color: "#6366f1", isDefault: true };

/** Cor de um bloqueio iCal por plataforma, a partir do nome dado ao link em Definições > iCal. */
function colorForBlockedLabel(label: string): CellColor {
  const l = label.toLowerCase();
  if (l.includes("airbnb")) return SOURCE_COLOR.airbnb;
  if (l.includes("booking")) return SOURCE_COLOR.booking;
  if (l.includes("vrbo")) return SOURCE_COLOR.vrbo;
  return FALLBACK_BLOCKED_COLOR;
}

const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** Grelha do mês: começa na segunda-feira da semana que contém o dia 1, sempre 6 semanas (42 dias) */
function buildMonthGrid(year: number, month: number): string[] {
  const first = new Date(year, month, 1);
  const firstWeekday = (first.getDay() + 6) % 7; // 0 = segunda
  const start = new Date(year, month, 1 - firstWeekday);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return toISO(d);
  });
}

export default function Calendario() {
  const router = useRouter();
  const today = useMemo(() => toISO(new Date()), []);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());

  const [bookings, setBookings] = useState<BookingLite[]>([]);
  const [blockedBySource, setBlockedBySource] = useState<Map<string, string>>(new Map());
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [defaultPrice, setDefaultPrice] = useState(0);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [ratePlanByDate, setRatePlanByDate] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [savingDate, setSavingDate] = useState<string | null>(null);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkRanges, setBulkRanges] = useState<DateRange[]>([{ id: crypto.randomUUID(), start: "", end: "" }]);
  const [bulkWeekdays, setBulkWeekdays] = useState<Set<number>>(new Set());
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkResult, setBulkResult] = useState<string | null>(null);
  const [bulkApplying, setBulkApplying] = useState(false);
  const [bulkSlow, setBulkSlow] = useState(false);

  const [tarifaOpen, setTarifaOpen] = useState(false);
  const [tarifaRanges, setTarifaRanges] = useState<DateRange[]>([{ id: crypto.randomUUID(), start: "", end: "" }]);
  const [tarifaWeekdays, setTarifaWeekdays] = useState<Set<number>>(new Set());
  const [tarifaPlanId, setTarifaPlanId] = useState("");
  const [tarifaResult, setTarifaResult] = useState<string | null>(null);
  const [tarifaApplying, setTarifaApplying] = useState(false);

  const grid = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const holidaysByDate = useMemo(() => {
    const years = new Set(grid.map((d) => Number(d.slice(0, 4))));
    const merged = new Map<string, Holiday[]>();
    for (const year of years) {
      for (const [date, list] of getAllHolidaysByDate(year)) merged.set(date, list);
    }
    return merged;
  }, [grid]);

  useEffect(() => {
    const start = grid[0];
    const end = grid[grid.length - 1];

    // Um único pedido (ver /api/backoffice/calendar): antes eram 5 em paralelo e bastava
    // um deles pendurar para o calendário ficar preso em "A carregar...".
    // "cancelled" evita que o cleanup (StrictMode em dev corre o efeito 2x) trate o
    // seu próprio abort() como um erro real e sobreponha o resultado da execução seguinte.
    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    (async () => {
      try {
        const res = await fetch(`/api/backoffice/calendar?start=${start}&end=${end}`, {
          signal: controller.signal,
        });
        if (res.status === 401 || res.redirected) {
          throw new Error("sessao-expirada");
        }
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setLoadError(data.error ?? "Erro ao carregar o calendário.");
          return;
        }

        setLoadError(null);
        setBookings(data.bookings ?? []);
        const blockedMap = new Map<string, string>();
        for (const b of data.blocked ?? []) blockedMap.set(b.date, b.sourceLabel);
        setBlockedBySource(blockedMap);
        setPrices(data.prices ?? {});
        setDefaultPrice(data.defaultPrice ?? 0);
        setRatePlans(
          Array.isArray(data.ratePlans) && data.ratePlans.length > 0 ? data.ratePlans : [DEFAULT_RATE_PLAN]
        );
        setRatePlanByDate(data.ratePlansByDate ?? {});
      } catch (err) {
        if (cancelled) return;
        const name = (err as Error)?.name;
        const message = (err as Error)?.message;
        setLoadError(
          name === "AbortError"
            ? "Demorou demasiado tempo a responder. Pode ser o Supabase a acordar de uma pausa — tente outra vez."
            : message === "sessao-expirada"
            ? "A sessão expirou. Volte a entrar no backoffice."
            : "Erro de ligação ao carregar o calendário."
        );
      } finally {
        // Sai sempre do estado "A carregar", aconteça o que acontecer — é isto que torna
        // impossível o ecrã ficar preso no spinner.
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [grid, reloadToken]);

  const bookingByDate = useMemo(() => {
    const map = new Map<string, BookingLite>();
    for (const b of bookings) {
      if (!["paid", "pending", "not_applicable"].includes(b.paymentStatus)) continue;
      let d = b.checkin;
      while (d < b.checkout) {
        map.set(d, b);
        d = addDays(d, 1);
      }
    }
    return map;
  }, [bookings]);

  async function savePrice(date: string, value: string) {
    const price = parseFloat(value);
    if (isNaN(price)) {
      setEditingDate(null);
      return;
    }
    setPrices((prev) => ({ ...prev, [date]: price }));
    setSavingDate(date);
    setEditingDate(null);
    await fetch("/api/backoffice/daily-prices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: "site", date, price }),
    });
    setSavingDate(null);
  }

  function addBulkRange() {
    setBulkRanges([...bulkRanges, { id: crypto.randomUUID(), start: "", end: "" }]);
  }

  function updateBulkRange(id: string, field: "start" | "end", value: string) {
    setBulkRanges((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function removeBulkRange(id: string) {
    setBulkRanges((prev) => prev.filter((r) => r.id !== id));
  }

  function toggleBulkWeekday(day: number) {
    setBulkWeekdays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  function computeBulkDates(): string[] {
    const dates = new Set<string>();
    for (const r of bulkRanges) {
      if (!r.start || !r.end || r.start > r.end) continue;
      let d = r.start;
      while (d <= r.end) {
        const weekday = (new Date(d + "T00:00:00").getDay() + 6) % 7; // 0 = segunda
        if (bulkWeekdays.size === 0 || bulkWeekdays.has(weekday)) dates.add(d);
        d = addDays(d, 1);
      }
    }
    return Array.from(dates);
  }

  async function applyBulkPrice() {
    const price = parseFloat(bulkPrice);
    if (isNaN(price)) {
      setBulkResult("Indique um preço válido.");
      return;
    }
    const dates = computeBulkDates();
    if (dates.length === 0) {
      setBulkResult("Escolha pelo menos um intervalo de datas válido.");
      return;
    }
    setBulkApplying(true);
    setBulkSlow(false);
    setBulkResult(null);

    // Se demorar mais de 2s, mostra um aviso mais visível — evita a sensação de "bloqueado"
    // em ligações mais lentas (ex: servidor a arrancar a frio).
    const slowTimer = setTimeout(() => setBulkSlow(true), 2000);
    // Nunca deixa o pedido ficar pendente para sempre sem feedback nenhum.
    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch("/api/backoffice/daily-prices/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "site", dates, price }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) {
        setBulkResult(data.error ?? "Erro ao aplicar preços.");
      } else {
        setPrices((prev) => {
          const next = { ...prev };
          for (const d of dates) next[d] = price;
          return next;
        });
        setBulkResult(`Preço aplicado a ${dates.length} dia(s).`);
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setBulkResult(
          "A operação demorou demasiado tempo e foi cancelada. Tente novamente — se persistir, verifique se o projeto Supabase não está pausado."
        );
      } else {
        setBulkResult("Erro de ligação ao aplicar preços.");
      }
    }

    clearTimeout(slowTimer);
    clearTimeout(abortTimer);
    setBulkApplying(false);
    setBulkSlow(false);
  }

  function addTarifaRange() {
    setTarifaRanges([...tarifaRanges, { id: crypto.randomUUID(), start: "", end: "" }]);
  }

  function updateTarifaRange(id: string, field: "start" | "end", value: string) {
    setTarifaRanges((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function removeTarifaRange(id: string) {
    setTarifaRanges((prev) => prev.filter((r) => r.id !== id));
  }

  function toggleTarifaWeekday(day: number) {
    setTarifaWeekdays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  function computeTarifaDates(): string[] {
    const dates = new Set<string>();
    for (const r of tarifaRanges) {
      if (!r.start || !r.end || r.start > r.end) continue;
      let d = r.start;
      while (d <= r.end) {
        const weekday = (new Date(d + "T00:00:00").getDay() + 6) % 7;
        if (tarifaWeekdays.size === 0 || tarifaWeekdays.has(weekday)) dates.add(d);
        d = addDays(d, 1);
      }
    }
    return Array.from(dates);
  }

  async function applyTarifa() {
    if (!tarifaPlanId) {
      setTarifaResult("Escolha uma tarifa.");
      return;
    }
    const dates = computeTarifaDates();
    if (dates.length === 0) {
      setTarifaResult("Escolha pelo menos um intervalo de datas válido.");
      return;
    }
    setTarifaApplying(true);
    setTarifaResult(null);
    try {
      const res = await fetch("/api/backoffice/date-rate-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ratePlanId: tarifaPlanId, dates }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTarifaResult(data.error ?? "Erro ao aplicar tarifa.");
      } else {
        setRatePlanByDate((prev) => {
          const next = { ...prev };
          for (const d of dates) next[d] = tarifaPlanId;
          return next;
        });
        setTarifaResult(`Tarifa aplicada a ${dates.length} dia(s).`);
      }
    } catch {
      setTarifaResult("Erro de ligação ao aplicar tarifa.");
    }
    setTarifaApplying(false);
  }

  function changeMonth(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setLoading(true);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  return (
    <main className="max-w-5xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-semibold">Calendário</h1>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setTarifaOpen(true);
              setTarifaResult(null);
              setTarifaPlanId(ratePlans.find((p) => !p.isDefault)?.id ?? "");
            }}
            className="border border-gray-900 text-gray-900 text-sm px-4 py-2 rounded hover:bg-gray-50"
          >
            Aplicar tarifa
          </button>
          <button
            onClick={() => {
              setBulkOpen(true);
              setBulkResult(null);
            }}
            className="bg-gray-900 text-white text-sm px-4 py-2 rounded"
          >
            Mudar preços em massa
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <button onClick={() => changeMonth(-1)} className="border rounded px-3 py-1.5 text-sm hover:bg-gray-50">
          ← Anterior
        </button>
        <p className="font-medium min-w-[160px] text-center">
          {MONTH_LABELS[viewMonth]} {viewYear}
        </p>
        <button onClick={() => changeMonth(1)} className="border rounded px-3 py-1.5 text-sm hover:bg-gray-50">
          Seguinte →
        </button>
        <button
          onClick={() => {
            const now = new Date();
            if (now.getFullYear() !== viewYear || now.getMonth() !== viewMonth) {
              setLoading(true);
              setViewYear(now.getFullYear());
              setViewMonth(now.getMonth());
            }
          }}
          className="text-sm text-gray-500 underline"
        >
          Hoje
        </button>
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-500 mb-4 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-indigo-400" /> Reservado (site)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-red-400" /> Airbnb
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-blue-400" /> Booking.com
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-green-500" /> VRBO
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-amber-400" /> Outro bloqueio (OTA)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-green-200" /> Livre
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-sky-500" /> Feriado PT
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-violet-500" /> Feriado DE
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-orange-500" /> Feriado ES
        </span>
        {ratePlans
          .filter((p) => !p.isDefault)
          .map((p) => (
            <span key={p.id} className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-1.5 rounded-sm" style={{ backgroundColor: p.color }} /> Tarifa: {p.name}
            </span>
          ))}
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : loadError ? (
        <div className="text-center py-16">
          <p className="text-red-600 text-sm mb-3">{loadError}</p>
          <button
            onClick={() => {
              setLoading(true);
              setReloadToken((t) => t + 1);
            }}
            className="border rounded px-4 py-2 text-sm hover:bg-gray-50"
          >
            Tentar outra vez
          </button>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <div className="grid grid-cols-7 bg-gray-50 text-gray-500 text-xs uppercase">
            {WEEKDAY_LABELS.map((w) => (
              <div key={w} className="px-2 py-2 text-center border-b">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {grid.map((date) => {
              const inMonth = new Date(date + "T00:00:00").getMonth() === viewMonth;
              const booking = bookingByDate.get(date);
              const blockedLabel = !booking ? blockedBySource.get(date) : undefined;
              const isToday = date === today;
              const price = date in prices ? prices[date] : defaultPrice;
              const holidays = holidaysByDate.get(date) ?? [];
              const ratePlanId = ratePlanByDate[date];
              const ratePlan = ratePlanId ? ratePlans.find((p) => p.id === ratePlanId) : undefined;

              const cellColor: CellColor | null = booking
                ? SOURCE_COLOR[booking.source] ?? SOURCE_COLOR.outros
                : blockedLabel
                ? colorForBlockedLabel(blockedLabel)
                : null;

              let bg = "bg-white";
              if (cellColor) bg = cellColor.bg;
              else if (inMonth) bg = "bg-green-50/40";

              return (
                <div
                  key={date}
                  className={`relative min-h-[90px] border-b border-r px-2 py-1.5 ${bg} ${inMonth ? "" : "opacity-40"}`}
                  title={ratePlan && !ratePlan.isDefault ? `Tarifa: ${ratePlan.name}` : undefined}
                >
                  {ratePlan && !ratePlan.isDefault && (
                    <span
                      className="absolute top-0 left-0 right-0 h-1"
                      style={{ backgroundColor: ratePlan.color }}
                    />
                  )}
                  <div className="flex items-center justify-between">
                    <span className={`text-xs ${isToday ? "font-bold text-gray-900" : "text-gray-500"}`}>
                      {Number(date.slice(8, 10))}
                    </span>
                    {holidays.length > 0 && (
                      <span className="flex items-center gap-0.5">
                        {holidays.map((h) => (
                          <span
                            key={h.country}
                            className={`inline-block w-2 h-2 rounded-full ${HOLIDAY_DOT_COLOR[h.country]}`}
                            title={`${HOLIDAY_LABEL[h.country]}: ${h.name}`}
                          />
                        ))}
                      </span>
                    )}
                  </div>

                  {booking && (
                    <button
                      onClick={() => router.push(`/backoffice/reservas/${booking.id}`)}
                      className={`text-[11px] ${cellColor?.text ?? "text-gray-700"} mt-1 truncate block text-left hover:underline w-full`}
                      title={`Abrir reserva de ${booking.guestName}`}
                    >
                      {booking.guestName} · {SOURCE_LABEL[booking.source] ?? booking.source}
                    </button>
                  )}
                  {!booking && blockedLabel && (
                    <p className={`text-[11px] ${cellColor?.text ?? "text-amber-700"} mt-1 font-medium`}>
                      {blockedLabel}
                    </p>
                  )}

                  <div className="mt-2">
                    {editingDate === date ? (
                      <input
                        type="number"
                        step={0.5}
                        autoFocus
                        defaultValue={price}
                        className="w-16 border rounded px-1 py-0.5 text-xs"
                        onBlur={(e) => savePrice(date, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          if (e.key === "Escape") setEditingDate(null);
                        }}
                      />
                    ) : (
                      <button
                        onClick={() => setEditingDate(date)}
                        className="text-xs text-gray-600 hover:underline"
                        title="Editar preço deste dia"
                      >
                        €{price}
                      </button>
                    )}
                    {savingDate === date && <span className="block text-[10px] text-gray-400">a guardar...</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {bulkOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-20">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium">Mudar preços em massa</h2>
              <button onClick={() => setBulkOpen(false)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">
                ×
              </button>
            </div>

            <p className="text-sm text-gray-500 mb-3">Datas ou intervalos de datas a alterar (preço do site próprio):</p>
            <div className="space-y-2 mb-3">
              {bulkRanges.map((r) => (
                <div key={r.id} className="flex items-center gap-2">
                  <input
                    type="date"
                    className="border rounded px-2 py-1.5 text-sm flex-1"
                    value={r.start}
                    onChange={(e) => updateBulkRange(r.id, "start", e.target.value)}
                  />
                  <span className="text-gray-400 text-sm">a</span>
                  <input
                    type="date"
                    className="border rounded px-2 py-1.5 text-sm flex-1"
                    value={r.end}
                    onChange={(e) => updateBulkRange(r.id, "end", e.target.value)}
                  />
                  {bulkRanges.length > 1 && (
                    <button
                      onClick={() => removeBulkRange(r.id)}
                      className="text-red-500 text-sm px-1 hover:bg-red-50 rounded"
                      aria-label="Remover intervalo"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={addBulkRange} className="text-sm border rounded px-3 py-1.5 hover:bg-gray-50 mb-4">
              + Adicionar outro intervalo
            </button>

            <p className="text-sm text-gray-500 mb-2">
              Dias da semana (deixe tudo por marcar para aplicar a todos os dias):
            </p>
            <div className="flex gap-1 mb-4 flex-wrap">
              {WEEKDAY_LABELS.map((label, i) => (
                <button
                  key={label}
                  onClick={() => toggleBulkWeekday(i)}
                  className={`px-3 py-1.5 rounded text-xs border ${
                    bulkWeekdays.has(i) ? "bg-gray-900 text-white border-gray-900" : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-1">Preço por noite (€)</label>
              <input
                type="number"
                step={0.5}
                className="w-full border rounded px-3 py-2"
                value={bulkPrice}
                onChange={(e) => setBulkPrice(e.target.value)}
              />
            </div>

            <button
              onClick={applyBulkPrice}
              disabled={bulkApplying}
              className="w-full bg-gray-900 text-white rounded py-2.5 font-medium flex items-center justify-center gap-2 disabled:opacity-80"
            >
              {bulkApplying && (
                <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              )}
              {bulkApplying ? "A aplicar..." : "Aplicar"}
            </button>
            {bulkApplying && bulkSlow && (
              <p className="text-xs text-amber-600 mt-2">
                Isto está a demorar mais do que o normal (a ligar ao servidor) — aguarde, não feche esta janela.
              </p>
            )}
            {bulkResult && <p className="text-sm mt-2 text-gray-700">{bulkResult}</p>}
          </div>
        </div>
      )}

      {tarifaOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-20">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium">Aplicar tarifa</h2>
              <button onClick={() => setTarifaOpen(false)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">
                ×
              </button>
            </div>

            <p className="text-sm text-gray-500 mb-2">Tarifa a aplicar:</p>
            <select
              className="w-full border rounded px-3 py-2 mb-4"
              value={tarifaPlanId}
              onChange={(e) => setTarifaPlanId(e.target.value)}
            >
              {ratePlans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <p className="text-sm text-gray-500 mb-3">Datas ou intervalos de datas a marcar com esta tarifa:</p>
            <div className="space-y-2 mb-3">
              {tarifaRanges.map((r) => (
                <div key={r.id} className="flex items-center gap-2">
                  <input
                    type="date"
                    className="border rounded px-2 py-1.5 text-sm flex-1"
                    value={r.start}
                    onChange={(e) => updateTarifaRange(r.id, "start", e.target.value)}
                  />
                  <span className="text-gray-400 text-sm">a</span>
                  <input
                    type="date"
                    className="border rounded px-2 py-1.5 text-sm flex-1"
                    value={r.end}
                    onChange={(e) => updateTarifaRange(r.id, "end", e.target.value)}
                  />
                  {tarifaRanges.length > 1 && (
                    <button
                      onClick={() => removeTarifaRange(r.id)}
                      className="text-red-500 text-sm px-1 hover:bg-red-50 rounded"
                      aria-label="Remover intervalo"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={addTarifaRange} className="text-sm border rounded px-3 py-1.5 hover:bg-gray-50 mb-4">
              + Adicionar outro intervalo
            </button>

            <p className="text-sm text-gray-500 mb-2">
              Dias da semana (deixe tudo por marcar para aplicar a todos os dias):
            </p>
            <div className="flex gap-1 mb-4 flex-wrap">
              {WEEKDAY_LABELS.map((label, i) => (
                <button
                  key={label}
                  onClick={() => toggleTarifaWeekday(i)}
                  className={`px-3 py-1.5 rounded text-xs border ${
                    tarifaWeekdays.has(i) ? "bg-gray-900 text-white border-gray-900" : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              onClick={applyTarifa}
              disabled={tarifaApplying}
              className="w-full bg-gray-900 text-white rounded py-2.5 font-medium flex items-center justify-center gap-2 disabled:opacity-80"
            >
              {tarifaApplying && (
                <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              )}
              {tarifaApplying ? "A aplicar..." : "Aplicar"}
            </button>
            {tarifaResult && <p className="text-sm mt-2 text-gray-700">{tarifaResult}</p>}
          </div>
        </div>
      )}
    </main>
  );
}
