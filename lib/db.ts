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
// connect_timeout: sem isto, se a ligação ficar presa (ex: projeto Supabase inacessível),
// o pedido bloqueia indefinidamente em vez de falhar rapidamente com um erro claro — foi o
// que causou o site inteiro a ficar em branco/a carregar para sempre nalguns relatos.
export const sql = postgres(connectionString, { ssl: "prefer", prepare: false, connect_timeout: 10 });

let schemaReady: Promise<void> | null = null;

/**
 * Subir este número sempre que `initSchema()` mudar (nova tabela/coluna) — é isso que
 * faz a migração correr outra vez. Sem isto, a alteração nunca chegaria à base de dados.
 */
const SCHEMA_VERSION = "3";

/** Garante que as tabelas e colunas existem. Idempotente e memorizado — seguro chamar em cada pedido. */
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = migrateIfNeeded().catch((err) => {
      // Falha transitória (ex: BD momentaneamente inacessível no arranque) não deve
      // bloquear todos os pedidos seguintes — permite nova tentativa no próximo.
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

/**
 * Cada instância nova na Vercel (arranque a frio) chamava `initSchema()`, ou seja 17
 * instruções em série — 8 delas `ALTER TABLE`, que pegam num lock exclusivo da tabela.
 * Com vários pedidos em paralelo (o calendário faz-nos ao mesmo tempo) ficavam todos à
 * espera do mesmo lock, o que dava pedidos pendurados e o ecrã preso "A carregar...".
 * Agora o caminho normal é uma única consulta barata à versão do schema.
 */
async function migrateIfNeeded(): Promise<void> {
  try {
    const rows = await sql<{ value: string }[]>`SELECT value FROM settings WHERE key = 'schema_version'`;
    if (rows[0]?.value === SCHEMA_VERSION) return;
  } catch {
    // Tabela `settings` ainda não existe (base de dados vazia) — segue para a migração.
  }

  await initSchema();
  await sql`
    INSERT INTO settings (key, value) VALUES ('schema_version', ${SCHEMA_VERSION})
    ON CONFLICT (key) DO UPDATE SET value = excluded.value
  `;
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

  await sql`
    CREATE TABLE IF NOT EXISTS date_rate_plans (
      date TEXT PRIMARY KEY,
      rate_plan_id TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS message_templates (
      type TEXT NOT NULL,
      language TEXT NOT NULL,
      subject TEXT DEFAULT '',
      body TEXT DEFAULT '',
      PRIMARY KEY (type, language)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS message_log (
      id TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL REFERENCES bookings(id),
      type TEXT NOT NULL,
      channel TEXT NOT NULL,
      language TEXT NOT NULL,
      automated INTEGER DEFAULT 0,
      body TEXT DEFAULT '',
      sent_at TIMESTAMPTZ DEFAULT now()
    )
  `;
  await sql`ALTER TABLE message_log ADD COLUMN IF NOT EXISTS body TEXT DEFAULT ''`;

  // Migração segura: adiciona colunas novas a bases de dados criadas antes desta versão
  await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS commission_amount REAL DEFAULT 0`;
  await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cleaning_cost REAL DEFAULT 0`;
  await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_reference TEXT`;
  await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_number SERIAL`;
  await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS guest_language TEXT DEFAULT 'pt'`;
  await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS message_channel TEXT DEFAULT 'email'`;
  // Mudança de omissão: email é o único canal totalmente automático (grátis, via Resend);
  // WhatsApp fica para envio manual. Isto atualiza o valor por omissão para reservas
  // futuras — não altera reservas já existentes, que continuam com o que já tinham.
  await sql`ALTER TABLE bookings ALTER COLUMN message_channel SET DEFAULT 'email'`;
}

// Chaves de definições geridas no backoffice (nunca hardcoded no código)
export const SETTINGS_KEYS = [
  "ical_sources", // JSON: [{ id, label, url }] — lista dinâmica, tantos links quantos precisar
  "nuki_api_token",
  "nuki_smartlock_id",
  "nuki_checkin_hour", // hora de início da validade do código (0-23), ex: 16
  "nuki_checkout_hour", // hora de fim da validade do código (0-23), ex: 12
  "ifthenpay_mbway_key",
  "ifthenpay_gateway_key",
  "ifthenpay_anti_phishing_key", // chave que a ifthenpay envia no callback — sem ela o callback é recusado
  "bank_iban", // IBAN mostrado nas mensagens quando o hóspede escolhe pagar por transferência
  "bank_account_holder", // nome do titular da conta, mostrado junto ao IBAN
  "price_per_night",
  "cleaning_fee", // mantido por compatibilidade — ver fees_config para o sistema de taxas atual
  "fees_config", // JSON: [{ id, name, value, type: 'fixed'|'percent' }] — taxas somadas ao preço das noites
  "rate_plans", // JSON: [{ id, name, color, isDefault, cancellationDays, minNights, maxNights, weeklyDiscountPercent, monthlyDiscountPercent }]
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
  "site_name", // nome da casa/alojamento, mostrado no site e no separador do browser
  "site_logo_url", // logótipo (Supabase Storage)
  "favicon_url", // ícone do separador do browser (Supabase Storage)
  "al_registration_number", // nº de registo de Alojamento Local, obrigatório por lei mostrar no site
  "cover_photo_url", // foto de capa (Supabase Storage)
  "gallery_photo_urls", // JSON: string[] — fotos da galeria (Supabase Storage)
  "site_description", // descrição da casa em PT (compatibilidade com versões antigas, usada como fallback)
  "site_description_pt",
  "site_description_en",
  "site_description_de",
  "site_about", // texto "Sobre nós" em PT (compatibilidade com versões antigas, usada como fallback)
  "site_about_pt",
  "site_about_en",
  "site_about_de",
  // Contactos — mostrados sempre, publicamente, na página inicial
  "contact_phone",
  "contact_email",
  "contact_address",
  // Mensagens automáticas (chaves/instruções/personalizadas)
  "automation_rules", // JSON: [{ id, type, daysOffset, relativeTo: 'checkin'|'checkout', enabled }]
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
