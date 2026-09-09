import type { Brief, Trip } from "@/lib/types";
import { cityById, destinationById } from "@/data/destinations";
import { inferPace, parseAvoidTags } from "@/lib/discovery";
import { quotable } from "@/lib/brief";

const PACE_CLAUSE = {
  relaxed: "Slow mornings, one thing worth doing most days, and afternoons you don't have to account for.",
  light: "Unhurried mornings, one or two real stops a day, and long open stretches in between.",
  mixed: "Slow mornings, a couple of substantial things a day, and enough unscheduled time to feel like you're actually away.",
  busy: "Early starts and full days, with the walking grouped so you're not doubling back.",
} as const;

/** Composed from what they asked for. Deliberately not model-written prose. */
export function vibeLine(trip: Trip, brief: Brief): string {
  const parts: string[] = [PACE_CLAUSE[inferPace(brief)]];

  const dayTrip = trip.concept.shape.find((l) => l.dayTrip);
  if (dayTrip) parts.push(`One day out of the city, to ${cityById(dayTrip.dayTrip!).name}.`);

  if (brief.vibes.includes("food")) parts.push("Food and wine get real time rather than being fitted around sightseeing.");
  // "The outdoor days break up the city ones" is a city-break sentence, and it
  // was printing on a twelve-day trek through Yunnan where there are no city
  // days to break up.
  if (brief.vibes.includes("nature")) {
    parts.push(brief.vibes.includes("city")
      ? "The outdoor days are spaced so they break up the city ones."
      : "The hard days are spaced so you're not walking yourself into the ground.");
  }
  // "Two bases" was hard-coded next to a shape that could be three or four,
  // and a return leg made even a two-base trip read as three names. Count the
  // places you actually sleep, not the legs.
  const beds = trip.concept.shape.filter((l) => l.nights > 0);
  const names = [...new Set(beds.map((l) => cityById(l.cityId).name))];
  if (names.length > 1) {
    const moves = Math.max(1, beds.length - 1);
    const n = count(names.length);
    parts.push(
      `${n.charAt(0).toUpperCase()}${n.slice(1)} bases — ${names.join(" then ")} — `
      + `${moves === 1 ? "one move" : `${count(moves)} moves`} between them, and nothing else to pack.`,
    );
  }
  return parts.join(" ");
}

/** Fallback "why" when the driver's pitch body isn't available. */
export function whyLine(trip: Trip, brief: Brief): string {
  /*
   * Her words, not the taxonomy.
   *
   * This read `brief.vibes`, which are tags the model picked from a fixed
   * list. A traveller who said "i wanna go see the northern lights" and got
   * a Yellowknife aurora trip was told "You said nature, city", because
   * northern lights is not one of the tags. The app paraphrasing her back to
   * herself, wrongly, in the one line whose whole job is to prove it
   * listened.
   *
   * So the echo of what she actually typed leads, and the tags fill in only
   * when there is nothing else.
   */
  /*
   * Only what she typed may follow "You said".
   *
   * This read `brief.activities` whole, and that list is also filled by the
   * model — which is asked for her own words and cannot be held to it — and by
   * a freeform chip the model wrote and she merely clicked. `quotable` keeps
   * the entries whose every word is a word she typed.
   */
  const own = quotable(brief).map((p) => p.trim()).filter(Boolean);
  /*
   * The shape carries the hub twice, because the last night goes back to the
   * airport city. "So: Lisbon and Porto and Lisbon" reads like a bug because
   * it is one: 430 of 660 trips with a return leg said it.
   */
  const cities = [...new Set(trip.concept.shape.map((l) => cityById(l.cityId).name))];
  const moves = trip.concept.shape.length - 1;
  /*
   * "You said" is only allowed in front of words she actually typed.
   *
   * The fallback below used to read the same sentence with brief.vibes in it,
   * which are tags picked off a fixed list, so someone who typed "i wanna hike
   * a national park" was told "You said nature, adventure and relaxation".
   * With nothing of hers to quote, the line describes the trip instead of
   * putting words in her mouth.
   *
   * The old sentence also asserted "and that you didn't want to spend the trip
   * rushing" every time, whether or not she had said anything of the kind. The
   * pace is visible further down in the open-afternoon count, honestly.
   */
  const bits = [
    own.length
      ? (brief.days
          // Only when she gave one. effectiveDays resolves an unset length to
          // seven for the scheduler, and that seven was landing inside the one
          // sentence whose job is to repeat what she told us.
          ? `You said ${own.join(", ")}, over ${trip.concept.days} days.`
          : `You said ${own.join(", ")}.`)
      : `${trip.concept.days} days, built around ${brief.vibes.length ? brief.vibes.join(", ") : "the shape of the place"} rather than a checklist.`,
  ];
  bits.push(moves === 0
    ? `So: one base, and time to actually learn ${cities[0]} rather than skim it.`
    : `So: ${cities.join(" and ")}, ${moves === 1 ? "one move" : `${count(moves)} moves`} between them, and nothing else to pack and unpack.`);
  const rest = trip.days.filter((d) =>
    d.items.some((i) => i.type === "downtime" && i.durationMin >= 120)).length;
  if (rest >= 2) bits.push(`${rest} of the ${trip.days.length} days have a genuinely open afternoon in them. That's deliberate, not a gap I failed to fill.`);
  return bits.join(" ");
}

/** Small numbers read as words in a sentence. "2 train between them" did not. */
function count(n: number): string {
  return ["zero", "one", "two", "three", "four", "five", "six", "seven"][n] ?? String(n);
}

/**
 * Does this sentence still describe a trip of this length?
 *
 * The pitch is written once, against the trip as it was then, and every edit
 * that carries it forward carries its numbers with it. "One more night in
 * Porto" replanned at ten days and kept a paragraph that opened "Nine days in
 * Portugal", so the card read "10 days" directly above prose saying nine. On
 * the destinations I measured it was eight of fifteen.
 *
 * Only plural counts are read, because a trip is never one day long and
 * "One day out of the city, to Sintra" is a day trip, not a length.
 */
export function namesOtherLength(why: string, days: number): boolean {
  const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven",
    "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen"];
  const said: number[] = [];
  for (const m of why.matchAll(/\b(\d{1,2}|[a-z]+)[\s-]days\b/gi)) {
    const raw = m[1].toLowerCase();
    const n = /^\d+$/.test(raw) ? Number(raw) : WORDS.indexOf(raw);
    if (n > 1) said.push(n);
  }
  return said.some((n) => n !== days);
}

/**
 * Things she asked for that nothing in this codebase can check.
 *
 * `constraints` holds her refusals verbatim. Anything in one that maps to one
 * of the 28 `avoidTags` is enforced by the planner and the critic; the rest —
 * "no more than two hours' driving a day", "must be step-free", "nothing that
 * needs booking months ahead" — is stored, shown to the model, and enforced by
 * nothing. Identical itineraries with and without it, on 15 of 15
 * destinations.
 *
 * The model may honour it and often will. But "may" is not a thing to leave
 * unsaid on a plan she is about to book, and telling her which of her own
 * words the machinery could not act on is cheaper and more honest than
 * pretending or than silently dropping them.
 */
export function unenforced(brief: Brief): string[] {
  return (brief.constraints ?? [])
    .map((c) => c.trim())
    .filter(Boolean)
    // Something in it landed as a tag, so the planner and critic hold it.
    .filter((c) => !parseAvoidTags(c).length)
    // A place name is enforced by buildShape and now by the critic too.
    .filter((c) => !(brief.avoidPlaces ?? []).some((p) => c.toLowerCase().includes(p.toLowerCase())))
    /*
     * Only clauses that read like a requirement.
     *
     * Every negated clause is recorded, because she said it. Not every negated
     * clause is a rule: "somewhere that looks nothing like home" is a figure
     * of speech, and reading it back as "you also said 'nothing like home',
     * which I can't check" is worse than saying nothing. A limit, a
     * requirement or an absolute is what this sentence is for.
     */
    .filter((c) => /\b(no more than|no less than|at most|at least|under|over|max|maximum|minimum|must|has to|have to|needs?|only|without|within|nothing that|never more)\b/i.test(c))
    .filter((c) => c.split(/\s+/).length <= 12);
}

/** The sentence for those, or nothing when everything she said is enforced. */
export function unenforcedNote(brief: Brief): string | undefined {
  const left = unenforced(brief);
  if (!left.length) return undefined;
  return `You also said ${left.map((x) => `"${x}"`).join(" and ")}. I've kept `
    + `${left.length === 1 ? "that" : "those"} in mind while building this, but `
    + `${left.length === 1 ? "it isn't" : "they aren't"} something I can check the finished plan against — `
    + `so give ${left.length === 1 ? "it" : "them"} a second look before you book anything.`;
}
