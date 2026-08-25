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
  source: "airbnb" | "booking" | "vrbo" | "other" | null;
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
  "source": "airbnb" | "booking" | "vrbo" | "other" ou null,
  "totalPrice": number (preço total pago pelo hóspede, sem símbolo de moeda) ou null,
  "commissionAmount": number (comissão/taxa de serviço cobrada pela plataforma, valor absoluto em €) ou null,
  "cleaningFee": number (taxa de limpeza, se visível) ou null,
  "bookingReference": string (número/código da reserva) ou null,
  "guestEmail": string ou null,
  "guestPhone": string ou null
}

Datas sempre no formato YYYY-MM-DD. Se um valor não estiver visível na imagem, usa null — nunca inventes valores.`;

function extractJson(text: string): any {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
  return JSON.parse(cleaned);
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
