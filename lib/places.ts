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
/**
 * Other names for a bed we hold. "aix en provence" is Provence; it was
 * refused, because "provence" matched and "aix en" did not, and the app
 * said it needed a model for a place it holds.
 */
const CITY_ALIASES: Record<string, string[]> = {
  provence: ["aix", "aix en provence", "aix-en-provence", "avignon", "arles", "the luberon", "luberon"],
  kyoto: ["kansai"],
  seoul: ["gangnam", "hongdae"],
  busan: ["haeundae"],
  lisbon: ["lisboa"],
  florence: ["firenze", "tuscany", "toscana"],
  rome: ["roma"],
  hanoi: ["ha noi"],
  hoian: ["hoi-an"],
};

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
  // A pack names a bed by its area ("Hallstatt and the Salzkammergut",
  // "Kochi: Fort Kochi and Mattancherry"); she types the town. The head of
  // the name, before the "and", the colon or the comma, is the town.
  const head = (n: string) => n.split(/\s*(?::|,|\band\b)\s*/)[0];
  const city = CITIES.find((c) => same(c.name) || same(c.id))
    ?? CITIES.find((c) => (CITY_ALIASES[c.id] ?? []).some(same))
    ?? CITIES.find((c) => head(c.name).length >= 4 && same(head(c.name)));
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
  /*
   * A near miss on a long name is the name. "kazakstan" was read as an
   * activity and "rio de jainero" as a place called "de jainero"; both are
   * one slip from something we hold. One edit (a transposition counts as
   * one) for names of seven letters or more, two from twelve, and only
   * against whole names: short words and sentences never get this.
   */
  if (opts.exact && want.length >= 7 && !/\d/.test(said)) {
    const allow = want.length >= 12 ? 2 : 1;
    const words = said.trim().split(/\s+/).length;
    // The first three letters have to agree ("northern spain" is two edits
    // from "southern spain" and is not a typo for it), the word count too
    // ("iceland 5" folds to one edit from "iceland" and is a name plus a
    // number, not a slip), and nothing with a digit in it is a misspelling.
    const near = (n: string) => fold(n).length >= 7 && n.trim().split(/\s+/).length === words
      && fold(n).slice(0, 3) === want.slice(0, 3) && damerau(want, fold(n)) <= allow;
    for (const d of DESTINATIONS) {
      if ([d.name, d.id, ...(d.aliases ?? [])].some(near)) return { destinationId: d.id };
    }
    for (const c of CITIES) {
      if ([c.name, ...(CITY_ALIASES[c.id] ?? [])].some(near)) return { destinationId: c.destinationId, cityId: c.id };
    }
  }
  return undefined;
}

/** Optimal string alignment distance, capped early: we only ever ask "is it under 3". */
function damerau(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const d: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) d[i][0] = i;
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}
