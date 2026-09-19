import { NextRequest, NextResponse } from "next/server";
import { uploadPhoto, deletePhoto } from "@/lib/storage";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const { imageBase64, mediaType, fileName } = await req.json();
  if (!imageBase64 || !mediaType) {
    return NextResponse.json({ error: "Imagem em falta." }, { status: 400 });
  }
  try {
    const url = await uploadPhoto(imageBase64, mediaType, fileName ?? "foto.jpg");
    return NextResponse.json({ url });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { url } = await req.json();
  if (!url) {
    return NextResponse.json({ error: "URL em falta." }, { status: 400 });
  }
  try {
    await deletePhoto(url);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
