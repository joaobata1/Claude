"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface Booking {
  id: string;
  booking_number: number;
  source: string;
  guest_name: string;
  guest_email: string | null;
  guest_phone: string | null;
  checkin: string;
  checkout: string;
  guests_count: number;
  price_total: number | null;
  commission_amount: number;
  cleaning_cost: number;
  booking_reference: string | null;
  payment_status: string;
  nuki_code: string | null;
  nuki_code_sent: number;
  guest_language: string;
  message_channel: string;
}

interface Guest {
  id: string;
  full_name: string;
  nationality: string | null;
  document_type: string | null;
  document_number: string | null;
  birth_date: string | null;
}

interface LogEntry {
  type: string;
  channel: string;
  language: string;
  automated: number;
  sent_at: string;
}

interface AutomationRule {
  id: string;
  type: string;
  daysOffset: number;
  relativeTo: "checkin" | "checkout";
  enabled: boolean;
}

const SOURCE_LABEL: Record<string, string> = {
  site: "Site próprio",
  airbnb: "Airbnb",
  booking: "Booking.com",
  vrbo: "VRBO",
  outros: "Outros",
};

const LANGUAGES = [
  { id: "pt", label: "Português" },
  { id: "en", label: "Inglês" },
  { id: "fr", label: "Francês" },
  { id: "es", label: "Espanhol" },
  { id: "de", label: "Alemão" },
];

const PAYMENT_STATUSES = [
  { id: "pending", label: "Pendente" },
  { id: "paid", label: "Pago" },
  { id: "failed", label: "Falhado" },
  { id: "not_applicable", label: "Não aplicável (OTA)" },
];

const MESSAGE_TYPE_LABEL: Record<string, string> = {
  chaves: "Chaves",
  instrucoes: "Instruções e regras",
  custom1: "Mensagem personalizada 1",
  custom2: "Mensagem personalizada 2",
};

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function BookingDetail() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [sending, setSending] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ text: string; isError: boolean } | null>(null);

  function load() {
    Promise.all([
      fetch(`/api/backoffice/bookings/${id}`).then((r) => {
        if (!r.ok) throw new Error("not_found");
        return r.json();
      }),
      fetch("/api/backoffice/settings").then((r) => r.json()),
    ])
      .then(([data, settingsData]) => {
        setBooking(data.booking);
        setGuests(data.guests ?? []);
        setLog(data.messageLog ?? []);
        try {
          const parsed = settingsData.automation_rules ? JSON.parse(settingsData.automation_rules) : [];
          setRules(Array.isArray(parsed) ? parsed : []);
        } catch {
          setRules([]);
        }
        setLoading(false);
      })
      .catch(() => {
        setNotFound(true);
        setLoading(false);
      });
  }

  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const sentTypes = useMemo(() => new Set(log.map((l) => l.type)), [log]);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const pendingWhatsappReminders = useMemo(() => {
    if (!booking || booking.message_channel !== "whatsapp") return [];
    return rules.filter((r) => {
      if (!r.enabled || sentTypes.has(r.type)) return false;
      const base = r.relativeTo === "checkin" ? booking.checkin : booking.checkout;
      return addDaysIso(base, r.daysOffset) === today;
    });
  }, [rules, booking, sentTypes, today]);

  function updateField<K extends keyof Booking>(field: K, value: Booking[K]) {
    setBooking((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  async function saveChanges() {
    if (!booking) return;
    setSaving(true);
    setSavedMsg("");
    const res = await fetch(`/api/backoffice/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guest_name: booking.guest_name,
        guest_email: booking.guest_email,
        guest_phone: booking.guest_phone,
        checkin: booking.checkin,
        checkout: booking.checkout,
        guests_count: booking.guests_count,
        price_total: booking.price_total,
        commission_amount: booking.commission_amount,
        cleaning_cost: booking.cleaning_cost,
        booking_reference: booking.booking_reference,
        payment_status: booking.payment_status,
        guest_language: booking.guest_language,
        message_channel: booking.message_channel,
      }),
    });
    setSaving(false);
    setSavedMsg(res.ok ? "Guardado com sucesso." : "Erro ao guardar.");
    setTimeout(() => setSavedMsg(""), 4000);
  }

  async function generateKey() {
    setSending("gerar_chaves");
    setActionMsg(null);
    const res = await fetch(`/api/backoffice/bookings/${id}/generate-key`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      updateField("nuki_code", data.code);
      setActionMsg({ text: `Código gerado: ${data.code}`, isError: false });
    } else {
      setActionMsg({ text: data.error ?? "Erro ao gerar o código.", isError: true });
    }
    setSending(null);
  }

  async function sendMessage(type: string) {
    setSending(type);
    setActionMsg(null);
    const res = await fetch(`/api/backoffice/bookings/${id}/send-message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });
    const data = await res.json();
    if (res.ok) {
      if (data.channel === "whatsapp" && data.link) {
        window.open(data.link, "_blank", "noopener,noreferrer");
        setActionMsg({ text: "A abrir o WhatsApp com a mensagem pronta a enviar...", isError: false });
      } else {
        setActionMsg({ text: "Email enviado.", isError: false });
      }
      load();
    } else {
      setActionMsg({ text: data.error ?? "Erro ao enviar a mensagem.", isError: true });
    }
    setSending(null);
  }

  if (loading) return <main className="max-w-4xl mx-auto p-8 text-gray-500 text-sm">A carregar...</main>;
  if (notFound || !booking)
    return (
      <main className="max-w-4xl mx-auto p-8">
        <p className="text-red-600">Reserva não encontrada.</p>
        <button onClick={() => router.push("/backoffice/reservas")} className="mt-3 text-sm underline">
          ← Voltar à folha de reservas
        </button>
      </main>
    );

  return (
    <main className="max-w-4xl mx-auto p-8">
      <button onClick={() => router.push("/backoffice/reservas")} className="text-sm text-gray-500 hover:underline mb-4">
        ← Folha de reservas
      </button>

      <div className="flex items-center justify-between flex-wrap gap-2 mb-6">
        <h1 className="text-2xl font-semibold">
          Reserva #{booking.booking_number} <span className="text-gray-400 font-normal text-lg">— {booking.guest_name}</span>
        </h1>
        <span className="text-xs bg-gray-100 border rounded px-2 py-1 text-gray-600">
          {SOURCE_LABEL[booking.source] ?? booking.source}
        </span>
      </div>

      {pendingWhatsappReminders.length > 0 && (
        <div className="border border-amber-300 bg-amber-50 rounded-lg p-4 mb-6">
          <p className="text-sm font-medium text-amber-800">Mensagens agendadas para hoje (envio manual por WhatsApp):</p>
          <ul className="mt-1 space-y-1">
            {pendingWhatsappReminders.map((r) => (
              <li key={r.id} className="text-sm text-amber-800">
                {MESSAGE_TYPE_LABEL[r.type] ?? r.type} — use o botão abaixo para enviar agora.
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="border rounded-lg p-5 mb-6">
        <h2 className="font-medium mb-4">Detalhes da reserva</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Nome do hóspede</label>
            <input
              className="w-full border rounded px-3 py-2 text-sm"
              value={booking.guest_name}
              onChange={(e) => updateField("guest_name", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Referência da reserva (OTA)</label>
            <input
              className="w-full border rounded px-3 py-2 text-sm"
              value={booking.booking_reference ?? ""}
              onChange={(e) => updateField("booking_reference", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Email</label>
            <input
              className="w-full border rounded px-3 py-2 text-sm"
              value={booking.guest_email ?? ""}
              onChange={(e) => updateField("guest_email", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Telefone</label>
            <input
              className="w-full border rounded px-3 py-2 text-sm"
              value={booking.guest_phone ?? ""}
              onChange={(e) => updateField("guest_phone", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Check-in</label>
            <input
              type="date"
              className="w-full border rounded px-3 py-2 text-sm"
              value={booking.checkin}
              onChange={(e) => updateField("checkin", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Check-out</label>
            <input
              type="date"
              className="w-full border rounded px-3 py-2 text-sm"
              value={booking.checkout}
              onChange={(e) => updateField("checkout", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Nº de pessoas</label>
            <input
              type="number"
              min={1}
              className="w-full border rounded px-3 py-2 text-sm"
              value={booking.guests_count}
              onChange={(e) => updateField("guests_count", Number(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Estado do pagamento</label>
            <select
              className="w-full border rounded px-3 py-2 text-sm"
              value={booking.payment_status}
              onChange={(e) => updateField("payment_status", e.target.value)}
            >
              {PAYMENT_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Preço total (€)</label>
            <input
              type="number"
              step={0.01}
              className="w-full border rounded px-3 py-2 text-sm"
              value={booking.price_total ?? ""}
              onChange={(e) => updateField("price_total", e.target.value === "" ? null : Number(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Comissão (€)</label>
            <input
              type="number"
              step={0.01}
              className="w-full border rounded px-3 py-2 text-sm"
              value={booking.commission_amount}
              onChange={(e) => updateField("commission_amount", Number(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Custo de limpeza (€)</label>
            <input
              type="number"
              step={0.01}
              className="w-full border rounded px-3 py-2 text-sm"
              value={booking.cleaning_cost}
              onChange={(e) => updateField("cleaning_cost", Number(e.target.value))}
            />
          </div>
        </div>

        <button
          onClick={saveChanges}
          disabled={saving}
          className="mt-4 bg-gray-900 text-white text-sm px-4 py-2 rounded disabled:opacity-60"
        >
          {saving ? "A guardar..." : "Guardar alterações"}
        </button>
        {savedMsg && <span className="ml-3 text-sm text-gray-600">{savedMsg}</span>}
      </section>

      <section className="border rounded-lg p-5 mb-6">
        <h2 className="font-medium mb-4">Idioma e canal de comunicação</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Idioma do hóspede</label>
            <select
              className="w-full border rounded px-3 py-2 text-sm"
              value={booking.guest_language}
              onChange={(e) => updateField("guest_language", e.target.value)}
            >
              {LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Enviar mensagens por</label>
            <select
              className="w-full border rounded px-3 py-2 text-sm"
              value={booking.message_channel}
              onChange={(e) => updateField("message_channel", e.target.value)}
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
            </select>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Lembre-se de guardar as alterações acima antes de enviar mensagens, para usar o idioma/canal correto.
        </p>
      </section>

      <section className="border rounded-lg p-5 mb-6">
        <h2 className="font-medium mb-1">Chaves e mensagens</h2>
        <p className="text-sm text-gray-500 mb-4">
          {booking.nuki_code ? `Código atual: ${booking.nuki_code}` : "Ainda não foi gerado nenhum código."}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={generateKey}
            disabled={sending !== null}
            className="border rounded px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
          >
            {sending === "gerar_chaves" ? "A gerar..." : "Gerar chaves"}
          </button>
          <button
            onClick={() => sendMessage("chaves")}
            disabled={sending !== null}
            className="bg-gray-900 text-white rounded px-4 py-2 text-sm disabled:opacity-60"
          >
            {sending === "chaves" ? "A enviar..." : "Enviar chaves"}
          </button>
          <button
            onClick={() => sendMessage("instrucoes")}
            disabled={sending !== null}
            className="bg-gray-900 text-white rounded px-4 py-2 text-sm disabled:opacity-60"
          >
            {sending === "instrucoes" ? "A enviar..." : "Enviar instruções e regras"}
          </button>
          <button
            onClick={() => sendMessage("custom1")}
            disabled={sending !== null}
            className="border rounded px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
          >
            {sending === "custom1" ? "A enviar..." : "Mensagem personalizada 1"}
          </button>
          <button
            onClick={() => sendMessage("custom2")}
            disabled={sending !== null}
            className="border rounded px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
          >
            {sending === "custom2" ? "A enviar..." : "Mensagem personalizada 2"}
          </button>
        </div>
        {actionMsg && (
          <p className={`text-sm mt-3 ${actionMsg.isError ? "text-red-600" : "text-green-700"}`}>{actionMsg.text}</p>
        )}
        <p className="text-xs text-gray-400 mt-3">
          As mensagens usam os modelos configurados em Definições → Mensagens, no idioma escolhido acima.
        </p>

        {log.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-medium mb-2">Histórico de envios</p>
            <ul className="text-sm text-gray-600 space-y-1">
              {log.map((l, i) => (
                <li key={i}>
                  {new Date(l.sent_at).toLocaleString("pt-PT")} — {MESSAGE_TYPE_LABEL[l.type] ?? l.type} por{" "}
                  {l.channel === "email" ? "email" : "WhatsApp"} ({l.language.toUpperCase()})
                  {l.automated ? " · automático" : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {guests.length > 0 && (
        <section className="border rounded-lg p-5">
          <h2 className="font-medium mb-3">Hóspedes registados (SIBA)</h2>
          <ul className="text-sm text-gray-700 space-y-1">
            {guests.map((g) => (
              <li key={g.id}>
                {g.full_name} — {g.nationality || "—"} — {g.document_type || "—"} {g.document_number || ""}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
