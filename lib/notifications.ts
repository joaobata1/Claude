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

/**
 * Traduz os erros mais comuns do Resend para algo acionável.
 * Sem isto, o backoffice mostrava o JSON cru da API.
 */
function explainResendError(status: number, body: string): string {
  const lower = body.toLowerCase();
  if (status === 401 || status === 403 || lower.includes("api key")) {
    return "A chave do Resend é inválida (Definições → SMS & Email).";
  }
  if (lower.includes("domain is not verified") || lower.includes("not verified") || lower.includes("domain")) {
    return (
      "O domínio do email de envio ainda não está verificado no Resend. " +
      "No Resend: Domains → Add Domain → adicione os registos DNS que ele indicar no seu registador, " +
      "e espere que fique 'Verified'."
    );
  }
  if (lower.includes("from")) {
    return "O endereço de envio não é aceite pelo Resend. Use um endereço do domínio verificado.";
  }
  return `Falha no envio (${status}): ${body.slice(0, 200)}`;
}

/** Endereço de envio configurado no backoffice. Sem ele não se envia nada. */
async function getFromEmail(): Promise<string | null> {
  // Não há valor por omissão: um domínio escrito no código seria um domínio que não é
  // seu, e o Resend recusaria o envio com um erro difícil de perceber.
  return getSetting("notification_from_email");
}

/** Envio de email genérico (usado pelas mensagens de chaves/instruções/personalizadas) */
export async function sendGenericEmail(params: { to: string; subject: string; text: string }) {
  const apiKey = await getSetting("resend_api_key");
  const fromEmail = await getFromEmail();

  if (!apiKey) {
    return { sent: false, reason: "Chave do Resend não configurada (Definições → SMS & Email)." };
  }
  if (!fromEmail) {
    return { sent: false, reason: "Falta o email de envio (Definições → SMS & Email)." };
  }
  if (!params.to) {
    return { sent: false, reason: "no_email" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: params.to,
      subject: params.subject,
      text: params.text,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Falha ao enviar email Resend:", errText);
    return { sent: false, reason: explainResendError(res.status, errText) };
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
  const fromEmail = await getFromEmail();

  if (!apiKey) {
    console.warn("Resend não configurado no backoffice — email não enviado.");
    return { sent: false, reason: "not_configured" };
  }
  if (!fromEmail) {
    console.warn("Email de envio não configurado no backoffice — email não enviado.");
    return { sent: false, reason: "no_from_email" };
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
    return { sent: false, reason: explainResendError(res.status, errText) };
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
