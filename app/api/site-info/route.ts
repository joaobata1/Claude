import { NextResponse } from "next/server";
import { getSetting } from "@/lib/db";

const DEFAULT_NAME = "Aljezur - Monte Clérigo";

/** Endpoint público (sem autenticação) — nome/logótipo para páginas client-side como /reservar. */
export async function GET() {
  const [name, logoUrl] = await Promise.all([getSetting("site_name"), getSetting("site_logo_url")]);
  return NextResponse.json({ name: name || DEFAULT_NAME, logoUrl: logoUrl || null });
}
