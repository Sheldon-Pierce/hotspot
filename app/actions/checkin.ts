"use server";

import { requireSession } from "@/lib/dal";
import { recordCheckIn } from "@/lib/checkins/record";

export type { CheckInResult } from "@/lib/checkins/record";

export async function checkIn(barId: string) {
  const session = await requireSession();
  return recordCheckIn(session.user.id, barId, new Date());
}
