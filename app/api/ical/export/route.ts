import { NextResponse } from "next/server";
import { generateOwnIcalFeed } from "@/lib/ical-sync";

export async function GET() {
  const feed = await generateOwnIcalFeed();
  return new NextResponse(feed, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "inline; filename=aljezur-reservas.ics",
    },
  });
}
