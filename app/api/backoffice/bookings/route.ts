import { NextResponse } from "next/server";
import { getBookingsOverview } from "@/lib/bookings-overview";

export async function GET() {
  const bookings = await getBookingsOverview();
  return NextResponse.json({ bookings });
}
