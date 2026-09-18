import { getSetting } from "./db";

/**
 * Documentação oficial: https://ifthenpay.com/docs/
 * MB WAY: POST para gerar pedido de pagamento (o cliente recebe notificação na app)
 * Cartão: usa o gateway/Pagamento SIBS ou "Payment Link" da ifthenpay
 *
 * As chaves (mbway_key / gateway_key) são geridas no backoffice, nunca no código.
 */

/**
 * A API MB WAY da ifthenpay espera o número separado do indicativo por "#" (ex:
 * "351#912345678"), mas o formulário de reserva recolhe o número em bloco (ex:
 * "351912345678"). MB WAY só funciona com números portugueses, por isso assume-se
 * sempre o indicativo 351.
 */
function toMbwayMobileFormat(phone: string): string {
  if (phone.includes("#")) return phone;
  const digits = phone.replace(/\D/g, "");
  const withoutCountryCode = digits.startsWith("351") ? digits.slice(3) : digits;
  return `351#${withoutCountryCode}`;
}

export async function createMbwayRequest(params: {
  bookingId: string;
  amount: number;
  guestPhone: string; // qualquer formato com o número português (com ou sem indicativo/#)
}) {
  const mbwayKey = await getSetting("ifthenpay_mbway_key");
  if (!mbwayKey) throw new Error("Chave MB WAY não configurada no backoffice.");

  const res = await fetch("https://api.ifthenpay.com/spg/payment/mbway", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mbWayKey: mbwayKey,
      orderId: params.bookingId,
      amount: params.amount.toFixed(2),
      mobileNumber: toMbwayMobileFormat(params.guestPhone),
      email: "",
      description: `Reserva Aljezur - ${params.bookingId}`,
    }),
  });

  if (!res.ok) throw new Error("Falha ao criar pedido MB WAY");
  const data = await res.json();
  // A ifthenpay costuma devolver HTTP 200 mesmo quando o pedido falha a nível de
  // negócio (ex: chave errada, número inválido) — sem isto, a reserva seguia em frente
  // como se a notificação MB WAY tivesse sido enviada, quando na verdade não foi.
  if (data.Status && data.Status !== "000") {
    throw new Error(data.Message ?? `Pedido MB WAY recusado (estado ${data.Status}).`);
  }
  return data; // devolve RequestId para consultar estado depois
}

export async function createCardPaymentLink(params: {
  bookingId: string;
  amount: number;
  guestName: string;
}) {
  const gatewayKey = await getSetting("ifthenpay_gateway_key");
  if (!gatewayKey) throw new Error("Chave de gateway (cartão) não configurada no backoffice.");

  const res = await fetch("https://ifthenpay.com/api/gateway/paybylink/init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      gatewayKey,
      id: params.bookingId,
      amount: params.amount.toFixed(2),
      description: `Reserva Aljezur - ${params.guestName}`,
      lang: "pt",
    }),
  });

  if (!res.ok) throw new Error("Falha ao criar link de pagamento por cartão");
  return res.json(); // devolve URL de pagamento para redirecionar o cliente
}

/**
 * O ifthenpay chama este endpoint (configurado no backoffice deles) quando o
 * pagamento é confirmado. Ver /app/api/pay/callback/route.ts
 */
