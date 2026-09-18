"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import GuestForm, { useGuestForm } from "@/app/components/GuestForm";
import LogoutButton from "@/app/components/LogoutButton";
import type { IcalSource } from "@/lib/ical-sync";

const FIELDS: { key: string; label: string; type?: string; hint?: string }[] = [
  { key: "nuki_api_token", label: "Nuki - API Token", type: "password" },
  { key: "nuki_smartlock_id", label: "Nuki - Smart Lock ID" },
  { key: "ifthenpay_mbway_key", label: "ifthenpay - Chave MB WAY", type: "password" },
  { key: "ifthenpay_gateway_key", label: "ifthenpay - Chave Gateway (Cartão)", type: "password" },
  { key: "price_per_night", label: "Preço por noite (€)" },
  { key: "cleaning_fee", label: "Taxa de limpeza (€)" },
  { key: "vonage_api_key", label: "Vonage - API Key (SMS)" },
  { key: "vonage_api_secret", label: "Vonage - API Secret (SMS)", type: "password" },
  { key: "vonage_sender_id", label: "Vonage - Nome do remetente", hint: "Ex: AljezurAL (máx. 11 caracteres)" },
  { key: "resend_api_key", label: "Resend - API Key (Email)", type: "password" },
  { key: "notification_from_email", label: "Email de envio", hint: "reservas@oseudominio.pt" },
  { key: "cleaning_contact_phone", label: "WhatsApp da senhora da limpeza", hint: "351912345678" },
  { key: "siba_nipc", label: "SIBA - NIPC / Unidade Hoteleira" },
  { key: "siba_estabelecimento", label: "SIBA - Nº de Estabelecimento" },
  { key: "siba_chave_acesso", label: "SIBA - Chave de Acesso", type: "password" },
  { key: "siba_nome_unidade", label: "SIBA - Nome da unidade" },
  { key: "siba_abreviatura", label: "SIBA - Abreviatura" },
  { key: "siba_morada", label: "SIBA - Morada" },
  { key: "siba_localidade", label: "SIBA - Localidade" },
  { key: "siba_codigo_postal", label: "SIBA - Código Postal" },
  { key: "siba_zona_postal", label: "SIBA - Zona Postal" },
  { key: "siba_telefone", label: "SIBA - Telefone" },
  { key: "siba_contacto_nome", label: "SIBA - Nome do contacto" },
  { key: "siba_contacto_email", label: "SIBA - Email do contacto" },
  { key: "ai_vision_api_key", label: "Anthropic API Key (leitura de screenshots)", type: "password", hint: "console.anthropic.com" },
  { key: "ai_vision_model", label: "Modelo de IA (leitura de screenshots)", hint: "ex: claude-sonnet-5" },
];

export default function Backoffice() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [savedIsError, setSavedIsError] = useState(false);
  const [icalSources, setIcalSources] = useState<IcalSource[]>([]);

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

  useEffect(() => {
    fetch("/api/backoffice/settings")
      .then((r) => r.json())
      .then((data) => {
        setSettings(data);
        try {
          const parsed = data.ical_sources ? JSON.parse(data.ical_sources) : [];
          setIcalSources(Array.isArray(parsed) ? parsed : []);
        } catch {
          setIcalSources([]);
        }
      });
  }, []);

  function addIcalSource() {
    setIcalSources([...icalSources, { id: crypto.randomUUID(), label: "", url: "", commissionPercent: 0 }]);
  }

  function updateIcalSource(index: number, field: "label" | "url" | "commissionPercent", value: string) {
    setIcalSources((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: field === "commissionPercent" ? Number(value) : value };
      return next;
    });
  }

  function removeIcalSource(index: number) {
    setIcalSources((prev) => prev.filter((_, i) => i !== index));
  }

  async function saveSettings() {
    setSaving(true);
    setSavedMsg("");
    try {
      const res = await fetch("/api/backoffice/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...settings, ical_sources: JSON.stringify(icalSources) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSavedIsError(true);
        setSavedMsg(data.error ? `Erro ao guardar: ${data.error}` : "Erro ao guardar. Tente novamente.");
      } else {
        setSavedIsError(false);
        setSavedMsg("Guardado com sucesso.");
      }
    } catch {
      setSavedIsError(true);
      setSavedMsg("Erro de ligação ao tentar guardar. Verifique a sua internet e tente novamente.");
    }
    setSaving(false);
    setTimeout(() => setSavedMsg(""), 4000);
  }

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
        source: ["airbnb", "booking", "vrbo"].includes(data.source) ? data.source : prev.source,
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
    <main className="max-w-2xl mx-auto p-8 space-y-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Backoffice - Aljezur Monte Clérigo</h1>
        <div className="flex gap-4">
          <Link href="/backoffice/reservas" className="text-sm text-gray-600 hover:text-gray-900 underline">
            Folha de reservas →
          </Link>
          <Link href="/backoffice/precos" className="text-sm text-gray-600 hover:text-gray-900 underline">
            Comparação de preços →
          </Link>
          <Link href="/backoffice/limpeza" className="text-sm text-gray-600 hover:text-gray-900 underline">
            Tabela de limpezas →
          </Link>
          <LogoutButton />
        </div>
      </div>

      <section>
        <h2 className="text-lg font-medium mb-1">Links iCal (sincronização de calendário)</h2>
        <p className="text-sm text-gray-500 mb-3">
          Adicione quantos links precisar — Airbnb, Booking, VRBO, ou outro apartamento/plataforma no futuro.
        </p>
        <div className="space-y-3">
          {icalSources.map((source, i) => (
            <div key={source.id} className="flex gap-2 items-start border rounded-lg p-3">
              <div className="flex-1 space-y-2">
                <input
                  placeholder="Nome (ex: Airbnb)"
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={source.label}
                  onChange={(e) => updateIcalSource(i, "label", e.target.value)}
                />
                <input
                  placeholder="https://..."
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={source.url}
                  onChange={(e) => updateIcalSource(i, "url", e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">Comissão do canal:</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    className="w-20 border rounded px-2 py-1 text-sm"
                    value={source.commissionPercent ?? 0}
                    onChange={(e) => updateIcalSource(i, "commissionPercent", e.target.value)}
                  />
                  <span className="text-xs text-gray-500">%</span>
                </div>
              </div>
              <button
                onClick={() => removeIcalSource(i)}
                className="text-red-500 text-sm px-2 py-1 hover:bg-red-50 rounded"
                aria-label="Remover"
              >
                Remover
              </button>
            </div>
          ))}
        </div>
        <button onClick={addIcalSource} className="mt-3 text-sm border rounded px-3 py-2 hover:bg-gray-50">
          + Adicionar link iCal
        </button>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">Definições / Integrações</h2>
        <div className="space-y-3">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label className="block text-sm text-gray-600 mb-1">{f.label}</label>
              <input
                type={f.type ?? "text"}
                className="w-full border rounded px-3 py-2"
                value={settings[f.key] ?? ""}
                placeholder={f.hint}
                onChange={(e) => setSettings({ ...settings, [f.key]: e.target.value })}
              />
            </div>
          ))}
        </div>
        <button
          onClick={saveSettings}
          disabled={saving}
          className="mt-4 bg-black text-white px-4 py-2 rounded"
        >
          {saving ? "A guardar..." : "Guardar definições"}
        </button>
        {savedMsg && (
          <p className={`text-sm mt-2 ${savedIsError ? "text-red-600" : "text-green-600"}`}>{savedMsg}</p>
        )}
      </section>

      <section className="border-t pt-8">
        <h2 className="text-lg font-medium mb-1">Envio da chave Nuki e instruções de check-in</h2>
        <p className="text-sm text-gray-500 mb-3">
          Decide se o código Nuki e as instruções de check-in podem ser enviados sem os dados dos hóspedes,
          ou se ficam retidos até esses dados serem preenchidos.
        </p>
        <div className="border rounded-lg p-4 flex items-start justify-between gap-4">
          <div>
            <p className="font-medium text-sm">
              {settings.require_guests_before_checkin === "true" ? "Ativado (ON)" : "Desativado (OFF)"}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {settings.require_guests_before_checkin === "true"
                ? "Não envia o código Nuki nem as instruções enquanto os dados de todos os hóspedes não estiverem preenchidos."
                : "Envia o código Nuki e as instruções assim que o pagamento estiver confirmado, mesmo sem os dados dos hóspedes."}
            </p>
          </div>
          <button
            onClick={() =>
              setSettings({
                ...settings,
                require_guests_before_checkin: settings.require_guests_before_checkin === "true" ? "false" : "true",
              })
            }
            className={`shrink-0 px-4 py-2 rounded text-sm font-medium ${
              settings.require_guests_before_checkin === "true" ? "bg-gray-900 text-white" : "bg-gray-200 text-gray-700"
            }`}
          >
            {settings.require_guests_before_checkin === "true" ? "Desligar" : "Ligar"}
          </button>
        </div>
        <p className="text-xs text-amber-600 mt-2">
          Lembre-se de guardar as definições depois de alterar este interruptor.
        </p>
      </section>

      <section className="border-t pt-8">
        <h2 className="text-lg font-medium mb-3">Registar reserva manual (Airbnb / Booking / VRBO)</h2>
        <p className="text-sm text-gray-500 mb-3">
          Estas plataformas não partilham dados de contacto reais via API. Introduza aqui os dados
          assim que receber a notificação de reserva — o código Nuki é gerado automaticamente.
        </p>
        <div
          onPaste={(e) => {
            const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
            const file = item?.getAsFile();
            if (file) handleBookingImage(file);
          }}
          className="border-2 border-dashed rounded-lg p-4 mb-4 text-center text-sm text-gray-500 bg-gray-50"
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
        <button
          onClick={submitManualBooking}
          className="mt-4 bg-black text-white px-4 py-2 rounded"
        >
          Registar e gerar código Nuki
        </button>
        {manualResult && <p className="text-sm mt-2">{manualResult}</p>}
      </section>
    </main>
  );
}
