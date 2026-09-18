import { NextRequest, NextResponse } from "next/server";
import {
  MESSAGE_TYPES,
  MESSAGE_LANGUAGES,
  getTemplate,
  saveTemplate,
  MessageTemplate,
  MessageType,
  MessageLanguage,
} from "@/lib/message-templates";

export async function GET() {
  const templates: MessageTemplate[] = [];
  for (const { id: type } of MESSAGE_TYPES) {
    for (const { id: language } of MESSAGE_LANGUAGES) {
      templates.push(await getTemplate(type, language));
    }
  }
  return NextResponse.json({ templates });
}

const VALID_TYPES: MessageType[] = MESSAGE_TYPES.map((t) => t.id);
const VALID_LANGUAGES: MessageLanguage[] = MESSAGE_LANGUAGES.map((l) => l.id);

export async function POST(req: NextRequest) {
  const { templates } = await req.json();
  if (!Array.isArray(templates)) {
    return NextResponse.json({ error: "Formato inválido." }, { status: 400 });
  }

  for (const t of templates) {
    if (!VALID_TYPES.includes(t.type) || !VALID_LANGUAGES.includes(t.language)) {
      return NextResponse.json({ error: `Tipo ou idioma inválido: ${t.type}/${t.language}` }, { status: 400 });
    }
    await saveTemplate({
      type: t.type,
      language: t.language,
      subject: String(t.subject ?? ""),
      body: String(t.body ?? ""),
    });
  }

  return NextResponse.json({ ok: true });
}
