"use client";

import { useEffect, useState } from "react";
import type { BarsResponse } from "@/lib/types";

const POLL_MS = 10_000;

/**
 * Polls /api/bars every 10 seconds. `preset` switches the whole app
 * into time-travel mode; null means live.
 */
export function useBars(preset: string | null) {
  const [data, setData] = useState<BarsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const url = preset ? `/api/bars?preset=${preset}` : "/api/bars";
        const res = await fetch(url);
        if (!res.ok) throw new Error(`API returned ${res.status}`);
        const body: BarsResponse = await res.json();
        if (!cancelled) {
          setData(body);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      }
    }

    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [preset]);

  return { data, error };
}
