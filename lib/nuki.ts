import { getSetting, sql, ensureSchema } from "./db";

/**
 * Nuki Web API: https://developer.nuki.io/
 * Cria um código de teclado (keypad code) válido apenas durante a estadia.
 * Token e Smart Lock ID são geridos no backoffice.
 */

function randomPin(): string {
  // Código numérico de 6 dígitos (Nuki Keypad aceita 6 dígitos)
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function createNukiAccessCode(params: {
  bookingId: string;
  guestName: string;
  checkinDate: string; // YYYY-MM-DD
  checkoutDate: string; // YYYY-MM-DD
  checkinHour?: number; // default 16h
  checkoutHour?: number; // default 12h
}) {
  const apiToken = await getSetting("nuki_api_token");
  const smartlockId = await getSetting("nuki_smartlock_id");
  if (!apiToken || !smartlockId) {
    throw new Error("Token Nuki ou Smart Lock ID não configurados no backoffice.");
  }

  const pin = randomPin();
  const checkinHour = params.checkinHour ?? Number((await getSetting("nuki_checkin_hour")) || 16);
  const checkoutHour = params.checkoutHour ?? Number((await getSetting("nuki_checkout_hour")) || 12);
  const allowedFrom = new Date(`${params.checkinDate}T${String(checkinHour).padStart(2, "0")}:00:00`);
  const allowedUntil = new Date(`${params.checkoutDate}T${String(checkoutHour).padStart(2, "0")}:00:00`);

  const res = await fetch(`https://api.nuki.io/smartlock/${smartlockId}/auth`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: `Reserva ${params.guestName} (${params.bookingId})`,
      type: 13, // keypad code
      code: pin,
      allowedFromDate: allowedFrom.toISOString(),
      allowedUntilDate: allowedUntil.toISOString(),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Falha ao criar código Nuki: ${text}`);
  }

  // Guarda o código na reserva
  await ensureSchema();
  await sql`UPDATE bookings SET nuki_code = ${pin} WHERE id = ${params.bookingId}`;

  return pin;
}
