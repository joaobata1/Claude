import { NextRequest, NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";
import { validateGuestsForSave, saveGuestsForBooking, getGuestsForBooking, GuestInput } from "@/lib/guests";
import { releaseAccessIfReady } from "@/lib/access-release";
import { isMachineAuthorized } from "@/lib/machine-auth";

export const maxDuration = 30;

/**
 * Só o backoffice pode ler estes dados: são dados pessoais dos hóspedes (nome completo,
 * número de documento, data de nascimento, nacionalidade). Antes bastava saber o id da
 * reserva para os obter sem qualquer autenticação.
 * O POST continua aberto porque é o próprio hóspede a preencher o formulário, e o id da
 * reserva funciona aí como a sua credencial.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  if (!(await isMachineAuthorized(req))) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const { bookingId } = await params;
  const guests = await getGuestsForBooking(bookingId);
  return NextResponse.json({ guests });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  await ensureSchema();
  const [booking] = await sql`SELECT * FROM bookings WHERE id = ${bookingId}`;
  if (!booking) {
    return NextResponse.json({ error: "Reserva não encontrada." }, { status: 404 });
  }

  const body = await req.json();
  const guests: GuestInput[] = body.guests ?? [];

  const error = validateGuestsForSave(guests);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  const savedCount = await saveGuestsForBooking(bookingId, guests);

  // Se o pagamento já estava confirmado e só faltavam os dados dos hóspedes, liberta agora.
  const release = await releaseAccessIfReady(bookingId);

  return NextResponse.json({ ok: true, savedCount, release });
}
