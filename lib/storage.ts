import { createClient } from "@supabase/supabase-js";

/**
 * Fotos do site (capa + galeria) ficam no Supabase Storage, num bucket público chamado
 * "fotos" — é preciso criá-lo manualmente no dashboard do Supabase (Storage → New bucket →
 * marcar "Public bucket") antes de usar esta funcionalidade. Usa a chave de serviço
 * (service role), nunca exposta ao browser, porque este código corre só no servidor.
 */
const BUCKET = "fotos";

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY não estão configuradas no servidor — ver .env.example."
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function extensionFromName(name: string): string {
  const match = name.match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1].toLowerCase() : "jpg";
}

/** Envia uma foto (base64) para o Storage e devolve o URL público. */
export async function uploadPhoto(base64: string, mediaType: string, originalName: string): Promise<string> {
  const supabase = getClient();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensionFromName(originalName)}`;
  const bytes = Buffer.from(base64, "base64");

  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: mediaType,
    upsert: false,
  });
  if (error) {
    throw new Error(
      `Falha ao enviar a foto: ${error.message}. Confirme que existe um bucket público chamado "fotos" no Supabase Storage.`
    );
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Remove uma foto do Storage a partir do seu URL público. Ignora URLs que não sejam deste bucket. */
export async function deletePhoto(publicUrl: string): Promise<void> {
  const marker = `/object/public/${BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return;
  const path = publicUrl.slice(idx + marker.length);
  const supabase = getClient();
  await supabase.storage.from(BUCKET).remove([path]);
}
