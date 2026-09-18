"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BookingSearchWidget({ price, cleaningFee }: { price: number; cleaningFee: number }) {
  const router = useRouter();
  const [checkin, setCheckin] = useState("");
  const [checkout, setCheckout] = useState("");
  const [guestsCount, setGuestsCount] = useState(2);

  function handleSearch() {
    const params = new URLSearchParams();
    if (checkin) params.set("checkin", checkin);
    if (checkout) params.set("checkout", checkout);
    params.set("guests", String(guestsCount));
    router.push(`/reservar?${params.toString()}`);
  }

  return (
    <aside className="border rounded-xl p-6 h-fit shadow-sm sticky top-6">
      <p className="text-2xl font-semibold mb-1">
        €{price} <span className="text-base font-normal text-gray-500">/ noite</span>
      </p>
      <p className="text-sm text-gray-500 mb-4">
        {cleaningFee > 0 ? `+ €${cleaningFee} taxa de limpeza` : "Taxa de limpeza incluída no total"}
      </p>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Check-in</label>
            <input
              type="date"
              className="w-full border rounded px-2 py-2 text-sm"
              value={checkin}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setCheckin(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Check-out</label>
            <input
              type="date"
              className="w-full border rounded px-2 py-2 text-sm"
              value={checkout}
              min={checkin || new Date().toISOString().slice(0, 10)}
              onChange={(e) => setCheckout(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Hóspedes</label>
          <input
            type="number"
            min={1}
            max={6}
            value={guestsCount}
            onChange={(e) => setGuestsCount(Number(e.target.value))}
            className="w-full border rounded px-2 py-2 text-sm"
          />
        </div>
      </div>

      <button
        onClick={handleSearch}
        className="mt-5 block w-full text-center bg-gray-900 text-white rounded py-3 font-medium hover:bg-gray-800 transition"
      >
        Verificar disponibilidade
      </button>

      <p className="text-xs text-gray-400 text-center mt-3">MB WAY · Cartão de crédito</p>
    </aside>
  );
}
