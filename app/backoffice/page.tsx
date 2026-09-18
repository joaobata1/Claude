"use client";

import { useEffect, useState } from "react";
import type { IcalSource } from "@/lib/ical-sync";

const FIELD_LABELS: Record<string, { label: string; type?: string; hint?: string }> = {
  nuki_api_token: { label: "Nuki - API Token", type: "password" },
  nuki_smartlock_id: { label: "Nuki - Smart Lock ID" },
  ifthenpay_mbway_key: { label: "ifthenpay - Chave MB WAY", type: "password" },
  ifthenpay_gateway_key: { label: "ifthenpay - Chave Gateway (Cartão)", type: "password" },
  price_per_night: { label: "Preço por noite (€)" },
  cleaning_fee: { label: "Taxa de limpeza (€)" },
  vonage_api_key: { label: "Vonage - API Key (SMS)" },
  vonage_api_secret: { label: "Vonage - API Secret (SMS)", type: "password" },
  vonage_sender_id: { label: "Vonage - Nome do remetente", hint: "Ex: AljezurAL (máx. 11 caracteres)" },
  resend_api_key: { label: "Resend - API Key (Email)", type: "password" },
  notification_from_email: { label: "Email de envio", hint: "reservas@oseudominio.pt" },
  cleaning_contact_phone: { label: "WhatsApp da senhora da limpeza", hint: "351912345678" },
  siba_nipc: { label: "SIBA - NIPC / Unidade Hoteleira" },
  siba_estabelecimento: { label: "SIBA - Nº de Estabelecimento" },
  siba_chave_acesso: { label: "SIBA - Chave de Acesso", type: "password" },
  siba_nome_unidade: { label: "SIBA - Nome da unidade" },
  siba_abreviatura: { label: "SIBA - Abreviatura" },
  siba_morada: { label: "SIBA - Morada" },
  siba_localidade: { label: "SIBA - Localidade" },
  siba_codigo_postal: { label: "SIBA - Código Postal" },
  siba_zona_postal: { label: "SIBA - Zona Postal" },
  siba_telefone: { label: "SIBA - Telefone" },
  siba_contacto_nome: { label: "SIBA - Nome do contacto" },
  siba_contacto_email: { label: "SIBA - Email do contacto" },
  ai_vision_api_key: { label: "Anthropic API Key (leitura de screenshots)", type: "password", hint: "console.anthropic.com" },
  ai_vision_model: { label: "Modelo de IA (leitura de screenshots)", hint: "ex: claude-sonnet-5" },
};

const SECTIONS: { id: string; label: string; fields: string[] }[] = [
  { id: "ical", label: "iCal", fields: [] },
  { id: "regras", label: "Regras & Preços", fields: ["price_per_night", "cleaning_fee", "cleaning_contact_phone"] },
  { id: "nuki", label: "Nuki", fields: ["nuki_api_token", "nuki_smartlock_id"] },
  { id: "pagamentos", label: "Pagamentos", fields: ["ifthenpay_mbway_key", "ifthenpay_gateway_key"] },
  {
    id: "notificacoes",
    label: "SMS & Email",
    fields: ["vonage_api_key", "vonage_api_secret", "vonage_sender_id", "resend_api_key", "notification_from_email"],
  },
  {
    id: "siba",
    label: "SIBA",
    fields: [
      "siba_nipc",
      "siba_estabelecimento",
      "siba_chave_acesso",
      "siba_nome_unidade",
      "siba_abreviatura",
      "siba_morada",
      "siba_localidade",
      "siba_codigo_postal",
      "siba_zona_postal",
      "siba_telefone",
      "siba_contacto_nome",
      "siba_contacto_email",
    ],
  },
  { id: "ia", label: "IA (leitura de imagens)", fields: ["ai_vision_api_key", "ai_vision_model"] },
];

export default function Backoffice() {
  const [section, setSection] = useState("ical");
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [savedIsError, setSavedIsError] = useState(false);
  const [icalSources, setIcalSources] = useState<IcalSource[]>([]);

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

  const activeSection = SECTIONS.find((s) => s.id === section)!;

  return (
    <main className="max-w-3xl mx-auto p-8">
      <h1 className="text-2xl font-semibold mb-6">Definições</h1>

      <div className="flex gap-1 border-b mb-6 overflow-x-auto">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`whitespace-nowrap px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
              section === s.id
                ? "border-gray-900 text-gray-900 font-medium"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === "ical" && (
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
      )}

      {section === "regras" && (
        <section className="space-y-6">
          <div className="space-y-3">
            {activeSection.fields.map((key) => {
              const f = FIELD_LABELS[key];
              return (
                <div key={key}>
                  <label className="block text-sm text-gray-600 mb-1">{f.label}</label>
                  <input
                    type={f.type ?? "text"}
                    className="w-full border rounded px-3 py-2"
                    value={settings[key] ?? ""}
                    placeholder={f.hint}
                    onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                  />
                </div>
              );
            })}
          </div>

          <div className="border-t pt-6">
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
          </div>
        </section>
      )}

      {activeSection.fields.length > 0 && section !== "regras" && (
        <section>
          <div className="space-y-3">
            {activeSection.fields.map((key) => {
              const f = FIELD_LABELS[key];
              return (
                <div key={key}>
                  <label className="block text-sm text-gray-600 mb-1">{f.label}</label>
                  <input
                    type={f.type ?? "text"}
                    className="w-full border rounded px-3 py-2"
                    value={settings[key] ?? ""}
                    placeholder={f.hint}
                    onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                  />
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="border-t mt-8 pt-6">
        <button onClick={saveSettings} disabled={saving} className="bg-black text-white px-4 py-2 rounded">
          {saving ? "A guardar..." : "Guardar definições"}
        </button>
        {savedMsg && <p className={`text-sm mt-2 ${savedIsError ? "text-red-600" : "text-green-600"}`}>{savedMsg}</p>}
        <p className="text-xs text-gray-400 mt-2">Guarda as definições de todos os separadores de uma vez.</p>
      </div>
    </main>
  );
}
