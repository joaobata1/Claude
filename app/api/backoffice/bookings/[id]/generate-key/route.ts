import { NextRequest, NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";
import { createNukiAccessCode } from "@/lib/nuki";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureSchema();
  const [booking] = await sql`SELECT * FROM bookings WHERE id = ${id}`;
  if (!booking) {
    return NextResponse.json({ error: "Reserva não encontrada." }, { status: 404 });
  }

  try {
    const pin = await createNukiAccessCode({
      bookingId: booking.id,
      guestName: booking.guest_name,
      checkinDate: booking.checkin,
      checkoutDate: booking.checkout,
    });
    return NextResponse.json({ ok: true, code: pin });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao gerar o código Nuki.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
