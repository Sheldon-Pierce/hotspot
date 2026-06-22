"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { toggleFavorite } from "@/app/actions/favorites";

function flip(set: Set<string>, barId: string): Set<string> {
  const next = new Set(set);
  if (next.has(barId)) next.delete(barId);
  else next.add(barId);
  return next;
}

export function useFavorites() {
  const { data: session } = useSession();
  const router = useRouter();
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const isLoggedIn = !!session?.user;

  useEffect(() => {
    if (!isLoggedIn) {
      setFavorites(new Set());
      return;
    }
    let cancelled = false;
    fetch("/api/favorites")
      .then((r) => r.json())
      .then((b: { favorites: string[] }) => {
        if (!cancelled) setFavorites(new Set(b.favorites));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  const toggle = useCallback(
    async (barId: string) => {
      if (!isLoggedIn) {
        router.push("/login");
        return;
      }
      setFavorites((prev) => flip(prev, barId)); // optimistic
      try {
        await toggleFavorite(barId);
      } catch {
        setFavorites((prev) => flip(prev, barId)); // revert on error
      }
    },
    [isLoggedIn, router],
  );

  return { favorites, toggle, isLoggedIn };
}
