/**
 * One resolver for "is this somewhere we hold?"
 *
 * It lived inside the model driver, private, and the page needed the same
 * answer the moment the agent started suggesting destinations of its own:
 * a suggestion we already hold is planned instantly, one we don't is
 * researched. Two copies of this question is how the last few bugs happened,
 * so there is one.
 */
import { CITIES, DESTINATIONS } from "@/data/destinations";
import { NAMED_DESTINATIONS } from "@/lib/discovery";
import { key } from "@/lib/text";

/**
 * Fold to letters and digits so a name matches however she typed it.
 *
 * Comparing raw strings meant "new zealand" missed the id "newzealand", and
 * "reykjavik" missed the name "Reykjavík" over one accent. Both were then
 * filed as places we don't cover and queued for research, which is the
 * expensive way to be wrong about somewhere already in the catalogue.
 */
/*
 * This is `key` from lib/text.ts, and it always was: byte for byte the same
 * function also lived in lib/discovery.ts as `foldName`. Re-exported rather
 * than redefined, under the name the callers here already use, so the two
 * cannot drift apart again.
 */
export const fold = key;

export function resolvePlaceName(said: string): { destinationId: string; cityId?: string } | undefined {
  const want = fold(said);
  if (!want) return undefined;
  const same = (a: string) => fold(a) === want;
  const dest = DESTINATIONS.find((d) => same(d.name) || same(d.id));
  if (dest) return { destinationId: dest.id };
  // A city is where the data lives, but it is also the whole trip: someone who
  // says "oaxaca" has named their destination, not a starting point for a tour
  // of Mexico.
  const city = CITIES.find((c) => same(c.name) || same(c.id));
  if (city) return { destinationId: city.destinationId, cityId: city.id };
  /*
   * Last, the shared alias table. "Utah", "Zion" and "the PNW" are names for
   * destinations whose ids and titles say none of those things, and keeping a
   * second copy of that knowledge here is how the two layers drifted apart in
   * the first place.
   */
  for (const [re, id] of NAMED_DESTINATIONS) {
    re.lastIndex = 0;
    if (re.test(said.trim()) && DESTINATIONS.some((d) => d.id === id)) return { destinationId: id };
  }
  return undefined;
}
