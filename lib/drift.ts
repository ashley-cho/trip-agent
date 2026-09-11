/**
 * Drift: one question, asked of four surfaces.
 *
 * "I think we should catch when the agent is drifting away in its thoughts."
 *
 * There are four ways this product has been observed to drift — the plan moves
 * off the destination, the prose wanders off the plan, the conversation loses
 * its place, the status label describes something else — and the temptation is
 * four guards, in four files, with four wordings. That is how this codebase
 * got here: `namesOnly` guards the pitch and nothing guards the streamed
 * research paragraph; the pin in flow.ts guards the recommender and nothing
 * guards the label; `asksTheSameThing` was written to guard a rephrased
 * question and never called by anything at all.
 *
 * So it is one question, asked four times:
 *
 *     Is this surface still anchored to what SHE settled, and if it moved,
 *     did she move it?
 *
 * Everything below is built out of three primitives — the anchor (what she
 * settled), `foreignPlaces` (what a piece of text names instead), and
 * `sameQuestion` (whether two sentences ask the same thing). The four
 * detectors are four readings of those, not four implementations.
 *
 * Every function here is pure. The runtime calls them in lib/flow.ts; the
 * scorecard calls the SAME functions in evals/metrics.ts. That is deliberate:
 * a metric that reimplements its detector measures the reimplementation, which
 * is the failure this file's neighbours are covered in comments about.
 *
 * ---------------------------------------------------------------------------
 * WHAT HAPPENS WHEN ONE FIRES. Her rules, in her words:
 *
 *   "it must stay faithful to the user's input. that tops everything"
 *   "always ask ... it's better than spitting out nonsensical bs"
 *   "no degraded mode at all - just stop"
 *
 * The response is not the same for all four, because the four surfaces carry
 * different weight, and "just stop" applied to a spinner caption would be
 * theatre. The table, defended at each call site in lib/flow.ts:
 *
 *   subject  STOP.      She is about to be sent somewhere she never named.
 *                       There is no smaller honest move: pitching it with a
 *                       caveat is the bait-and-switch, and asking "did you
 *                       mean Paris?" about a place she never mentioned invents
 *                       the premise. Stop the turn, name both places, say
 *                       plainly it will not be substituted.
 *
 *   prose    STOP that subject, and take the paragraph back off the screen.
 *                       Wandering prose is not just bad copy: those same notes
 *                       are what the pack is built from, so a paragraph about
 *                       New Zealand becomes a New Zealand pack labelled Faroe
 *                       Islands. It joins the existing failed-research path,
 *                       which already stops and already refuses to substitute.
 *
 *   thread   DON'T ASK IT.  This is the one place "always ask" argues the
 *                       other way: the question is drifting precisely because
 *                       she has already answered it, so asking is what the
 *                       nonsense looks like here. Carry on with the answer she
 *                       already gave. Nothing is degraded — a question is
 *                       removed, not a capability.
 *
 *   label    WITHHOLD IT.   A label is the only one of the four that makes no
 *                       promise she can act on, and the work underneath it is
 *                       fine. Stopping a good research call because its
 *                       caption is wrong would cost her the trip to protect
 *                       her from a spinner. So the false caption is refused —
 *                       she gets the plain "Thinking" — and it is logged where
 *                       the person fixing it will look. Showing "Reading up on
 *                       Validate Pack…" is the harm; showing nothing is not.
 * ---------------------------------------------------------------------------
 */
import type { Brief } from "@/lib/types";
import type { Question, Turn } from "@/lib/agent/types";
import { CITIES, DESTINATIONS } from "@/data/destinations";
import { fold, resolvePlaceName } from "@/lib/places";

export type DriftKind = "subject" | "prose" | "thread" | "label";

export interface Drift {
  kind: DriftKind;
  /** One line, in her language, for the console and for the scorecard. */
  says: string;
  /** The specific thing that moved, so a report can be checked by hand. */
  evidence: string;
}

// ---------------------------------------------------------------------------
// Primitive one: what a piece of text names.
// ---------------------------------------------------------------------------

/**
 * Words that are in a destination's name but are not its name.
 *
 * Lifted verbatim from lib/agent/llm.ts, which is now a caller rather than a
 * second copy. The catalogue calls places "the Utah canyon country", "the
 * Olympic Peninsula", "New Zealand's South Island"; splitting those into
 * tokens and rejecting any prose containing one meant "the south of the
 * province", "gorge country" or "an island" read as naming a different
 * destination, and a good pitch was thrown away for rules prose.
 */
export const GENERIC_PLACE_WORDS = new Set([
  "coast", "coastal", "country", "countryside", "island", "islands",
  "north", "south", "east", "west", "northern", "southern", "eastern", "western",
  "canyon", "canyons", "peninsula", "region", "valley", "mountain", "mountains",
  "river", "lake", "lakes", "circle", "city", "cities", "area", "land", "park",
]);

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Every destination or city this prose names, other than the one it is about.
 *
 * Only distinctive parts of a name count: whole-word, four letters or more,
 * not a generic geography word, and not already part of the chosen
 * destination's own name. "Rome" still doesn't match "Romania"; "the south
 * coast" no longer matches New Zealand.
 *
 * The names are RETURNED rather than counted, because every one of the four
 * responses has to be able to say which place it saw. "Something looks wrong"
 * is not a sentence anybody can act on.
 */
/**
 * The separate places inside one catalogue name.
 *
 * Catalogue names are written for a reader, not a parser: "Barcelona & the
 * Costa Brava", "Golden Triangle: Delhi, Agra, Jaipur", "Alaska (Anchorage /
 * Seward / Denali)", "Norway: Oslo, Sognefjord & Bergen". Each of those is a
 * list, and each item in it is a real name a paragraph could name.
 *
 * Split on the punctuation that MAKES a list — and, ampersand, comma, slash,
 * a spaced dash — and nothing else. Never on a plain space: that is what let
 * "Glacier National Park" convict the word "glacier", and what left "long",
 * "blue", "hill", "salt" and "high" waiting to do the same from "Ha Long
 * Bay", "Sydney & Blue Mountains", "Texas Hill Country", "Uyuni Salt Flats"
 * and "High Tatras".
 *
 * A leading label ("Austria: Vienna...") is dropped from its first item
 * because the label is usually the whole name, already matched above, and
 * brackets are stripped so "Denali)" is still Denali.
 */
function listParts(name: string): string[] {
  /*
   * "New Zealand's South Island" is New Zealand's south island.
   *
   * The possessive is the one place where a plain space genuinely does
   * separate two names, and it says so grammatically rather than by luck: the
   * head owns the tail, so the head is a place. That was the single real catch
   * the old word-by-word split had, and it is worth keeping, because "you want
   * New Zealand" over a Faroes brief is the substitution this whole function
   * exists for.
   *
   * Recovered by the apostrophe, not by a list of names, so it keeps working
   * for whatever the catalogue is called next week.
   */
  const owner = name.match(/^(.+?)['\u2019]s\s+\S/);
  const heads = owner ? [owner[1]] : [];
  return heads.concat(name
    .replace(/[()\[\]]/g, " ")
    .split(/\s+and\s+|\s*[,&/+]\s*|\s+[-\u2013]\s+/i))
    .map((p) => p.toLowerCase()
      .replace(/^[^:]*:\s*/, "")
      .replace(/['\u2019]s\b/, "")
      .replace(/^the\s+/, "")
      .replace(/[^a-z\s'\u2019-]/g, "")
      .trim())
    .filter(Boolean);
}

export function foreignPlaces(
  chosen: string, prose: string, chosenId?: string,
  scope: "destinations" | "all" = "all",
): string[] {
  const hay = prose.toLowerCase();
  const mine = new Set(chosen.toLowerCase().split(/[^a-z]+/).filter(Boolean));
  const out: string[] = [];
  const add = (n: string) => { if (!out.includes(n)) out.push(n); };
  for (const d of DESTINATIONS) {
    if (d.name === chosen || d.id === chosenId) continue;
    /*
     * Whole words, not substrings.
     *
     * This was `hay.includes(whole)`, and the docstring above it claimed
     * "Rome still doesn't match Romania" — true of that pair by luck, and
     * false in general. "Japanese-era bathhouses" in Taiwan's own write-up
     * contains "japan", so Taiwan could not be pitched without reading as a
     * substitution for Japan. "Romania" contains "oman". "Indian Ocean"
     * contains "india". Every one of those is a correct sentence the guard
     * would refuse to let her see.
     *
     * A trailing possessive or plural still matches, because \b falls
     * between the name and the apostrophe: "New Zealand's South Island"
     * names New Zealand, and it should.
     */
    const whole = d.name.toLowerCase();
    if (whole.length >= 4 && new RegExp(`\\b${esc(whole)}\\b`).test(hay)) { add(d.name); continue; }
    /*
     * The id is a name too, and for four destinations it is the ONLY name a
     * traveller would use. The catalogue calls Denmark "Copenhagen" and France
     * "Paris and Provence", so "honestly, go to Denmark instead" over a
     * Portugal itinerary named nothing this loop could see.
     *
     * Not every id: this catalogue spells its regional ones as run-together
     * compass words — "southwest", "pacificnw", "centralcoast" — and matching
     * "southwest" would make "the southwest coast" evidence of a substitution,
     * which is the exact class GENERIC_PLACE_WORDS exists to prevent. So an id
     * counts only when it is one plain word that is not generic and does not
     * begin with a direction.
     */
    const id = d.id.toLowerCase();
    if (/^[a-z]{4,}$/.test(id) && !GENERIC_PLACE_WORDS.has(id) && !mine.has(id)
        && !/^(north|south|east|west|central|pacific|atlantic)/.test(id)
        && new RegExp(`\\b${id}\\b`).test(hay)) { add(d.name); continue; }
    /*
     * A name of several words is matched as a phrase, never word by word.
     *
     * This loop used to split on plain spaces, so any single distinctive-
     * looking word inside a destination's name could convict a paragraph on
     * its own. That is survivable while the catalogue is fifteen curated
     * names. It stops being survivable the moment the catalogue grows, and it
     * broke the same afternoon it did: seeding added "Glacier National Park",
     * and Patagonia's own hand-written pitch — "a glacier you can stand in
     * front of on the way in" — became, to this function, a write-up about
     * Montana. The trip was correct, the sentence was correct, and the guard
     * threw it away.
     *
     * "Ha Long Bay" was the same landmine sitting unexploded: "park" is in
     * the generic list, "long" is not, so any prose using the word long about
     * anywhere on earth was one step from being called a substitution.
     *
     * Adding "glacier" to GENERIC_PLACE_WORDS would fix today and leave
     * smoky, crater, rockies, joshua, grand, hill and every future name to be
     * discovered the same way — by a traveller. A word list is a note about
     * the last failure, not a rule.
     *
     * The rule the city half below has always used is the right one, and it
     * is one line: whole names only. The single exception is a name that is
     * literally a LIST of places — "Barcelona & the Costa Brava", "Klis and
     * Salona", "Paris and Provence" — where each item is genuinely its own
     * name. So split on list separators only, and match each piece whole.
     * A single-word country still matches through the id rule above.
     */
    for (const part of listParts(d.name)) {
      if (part === whole || part.length < 4) continue;
      const bare = part.replace(/[^a-z]/g, "");
      if (GENERIC_PLACE_WORDS.has(bare) || mine.has(bare)) continue;
      if (new RegExp(`\\b${esc(part)}\\b`).test(hay)) { add(d.name); break; }
    }
  }
  /*
   * Cities give it away as surely as countries do: "three nights in Kyoto,
   * then two in Tokyo" on a Yunnan plan names no country and is still the
   * wrong trip.
   *
   * `scope: "destinations"` turns that half off, and there is exactly one
   * caller: the streamed research write-up for somewhere the catalogue does
   * not hold. There, `chosenId` is undefined, so every city of every
   * destination reads as foreign — including the one she is flying through.
   * "Two flights a day from Copenhagen" is a true sentence about the Faroes,
   * and stopping her trip over it would be the guard doing the damage. The
   * substitution class this is defending against (a Faroes brief answered
   * with New Zealand) always names the country, so the country half is enough
   * there and the city half is kept for the paths that know their cities.
   */
  if (scope === "destinations") return out;
  // Cities give it away as surely as countries do: "three nights in Kyoto,
  // then two in Tokyo" on a Yunnan plan names no country and is still the
  // wrong trip. Whole city names only, never their parts, so "the Golden
  // Circle" can't make the word "golden" disqualifying.
  const ours = new Set(
    CITIES.filter((c) => c.destinationId === chosenId).map((c) => c.name.toLowerCase()),
  );
  for (const c of CITIES) {
    if (c.destinationId === chosenId) continue;
    const n = c.name.toLowerCase().replace(/^the\s+/, "");
    if (n.length < 4 || ours.has(c.name.toLowerCase()) || GENERIC_PLACE_WORDS.has(n)) continue;
    if (new RegExp(`\\b${esc(n)}\\b`).test(hay)) add(c.name);
  }
  return out;
}

/** True when the prose names no destination other than the one we planned. */
export const namesOnlyChosen = (chosen: string, prose: string, chosenId?: string): boolean =>
  foreignPlaces(chosen, prose, chosenId).length === 0;

/** How many times does this text name a place, counting its cities as itself? */
function countMentions(prose: string, name: string, id?: string): number {
  const hay = fold(prose);
  const needles = new Set<string>();
  const add = (s: string) => { const f = fold(s); if (f.length >= 4) needles.add(f); };
  add(name);
  for (const w of name.split(/[^A-Za-z]+/)) {
    const t = fold(w);
    if (t.length >= 5 && !GENERIC_PLACE_WORDS.has(t)) needles.add(t);
  }
  if (id) for (const c of CITIES) if (c.destinationId === id) add(c.name);
  /*
   * Merged spans, not raw hits. "The Faroe Islands" matches both "faroeislands"
   * and "faroe" at the same place, so counting hits scored one mention as two
   * and a paragraph that says New Zealand twice tied with one that says the
   * Faroes once. Overlapping matches are one mention.
   */
  const spans: [number, number][] = [];
  for (const needle of needles) {
    let i = hay.indexOf(needle);
    while (i !== -1) { spans.push([i, i + needle.length]); i = hay.indexOf(needle, i + 1); }
  }
  spans.sort((a, b) => a[0] - b[0]);
  let n = 0;
  let end = -1;
  for (const [a, b] of spans) if (a >= end) { n++; end = b; } else if (b > end) end = b;
  return n;
}

/** Does this text mention the thing it is supposed to be about, by any name? */
function mentions(prose: string, about: string, aboutId?: string): boolean {
  const hay = fold(prose);
  const names = [about, ...(aboutId ? [aboutId] : [])];
  const d = aboutId ? DESTINATIONS.find((x) => x.id === aboutId) : undefined;
  if (d) names.push(d.name);
  for (const n of names) {
    const f = fold(n);
    if (f.length >= 4 && hay.includes(f)) return true;
    // A multi-word name counts if any distinctive word of it is there:
    // "the faroe islands" is mentioned by "the Faroes" and by "Faroese".
    for (const w of n.split(/[^A-Za-z]+/)) {
      const t = fold(w);
      if (t.length >= 5 && !GENERIC_PLACE_WORDS.has(t) && hay.includes(t)) return true;
    }
  }
  // Its own cities count as mentioning it. A paragraph that is all Tórshavn
  // and Gjógv is unmistakably about the Faroes.
  if (aboutId) {
    for (const c of CITIES) {
      if (c.destinationId !== aboutId) continue;
      const f = fold(c.name);
      if (f.length >= 4 && hay.includes(f)) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Primitive two: the anchor. What she settled, and what she is allowed to have
// changed.
// ---------------------------------------------------------------------------

export interface Anchor {
  /** Destination ids she has settled on, by any route. */
  ids: string[];
  /** Her own words for them, for the sentence she reads. */
  words: string[];
  /** True when she has named nowhere at all: there is nothing to drift FROM. */
  open: boolean;
}

/**
 * What is this conversation about?
 *
 * Built from the brief rather than from a flag, for the reason lib/subject.ts
 * gives at length: every previous version of this question was answered by a
 * boolean that something else was supposed to have set correctly, and the
 * boolean was wrong. `statedPlaces` is used rather than `subjects` on purpose
 * — knowing a place better must never make it easier to lose.
 *
 * A place she has REJECTED or already visited is deliberately not in the
 * anchor: recommend() is free to move off those, and it moves off them because
 * she said so. That is her changing the subject, which is the one thing this
 * file must never call drift.
 */
export function anchorOf(
  b: Brief,
  pitched?: string | null,
  profile?: { rejectedDestinationIds?: string[]; visitedDestinationIds?: string[] },
): Anchor {
  const out = new Set<string>();
  const words: string[] = [];
  const gone = new Set([
    ...(profile?.rejectedDestinationIds ?? []),
    ...(profile?.visitedDestinationIds ?? []),
    ...(b.visitedIds ?? []),
  ]);
  const take = (said: string) => {
    const w = said.trim();
    if (!w) return;
    const hit = resolvePlaceName(w);
    if (hit && !gone.has(hit.destinationId)) { out.add(hit.destinationId); words.push(w); return; }
    // Somewhere we hold no data for is still the subject. It cannot be
    // resolved to an id, and it is exactly the case ("the faroe islands")
    // where substitution has historically happened, so it is recorded by name
    // and anchors nothing else.
    if (!hit) words.push(w);
  };
  for (const s of statedNames(b)) take(s);
  if (b.namedDestination) take(b.namedDestination);
  if (b.focusCityId) take(b.focusCityId);
  for (const c of b.candidates ?? []) take(c);
  for (const id of b.regionIds ?? []) if (!gone.has(id)) out.add(id);
  // The pin is hers too: it is the destination she has been shown and has not
  // turned down. Ordinary conversation drifting off it is the New Orleans /
  // Paris bug this whole file is named after.
  if (pitched && !gone.has(pitched)) out.add(pitched);
  return { ids: [...out], words: [...new Set(words)], open: out.size === 0 && words.length === 0 };
}

/** Every place name on the brief, whether or not the catalogue holds it. */
function statedNames(b: Brief): string[] {
  const named = [...(b.unknownCandidates ?? [])];
  const region = b.region && !(b.regionIds ?? []).length ? [b.regionLabel ?? b.region] : [];
  return [...named, ...region].map((s) => s.trim()).filter(Boolean);
}

// ---------------------------------------------------------------------------
// 1. Off the destination or brief.
// ---------------------------------------------------------------------------

/**
 * The subject under discussion changed, and she did not change it.
 *
 * "Someone asked for more detail on New Orleans and was told to go to Paris."
 * "A Faroe Islands brief came back as New Zealand."
 *
 * The existing guards in lib/flow.ts each cover one route to that: the pin
 * stops the score drifting off a pitch, `statedPlaces` stops a pitch while
 * somewhere she named is unresolved, and the fidelity gate stops the
 * catalogue being ranked when she has named nothing. All three are gates on
 * the INPUT. This is the check on the OUTPUT, at the last moment before a
 * destination is spoken, and it needs no flag to be right: is the thing we are
 * about to pitch one of the things she settled on?
 */
export function subjectDrift(a: Anchor, about: string): Drift | null {
  if (a.open) return null;                    // nothing named: nothing to drift from
  if (a.ids.includes(about)) return null;
  /*
   * She named somewhere we hold no data for, and we are about to pitch
   * something. That IS the Faroes/New Zealand substitution, and it is the
   * single most damaging shape this bug takes, so it counts even though there
   * is no id to compare against.
   */
  const named = a.words.length ? a.words.join(", ") : a.ids.join(", ");
  return {
    kind: "subject",
    says: `about to pitch ${about} on a conversation about ${named}`,
    evidence: `anchored on [${[...a.ids, ...a.words].join(", ")}], moving to ${about}`,
  };
}

// ---------------------------------------------------------------------------
// 2. The model's prose wandering.
// ---------------------------------------------------------------------------

/**
 * The write-up went somewhere the plan underneath it did not.
 *
 * Two readings, because the bug has two shapes and only one of them was ever
 * guarded:
 *
 *   - it names somewhere else. `namesOnly` has guarded the PITCH against this
 *     for months. Nothing has ever guarded the streamed research paragraph,
 *     which is the text she actually reads first and the text the data pack is
 *     then built from.
 *   - it never mentions the place at all. A paragraph about "the region" that
 *     names nothing is not a write-up of anywhere; it is the model answering a
 *     question that was not asked.
 *
 * `plannedCities`, when given, is the third: a city of the RIGHT destination
 * that is not in the itinerary. "Three nights in Kyoto" over an Osaka-only
 * plan names no foreign country and is still a claim the plan cannot support.
 */
export function proseDrift(
  about: { name: string; id?: string; plannedCities?: string[] },
  prose: string,
  opts: { scope?: "destinations" | "all" } = {},
): Drift | null {
  const text = (prose ?? "").trim();
  // Too short to be a write-up. A headline on its own is judged with its body.
  if (text.length < 40) return null;

  const scope = opts.scope ?? "all";
  const foreign = foreignPlaces(about.name, text, about.id, scope);
  if (foreign.length) {
    /*
     * A pitch may name nowhere else at all. "I'm sending you to Montenegro"
     * over a Rome itinerary is the most trust-destroying sentence this product
     * can produce, and `namesOnly` has enforced exactly that on the pitch for
     * months; nothing about moving it here loosens it.
     *
     * The streamed research write-up is judged differently, and it has to be.
     * The catalogue calls Denmark "Copenhagen", so "two flights a day from
     * Copenhagen" — a true, useful sentence about the Faroe Islands — reads as
     * naming another destination. Refusing her trip over that would be the
     * guard doing the damage.
     *
     * So on that path the test is dominance: the write-up has to be about its
     * subject more than it is about anywhere else. A transit mention loses to
     * the place itself; "honestly, you want New Zealand" does not, because the
     * subject is not in the paragraph at all.
     */
    if (scope === "all") {
      return {
        kind: "prose",
        says: `the write-up about ${about.name} talks about ${foreign.join(", ")}`,
        evidence: `names ${foreign.join(", ")} in prose about ${about.name}`,
      };
    }
    const mine = countMentions(text, about.name, about.id);
    const theirs = Math.max(...foreign.map((f) => countMentions(text, f)));
    if (mine < theirs) {
      return {
        kind: "prose",
        says: `the write-up about ${about.name} is mostly about ${foreign.join(", ")}`,
        evidence: `${about.name} ×${mine}, ${foreign.join("/")} ×${theirs}`,
      };
    }
  }

  if (about.plannedCities) {
    const planned = new Set(about.plannedCities.map(fold));
    const strayed = CITIES
      .filter((c) => c.destinationId === about.id && !planned.has(fold(c.name)) && !planned.has(fold(c.id)))
      .filter((c) => fold(c.name).length >= 4
        && new RegExp(`\\b${esc(c.name.toLowerCase().replace(/^the\s+/, ""))}\\b`).test(text.toLowerCase()))
      .map((c) => c.name);
    if (strayed.length) {
      return {
        kind: "prose",
        says: `the write-up promises ${strayed.join(", ")}, which this trip does not go to`,
        evidence: `names ${strayed.join(", ")}; itinerary covers ${about.plannedCities.join(", ")}`,
      };
    }
  }

  if (!mentions(text, about.name, about.id)) {
    return {
      kind: "prose",
      says: `${text.length} words about ${about.name} that never mention ${about.name}`,
      evidence: `no mention of ${about.name}: "${text.slice(0, 70)}…"`,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// 3. Losing the thread mid-conversation.
// ---------------------------------------------------------------------------

/**
 * Is the rewrite still the same question?
 *
 * This is `asksTheSameThing`, moved here from lib/agent/llm.ts where it had
 * been sitting since it was written with exactly zero callers — a guard
 * against the model substituting a question of its own, wired to nothing. It
 * is the right primitive for the wrong-question problem in both directions, so
 * it lives with the other primitives and is now actually used.
 *
 * The cheap, robust test: both have to be questions, and the second has to
 * keep the subject words the first leaned on. Catches the substitution without
 * policing style.
 */
export function sameQuestion(a: string, b: string): boolean {
  if (!/\?\s*$/.test(b.trim())) return false;
  const stop = new Set([
    "what", "when", "where", "how", "which", "who", "why", "are", "is", "do",
    "does", "did", "you", "your", "the", "a", "an", "for", "and", "or", "to",
    "of", "in", "on", "it", "this", "that", "with", "have", "has", "want",
    "would", "like", "long", "much", "many", "rough", "about", "just", "i",
    "im", "us", "we", "me", "my", "s", "t", "re", "ll",
  ]);
  const words = (t: string) =>
    new Set(
      t.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
        .filter((w) => w.length > 2 && !stop.has(w)),
    );
  const want = words(a);
  if (want.size === 0) return true;
  const got = words(b);
  let hit = 0;
  for (const w of want) if (got.has(w)) hit++;
  return hit / want.size >= 0.25;
}

/** What the brief already holds for each thing a structural question asks. */
function answeredAlready(q: Question, b: Brief): string | undefined {
  const days = b.days !== undefined ? `${b.days} days` : b.flexibleDuration ? "flexible on length" : undefined;
  // `budgetIsOurs` marks a figure WE anchored from a quote. Asking about a
  // number we invented is not re-asking her anything.
  const money = b.budgetUsd !== undefined && !b.budgetIsOurs ? `$${b.budgetUsd}`
    : b.flexibleBudget ? "flexible on budget" : undefined;
  if (q.id === "duration") return days;
  if (q.id === "budget") return money;
  if (q.id === "vibes") return b.vibes.length ? b.vibes.join(", ") : undefined;
  if (q.id === "pace") return b.pace;
  if (q.id === "constraints") return b.constraints.length ? b.constraints.join("; ") : undefined;
  /*
   * A model-authored question carries the id "open", so the slot table cannot
   * reach it. Only the unmistakable asks are read out of the prose — a fuzzy
   * match here would suppress good questions, and suppressing a good question
   * is the one failure mode worse than asking twice.
   */
  if (q.id === "open") {
    const p = q.prompt.toLowerCase();
    if (days && /\bhow (many days|long)\b|\bhow much time\b/.test(p)) return days;
    if (money && /\bbudget\b|\bhow much (are you |do you )?(want to |looking to )?spend\b/.test(p)) return money;
    if (b.origin && /\bflying from\b|\bwhere are you (flying|travelling|traveling) from\b/.test(p)) {
      return b.origin.label;
    }
  }
  return undefined;
}

/**
 * It is about to ask something it already has the answer to, or ask again a
 * question she has already answered once.
 *
 * The existing defence is in app/page.tsx: `askedRef` holds the last question
 * verbatim and a repeat gets an apology and a rephrasing from the REASK table.
 * Two holes, both structural rather than incidental. It compares the exact
 * sentence, so the same question in different words is not a repeat. And it
 * only ever looks at the question BEFORE this one, so "how long?", answered,
 * two questions about something else, "how long?" is invisible to it — which
 * is the shape of "replies to an earlier turn rather than the current one".
 *
 * This reads the brief and the whole transcript instead, and it is the brief
 * that makes it honest: a question is only drifting if the answer is already
 * in hand. A repeat where the slot is STILL EMPTY is not drift, it is the
 * REASK case, and it is left alone.
 */
export function threadDrift(q: Question, history: Turn[], b: Brief): Drift | null {
  const have = answeredAlready(q, b);
  if (have) {
    return {
      kind: "thread",
      says: `asking "${q.prompt}" when she has already said ${have}`,
      evidence: `${q.id}: already holds ${have}`,
    };
  }
  /*
   * Asked twice already, and answered both times.
   *
   * The SECOND ask is deliberately not drift. She answered and the slot is
   * still empty, so asking again is asking — her rule, "always ask, it's
   * better than spitting out nonsensical bs" — and app/page.tsx already does
   * it honestly: `askedRef` notices the repeat and `REASK` puts a different
   * sentence with an acknowledgement in front of it.
   *
   * The THIRD is the transcript page.tsx was written to end: "Roughly what do
   * you want to spend?", "i've already been to tulum", "Roughly what do you
   * want to spend?", a real instruction, and the same sentence again. `REASK`
   * holds one rephrasing per slot, so by the third attempt she is reading the
   * identical acknowledgement and the identical question for the second time,
   * and the loop is the answer to nothing.
   *
   * Requiring a user turn after each earlier ask is what separates "she
   * answered and I forgot" from "I asked and she is still typing".
   */
  let answeredAsks = 0;
  for (let i = 0; i < history.length; i++) {
    const t = history[i];
    if (t.from !== "agent" || !sameQuestion(t.text, q.prompt)) continue;
    if (history.slice(i + 1).some((x) => x.from === "user")) answeredAsks++;
  }
  if (answeredAsks >= 2) {
    return {
      kind: "thread",
      says: `putting "${q.prompt}" a third time, having been answered twice`,
      evidence: `${answeredAsks} earlier asks, each answered`,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// 4. The visible thinking text.
// ---------------------------------------------------------------------------

/**
 * Machinery. Words that describe how the answer is being fetched rather than
 * what is being looked up.
 *
 * She is watching a holiday get planned. "Reading up on Validate Pack…" and
 * "Reading up on Bend, Oregon, retrying tool call 2/3…" are the same failure
 * as a stack trace in a chat bubble.
 */
const MACHINERY = new Set([
  "pack", "packs", "json", "schema", "token", "tokens", "prompt", "api", "llm",
  "sdk", "endpoint", "http", "https", "fetch", "serverless", "function",
  "timeout", "timed", "null", "undefined", "validate", "validating", "parse",
  "parsing", "cache", "fallback", "driver", "tool", "stub", "request",
  "response", "sonnet", "anthropic", "claude", "model", "retry", "retrying",
  "error", "exception", "stack", "buffer", "stream", "chunk", "await",
]);

/** The place half of a label may be a name; the note after the pipe may not. */
const PLACE_WORDS_MAX = 6;
const NOTE_WORDS_MAX = 5;
const LABEL_MAX = 60;

/**
 * The label she is reading has to be the thing being worked on.
 *
 * `io.setResearching(s)` drives "Reading up on X…", where X is the half before
 * the pipe, title-cased, and anything after the pipe is appended verbatim.
 * Three ways it goes wrong, and all three have shipped:
 *
 *   - it names something that is not the subject. The pack retry builds its
 *     label with a comma instead of the pipe, so the whole string goes through
 *     `title()` and she reads "Reading up on Faroe Islands, One More Go…".
 *   - it rambles. A label is four words on a spinner, not a sentence.
 *   - it exposes machinery.
 *
 * Checked against the subject the turn is actually researching, which is the
 * only thing that makes the first of those detectable at all.
 */
export function labelDrift(label: string | null, subject: string): Drift | null {
  if (label === null) return null;
  const [place, ...rest] = label.split("|");
  const note = rest.join("|");
  const words = (s: string) => s.split(/\s+/).filter(Boolean);

  const machine = [...words(place), ...words(note)]
    .map((w) => w.toLowerCase().replace(/[^a-z]/g, ""))
    .find((w) => MACHINERY.has(w));
  if (machine) {
    return {
      kind: "label",
      says: `the status label says "${label}", which is machinery, not a place`,
      evidence: `machinery word "${machine}" in label "${label}"`,
    };
  }
  if (fold(place) !== fold(subject)) {
    return {
      kind: "label",
      says: `the status label says "${place}" while it is looking up ${subject}`,
      evidence: `label place "${place}" ≠ subject "${subject}"`,
    };
  }
  if (label.length > LABEL_MAX || words(place).length > PLACE_WORDS_MAX
      || (note && words(note).length > NOTE_WORDS_MAX)) {
    return {
      kind: "label",
      says: `the status label rambles: "${label}"`,
      evidence: `${label.length} chars, ${words(place).length} place words, ${words(note).length} note words`,
    };
  }
  return null;
}
