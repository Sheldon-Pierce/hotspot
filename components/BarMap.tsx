"use client";

import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { BarStatus } from "@/lib/types";
import { LEVEL_META } from "@/lib/ui";

const BALLARD_CENTER: [number, number] = [47.6669, -122.3855];

interface BarMapProps {
  bars: BarStatus[];
  onSelect: (barId: string) => void;
}

function markerRadius(status: BarStatus): number {
  if (!status.open) return 6;
  return 9 + status.ratio * 16;
}

export default function BarMap({ bars, onSelect }: BarMapProps) {
  return (
    <div className="relative h-[calc(100dvh-66px)]">
      <MapContainer
        center={BALLARD_CENTER}
        zoom={16}
        className="h-full w-full"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        {bars.map((status) => {
          const color = LEVEL_META[status.level].color;
          return (
            <CircleMarker
              key={status.bar.id}
              center={[status.bar.lat, status.bar.lng]}
              radius={markerRadius(status)}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: status.open ? 0.7 : 0.25,
                weight: 2,
                className: "hotspot-marker",
              }}
              eventHandlers={{ click: () => onSelect(status.bar.id) }}
            >
              <Tooltip direction="top" offset={[0, -6]}>
                <div className="text-center">
                  <div className="font-semibold">{status.bar.name}</div>
                  <div>
                    {status.open
                      ? `${status.count} people · ${LEVEL_META[status.level].label}`
                      : "Closed"}
                  </div>
                  {status.deals.some((d) => d.type === "incentive") && (
                    <div>🎁 {status.deals[0].title}</div>
                  )}
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>

      <div className="glass-strong absolute bottom-4 left-4 z-[1000] rounded-[var(--r-control)] px-3 py-2 text-xs text-zinc-300">
        {(["quiet", "warming", "buzzing", "packed"] as const).map((level) => (
          <div key={level} className="flex items-center gap-2 py-0.5">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: LEVEL_META[level].color }}
            />
            {LEVEL_META[level].label}
          </div>
        ))}
        <div className="mt-1 border-t border-[var(--hair)] pt-1 text-[var(--muted)]">
          🎁 = deal active
        </div>
      </div>
    </div>
  );
}
