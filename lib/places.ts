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

/**
 * Two modes, and they were not the same function.
 *
 * The name and id checks below are equality: fold(name) === fold(said). The
 * alias check is a regex SEARCH, so it matches anywhere in the string, and
 * "japan for 10 days" resolved to Japan whole. That is right for a caller
 * scanning a sentence for a place, and wrong for a caller asking "is this
 * string, exactly, a place we hold" - which reads the whole message as a name
 * and silently swallows whatever else was in it.
 *
 * `exact` anchors the alias test so the match has to consume the entire
 * string. The knowledge stays in one table; only the strictness moves.
 */
export function resolvePlaceName(
  said: string, opts: { exact?: boolean } = {},
): { destinationId: string; cityId?: string } | undefined {
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
   * The names the pack brought with it.
   *
   * Checked as whole strings, like the two above and unlike the table below,
   * because an alias is a name and not a pattern. That is what keeps
   * "himalayas" resolving to Nepal without "the himalayan foothills of
   * somewhere else" resolving to it too.
   */
  const byAlias = DESTINATIONS.find((d) => (d.aliases ?? []).some(same));
  if (byAlias) return { destinationId: byAlias.id };
  /*
   * Last, the shared alias table. "Utah", "Zion" and "the PNW" are names for
   * destinations whose ids and titles say none of those things, and keeping a
   * second copy of that knowledge here is how the two layers drifted apart in
   * the first place.
   */
  const trimmed = said.trim();
  for (const [re, id] of NAMED_DESTINATIONS) {
    re.lastIndex = 0;
    if (!DESTINATIONS.some((d) => d.id === id)) continue;
    if (!opts.exact) {
      if (re.test(trimmed)) return { destinationId: id };
      continue;
    }
    // The whole string, or it is not a name, it is a sentence with a name in it.
    re.lastIndex = 0;
    const m = re.exec(trimmed);
    if (m && m[0].length === trimmed.length) return { destinationId: id };
  }
  return undefined;
}
