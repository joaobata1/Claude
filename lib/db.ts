import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL não está configurada — defina a connection string do Postgres (ex: Supabase) nas variáveis de ambiente."
  );
}

// ssl "prefer": liga com TLS quando o servidor suporta (Supabase, produção em geral)
// sem exigir configuração extra para bases de dados locais de teste sem TLS.
// prepare:false: necessário para funcionar através do connection pooler do Supabase (pgbouncer).
export const sql = postgres(connectionString, { ssl: "prefer", prepare: false });

let schemaReady: Promise<void> | null = null;

/** Garante que as tabelas e colunas existem. Idempotente e memorizado — seguro chamar em cada pedido. */
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = initSchema().catch((err) => {
      // Falha transitória (ex: BD momentaneamente inacessível no arranque) não deve
      // bloquear todos os pedidos seguintes — permite nova tentativa no próximo.
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

async function initSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      guest_name TEXT NOT NULL,
      guest_email TEXT,
      guest_phone TEXT,
      checkin TEXT NOT NULL,
      checkout TEXT NOT NULL,
      guests_count INTEGER DEFAULT 1,
      price_total REAL,
      commission_amount REAL DEFAULT 0,
      cleaning_cost REAL DEFAULT 0,
      booking_reference TEXT,
      payment_status TEXT DEFAULT 'pending',
      payment_method TEXT,
      ifthenpay_request_id TEXT,
      nuki_code TEXT,
      nuki_code_sent INTEGER DEFAULT 0,
      siba_submitted INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `;

  await sql`
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
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS blocked_dates (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      date TEXT NOT NULL,
      UNIQUE (source, date)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS daily_prices (
      id TEXT PRIMARY KEY,
      channel TEXT NOT NULL,
      date TEXT NOT NULL,
      price REAL NOT NULL,
      UNIQUE (channel, date)
    )
  `;

  // Migração segura: adiciona colunas novas a bases de dados criadas antes desta versão
  await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS commission_amount REAL DEFAULT 0`;
  await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cleaning_cost REAL DEFAULT 0`;
  await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_reference TEXT`;
}

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
  // Conteúdo do site público
  "cover_photo_url", // foto de capa (Supabase Storage)
  "gallery_photo_urls", // JSON: string[] — fotos da galeria (Supabase Storage)
  "site_description", // descrição da casa, mostrada na página inicial
  "site_about", // texto "Sobre nós"
] as const;

export async function getSetting(key: string): Promise<string | null> {
  await ensureSchema();
  const rows = await sql<{ value: string }[]>`SELECT value FROM settings WHERE key = ${key}`;
  return rows[0]?.value ?? null;
}

/** Todas as definições guardadas, numa única query (ex: para preencher o formulário do backoffice). */
export async function getAllSettings(): Promise<Record<string, string>> {
  await ensureSchema();
  const rows = await sql<{ key: string; value: string }[]>`SELECT key, value FROM settings`;
  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;
  return map;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await ensureSchema();
  await sql`
    INSERT INTO settings (key, value) VALUES (${key}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = excluded.value
  `;
}
