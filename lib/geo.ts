/** Great-circle distance in km. */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Minutes to get between two points inside a city. Deliberately conservative:
 * the critic uses this to reject impossible schedules, so under-estimating
 * here would let bad itineraries through.
 */
export function travelMinutes(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const km = haversineKm(a, b);
  if (km < 0.25) return 5;
  if (km <= 1.2) return Math.round(km * 13) + 3;      // walking pace, with lights
  return Math.round(km * 4.5) + 9;                     // metro/tram + waiting
}

export function travelMode(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  return haversineKm(a, b) <= 1.2 ? "walk" : "transit";
}

// --- clock helpers ---------------------------------------------------------

export const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export const toClock = (min: number): string => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

export const prettyTime = (hhmm: string): string => {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hr} ${ampm}` : `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
};
