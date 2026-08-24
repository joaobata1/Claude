import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, SESSION_MAX_AGE_SECONDS, createSessionToken, timingSafeEqual } from "@/lib/auth";

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

  if (!password || !timingSafeEqual(password, expected)) {
    return NextResponse.json({ error: "Palavra-passe incorreta." }, { status: 401 });
  }

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
