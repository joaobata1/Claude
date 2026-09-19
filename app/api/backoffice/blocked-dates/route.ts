import { NextResponse } from "next/server";
import { getBlockedDatesBySource } from "@/lib/availability";

export const maxDuration = 30;

export async function GET() {
  const blocked = await getBlockedDatesBySource();
  return NextResponse.json({ blocked });
}
