import { NextRequest, NextResponse } from "next/server";
import { parseBookingScreenshot } from "@/lib/ai-vision";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { imageBase64, mediaType } = await req.json();
  if (!imageBase64 || !mediaType) {
    return NextResponse.json({ error: "Imagem em falta." }, { status: 400 });
  }

  try {
    const parsed = await parseBookingScreenshot(imageBase64, mediaType);
    return NextResponse.json(parsed);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
