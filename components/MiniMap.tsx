"use client";

import { useEffect, useRef, useState } from "react";
import type { ItineraryDay } from "@/lib/types";
import "leaflet/dist/leaflet.css";

/**
 * The day, on an actual map.
 *
 * This used to draw the stops on a blank panel, on the theory that the shape
 * of the movement was the only thing that mattered. It wasn't: two labelled
 * circles connected by a dotted line, with no streets under them, tell you
 * nothing about whether the walk between them is five minutes or an hour.
 * Real tiles, numbered in the order you do them, and a link that hands the
 * whole day to Google Maps for directions.
 */
function directionsLink(pts: { lat: number; lng: number }[]): string {
  const p = new URLSearchParams({ api: "1", travelmode: "walking" });
  p.set("origin", `${pts[0].lat},${pts[0].lng}`);
  p.set("destination", `${pts[pts.length - 1].lat},${pts[pts.length - 1].lng}`);
  const via = pts.slice(1, -1);
  if (via.length) p.set("waypoints", via.map((x) => `${x.lat},${x.lng}`).join("|"));
  return `https://www.google.com/maps/dir/?${p.toString()}`;
}

export function MiniMap({ day, height = 260 }: { day: ItineraryDay; height?: number }) {
  const el = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  const pts = day.items
    .filter((i) => i.lat != null && i.lng != null && i.type !== "transit")
    .map((i, n) => ({ id: i.id, name: i.name, lat: i.lat!, lng: i.lng!, n: n + 1 }));

  useEffect(() => {
    if (!el.current || pts.length === 0) return;
    let map: import("leaflet").Map | undefined;
    let cancelled = false;

    (async () => {
      try {
        const L = (await import("leaflet")).default;
        if (cancelled || !el.current) return;

        map = L.map(el.current, {
          scrollWheelZoom: false,
          zoomControl: pts.length > 1,
          attributionControl: true,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap",
        }).addTo(map);

        const latlngs = pts.map((p) => [p.lat, p.lng] as [number, number]);

        if (pts.length > 1) {
          L.polyline(latlngs, {
            color: "#8a5a3b", weight: 2, opacity: 0.65, dashArray: "6 6",
          }).addTo(map);
        }

        for (const p of pts) {
          L.marker([p.lat, p.lng], {
            icon: L.divIcon({
              className: "",
              html:
                `<div style="display:flex;align-items:center;justify-content:center;` +
                `width:26px;height:26px;border-radius:50%;background:#fffdfa;` +
                `border:1.6px solid #8a5a3b;color:#8a5a3b;font:600 12px/1 ui-sans-serif,system-ui;` +
                `box-shadow:0 1px 4px rgba(0,0,0,.22)">${p.n}</div>`,
              iconSize: [26, 26],
              iconAnchor: [13, 13],
            }),
          })
            .addTo(map)
            .bindPopup(`<strong>${p.n}. ${p.name.replace(/</g, "&lt;")}</strong>`);
        }

        if (pts.length > 1) {
          map.fitBounds(L.latLngBounds(latlngs).pad(0.18));
        } else {
          map.setView(latlngs[0], 15);
        }
        // The container is inside a section that was display:none until the
        // day was expanded, so Leaflet measured it at zero.
        setTimeout(() => map?.invalidateSize(), 60);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => { cancelled = true; map?.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day.index, pts.length]);

  if (pts.length === 0 || failed) return null;

  return (
    <div className="space-y-2">
      <div
        ref={el}
        style={{ height }}
        className="w-full overflow-hidden rounded-xl border border-paper-edge bg-paper-blank [&_.leaflet-control-attribution]:text-[10px]"
        role="img"
        aria-label={`Map of day ${day.index}`}
      />
      {pts.length > 1 && (
        <a
          href={directionsLink(pts)}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-block text-[0.84rem] text-ink-faint underline-offset-2 transition hover:text-accent hover:underline"
        >
          Walking directions for the whole day &#8599;
        </a>
      )}
    </div>
  );
}
