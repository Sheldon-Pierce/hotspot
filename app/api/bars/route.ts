import { NextRequest, NextResponse } from "next/server";
import { BARS } from "@/data/bars";
import { barStatus } from "@/lib/simulation";
import { resolvePreset } from "@/lib/presets";
import type { BarsResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/bars            — live status for every bar
 * GET /api/bars?preset=id  — status at a time-travel preset (demo mode)
 *
 * This is the read side of the occupancy pipeline. Today the numbers
 * come from the deterministic simulator; a real deployment would swap
 * in counts aggregated from CountEvent ingestion (see lib/types.ts).
 */
export function GET(request: NextRequest) {
  const presetId = request.nextUrl.searchParams.get("preset");
  const now = new Date();
  const at = presetId ? resolvePreset(presetId, now) ?? now : now;

  const body: BarsResponse = {
    generatedAt: at.toISOString(),
    bars: BARS.map((bar) => barStatus(bar, at)),
  };
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
  });
}
