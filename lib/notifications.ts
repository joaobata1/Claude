import { getSetting } from "./db";

/**
 * SMS via Vonage (https://developer.vonage.com/en/api/sms).
 * Email via Resend (https://resend.com/docs).
 * Todas as chaves são geridas no backoffice — nunca hardcoded.
 */

function buildMessage(params: {
  guestName: string;
  checkin: string;
  checkout: string;
  nukiCode: string;
}) {
  return (
    `Olá ${params.guestName}, bem-vindo(a) ao apartamento em Aljezur - Monte Clérigo.\n\n` +
    `Código de acesso à porta: ${params.nukiCode}\n` +
    `Check-in: a partir das 16h de ${params.checkin}\n` +
    `Check-out: até às 12h de ${params.checkout}\n\n` +
    `O código é válido apenas durante a estadia. Qualquer dúvida, responda a esta mensagem.`
  );
}

export async function sendNukiCodeBySms(params: {
  guestPhone: string; // formato E.164, ex: 351912345678
  guestName: string;
  checkin: string;
  checkout: string;
  nukiCode: string;
}) {
  const apiKey = await getSetting("vonage_api_key");
  const apiSecret = await getSetting("vonage_api_secret");
  const senderId = (await getSetting("vonage_sender_id")) || "AljezurAL";

  if (!apiKey || !apiSecret) {
    console.warn("Vonage não configurado no backoffice — SMS não enviado.");
    return { sent: false, reason: "not_configured" };
  }

  const text = buildMessage(params);

  const res = await fetch("https://rest.nexmo.com/sms/json", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      api_key: apiKey,
      api_secret: apiSecret,
      to: params.guestPhone.replace(/\D/g, ""),
      from: senderId,
      text,
    }),
  });

  const data = await res.json();
  const status = data?.messages?.[0]?.status;
  if (status !== "0") {
    console.error("Falha ao enviar SMS Vonage:", data);
    return { sent: false, reason: data?.messages?.[0]?.["error-text"] ?? "unknown" };
  }

  return { sent: true };
}

export async function sendNukiCodeByEmail(params: {
  guestEmail: string;
  guestName: string;
  checkin: string;
  checkout: string;
  nukiCode: string;
}) {
  const apiKey = await getSetting("resend_api_key");
  const fromEmail = (await getSetting("notification_from_email")) || "reservas@aljezurmonteclerigo.pt";

  if (!apiKey) {
    console.warn("Resend não configurado no backoffice — email não enviado.");
    return { sent: false, reason: "not_configured" };
  }
  if (!params.guestEmail) {
    return { sent: false, reason: "no_email" };
  }

  const text = buildMessage(params);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: params.guestEmail,
      subject: "As suas instruções de check-in — Aljezur Monte Clérigo",
      text,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Falha ao enviar email Resend:", errText);
    return { sent: false, reason: errText };
  }

  return { sent: true };
}

/** Chama SMS + email em paralelo; não falha se um dos dois canais não estiver configurado */
export async function sendNukiCodeToGuest(params: {
  guestName: string;
  guestPhone?: string | null;
  guestEmail?: string | null;
  checkin: string;
  checkout: string;
  nukiCode: string;
}) {
  const [smsResult, emailResult] = await Promise.all([
    params.guestPhone
      ? sendNukiCodeBySms({ ...params, guestPhone: params.guestPhone })
      : Promise.resolve({ sent: false, reason: "no_phone" }),
    params.guestEmail
      ? sendNukiCodeByEmail({ ...params, guestEmail: params.guestEmail })
      : Promise.resolve({ sent: false, reason: "no_email" }),
  ]);

  return { sms: smsResult, email: emailResult };
}
