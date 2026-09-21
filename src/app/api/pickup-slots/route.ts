import { NextResponse } from "next/server";
import { getPickupSlotsForDay, getActiveZones } from "@/lib/catalog/queries";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const day = Number(searchParams.get("day") ?? "0");
  const zoneCode = searchParams.get("zoneCode");

  let zoneId: string | null = null;
  if (zoneCode) {
    const zones = await getActiveZones();
    zoneId = zones.find((z) => z.code === zoneCode)?.id ?? null;
  }

  const slots = await getPickupSlotsForDay(
    Number.isFinite(day) ? day : 0,
    zoneId,
  );

  return NextResponse.json({ slots });
}
