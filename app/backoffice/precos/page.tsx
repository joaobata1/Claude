"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { IcalSource } from "@/lib/ical-sync";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import { todayISO, addDaysISO } from "@/lib/dates";

const DAYS_AHEAD = 21;

const addDays = addDaysISO;

function formatDate(iso: string) {
  const [, m, d] = iso.split("-");
  const weekday = new Date(iso).toLocaleDateString("pt-PT", { weekday: "short" });
  return `${d}/${m} ${weekday}`;
}

interface PriceEntry {
  channel: string;
  date: string;
  price: number;
}

export default function Precos() {
  const [icalSources, setIcalSources] = useState<IcalSource[]>([]);
  const [sitePrice, setSitePrice] = useState<number>(0);
  const [prices, setPrices] = useState<Record<string, number>>({}); // key: `${channel}|${date}`
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [savingCell, setSavingCell] = useState<string | null>(null);

  const dates = useMemo(() => {
    const start = todayISO();
    return Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(start, i));
  }, []);

  useEffect(() => {
    const start = dates[0];
    const end = dates[dates.length - 1];
    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    Promise.all([
      fetch("/api/backoffice/settings", { signal: controller.signal }).then((r) => r.json()),
      fetch(`/api/backoffice/daily-prices?start=${start}&end=${end}`, { signal: controller.signal }).then((r) =>
        r.json()
      ),
    ])
      .then(([settingsData, pricesData]) => {
        if (cancelled) return;
        setLoadError(null);
        try {
          const parsed = settingsData.ical_sources ? JSON.parse(settingsData.ical_sources) : [];
          setIcalSources(Array.isArray(parsed) ? parsed : []);
        } catch {
          setIcalSources([]);
        }
        setSitePrice(parseFloat(settingsData.price_per_night ?? "0") || 0);

        const map: Record<string, number> = {};
        for (const p of pricesData.prices ?? []) {
          map[`${p.channel}|${p.date}`] = p.price;
        }
        setPrices(map);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(
          err?.name === "AbortError"
            ? "Demorou demasiado tempo a responder. Pode ser o Supabase a acordar de uma pausa — tente outra vez."
            : "Erro de ligação ao carregar os preços."
        );
        setLoading(false);
      });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [dates, reloadToken]);

  function getPrice(channel: string, date: string, fallback: number): number {
    const key = `${channel}|${date}`;
    return key in prices ? prices[key] : fallback;
  }

  async function savePrice(channel: string, date: string, value: string) {
    const price = parseFloat(value);
    if (isNaN(price)) return;
    const key = `${channel}|${date}`;
    setPrices((prev) => ({ ...prev, [key]: price }));
    setSavingCell(key);
    await fetch("/api/backoffice/daily-prices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, date, price }),
    });
    setSavingCell(null);
  }

  function netPrice(gross: number, commissionPercent?: number): number {
    const c = commissionPercent ?? 0;
    return gross * (1 - c / 100);
  }

  return (
    <main className="max-w-7xl mx-auto p-8">
      <h1 className="text-2xl font-semibold mb-1">Comparação de preços</h1>
      <p className="text-sm text-gray-500 mb-6">
        Introduza o preço que vê em cada canal — o valor líquido (já descontada a comissão configurada
        nas definições) é calculado automaticamente. Estes preços não são lidos nem alterados automaticamente
        nas plataformas: não existe API pública para isso.
      </p>

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
        <div className="overflow-x-auto border rounded-lg">
          <table className="text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
                <th className="text-left px-3 py-2 sticky left-0 bg-gray-50">Canal</th>
                {dates.map((d) => (
                  <th key={d} className="text-center px-2 py-2 whitespace-nowrap font-normal">
                    {formatDate(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Site próprio */}
              <tr className="border-t">
                <td className="px-3 py-2 font-medium sticky left-0 bg-white whitespace-nowrap">
                  Site próprio
                </td>
                {dates.map((d) => {
                  const key = `site|${d}`;
                  const value = getPrice("site", d, sitePrice);
                  return (
                    <td key={d} className="px-1 py-1 text-center">
                      <input
                        type="number"
                        step={0.5}
                        className="w-16 border rounded px-1 py-1 text-center text-xs"
                        defaultValue={value}
                        onBlur={(e) => savePrice("site", d, e.target.value)}
                      />
                      {savingCell === key && <span className="block text-[10px] text-gray-400">a guardar...</span>}
                    </td>
                  );
                })}
              </tr>

              {/* Cada canal OTA */}
              {icalSources.map((source) => (
                <tr key={source.id} className="border-t">
                  <td className="px-3 py-2 sticky left-0 bg-white whitespace-nowrap">
                    <div className="font-medium">{source.label || "Canal"}</div>
                    <div className="text-[10px] text-gray-400">comissão {source.commissionPercent ?? 0}%</div>
                  </td>
                  {dates.map((d) => {
                    const key = `${source.id}|${d}`;
                    const gross = getPrice(source.id, d, 0);
                    const net = netPrice(gross, source.commissionPercent);
                    return (
                      <td key={d} className="px-1 py-1 text-center">
                        <input
                          type="number"
                          step={0.5}
                          className="w-16 border rounded px-1 py-1 text-center text-xs"
                          defaultValue={gross || ""}
                          placeholder="—"
                          onBlur={(e) => savePrice(source.id, d, e.target.value)}
                        />
                        {gross > 0 && (
                          <div className="text-[10px] text-gray-500 mt-0.5">líquido €{net.toFixed(0)}</div>
                        )}
                        {savingCell === key && <span className="block text-[10px] text-gray-400">a guardar...</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {icalSources.length === 0 && !loading && (
        <p className="text-sm text-gray-500 mt-4">
          Ainda não tem canais configurados.{" "}
          <Link href="/backoffice" className="underline">
            Adicione os links iCal nas definições
          </Link>{" "}
          para poder comparar preços.
        </p>
      )}
    </main>
  );
}
