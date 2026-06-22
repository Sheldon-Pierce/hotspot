import { BARS } from "@/data/bars";

const BAR_IDS = new Set(BARS.map((b) => b.id));

export function isValidBarId(id: string): boolean {
  return BAR_IDS.has(id);
}

export function barName(id: string): string | null {
  return BARS.find((b) => b.id === id)?.name ?? null;
}
