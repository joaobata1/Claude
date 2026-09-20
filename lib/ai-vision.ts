import { getSetting } from "./db";

/**
 * Lê uma screenshot de uma reserva (Airbnb, Booking.com, etc.) e extrai os
 * dados relevantes usando um modelo Claude com visão, via API da Anthropic.
 *
 * Requer uma chave de API própria (console.anthropic.com), configurada no
 * backoffice — isto é uma chamada à API da Anthropic feita pelo SEU servidor,
 * distinta e independente do Claude usado para construir este projeto.
 */

export interface ParsedBookingScreenshot {
  guestName: string | null;
  checkin: string | null; // YYYY-MM-DD
  checkout: string | null; // YYYY-MM-DD
  guestsCount: number | null;
  source: "airbnb" | "booking" | "vrbo" | "outros" | null;
  totalPrice: number | null;
  commissionAmount: number | null;
  cleaningFee: number | null;
  bookingReference: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
}

const EXTRACTION_PROMPT = `Esta imagem é uma screenshot de uma reserva de alojamento local (de plataformas como Airbnb, Booking.com ou VRBO), ou do resumo de rendimentos dessa reserva.

Extrai os dados visíveis e responde APENAS com um objeto JSON válido, sem markdown, sem comentários, com exatamente estas chaves:

{
  "guestName": string ou null,
  "checkin": string "YYYY-MM-DD" ou null,
  "checkout": string "YYYY-MM-DD" ou null,
  "guestsCount": number (total de hóspedes, soma de adultos+crianças) ou null,
  "source": "airbnb" | "booking" | "vrbo" | "outros" ou null,
  "totalPrice": number (preço total pago pelo hóspede, sem símbolo de moeda) ou null,
  "commissionAmount": number (comissão/taxa de serviço cobrada pela plataforma, valor absoluto em €) ou null,
  "cleaningFee": number (taxa de limpeza, se visível) ou null,
  "bookingReference": string (número/código da reserva) ou null,
  "guestEmail": string ou null,
  "guestPhone": string ou null
}

Datas sempre no formato YYYY-MM-DD. Se um valor não estiver visível na imagem, usa null — nunca inventes valores.`;

/**
 * O mesmo, mas a partir do TEXTO de um email de reserva (Booking.com, Airbnb, VRBO).
 * Ler o email é mais fiável do que ler uma screenshot: não há erros de leitura de imagem,
 * e o email traz campos que muitas vezes não cabem no ecrã (nº de reserva, comissão, contactos).
 *
 * `emailType` existe para segurança: um email de cancelamento ou de alteração não pode ser
 * importado como se fosse uma reserva nova — quem chama decide o que fazer com essa informação.
 */
export interface ParsedBookingEmail extends ParsedBookingScreenshot {
  emailType: "nova_reserva" | "alteracao" | "cancelamento" | "outro" | null;
}

const EMAIL_EXTRACTION_PROMPT = `O texto seguinte é um email recebido de uma plataforma de reservas (Booking.com, Airbnb, VRBO ou semelhante) sobre uma reserva de alojamento local.

Extrai os dados e responde APENAS com um objeto JSON válido, sem markdown, sem comentários, com exatamente estas chaves:

{
  "emailType": "nova_reserva" | "alteracao" | "cancelamento" | "outro",
  "guestName": string ou null,
  "checkin": string "YYYY-MM-DD" ou null,
  "checkout": string "YYYY-MM-DD" ou null,
  "guestsCount": number (total de hóspedes, adultos+crianças) ou null,
  "source": "airbnb" | "booking" | "vrbo" | "outros" ou null,
  "totalPrice": number (valor total pago pelo hóspede, sem símbolo de moeda) ou null,
  "commissionAmount": number (comissão da plataforma em €) ou null,
  "cleaningFee": number (taxa de limpeza) ou null,
  "bookingReference": string (número/código da reserva) ou null,
  "guestEmail": string ou null,
  "guestPhone": string ou null
}

Regras importantes:
- Datas sempre "YYYY-MM-DD". Se o ano não estiver escrito, deduz o ano mais próximo no futuro.
- Se o email só indicar o valor que o anfitrião recebe (payout), põe esse valor em "totalPrice" e deixa "commissionAmount" a null. Não calcules nem estimes valores.
- A Airbnb não costuma incluir email nem telemóvel do hóspede: nesse caso usa null, não inventes.
- O email da Booking.com para o hóspede costuma terminar em "@guest.booking.com" — é válido, usa-o.
- Se um valor não estiver no texto, usa null. Nunca inventes dados.`;

function extractJson(text: string): any {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
  return JSON.parse(cleaned);
}

/** Limita o tamanho enviado à API: emails trazem muito rodapé e assinatura irrelevantes. */
const MAX_EMAIL_CHARS = 20000;

export async function parseBookingEmail(emailText: string): Promise<ParsedBookingEmail> {
  const apiKey = await getSetting("ai_vision_api_key");
  const model = (await getSetting("ai_vision_model")) || "claude-sonnet-5";

  if (!apiKey) {
    throw new Error("Chave da API de leitura não configurada no backoffice (Definições → IA).");
  }

  const text = emailText.slice(0, MAX_EMAIL_CHARS);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [{ role: "user", content: `${EMAIL_EXTRACTION_PROMPT}\n\n---\n${text}` }],
    }),
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error("A chave da API de IA é inválida ou expirou — verifique em Definições → IA.");
    }
    if (res.status === 429) {
      throw new Error("A API de IA está a recusar por excesso de pedidos. Tente daqui a um minuto.");
    }
    const errText = await res.text();
    throw new Error(`Falha na leitura do email (${res.status}): ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const textBlock = (data.content as { type: string; text?: string }[] | undefined)?.find(
    (b) => b.type === "text"
  );
  if (!textBlock?.text) throw new Error("Resposta da IA sem texto para analisar.");

  try {
    return extractJson(textBlock.text) as ParsedBookingEmail;
  } catch {
    throw new Error("Não foi possível interpretar os dados extraídos do email.");
  }
}

export async function parseBookingScreenshot(
  imageBase64: string,
  mediaType: string
): Promise<ParsedBookingScreenshot> {
  const apiKey = await getSetting("ai_vision_api_key");
  const model = (await getSetting("ai_vision_model")) || "claude-sonnet-5";

  if (!apiKey) {
    throw new Error("Chave da API de leitura de imagens não configurada no backoffice.");
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
            { type: "text", text: EXTRACTION_PROMPT },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Falha na leitura da imagem (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const textBlock = data.content?.find((b: any) => b.type === "text");
  if (!textBlock) throw new Error("Resposta da IA sem texto para analisar.");

  try {
    return extractJson(textBlock.text) as ParsedBookingScreenshot;
  } catch {
    throw new Error("Não foi possível interpretar os dados extraídos da imagem.");
  }
}
