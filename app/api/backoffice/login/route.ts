import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, SESSION_MAX_AGE_SECONDS, createSessionToken, timingSafeEqual } from "@/lib/auth";
import { clientIp, estadoDeTravagem, registarFalha, limparTentativas } from "@/lib/login-throttle";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password : "";

  const expected = process.env.BACKOFFICE_PASSWORD;
  if (!expected) {
    return NextResponse.json(
      { error: "BACKOFFICE_PASSWORD não está configurada no servidor." },
      { status: 503 }
    );
  }

  // Há uma só palavra-passe a proteger tudo: sem um limite de tentativas, podia ser
  // adivinhada por força bruta sem qualquer travão.
  const ip = clientIp(req);
  const travagem = await estadoDeTravagem(ip);
  if (travagem.bloqueado) {
    return NextResponse.json(
      {
        error: `Demasiadas tentativas falhadas. Aguarde ${travagem.minutosEmFalta} minuto(s) e tente novamente.`,
      },
      { status: 429 }
    );
  }

  if (!password || !timingSafeEqual(password, expected)) {
    await registarFalha(ip);
    return NextResponse.json({ error: "Palavra-passe incorreta." }, { status: 401 });
  }

  await limparTentativas(ip);

  const token = await createSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return res;
}
