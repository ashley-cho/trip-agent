/**
 * Two small answers about a trip that already exists.
 *
 * Both exist because the app said things that were not true about its own
 * output: it rebuilt an itinerary and reported that nothing had changed, and
 * it asked which day was wrong about an activity already booked on day three.
 * Neither is judgment. Both are arithmetic on the plan we are holding, so
 * they live here rather than in the page, and they are tested.
 */
import type { Trip } from "@/lib/types";

/**
 * Is she asking for something the trip already has?
 *
 * "i also really want to do dog sledding" was answered with "I'm not sure
 * what to change. Tell me which day, or which part is wrong" — on a trip
 * whose day three was Dog sledding on Great Slave Lake. Twice: ice fishing
 * got the same answer, and it is in the same booking. The editor was looking
 * for an operation to perform and never checked whether there was anything
 * left to do.
 *
 * Matching is on adjacent word pairs and on long single words, because "ice"
 * and "want" match everything and prove nothing.
 */
export function alreadyInTheTrip(trip: Trip, said: string): { name: string; day: number } | undefined {
  const stop = new Set(["want", "really", "also", "would", "like", "love", "trip",
    "there", "then", "that", "this", "with", "some", "into", "make", "have", "does",
    "day", "days", "night", "nights", "please", "could", "maybe", "much", "more"]);
  const words = said.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  const needles: string[] = [];
  for (let i = 0; i + 1 < words.length; i++) {
    if (words[i].length >= 3 && words[i + 1].length >= 3
      && !stop.has(words[i]) && !stop.has(words[i + 1])) needles.push(`${words[i]} ${words[i + 1]}`);
  }
  for (const w of words) if (w.length >= 7 && !stop.has(w)) needles.push(w);
  if (!needles.length) return undefined;
  for (let d = 0; d < trip.days.length; d++) {
    for (const item of trip.days[d].items) {
      const hay = `${item.name} ${item.reason}`.toLowerCase();
      if (needles.some((n) => hay.includes(n))) return { name: item.name, day: d + 1 };
    }
  }
  return undefined;
}

/**
 * What actually changed when the trip was rebuilt.
 *
 * `undefined` means nothing did, and then the editor's own words are the
 * honest ones. Anything else is a sentence naming what she got, because a
 * plan that quietly rearranged itself is indistinguishable from one that
 * ignored her.
 */
export function whatTheRebuildDid(before: Trip, after: Trip): string | undefined {
  const names = (t: Trip) => t.days.flatMap((d) => d.items.map((i) => i.name));
  const had = new Set(names(before).map((n) => n.toLowerCase()));
  const added = [...new Set(names(after).filter((n) => !had.has(n.toLowerCase())))];
  const beforeShape = before.days.map((d) => d.cityId ?? "").join(">");
  const afterShape = after.days.map((d) => d.cityId ?? "").join(">");
  if (!added.length && beforeShape === afterShape) return undefined;
  if (added.length) {
    const list = added.slice(0, 3).join(", ");
    const more = added.length > 3 ? `, and ${added.length - 3} more` : "";
    return `Rebuilt the days around that. ${list}${more} ${added.length === 1 ? "is" : "are"} in now.`;
  }
  return "Rebuilt the days around that — same places, different shape.";
}
