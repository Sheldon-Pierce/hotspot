"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Header from "@/components/Header";
import BarList from "@/components/BarList";
import BarDetail from "@/components/BarDetail";
import { useBars } from "@/lib/useBars";

// Leaflet touches `window`, so the map can only render client-side.
const BarMap = dynamic(() => import("@/components/BarMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100dvh-66px)] items-center justify-center text-zinc-500">
      Loading map…
    </div>
  ),
});

export default function Home() {
  const [view, setView] = useState<"list" | "map">("list");
  const [preset, setPreset] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, error } = useBars(preset);
  const selected = data?.bars.find((b) => b.bar.id === selectedId) ?? null;

  return (
    <div className="min-h-dvh">
      <Header
        view={view}
        onViewChange={setView}
        preset={preset}
        onPresetChange={setPreset}
      />

      {error && (
        <p className="mx-auto max-w-3xl px-4 py-3 text-sm text-red-400">
          Couldn&apos;t load bar data ({error}) — retrying…
        </p>
      )}

      {!data && !error && (
        <p className="mx-auto max-w-3xl px-4 py-10 text-center text-zinc-500">
          Checking the rooms…
        </p>
      )}

      {data &&
        (view === "list" ? (
          <BarList bars={data.bars} onSelect={setSelectedId} />
        ) : (
          <BarMap bars={data.bars} onSelect={setSelectedId} />
        ))}

      {selected && (
        <BarDetail status={selected} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
