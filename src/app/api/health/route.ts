import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "ghasilak",
    phase: 1,
    currency: "OMR",
  });
}
