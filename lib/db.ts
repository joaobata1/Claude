import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "data", "booking.db");

// Garante que a pasta 'data' existe
import fs from "fs";
const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,              -- 'site' | 'airbnb' | 'booking' | 'vrbo'
  guest_name TEXT NOT NULL,
  guest_email TEXT,
  guest_phone TEXT,
  checkin TEXT NOT NULL,             -- YYYY-MM-DD
  checkout TEXT NOT NULL,            -- YYYY-MM-DD
  guests_count INTEGER DEFAULT 1,
  price_total REAL,
  commission_amount REAL DEFAULT 0,  -- comissão/taxas cobradas pelo canal (valor absoluto em €)
  cleaning_cost REAL DEFAULT 0,      -- custo real da limpeza para esta estadia
  booking_reference TEXT,            -- nº de reserva na plataforma de origem (se aplicável)
  payment_status TEXT DEFAULT 'pending', -- pending | paid | failed | not_applicable
  payment_method TEXT,               -- mbway | card | null (manual/OTA)
  ifthenpay_request_id TEXT,
  nuki_code TEXT,
  nuki_code_sent INTEGER DEFAULT 0,
  siba_submitted INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS guests (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  full_name TEXT NOT NULL,
  nationality TEXT,
  document_type TEXT,
  document_number TEXT,
  document_issuing_country TEXT,
  residence_country TEXT,
  birth_date TEXT,
  is_lead_guest INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS blocked_dates (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,              -- id do link iCal (ver definição ical_sources) que originou este bloqueio
  date TEXT NOT NULL,                -- YYYY-MM-DD, uma linha por noite bloqueada
  UNIQUE(source, date)
);
CREATE TABLE IF NOT EXISTS daily_prices (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL,             -- 'site' ou o id de um link iCal (ical_sources)
  date TEXT NOT NULL,                -- YYYY-MM-DD
  price REAL NOT NULL,               -- preço bruto visto nesse canal (ou o preço do site)
  UNIQUE(channel, date)
);
`);

// Migração segura: adiciona colunas novas a bases de dados criadas antes desta versão
function ensureColumn(table: string, column: string, definition: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
ensureColumn("bookings", "commission_amount", "REAL DEFAULT 0");
ensureColumn("bookings", "cleaning_cost", "REAL DEFAULT 0");
ensureColumn("bookings", "booking_reference", "TEXT");

// Chaves de definições geridas no backoffice (nunca hardcoded no código)
export const SETTINGS_KEYS = [
  "ical_sources", // JSON: [{ id, label, url }] — lista dinâmica, tantos links quantos precisar
  "nuki_api_token",
  "nuki_smartlock_id",
  "ifthenpay_mbway_key",
  "ifthenpay_gateway_key",
  "price_per_night",
  "cleaning_fee",
  "vonage_api_key",
  "vonage_api_secret",
  "vonage_sender_id",
  "resend_api_key",
  "notification_from_email",
  "cleaning_contact_phone", // WhatsApp da senhora da limpeza (formato E.164, ex: 351912345678)
  // SIBA - dados da unidade hoteleira (fornecidos pela AIMA no ofício de ativação)
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
  // Regras de negócio
  "require_guests_before_checkin", // "true" | "false"
  // Leitura automática de screenshots de reservas (Anthropic API)
  "ai_vision_api_key",
  "ai_vision_model", // ex: claude-sonnet-5 — consultar docs.claude.com para o modelo mais recente
] as const;

export function getSetting(key: string): string | null {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string) {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, value);
}
