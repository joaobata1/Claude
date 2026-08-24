// Autenticação simples do /backoffice: uma única palavra-passe de administrador
// (BACKOFFICE_PASSWORD, definida como variável de ambiente) protege todas as
// páginas e rotas de API do backoffice. A sessão é um cookie assinado (HMAC),
// para não depender da base de dados nem de bibliotecas externas.

export const COOKIE_NAME = "backoffice_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 dias

function getSecret(): string | null {
  return process.env.BACKOFFICE_SESSION_SECRET || process.env.BACKOFFICE_PASSWORD || null;
}

function bytesToBase64Url(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes);
  let str = "";
  for (const b of arr) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return bytesToBase64Url(sig);
}

/** Comparação em tempo constante (evita timing attacks na verificação da palavra-passe). */
export function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  if (bufA.length !== bufB.length) return false;
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) diff |= bufA[i] ^ bufB[i];
  return diff === 0;
}

/** Cria um token de sessão assinado, válido por SESSION_MAX_AGE_SECONDS. */
export async function createSessionToken(): Promise<string> {
  const secret = getSecret();
  if (!secret) throw new Error("BACKOFFICE_PASSWORD não está configurada.");
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
  const payload = String(expiresAt);
  const signature = await hmac(payload, secret);
  return `${payload}.${signature}`;
}

/** Verifica um token de sessão. Devolve false se ausente, inválido, expirado, ou sem segredo configurado. */
export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  const secret = getSecret();
  if (!secret || !token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) return false;
  const expectedSignature = await hmac(payload, secret);
  return timingSafeEqual(signature, expectedSignature);
}
