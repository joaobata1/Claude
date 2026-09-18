"use client";

import { useEffect, useState } from "react";
import type { IcalSource } from "@/lib/ical-sync";

const FIELD_LABELS: Record<string, { label: string; type?: string; hint?: string }> = {
  nuki_api_token: { label: "Nuki - API Token", type: "password" },
  nuki_smartlock_id: { label: "Nuki - Smart Lock ID", hint: "ID numérico do Nuki Web (não o código de 8 caracteres do dispositivo)" },
  nuki_checkin_hour: { label: "Hora de início do código (check-in)", type: "number", hint: "0-23, ex: 16" },
  nuki_checkout_hour: { label: "Hora de fim do código (check-out)", type: "number", hint: "0-23, ex: 12" },
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
  site_description: { label: "Descrição da casa" },
  site_about: { label: "Sobre nós" },
};

const MESSAGE_TYPES: { id: string; label: string }[] = [
  { id: "chaves", label: "Envio de chaves" },
  { id: "instrucoes", label: "Instruções e regras" },
  { id: "custom1", label: "Mensagem personalizada 1" },
  { id: "custom2", label: "Mensagem personalizada 2" },
];

const MESSAGE_LANGUAGES: { id: string; label: string }[] = [
  { id: "pt", label: "Português" },
  { id: "en", label: "Inglês" },
  { id: "fr", label: "Francês" },
  { id: "es", label: "Espanhol" },
  { id: "de", label: "Alemão" },
];

interface MessageTemplateRow {
  type: string;
  language: string;
  subject: string;
  body: string;
}

interface AutomationRule {
  id: string;
  type: string;
  daysOffset: number;
  relativeTo: "checkin" | "checkout";
  enabled: boolean;
}

const SECTIONS: { id: string; label: string; fields: string[] }[] = [
  { id: "ical", label: "iCal", fields: [] },
  { id: "mensagens", label: "Mensagens", fields: [] },
  { id: "regras", label: "Regras & Preços", fields: ["price_per_night", "cleaning_fee", "cleaning_contact_phone"] },
  { id: "nuki", label: "Nuki", fields: ["nuki_api_token", "nuki_smartlock_id", "nuki_checkin_hour", "nuki_checkout_hour"] },
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
  { id: "site", label: "Site", fields: ["site_description", "site_about"] },
];

export default function Backoffice() {
  const [section, setSection] = useState("ical");
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [savedIsError, setSavedIsError] = useState(false);
  const [icalSources, setIcalSources] = useState<IcalSource[]>([]);
  const [galleryPhotos, setGalleryPhotos] = useState<string[]>([]);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const [templates, setTemplates] = useState<MessageTemplateRow[]>([]);
  const [msgType, setMsgType] = useState("chaves");
  const [msgLang, setMsgLang] = useState("pt");
  const [savingTemplates, setSavingTemplates] = useState(false);
  const [templatesSavedMsg, setTemplatesSavedMsg] = useState("");
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([]);

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
        try {
          const parsed = data.gallery_photo_urls ? JSON.parse(data.gallery_photo_urls) : [];
          setGalleryPhotos(Array.isArray(parsed) ? parsed : []);
        } catch {
          setGalleryPhotos([]);
        }
        try {
          const parsed = data.automation_rules ? JSON.parse(data.automation_rules) : [];
          setAutomationRules(Array.isArray(parsed) ? parsed : []);
        } catch {
          setAutomationRules([]);
        }
      });
    fetch("/api/backoffice/message-templates")
      .then((r) => r.json())
      .then((data) => setTemplates(data.templates ?? []));
  }, []);

  function fileToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve({ base64: result.split(",")[1], mediaType: file.type });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function uploadOnePhoto(file: File): Promise<string> {
    const { base64, mediaType } = await fileToBase64(file);
    const res = await fetch("/api/backoffice/photos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: base64, mediaType, fileName: file.name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Falha ao enviar a foto.");
    return data.url as string;
  }

  async function persistSetting(key: string, value: string) {
    await fetch("/api/backoffice/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
  }

  async function handleCoverUpload(file: File) {
    setPhotoError(null);
    setUploadingCover(true);
    try {
      const url = await uploadOnePhoto(file);
      setSettings((prev) => ({ ...prev, cover_photo_url: url }));
      await persistSetting("cover_photo_url", url);
    } catch (err: any) {
      setPhotoError(err.message ?? "Erro ao enviar a foto de capa.");
    }
    setUploadingCover(false);
  }

  async function handleGalleryUpload(files: FileList) {
    setPhotoError(null);
    setUploadingGallery(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        uploaded.push(await uploadOnePhoto(file));
      }
      const next = [...galleryPhotos, ...uploaded];
      setGalleryPhotos(next);
      await persistSetting("gallery_photo_urls", JSON.stringify(next));
    } catch (err: any) {
      setPhotoError(err.message ?? "Erro ao enviar fotos da galeria.");
    }
    setUploadingGallery(false);
  }

  async function handleGalleryRemove(url: string) {
    const next = galleryPhotos.filter((u) => u !== url);
    setGalleryPhotos(next);
    await persistSetting("gallery_photo_urls", JSON.stringify(next));
    fetch("/api/backoffice/photos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    }).catch(() => {});
  }

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

  function currentTemplate(): MessageTemplateRow {
    return (
      templates.find((t) => t.type === msgType && t.language === msgLang) ?? {
        type: msgType,
        language: msgLang,
        subject: "",
        body: "",
      }
    );
  }

  function updateCurrentTemplate(field: "subject" | "body", value: string) {
    setTemplates((prev) => {
      const exists = prev.some((t) => t.type === msgType && t.language === msgLang);
      if (exists) {
        return prev.map((t) => (t.type === msgType && t.language === msgLang ? { ...t, [field]: value } : t));
      }
      return [...prev, { type: msgType, language: msgLang, subject: "", body: "", [field]: value }];
    });
  }

  async function saveTemplates() {
    setSavingTemplates(true);
    setTemplatesSavedMsg("");
    const res = await fetch("/api/backoffice/message-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templates }),
    });
    setSavingTemplates(false);
    setTemplatesSavedMsg(res.ok ? "Modelos guardados com sucesso." : "Erro ao guardar os modelos.");
    setTimeout(() => setTemplatesSavedMsg(""), 4000);
  }

  function addAutomationRule() {
    setAutomationRules((prev) => [
      ...prev,
      { id: crypto.randomUUID(), type: "chaves", daysOffset: -1, relativeTo: "checkin", enabled: true },
    ]);
  }

  function updateAutomationRule(id: string, patch: Partial<AutomationRule>) {
    setAutomationRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeAutomationRule(id: string) {
    setAutomationRules((prev) => prev.filter((r) => r.id !== id));
  }

  async function saveSettings() {
    setSaving(true);
    setSavedMsg("");
    try {
      const res = await fetch("/api/backoffice/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...settings,
          ical_sources: JSON.stringify(icalSources),
          automation_rules: JSON.stringify(automationRules),
        }),
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

      {section === "mensagens" && (
        <section className="space-y-8">
          <div>
            <h2 className="text-lg font-medium mb-1">Modelos de mensagens</h2>
            <p className="text-sm text-gray-500 mb-3">
              Um modelo por tipo de mensagem e por idioma. Use os marcadores{" "}
              <code className="bg-gray-100 px-1 rounded">{"{nome}"}</code>{" "}
              <code className="bg-gray-100 px-1 rounded">{"{checkin}"}</code>{" "}
              <code className="bg-gray-100 px-1 rounded">{"{checkout}"}</code>{" "}
              <code className="bg-gray-100 px-1 rounded">{"{codigo}"}</code>{" "}
              <code className="bg-gray-100 px-1 rounded">{"{numero_reserva}"}</code> — são substituídos
              automaticamente ao enviar.
            </p>

            <div className="flex gap-1 mb-2 flex-wrap">
              {MESSAGE_TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setMsgType(t.id)}
                  className={`px-3 py-1.5 rounded text-xs border ${
                    msgType === t.id ? "bg-gray-900 text-white border-gray-900" : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1 mb-4 flex-wrap">
              {MESSAGE_LANGUAGES.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setMsgLang(l.id)}
                  className={`px-3 py-1.5 rounded text-xs border ${
                    msgLang === l.id ? "bg-gray-700 text-white border-gray-700" : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>

            <label className="block text-sm text-gray-600 mb-1">Assunto (usado no email)</label>
            <input
              className="w-full border rounded px-3 py-2 text-sm mb-3"
              value={currentTemplate().subject}
              onChange={(e) => updateCurrentTemplate("subject", e.target.value)}
            />
            <label className="block text-sm text-gray-600 mb-1">Mensagem</label>
            <textarea
              className="w-full border rounded px-3 py-2 h-40 text-sm"
              value={currentTemplate().body}
              onChange={(e) => updateCurrentTemplate("body", e.target.value)}
            />

            <button
              onClick={saveTemplates}
              disabled={savingTemplates}
              className="mt-3 bg-gray-900 text-white text-sm px-4 py-2 rounded disabled:opacity-60"
            >
              {savingTemplates ? "A guardar..." : "Guardar modelos"}
            </button>
            {templatesSavedMsg && <span className="ml-3 text-sm text-gray-600">{templatesSavedMsg}</span>}
          </div>

          <div className="border-t pt-6">
            <h2 className="text-lg font-medium mb-1">Envio automático</h2>
            <p className="text-sm text-gray-500 mb-3">
              Envia uma mensagem automaticamente X dias antes ou depois do check-in/check-out. Só é totalmente
              automático para reservas cujo canal seja Email — para WhatsApp, a reserva mostra um lembrete pronto a
              enviar na página de detalhe, porque não é possível enviar WhatsApp sem intervenção manual sem uma
              API de WhatsApp Business paga (Twilio, Meta ou Vonage).
            </p>
            <div className="space-y-2">
              {automationRules.map((r) => (
                <div key={r.id} className="flex items-center gap-2 border rounded-lg p-3 flex-wrap">
                  <select
                    className="border rounded px-2 py-1.5 text-sm"
                    value={r.type}
                    onChange={(e) => updateAutomationRule(r.id, { type: e.target.value })}
                  >
                    {MESSAGE_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    className="w-20 border rounded px-2 py-1.5 text-sm"
                    value={r.daysOffset}
                    title="Dias (negativo = antes, positivo = depois)"
                    onChange={(e) => updateAutomationRule(r.id, { daysOffset: Number(e.target.value) })}
                  />
                  <span className="text-xs text-gray-500">dias em relação a</span>
                  <select
                    className="border rounded px-2 py-1.5 text-sm"
                    value={r.relativeTo}
                    onChange={(e) =>
                      updateAutomationRule(r.id, { relativeTo: e.target.value as "checkin" | "checkout" })
                    }
                  >
                    <option value="checkin">Check-in</option>
                    <option value="checkout">Check-out</option>
                  </select>
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 ml-2">
                    <input
                      type="checkbox"
                      checked={r.enabled}
                      onChange={(e) => updateAutomationRule(r.id, { enabled: e.target.checked })}
                    />
                    Ativa
                  </label>
                  <button
                    onClick={() => removeAutomationRule(r.id)}
                    className="text-red-500 text-sm px-2 py-1 hover:bg-red-50 rounded ml-auto"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
            <button onClick={addAutomationRule} className="mt-3 text-sm border rounded px-3 py-2 hover:bg-gray-50">
              + Adicionar regra
            </button>
            <p className="text-xs text-gray-400 mt-2">
              As regras só ficam ativas depois de guardar as definições, no botão no fundo da página. É preciso um
              cron externo (ex: cron-job.org) a chamar <code className="bg-gray-100 px-1 rounded">/api/automation/run-scheduled-messages</code> uma vez por dia.
            </p>
          </div>
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

      {section === "site" && (
        <section className="space-y-8">
          <div>
            <h2 className="text-lg font-medium mb-1">Foto de capa</h2>
            <p className="text-sm text-gray-500 mb-3">Mostrada no topo da página inicial do site.</p>
            {settings.cover_photo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={settings.cover_photo_url}
                alt="Foto de capa atual"
                className="w-full max-w-sm h-40 object-cover rounded-lg border mb-3"
              />
            )}
            <input
              type="file"
              accept="image/*"
              disabled={uploadingCover}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleCoverUpload(file);
                e.target.value = "";
              }}
              className="text-sm"
            />
            {uploadingCover && <p className="text-xs text-gray-400 mt-1">A enviar...</p>}
          </div>

          <div>
            <h2 className="text-lg font-medium mb-1">Galeria de fotos</h2>
            <p className="text-sm text-gray-500 mb-3">Mostradas na página de fotos do site (pode escolher várias de uma vez).</p>
            {galleryPhotos.length > 0 && (
              <div className="flex flex-wrap gap-3 mb-3">
                {galleryPhotos.map((url) => (
                  <div key={url} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="w-24 h-24 object-cover rounded border" />
                    <button
                      onClick={() => handleGalleryRemove(url)}
                      className="absolute -top-2 -right-2 bg-white border rounded-full w-6 h-6 text-red-500 text-sm hover:bg-red-50"
                      aria-label="Remover foto"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={uploadingGallery}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) handleGalleryUpload(e.target.files);
                e.target.value = "";
              }}
              className="text-sm"
            />
            {uploadingGallery && <p className="text-xs text-gray-400 mt-1">A enviar...</p>}
          </div>

          {photoError && <p className="text-sm text-red-600">{photoError}</p>}

          <div>
            <label className="block text-sm text-gray-600 mb-1">Descrição da casa</label>
            <textarea
              className="w-full border rounded px-3 py-2 h-28"
              value={settings.site_description ?? ""}
              onChange={(e) => setSettings({ ...settings, site_description: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Sobre nós</label>
            <textarea
              className="w-full border rounded px-3 py-2 h-28"
              value={settings.site_about ?? ""}
              onChange={(e) => setSettings({ ...settings, site_about: e.target.value })}
            />
          </div>
        </section>
      )}

      {activeSection.fields.length > 0 && section !== "regras" && section !== "site" && (
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
