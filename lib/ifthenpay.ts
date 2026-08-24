import { getSetting } from "./db";

/**
 * Documentação oficial: https://ifthenpay.com/docs/
 * MB WAY: POST para gerar pedido de pagamento (o cliente recebe notificação na app)
 * Cartão: usa o gateway/Pagamento SIBS ou "Payment Link" da ifthenpay
 *
 * As chaves (mbway_key / gateway_key) são geridas no backoffice, nunca no código.
 */

export async function createMbwayRequest(params: {
  bookingId: string;
  amount: number;
  guestPhone: string; // formato 351#912345678
}) {
  const mbwayKey = getSetting("ifthenpay_mbway_key");
  if (!mbwayKey) throw new Error("Chave MB WAY não configurada no backoffice.");

  const res = await fetch("https://api.ifthenpay.com/spg/payment/mbway", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mbWayKey: mbwayKey,
      orderId: params.bookingId,
      amount: params.amount.toFixed(2),
      mobileNumber: params.guestPhone,
      email: "",
      description: `Reserva Aljezur - ${params.bookingId}`,
    }),
  });

  if (!res.ok) throw new Error("Falha ao criar pedido MB WAY");
  return res.json(); // devolve RequestId para consultar estado depois
}

export async function createCardPaymentLink(params: {
  bookingId: string;
  amount: number;
  guestName: string;
}) {
  const gatewayKey = getSetting("ifthenpay_gateway_key");
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
