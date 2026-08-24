import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth";

export const config = {
  matcher: ["/backoffice/:path*", "/api/backoffice/:path*"],
};

const PUBLIC_PATHS = new Set(["/backoffice/login", "/api/backoffice/login"]);

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  if (!process.env.BACKOFFICE_PASSWORD) {
    const message =
      "O backoffice está desativado: defina a variável de ambiente BACKOFFICE_PASSWORD no servidor para poder aceder.";
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    return new NextResponse(message, { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const authenticated = await verifySessionToken(token);

  if (authenticated) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sessão inválida ou expirada. Inicie sessão novamente." }, { status: 401 });
  }

  const loginUrl = new URL("/backoffice/login", req.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}
