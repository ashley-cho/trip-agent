import type { PlaceContext } from "@/lib/agent/types";
import type { City, Destination } from "@/lib/types";

/**
 * The browser tells the server about a destination the server doesn't hold.
 *
 * That is convenient and it is also client-supplied text heading for a model
 * prompt on a deployment anyone can open. So it gets treated as input, not as
 * data we wrote: every field is retyped, every string is capped, and anything
 * missing or misshapen means no context at all rather than a half-built
 * object that crashes further in.
 *
 * Nothing here is written to shared state. It exists for the length of one
 * request and then it's gone.
 */

const str = (v: unknown, max: number): string =>
  typeof v === "string" ? v.slice(0, max) : "";

const num = (v: unknown, lo: number, hi: number, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};

export function safePlaceContext(raw: unknown): PlaceContext | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const d = o.destination as Record<string, unknown> | undefined;
  if (!d || typeof d !== "object") return undefined;

  const id = str(d.id, 60);
  const name = str(d.name, 80);
  if (!id || !name) return undefined;

  const because: Record<string, string> = {};
  if (d.because && typeof d.because === "object") {
    for (const [k, v] of Object.entries(d.because as Record<string, unknown>).slice(0, 8)) {
      const line = str(v, 400);
      if (line) because[str(k, 20)] = line;
    }
  }

  const destination = {
    id,
    name,
    pitch: str(d.pitch, 600),
    because,
    caveat: str(d.caveat, 600),
    hubCityId: str(d.hubCityId, 60),
    arrival: d.arrival === "drive" ? "drive" : "fly",
    warmth: num(d.warmth, 1, 5, 3),
    minDays: num(d.minDays, 1, 30, 5),
    flightUsd: num(d.flightUsd, 0, 20000, 0),
    floorPerDayUsd: num(d.floorPerDayUsd, 0, 5000, 100),
    strengths: d.strengths,
    paceFit: Array.isArray(d.paceFit) ? d.paceFit : [],
  } as unknown as Destination;

  const cities = (Array.isArray(o.cities) ? o.cities : [])
    .slice(0, 12)
    .map((c) => {
      const x = c as Record<string, unknown>;
      const cid = str(x.id, 60);
      const cname = str(x.name, 80);
      if (!cid || !cname) return null;
      return {
        id: cid,
        name: cname,
        destinationId: id,
        lat: num(x.lat, -90, 90, 0),
        lng: num(x.lng, -180, 180, 0),
        nightlyUsd: num(x.nightlyUsd, 0, 5000, 100),
        minNights: num(x.minNights, 0, 30, 1),
        maxNights: num(x.maxNights, 0, 30, 4),
        base: str(x.base, 400),
      } as unknown as City;
    })
    .filter((c): c is City => c !== null);

  if (!cities.length) return undefined;
  return { destination, cities };
}
