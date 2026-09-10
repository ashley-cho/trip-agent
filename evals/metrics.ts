import type { Brief, ItineraryDay, TravelerProfile, Trip } from "@/lib/types";
import type { EditOp } from "@/lib/agent/types";
import { PACE_ACTIVITIES, ALL_VIBES } from "@/lib/types";
import { critique, intraDayKm } from "@/lib/critic";
import { inferPace } from "@/lib/discovery";
import { avoidedTags, coreTags, supportTags, unserved, SIGNATURE_TAGS } from "@/lib/select";
import { DESTINATIONS, destinationById, cityById } from "@/data/destinations";

// ---------------------------------------------------------------------------
// Every metric returns 0..1 (higher is better) plus a raw figure, so the
// scorecard can show both "0.83" and "5 of 6 days".
// ---------------------------------------------------------------------------

export interface Metric { score: number; raw: string }
export type Scores = Record<string, Metric>;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const ratio = (n: number, d: number) => (d === 0 ? 1 : n / d);
const isEdge = (d: ItineraryDay, t: Trip) => d.index === 1 || d.index === t.days.length;

/** 1. No overlaps, no closed venues, no impossible hops. (§32) */
export function scheduleValidity(trip: Trip, brief: Brief, profile: TravelerProfile): Metric {
  const errs = critique(trip, brief, profile).filter((i) => i.severity === "error" && i.day);
  const bad = new Set(errs.map((e) => e.day));
  const ok = trip.days.length - bad.size;
  return { score: ratio(ok, trip.days.length), raw: `${ok}/${trip.days.length} days clean` };
}

/** 2. Activities per day against the pace they asked for. */
export function paceAdherence(trip: Trip, brief: Brief): Metric {
  const target = PACE_ACTIVITIES[inferPace(brief)];
  const days = trip.days.filter((d) => !isEdge(d, trip));
  const ok = days.filter((d) => {
    const n = d.items.filter((i) => i.type === "activity").length;
    // A day with a three-hour train in it is not meant to hit the full target,
    // and the planner already lowers its own budget for those. Measure against
    // the intent, not a flat number.
    const hasLongHaul = d.items.some((i) => i.type === "transit" && i.durationMin >= 90);
    const isDayTrip = d.items.some((i) => i.type === "transit" && /^(Train|Drive) back/.test(i.name));
    const t = Math.max(1, target - (hasLongHaul && !isDayTrip ? 2 : isDayTrip ? 1 : 0));
    return n >= Math.max(1, t - 1) && n <= t + 1;
  }).length;
  return { score: ratio(ok, days.length), raw: `${ok}/${days.length} days near target ${target}` };
}

/** 3. Downtime is a feature, and it has to actually be there. (§10) */
export function downtimePresence(trip: Trip, brief: Brief): Metric {
  if (inferPace(brief) === "busy") return { score: 1, raw: "n/a (busy pace)" };
  const days = trip.days.filter((d) => !isEdge(d, trip));
  const ok = days.filter(
    (d) => d.items.filter((i) => i.type === "downtime").reduce((s, i) => s + i.durationMin, 0) >= 60,
  ).length;
  return { score: ratio(ok, days.length), raw: `${ok}/${days.length} days with a real free block` };
}

/**
 * 4. How much of the day is spent getting places. (§9)
 * Scored per day against the right yardstick: a day trip by car or fast train
 * is supposed to cover ground, and penalising it would push the planner toward
 * never leaving the city.
 */
export function geographicEfficiency(trip: Trip): Metric {
  const scored = trip.days.map((d) => {
    const km = intraDayKm(d);
    const roadDay = d.items.some(
      (i) => i.type === "transit" && /^(Train|Drive) (to|back)/.test(i.name));
    const driving = cityById(d.cityId)?.scale === "driving";
    return roadDay
      ? clamp01(1 - (km - 120) / 260)          // a day out: 120km free
      : driving
        ? clamp01(1 - (km - 50) / 120)         // a national park: spread by design
        : clamp01(1 - (km - 10) / 30);         // one walkable city
  });
  const mean = scored.reduce((a, b) => a + b, 0) / Math.max(1, scored.length);
  const rawKm = trip.days.map(intraDayKm);
  return {
    score: mean,
    raw: `${(rawKm.reduce((a, b) => a + b, 0) / rawKm.length).toFixed(0)} km/day mean`,
  };
}

/** 5. Does the estimate respect the number they gave? */
export function budgetAdherence(trip: Trip, brief: Brief): Metric {
  if (brief.budgetUsd === undefined) return { score: 1, raw: "no budget stated" };
  const over = trip.concept.estimateUsd - brief.budgetUsd;
  const score = over <= 0 ? 1 : clamp01(1 - over / (brief.budgetUsd * 0.2));
  return { score, raw: `$${trip.concept.estimateUsd} vs $${brief.budgetUsd}` };
}

/** 6. Questions asked before recommending. Three is normal, five is a failure. (§5) */
export function questionEconomy(count: number): Metric {
  const score = count <= 3 ? 1 : count === 4 ? 0.7 : count === 5 ? 0.3 : 0;
  return { score, raw: `${count} questions` };
}

/** 7. One recommendation, not a list. (§6) */
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function singleRecommendation(pitch: string, chosenId: string, confidence: string): Metric {
  // Match the whole name, not its first word. Matching on the first word made
  // "South" flag any pitch containing "a short flight south", which is a
  // metric reporting a bug that isn't there — worse than no metric.
  const others = DESTINATIONS.filter((d) => d.id !== chosenId)
    .filter((d) => new RegExp(`\\b${esc(d.name)}\\b`, "i").test(pitch));
  // Naming exactly one alternative is legitimate when genuinely torn (§7).
  const allowed = confidence === "high" ? 0 : 1;
  return {
    score: others.length <= allowed ? 1 : 0,
    raw: others.length === 0 ? "1 destination" : `also names ${others.map((d) => d.name).join(", ")}`,
  };
}

/** 8. Every meaningful item explains itself, and not with the same sentence. (§13) */
export function reasonCoverage(trip: Trip): Metric {
  const items = trip.days.flatMap((d) => d.items).filter((i) => i.type === "activity" || i.type === "meal");
  const withReason = items.filter((i) => i.reason && i.reason.length > 15);
  const distinct = new Set(withReason.map((i) => i.reason)).size;
  const coverage = ratio(withReason.length, items.length);
  const variety = ratio(distinct, Math.max(1, withReason.length));
  return {
    score: coverage * 0.5 + variety * 0.5,
    raw: `${withReason.length}/${items.length} explained, ${distinct} distinct`,
  };
}

const BANNED = [
  "hidden gem", "vibrant", "nestled", "bustling", "must-see", "must see",
  "gateway to", "something for everyone", "immerse yourself", "picturesque",
  "charming", "stunning", "breathtaking", "feast for the senses",
  "start your day", "delicious", "iconic landmark", "rich history", "world-class",
];

/** 9. The anti-slop check. (§12) */
export function slopScore(texts: string[]): Metric {
  const corpus = texts.join(" \n ");
  const words = corpus.split(/\s+/).filter(Boolean).length || 1;
  let hits = 0;
  const found: string[] = [];
  for (const phrase of BANNED) {
    const m = corpus.match(new RegExp(phrase.replace(/[-]/g, "[- ]"), "gi"));
    if (m) { hits += m.length; found.push(phrase); }
  }
  // Three or more adjectives stacked before a noun is the other tell.
  const stacks = corpus.match(/\b\w+ly?\b,? \b\w+\b,? and \b\w+\b (?=\w)/gi)?.length ?? 0;
  const rate = (hits * 60 + stacks * 15) / words;
  return {
    score: clamp01(1 - rate),
    raw: hits === 0 ? `clean over ${words} words` : `${hits} hits: ${found.join(", ")}`,
  };
}

/** 10. Did the edit actually do what they asked? (§14) */
export type EditCheck =
  | { type: "fewer_activities" }
  | { type: "more_tag"; tag: string }
  | { type: "fewer_tag"; tag: string }
  | { type: "less_touristy" }
  /** A question, or anything else that is not an instruction: the plan must not move. */
  | { type: "no_change" };

const actCount = (t: Trip) => t.days.reduce((s, d) => s + d.items.filter((i) => i.type === "activity").length, 0);
const tagCount = (t: Trip, tag: string) =>
  t.days.flatMap((d) => d.items).filter((i) => (i.tags as string[]).includes(tag)).length;
const touristyLoad = (t: Trip) =>
  t.days.flatMap((d) => d.items).filter((i) => (i.tags as string[]).includes("iconic")).length;

/**
 * `available` says whether the thing they asked for exists in these cities at
 * all. When it doesn't, declining with a reason is the correct answer, and
 * scoring it zero would train the agent to pad itineraries.
 */
export function editResponsiveness(
  before: Trip, after: Trip, check: EditCheck,
  ctx: { spoke: boolean; available: boolean } = { spoke: false, available: true },
): Metric {
  if (!ctx.available) {
    const what = check.type === "more_tag" ? `no ${check.tag} in these cities` : "already at the lighter pace";
    return ctx.spoke
      ? { score: 1, raw: `${what} — declined, with a reason` }
      : { score: 0, raw: `${what}, and said nothing` };
  }
  switch (check.type) {
    case "fewer_activities": {
      const b = actCount(before), a = actCount(after);
      return { score: a < b ? 1 : 0, raw: `${b} → ${a} activities` };
    }
    case "more_tag": {
      const b = tagCount(before, check.tag), a = tagCount(after, check.tag);
      return { score: a > b ? 1 : 0, raw: `${check.tag}: ${b} → ${a}` };
    }
    case "fewer_tag": {
      const b = tagCount(before, check.tag), a = tagCount(after, check.tag);
      return { score: a < b ? 1 : 0, raw: `${check.tag}: ${b} → ${a}` };
    }
    case "less_touristy": {
      const b = touristyLoad(before), a = touristyLoad(after);
      return { score: a <= b ? 1 : 0, raw: `iconic items: ${b} → ${a}` };
    }
    case "no_change": {
      const same = tripSignature(before) === tripSignature(after);
      return same
        ? { score: 1, raw: "plan untouched, correctly" }
        : { score: 0, raw: "a question rearranged the trip" };
    }
  }
}

/**
 * Everything about a plan that a traveller would notice changing: where each
 * day happens, what is in it, and when.
 */
export const tripSignature = (t: Trip) =>
  t.days.map((d) => `${d.cityId}:${d.items.map((i) => `${i.name}@${i.start}`).join("|")}`).join(">>");

/**
 * 14. She named a place. Did she get it?
 *
 * This was checked, but as an assertion printed under the scorecard rather
 * than a number inside it, so a week in Norway booked for someone who asked
 * for Canada scored 95%: valid schedule, good pace, low slop, every item
 * explained, and the wrong country. Her rule is the strongest one she has
 * given — if the conversation is about one place, we do not go elsewhere —
 * and it was the only rule with no score attached.
 *
 * The accepted set can hold more than one id. "Somewhere that looks nothing
 * like home, nature, not a city, $3,000+" is answered correctly by Iceland
 * AND by New Zealand, and an eval that insists on one of them is a false
 * alarm that trains you to ignore the red.
 */
export function destinationFidelity(got: string, want?: string | string[]): Metric {
  if (!want) return { score: 1, raw: "nowhere named" };
  const set = Array.isArray(want) ? want : [want];
  return set.includes(got)
    ? { score: 1, raw: got }
    : { score: 0, raw: `${got}, and they asked for ${set.join(" or ")}` };
}

/**
 * 15. Does what it SAYS it did match what it DID?
 *
 * "i also really want to do dog sledding" rebuilt the itinerary, moved the
 * estimate, and then said "I didn't change anything — tell me which day is
 * wrong". Every other metric here is satisfied by that turn: the plan it
 * produced was valid, well paced and fully explained. Nothing measured
 * whether the sentence next to it was true.
 *
 * Both directions are failures. Changing the trip in silence is worse,
 * because she has no way to know it happened, but claiming an edit that
 * never landed is the same class of lie.
 */
export function replyMatchesState(
  before: Trip, after: Trip, ctx: { claimed: boolean },
): Metric {
  const moved = tripSignature(before) !== tripSignature(after);
  if (moved === ctx.claimed) {
    return { score: 1, raw: moved ? "changed it, and said so" : "left it alone, and said so" };
  }
  return moved
    ? { score: 0, raw: "changed the plan and said it hadn't" }
    : { score: 0, raw: "claimed a change that never landed" };
}

/**
 * 12. Does the itinerary actually reflect what they asked for? Every other
 * metric here can pass on a trip full of the wrong content — this is the one
 * that catches "I said nature and got three museums".
 */
export function vibeFidelity(trip: Trip, brief: Brief): Metric {
  if (brief.vibes.length === 0) return { score: 1, raw: "no vibes stated" };

  const wanted = new Set([...coreTags(brief.vibes), ...supportTags(brief.vibes)]);
  const mine = new Set(brief.vibes.flatMap((v) => SIGNATURE_TAGS[v]));
  const foreign = new Set(
    ALL_VIBES.filter((v) => !brief.vibes.includes(v))
      .flatMap((v) => SIGNATURE_TAGS[v])
      .filter((t) => !mine.has(t)),
  );

  const acts = trip.days.flatMap((d) => d.items).filter((i) => i.type === "activity");
  if (!acts.length) return { score: 0, raw: "no activities" };

  // Three buckets, not two. A walk on a food trip is neither on-brief nor a
  // failure — it's connective tissue. What actually breaks trust is content
  // from a vibe they didn't pick: an art museum on a landscape trip. Scoring
  // neutral items as misses would push the planner to fill every hour with
  // on-theme content, which is its own kind of bad trip.
  // Classified in one pass so the three buckets partition the set. Judged the
  // same way the planner decides: something carrying another vibe's signature
  // and nothing of theirs is off-brief, whatever else it also happens to be.
  const isOff = (i: (typeof acts)[number]) =>
    i.tags.some((t) => foreign.has(t)) && !i.tags.some((t) => mine.has(t));
  const off = acts.filter(isOff);
  const on = acts.filter((i) => !isOff(i) && i.tags.some((t) => wanted.has(t)));
  const neutral = acts.length - on.length - off.length;

  const denom = on.length + off.length;
  return {
    score: denom === 0 ? 1 : on.length / denom,
    raw: off.length === 0
      ? `${on.length} on-brief, ${neutral} neutral, none off-brief`
      : `${on.length} on / ${off.length} off (${off.slice(0, 3).map((m) => m.name).join(", ")}), ${neutral} neutral`,
  };
}

/** 11. Never re-suggest what they turned down. (§32) */
export function preferenceRespect(trip: Trip, brief: Brief, profile: TravelerProfile): Metric {
  const avoid = avoidedTags(brief, profile);
  const rejected = new Set(profile.rejectedPlaceIds);
  const items = trip.days.flatMap((d) => d.items).filter((i) => i.type === "activity");
  const bad = items.filter(
    (i) => i.tags.some((t) => avoid.has(t)) || (i.placeId && rejected.has(i.placeId)),
  );
  return {
    score: bad.length === 0 ? 1 : clamp01(1 - bad.length / Math.max(1, items.length)),
    raw: bad.length === 0 ? "no violations" : `${bad.length} violations: ${bad.map((b) => b.name).join(", ")}`,
  };
}

export const METRIC_LABELS: Record<string, string> = {
  schedule_validity: "Schedule validity",
  pace_adherence: "Pace adherence",
  downtime_presence: "Downtime present",
  geographic_efficiency: "Geographic efficiency",
  budget_adherence: "Budget adherence",
  question_economy: "Question economy",
  single_recommendation: "One recommendation",
  reason_coverage: "Reason coverage",
  slop_score: "Anti-slop",
  edit_responsiveness: "Edit responsiveness",
  preference_respect: "Preference respect",
  vibe_fidelity: "Matches what they asked",
  destination_fidelity: "Went where they said",
  reply_matches_state: "Says what it did",
  claim_accuracy: "Absences are real",
  qualifier_fidelity: "Edits land where told",
  noise_rate: "Said nothing spare",
  clause_accounting: "Every clause answered",
  call_economy: "Model calls per place",
  idempotence: "Same input, same plan",
  destination_coverage: "Worst destination",
  words_survive: "Her words survive",
  attribution_accuracy: "Only her words quoted",
};

/**
 * 15. An absence it announces has to actually be absent.
 *
 * Added after the app told a Barcelona trip it had nothing for "gaudi" above
 * the Sagrada Família, a Paris trip nothing for "the galleries" above the
 * Louvre, and a Queenstown trip nothing for "bungee jumping" above the
 * Kawarau bridge bungy. Eighteen such claims in seventy-six over 150 briefs,
 * every one of them contradicted by an item on the same screen, and not one
 * metric here moved: the schedule was valid, the pace was right, the slop was
 * low, and the sentence under it was false.
 *
 * The trap this has to avoid is circularity. The sentence fires exactly when
 * `unserved` says the phrase is unserved, so scoring it with `unserved` is
 * guaranteed to pass. So the check is a DIFFERENT, looser reading of the same
 * plan: fold accents, drop the length floor and the prefix rule, and look for
 * the phrase's words anywhere in a scheduled item. Where the loose reading
 * finds what the strict one missed, the claim is suspect.
 *
 * It cannot see everything, and is not meant to. Whether the Louvre covers
 * "the galleries" is world knowledge and stays invisible here. What it does
 * catch is the whole mechanical class — compounds, accents, inflections —
 * which is where those eighteen came from.
 */
export function claimAccuracy(trip: Trip, brief: Brief): Metric {
  const stated = brief.activities ?? [];
  if (!stated.length) return { score: 1, raw: "nothing stated" };
  const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  /*
   * The loose reading is NAMES AND TAGS, not the prose.
   *
   * A first version searched the reason line too, which made a hot spring
   * noted "nobody has climbed it since" count as coverage for climbing. That
   * is a passing mention, not a thing to do, and scoring it as one would
   * push the matcher toward exactly the false coverage claims that silence an
   * honest report. What a name or a tag says the item IS, is coverage.
   */
  const hay = fold(trip.days.flatMap((d) => d.items
    .filter((i) => i.type === "activity" || i.type === "meal")
    .map((i) => `${i.name} ${i.tags.join(" ")}`)).join(" "));
  /*
   * The strict side, run through the app's own matcher rather than a copy of
   * it — a second implementation here would drift and then measure itself.
   * The itinerary carries `reason` where a catalogue place carries `note`;
   * they are the same prose to a word matcher.
   */
  const asPlaces = trip.days.flatMap((d) => d.items
    .filter((i) => i.type === "activity" || i.type === "meal")
    .map((i) => ({ id: i.id, name: i.name, note: i.reason, tags: i.tags, skip: false })));
  const claimed = stated.filter((a) => unserved(asPlaces as unknown as Parameters<typeof unserved>[0], [a]).length);
  const suspect = claimed.filter((a) => fold(a)
    .replace(/[^a-z0-9 ]/g, " ").split(/\s+/)
    .filter((w) => w.length >= 4 && !/^(the|and|for|with|some|more|from|that|this|they)$/.test(w))
    .some((w) => hay.includes(w.replace(/(?:ies|es|s)$/, ""))));
  if (!claimed.length) return { score: 1, raw: `${stated.length} stated, none claimed missing` };
  return {
    score: ratio(claimed.length - suspect.length, claimed.length),
    raw: suspect.length
      ? `${suspect.length}/${claimed.length} claimed missing but findable: ${suspect.join(", ")}`
      : `${claimed.length} claimed missing, none contradicted`,
  };
}

/**
 * 16. An edit that names a day, or a part of one, has to land there.
 *
 * "Add a free afternoon" cleared the last activity of the day — usually the
 * evening — and then said, accurately, which part it had opened. Edit
 * responsiveness scored it 1: something changed, and it was the right KIND of
 * change. Says-what-it-did scored it 1: the sentence matched the action. Both
 * were right, and she still typed afternoon and got a morning, because no
 * metric read the qualifier in her own sentence.
 *
 * So this one reads her words and nothing else: if she named a day or a
 * window, every item that moved has to be inside it.
 */
export function qualifierFidelity(before: Trip, after: Trip, said: string): Metric {
  const dayM = said.match(/\bday\s*(\d+)\b/i);
  const partM = said.match(/\b(morning|afternoon|evening)\b/i);
  if (!dayM && !partM) return { score: 1, raw: "no day or window named" };
  const partOf = (start: string) => {
    const at = Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5));
    return at >= 1020 ? "evening" : at >= 720 ? "afternoon" : "morning";
  };
  const sig = (t: Trip) => new Map(t.days.flatMap((d) =>
    d.items.map((i) => [`${d.index}@${i.start}`, `${i.type}:${i.name}`] as const)));
  const b = sig(before), a = sig(after);
  const moved = [...new Set([...b.keys(), ...a.keys()])].filter((k) => b.get(k) !== a.get(k));
  if (!moved.length) return { score: 1, raw: "nothing moved" };
  const outside = moved.filter((k) => {
    const [day, start] = k.split("@");
    if (dayM && day !== dayM[1]) return true;
    return !!partM && partOf(start) !== partM[1].toLowerCase();
  });
  return {
    score: ratio(moved.length - outside.length, moved.length),
    raw: outside.length
      ? `${outside.length}/${moved.length} changes outside "${[dayM?.[0], partM?.[0]].filter(Boolean).join(" ")}": ${outside.join(", ")}`
      : `${moved.length} change(s), all inside "${[dayM?.[0], partM?.[0]].filter(Boolean).join(" ")}"`,
  };
}

/**
 * 17. Say nothing spare.
 *
 * The app volunteers one sentence per phrase it could not place: "surfing — I
 * couldn't match that to anything in the plan". Measured over 150 briefs it
 * fired 71 times, and 22 of those were about "the weather", "the exchange
 * rate", "the kids" — phrases that reached `activities` because the purpose
 * parser grabbed the tail of a preposition, not because anybody asked for
 * anything. Every one of the 22 is a paragraph of noise printed under a
 * finished itinerary, and it costs more than it looks: a traveller who reads
 * three sentences of nonsense stops reading the fourth, which is the one about
 * the thing she actually wanted.
 *
 * WHAT MAKES A STATEMENT SPARE. The phrase it is about has to trace to
 * something she typed AS A REQUEST. Two legs, both read off her own text:
 *
 *   A. ATTRIBUTION. The phrase must appear as a contiguous run of words inside
 *      a message she typed. `activities` is also filled by the model and by
 *      chips the model wrote, and a sentence about a phrase we invented is
 *      spare whatever it says. This is deliberately stricter than
 *      lib/brief.ts `quotable`, which asks only that every word appear
 *      somewhere in her text — a bag test passes a phrase stitched out of two
 *      different sentences. Implemented here rather than imported so that
 *      breaking `quotable` shows up as a red number instead of moving the
 *      goalposts with it.
 *
 *   B. ASKEDNESS. Typing a word is not asking for it. Two grammatical tells,
 *      neither of them a travel vocabulary:
 *        B1  the clause it came from is a question — "does it matter which
 *            month we go for the weather?" She was asking ABOUT the weather.
 *        B2  the phrase is possessed — "my mum", "our honeymoon". A trip is
 *            not made of the things she owns.
 *
 * WHAT IT CANNOT SEE, written down rather than papered over: a reason stated
 * flatly — "flying to lisbon for work" — is neither a question nor a
 * possessive, and this metric will score a report about it as grounded. That
 * class is what lib/discovery.ts `NOT_AN_ACTIVITY` is for. This is a second,
 * independent net under that list, not a replacement for it: the list is a
 * vocabulary and will always have holes, and a metric built out of the same
 * vocabulary would have exactly the same ones.
 *
 * `unserved` decides WHICH phrases get a sentence, so it is used to build the
 * denominator. It takes no part in the judgement, which is the whole of the
 * numerator — so this is not the circular check that claimAccuracy had to
 * avoid.
 */
export function noiseRate(trip: Trip, brief: Brief): Metric {
  const stated = brief.activities ?? [];
  if (!stated.length) return { score: 1, raw: "nothing stated" };
  const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

  const asPlaces = trip.days.flatMap((d) => d.items
    .filter((i) => i.type === "activity" || i.type === "meal")
    .map((i) => ({ id: i.id, name: i.name, note: i.reason, tags: i.tags, skip: false })));
  // One statement per phrase the app could not place — the same partition
  // lib/flow.ts makes before it opens its mouth.
  const statements = stated.filter((a) =>
    unserved(asPlaces as unknown as Parameters<typeof unserved>[0], [a]).length);
  if (!statements.length) return { score: 1, raw: `${stated.length} stated, nothing said` };

  const typed = [brief.opening ?? "", ...(brief.stated ?? []).filter((x) => x.how === "typed").map((x) => x.text)]
    .map((t) => t.trim()).filter(Boolean);
  /** The clause of a typed message that contains this phrase, if any. */
  const sourceClause = (phrase: string): string | undefined => {
    const p = fold(phrase);
    if (!p) return undefined;
    for (const msg of typed) {
      for (const clause of msg.split(/(?<=[.!?;])\s+|\s*[,;]\s*|\s+[-–—]\s+|\n+/)) {
        if (` ${fold(clause)} `.includes(` ${p} `)) return clause.trim();
      }
      // A phrase that straddles no clause break but sits in the message whole.
      if (` ${fold(msg)} `.includes(` ${p} `)) return msg;
    }
    return undefined;
  };
  const asking = (clause: string) =>
    /\?\s*$/.test(clause)
    || /^\s*(what|which|when|where|why|how|who|whose|is|are|was|were|do|does|did|can|could|will|would|should|shall|am|has|have|had)\b/i.test(clause);
  const possessed = (phrase: string) => /^\s*(my|our|his|her|their)\b/i.test(phrase);

  const spare = statements.filter((a) => {
    const clause = sourceClause(a);
    return !clause || asking(clause) || possessed(a);
  });
  return {
    score: ratio(statements.length - spare.length, statements.length),
    raw: spare.length
      ? `${spare.length}/${statements.length} statements spare: ${spare.join(", ")}`
      : `${statements.length} statement(s), none spare`,
  };
}

/**
 * 18. Every clause she typed is either done or named.
 *
 * lib/edit.ts parses per clause and reports per clause, and the join between
 * the two is `markHandled`, which marks EVERY clause of a polarity as heard
 * the moment ANY clause of that polarity produces an op. So "more wine and
 * more helicopters" makes one op, marks both clauses handled, and the second
 * one disappears — no op, no `unresolved` entry, no sentence. Roughly 30 of
 * 90 clauses in the project's own edit corpus go that way. There is no screen
 * on which this is visible: the turn looks like a success, because the half it
 * did do is described accurately.
 *
 * The rule is not "every clause is obeyed". Plenty of clauses ask for things
 * this engine cannot do, and saying so is the correct answer. The rule is that
 * SILENCE is never the answer: acted on, or named as not acted on.
 *
 * HOW "ACTED ON" IS DECIDED. By ablation, not by reading the parser's
 * internals: parse the whole message, then parse it again with this clause
 * deleted, and compare the ops that are not `unknown`. If removing a clause
 * changes nothing the engine does, that clause did nothing. This is why the
 * metric survives a rewrite of the parser — it never looks inside one — and
 * why it cannot be satisfied by `markHandled` bookkeeping, which is exactly
 * the thing that is wrong.
 *
 * Ablation alone is not enough, and the failure is worth naming because the
 * first version of this scored a correct turn zero. "Actually this is too
 * busy, slow it down" is two clauses that ask for the SAME op, so deleting
 * either one changes nothing and both looked dropped. A clause is therefore
 * also acted on when, parsed by itself, it produces an op that is in the full
 * parse — it said something, and the something is in the result.
 *
 * `parse` is passed in so this scores whichever driver is under test, and so
 * the metric can be exercised directly against `parseEditRules` in a test.
 */
export async function clauseAccounting(
  said: string, parse: (text: string) => Promise<EditOp[]>, unresolved: string[],
): Promise<Metric> {
  // An independent split. Deliberately not lib/clauses.ts CLAUSE_BREAK: a
  // metric that shares its splitter with the code it measures cannot see a
  // clause the splitter loses.
  const clauses = said.split(/(?<=[.!?;])\s+|\s*,\s*|\s+[-–—:\/&]\s+|\s+but\s+|\s+and\s+|\s+plus\s+|\n+/i)
    .map((c) => c.trim()).filter(Boolean);
  if (!clauses.length) return { score: 1, raw: "nothing typed" };

  const real = (ops: EditOp[]) => JSON.stringify(
    ops.filter((o) => o.kind !== "unknown").map((o) => JSON.stringify(o)).sort());
  const full = real(await parse(said));
  const fold = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const named = new Set(unresolved.map(fold));

  const inFull = new Set(JSON.parse(full) as string[]);
  const dropped: string[] = [];
  for (const c of clauses) {
    const without = clauses.filter((x) => x !== c).join(", ");
    const solo = JSON.parse(real(await parse(c))) as string[];
    const actedOn = real(await parse(without)) !== full
      || solo.some((op) => inFull.has(op));
    // Named as not done: the clause itself came back in `unresolved`, or the
    // whole message did (a message the engine understood none of).
    const spoken = named.has(fold(c)) || [...named].some((u) => ` ${u} `.includes(` ${fold(c)} `));
    if (!actedOn && !spoken) dropped.push(c);
  }
  return {
    score: ratio(clauses.length - dropped.length, clauses.length),
    raw: dropped.length
      ? `${clauses.length - dropped.length}/${clauses.length} accounted for; dropped in silence: ${dropped.map((d) => `"${d}"`).join(", ")}`
      : `${clauses.length}/${clauses.length} accounted for`,
  };
}

/**
 * 19. Model calls per place.
 *
 * Every call is a serverless invocation, a bill, and thirty seconds of a
 * traveller watching a spinner. Two calls per researched place is the design:
 * notes, then the pack. Everything above that is a retry, and the retries were
 * added one at a time, each for a good reason, each without anybody counting
 * the total. The worst case is now four for one place — researchStream twice
 * (lib/flow.ts, the flaky-first-call retry) and researchPack twice (the
 * don't-send-her-to-a-different-country retry) — plus a researchPlaces call
 * per base on top of that when the spine comes back thin.
 *
 * This is not asserting that four is a bug. Both retries earn their keep and
 * scripts/regress-turn.ts pins them. It is asserting that the number is
 * VISIBLE, so the fifth one has to be argued for rather than merged.
 *
 * Counted from a recorded call log — the stub-and-record harness in
 * scripts/regress-turn.ts — and restricted to the calls that take a place as
 * an argument. `interpret` and `nextQuestion` scale with how much she typed,
 * not with how many destinations were worked up, and averaging them in would
 * make the number mean nothing.
 */
const PLACE_SCOPED = new Set([
  "researchStream", "researchPack", "researchPlaces", "pitch", "stays", "suggest",
]);

export function callEconomy(calls: { name: string }[], places: string[]): Metric {
  const scoped = calls.filter((c) => PLACE_SCOPED.has(c.name));
  const n = Math.max(1, places.length);
  const per = scoped.length / n;
  const tally = [...new Set(scoped.map((c) => c.name))]
    .map((k) => `${k}×${scoped.filter((c) => c.name === k).length}`).join(" ");
  return {
    // Two per place is free; every call above that is a retry she waits
    // through. Zero at six, which is where a third retry would put us.
    score: clamp01(1 - (per - 2) / 4),
    raw: `${per.toFixed(1)} calls/place over ${n} place(s)${tally ? ` — ${tally}` : ""}`,
  };
}

/**
 * 20. Same input, same plan. And an edit that is undone is undone.
 *
 * Two halves, reported separately, because they fail for different reasons and
 * a mean of the two hides both.
 *
 *   REPLAN     the same brief planned twice gives the same tripSignature.
 *              The scheduler picks from a scored pool, and any tie broken by
 *              insertion order, `Date.now()`, or a `Set` iteration would show
 *              up here as a trip that is different every time she reloads.
 *
 *   ROUNDTRIP  an edit followed by its inverse comes back to where it
 *              started. This is the one a traveller phrases as "undo": say
 *              "no museums", change your mind, say "more museums", and expect
 *              the museums back.
 *
 * Which half failed is in `raw`, always, because "idempotence: 50%" on its own
 * is not actionable.
 */
export function idempotence(
  replan: { a: Trip; b: Trip },
  roundTrips: { said: string; back: string; landed: boolean; restored: boolean }[] = [],
): Metric {
  const sameTwice = tripSignature(replan.a) === tripSignature(replan.b);
  const halves: number[] = [sameTwice ? 1 : 0];
  /*
   * A declined instruction has no inverse, so it is not a round trip. The
   * count of what was skipped goes in `raw` — a skip that is invisible is how
   * this half would quietly become free.
   */
  const real = roundTrips.filter((r) => r.landed);
  const skipped = roundTrips.length - real.length;
  const broken = real.filter((r) => !r.restored);
  if (real.length) halves.push(ratio(real.length - broken.length, real.length));
  const notes = [
    sameTwice ? "replan: same plan twice" : "replan: SAME BRIEF GAVE TWO DIFFERENT PLANS",
    real.length
      ? (broken.length
          ? `roundtrip: ${broken.length}/${real.length} did not come back (${broken.map((r) => `"${r.said}" → "${r.back}"`).join("; ")})`
          : `roundtrip: ${real.length}/${real.length} came back`)
      : roundTrips.length
        ? `roundtrip: not scored — ${skipped} forward edit(s) were declined, so there was nothing to undo`
        : "roundtrip: no inverse declared",
    ...(skipped && real.length ? [`(${skipped} declined, not scored)`] : []),
  ];
  return { score: halves.reduce((a, b) => a + b, 0) / halves.length, raw: notes.join(" · ") };
}

/**
 * 21. Her words survive the session.
 *
 * A widening of `NOT_AN_ACTIVITY` in lib/discovery.ts deletes phrases from
 * `brief.activities`, and when that happened there was no number anywhere that
 * could say what it cost: the schedule was still valid, the pace still right,
 * the slop still low, and a thing she had typed was simply no longer in the
 * brief the planner reads. It had to be measured by hand, on a diff of two
 * corpus runs, by somebody who already suspected it.
 *
 * The rule this scores is the strongest one the product has: every phrase she
 * types that the app takes as meaningful is still on the brief at the end of
 * the session — after every question, patch, replan and edit.
 *
 * FILTERED AT PARSE TIME vs LOST MID-SESSION. This is the whole difficulty,
 * and the distinction drawn here is CUSTODY, not judgement:
 *
 *   - A phrase the parser refused — "for work", "my mum", "montenegro in
 *     june" — never appears in ANY snapshot of the brief. It is not in the
 *     denominator, and this metric has no opinion about it. Refusing it may
 *     have been right or wrong; deciding that would mean holding a second
 *     opinion about what counts as a thing to do, built out of the same
 *     vocabulary as the list it was grading, and a metric assembled from the
 *     word list it measures can only ever agree with it.
 *
 *   - A phrase that IS in a snapshot was taken as meaningful by the app's own
 *     reckoning. From that moment it is in the denominator, and it has to
 *     still be there at the end. That is the defect this exists to catch: a
 *     phrase that was ON the brief and later vanished.
 *
 * WHAT COUNTS AS THE BRIEF. The derived fields, and deliberately NOT `opening`
 * or `stated`. Those two are the append-only raw record and nothing may remove
 * from them, so including them would make every phrase survive by construction
 * and the metric would read 100% on any code at all. A phrase deleted from
 * `activities` still sits in `stated`, and is still gone from everything that
 * matters: the planner's `asked` weight, the research prompt, `unserved`, the
 * "You said" line. Surviving in the transcript is not surviving.
 *
 * `vibes` and `avoidTags` are also out. They are our taxonomy, picked from a
 * fixed list, and a metric about HER words has no business scoring ours.
 *
 * A SHORTLIST IS NARROWED, NOT LOST. `candidates` and `unknownCandidates` hold
 * the options she named while she was still choosing, and naming one clears
 * the rest. "japan or korea, help me pick" then "korea then" drops "japan"
 * from the brief, and this metric cannot tell that from a deletion: an option
 * she DECLINED and a phrase that was silently deleted look identical here.
 * Scoring it either way invents a verdict, so they are counted, named in
 * `raw`, and kept out of the ratio — the same treatment attribution_accuracy
 * gives a claim that names nothing. The number is on the scorecard for a
 * reader to judge; it is not folded into a score that would then mean two
 * different things.
 *
 * SURVIVAL is checked across the whole tracked brief rather than the one field
 * that held it, because a phrase legitimately moves: "the faroe islands" goes
 * from `unknownCandidates` to `namedDestination` when the research resolves,
 * and `mergeActivities` replaces "hiking" with "hiking in the alps". Both are
 * kept, and a same-field test would call both of them losses.
 *
 * WITHDRAWAL IS NOT LOSS. She is allowed to take something back. The two the
 * app records are `flexibleDuration` and `flexibleBudget` — set only when she
 * says she's flexible — and `budgetIsOurs`, which is `cheaper` writing its own
 * target and saying so. Any of those in the final brief excuses the scalar it
 * governs. Nothing excuses a dropped phrase, because there is no field in
 * which she withdraws one.
 */
type Kept = { kind: "activity" | "constraint" | "place" | "length" | "budget" | "option"; text: string };

const foldWords = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
/** The same text with the spaces taken out, for ids: "newzealand" is "New Zealand". */
const squeeze = (s: string) => foldWords(s).replace(/ /g, "");

/** Everything on this brief that traces to a phrase, plus the two scalars. */
function tracked(b: Brief): Kept[] {
  const k = (kind: Kept["kind"]) => (text: string): Kept => ({ kind, text });
  return [
    ...(b.activities ?? []).map(k("activity")),
    ...(b.constraints ?? []).map(k("constraint")),
    ...[b.namedDestination, b.regionLabel, ...(b.avoidPlaces ?? []), ...(b.visitedNames ?? [])]
      .filter((x): x is string => !!x).map(k("place")),
    ...[...(b.candidates ?? []), ...(b.unknownCandidates ?? [])].map(k("option")),
    ...(b.days !== undefined ? [{ kind: "length" as const, text: `${b.days} days` }] : []),
    ...(b.budgetUsd !== undefined && !b.budgetIsOurs
      ? [{ kind: "budget" as const, text: `$${b.budgetUsd}` }] : []),
  ];
}

export function wordsSurvive(snapshots: Brief[]): Metric {
  const end = snapshots[snapshots.length - 1];
  if (!end) return { score: 1, raw: "no session" };
  const typed = [end.opening ?? "", ...(end.stated ?? []).filter((x) => x.how === "typed").map((x) => x.text)];
  const hay = ` ${typed.map(foldWords).join(" | ")} `;
  const tight = typed.map(squeeze).join("|");
  /*
   * Hers, by the same contiguous-run test attribution_accuracy uses: the words
   * in that order, in one message. A phrase the model wrote or a chip label
   * she clicked is on the brief legitimately and is not something she typed,
   * so it is not this metric's business either.
   *
   * The scalars have no phrase to match — "About a week." becomes 7 — so they
   * are hers unless the app has flagged the number as its own.
   */
  const isHers = (c: Kept) => c.kind === "length" || c.kind === "budget"
    || hay.includes(` ${foldWords(c.text)} `)
    || ((c.kind === "place" || c.kind === "option") && tight.includes(squeeze(c.text)));

  const seen = new Map<string, Kept>();
  for (const snap of snapshots) {
    for (const c of tracked(snap)) {
      const id = `${c.kind}:${foldWords(c.text)}`;
      if (!seen.has(id) && foldWords(c.text) && isHers(c)) seen.set(id, c);
    }
  }
  if (!seen.size) return { score: 1, raw: "nothing typed was taken" };

  const still = ` ${tracked(end).map((c) => foldWords(c.text)).join(" | ")} `;
  const stillTight = tracked(end).map((c) => squeeze(c.text)).join("|");
  const survives = (c: Kept) => {
    if (c.kind === "length") return end.days !== undefined
      ? `${end.days} days` === c.text : end.flexibleDuration === true;
    if (c.kind === "budget") return end.budgetUsd !== undefined
      ? `$${end.budgetUsd}` === c.text : (end.flexibleBudget === true || end.budgetIsOurs === true);
    return still.includes(` ${foldWords(c.text)} `) || stillTight.includes(squeeze(c.text));
  };
  const gone = [...seen.values()].filter((c) => !survives(c));
  const lost = gone.filter((c) => c.kind !== "option");
  const narrowed = gone.filter((c) => c.kind === "option");
  const scored = [...seen.values()].filter((c) => c.kind !== "option");
  const note = narrowed.length
    ? ` · ${narrowed.length} shortlist option(s) narrowed away, not scored: ${narrowed.map((c) => `"${c.text}"`).join(", ")}`
    : "";
  if (!scored.length) return { score: 1, raw: `nothing typed was taken${note}` };
  return {
    score: ratio(scored.length - lost.length, scored.length),
    raw: lost.length
      ? `${scored.length - lost.length}/${scored.length} kept; lost: ${lost.map((c) => `"${c.text}" (${c.kind})`).join(", ")}${note}`
      : `${scored.length}/${scored.length} typed phrases still on the brief${note}`,
  };
}

/**
 * 22. Only her words are quoted back at her.
 *
 * "You said X" fabricated 278 attributions across 60 trips, off a message that
 * names nothing at all: the `claimed` gate in lib/reasons.ts asks whether any
 * word of the line is a word she typed, and "can you plan me a trip" put the
 * word "you" in her licence set — and every one of the eleven second-person
 * reason lines contains "you". The gate was right; its alphabet was full of
 * words that are not things to do.
 *
 * lib/brief.ts `quotable` and lib/concept.ts `whyLine` are the guards that
 * came out of that, and they are pinned by ONE assertion on ONE hand-built
 * fixture. This turns them into a number over every scenario, and widens the
 * net past `whyLine` to every surface that puts words in her mouth: the
 * unenforced-constraints note, the planner's date and override notes, the
 * pitch, and the reason under every item.
 *
 * THE TEST IS A CONTIGUOUS RUN — those words, in that order, inside one thing
 * she typed. Deliberately stricter than both guards, and implemented here
 * rather than imported from either:
 *
 *   - `quotable` asks only that every WORD of the phrase appear somewhere in
 *     her text, so a phrase stitched out of two different sentences passes;
 *   - `claimed` asks only that ONE word of the line be one of hers, after
 *     stemming, which is how "beaches" licensed "the city days you asked for".
 *
 * Importing either would mean a broken guard moved the goalposts along with
 * the code, and the number would stay green through the bug.
 *
 * TAXONOMY AND CHIPS ARE NOT HER WORDS. `vibes` are ids off a fixed list and
 * chip labels are written by the model; neither is read here at all. The typed
 * side is `opening` plus the `stated` entries marked "typed", and nothing
 * else. This is what catches "You said city energy" said to someone who typed
 * "eat my way through a city": "city" is hers, "city energy" is ours.
 *
 * WHAT IT CANNOT SEE, written down rather than papered over. Four of the
 * reason-bank lines claim without naming what they claim — "You were clear
 * about that", "Half the point of coming here is being able to do this". The
 * span such a line attributes is in the sentence next to it, in our prose, and
 * pulling a phrase of hers out of our prose is guesswork; a metric that
 * guesses is measuring its own guesser. So they are counted, named in `raw`,
 * and kept out of the ratio. None of them fires on any scenario in the suite
 * today, which is checkable and is why the exclusion currently costs nothing.
 */

/** A claim that leads: the phrase it attributes follows it. */
const ATTRIB_LEAD = /\byou (?:also\s+)?(?:said|asked for|wanted|told me|didn'?t want|did not want)\b/gi;
/** A claim that trails: the phrase it attributes is the subject before it. */
const ATTRIB_TRAIL = /\b(?:on your list|top of your list|one of your interests|was the brief|were the brief|half the point|kept coming up in what you told me)\b/i;
/** A claim that names nothing. Counted, reported, not scored. See the note above. */
const ATTRIB_BARE = /\byou were clear\b|\bwhat you asked for\b/i;
/** Words that sit between the subject and a trailing claim, and are not the subject. */
const CARRIER = new Set(["was", "were", "is", "are", "explicit", "near", "the", "a", "an",
  "of", "top", "still", "all", "really", "mostly", "and", "also", "specifically", "very"]);

/** Where a leading claim's phrase stops: the sentence, or the turn it takes. */
const LEAD_END = /[.;!?]|,?\s+(?:but|so|rather than|and this|and that|which|because)\s+|,?\s+over\s+\d+\s+days/i;

export function attributionAccuracy(texts: string[], brief: Brief): Metric {
  const typed = [brief.opening ?? "", ...(brief.stated ?? []).filter((x) => x.how === "typed").map((x) => x.text)]
    .map((t) => t.trim()).filter(Boolean);
  const hay = ` ${typed.map(foldWords).join(" | ")} `;

  const spans: string[] = [];
  let unnamed = 0;
  const add = (raw: string) => {
    for (const part of raw.split(/,| and /i)) {
      const s = part.trim().replace(/^(?:to|not|for)\s+/i, "").replace(/^["'“”]+|["'“”.,;:]+$/g, "").trim();
      if (foldWords(s)) spans.push(s);
    }
  };

  for (const text of texts) {
    if (!text) continue;
    const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
    for (const sentence of sentences) {
      // A quoted run is the app showing its work, and is the phrase it means.
      const quoted = [...sentence.matchAll(/[""“]([^""”]{2,})[""”]/g)].map((m) => m[1]);
      const leads = [...sentence.matchAll(ATTRIB_LEAD)];
      const trail = sentence.match(ATTRIB_TRAIL);
      if (quoted.length && (leads.length || trail)) { quoted.forEach(add); continue; }
      if (leads.length) {
        for (const m of leads) {
          const after = sentence.slice(m.index! + m[0].length);
          const stop = after.search(LEAD_END);
          const span = (stop === -1 ? after : after.slice(0, stop)).trim();
          /*
           * A span that is itself a claim is not the phrase. "because you said
           * you didn't want to be out early" matches twice, and counting the
           * outer one as well would score one sentence as two attributions and
           * inflate whichever way it fell. The inner match is the claim.
           */
          if (/^you\b/i.test(span)) continue;
          if (foldWords(span)) add(span); else unnamed++;
        }
        continue;
      }
      if (trail) {
        const before = sentence.slice(0, trail.index!).trim().split(/\s+/);
        while (before.length && CARRIER.has(before[before.length - 1].toLowerCase().replace(/[^a-z]/g, ""))) before.pop();
        // Nothing in front of it: the claim leans on the sentence before, which
        // is our prose. Counted, not scored.
        if (before.length) add(before.join(" ")); else unnamed++;
        continue;
      }
      if (ATTRIB_BARE.test(sentence)) unnamed++;
    }
  }

  if (!spans.length) {
    return { score: 1, raw: unnamed ? `nothing attributed by name (${unnamed} unnamed claim(s))` : "nothing attributed" };
  }
  const wrong = spans.filter((s) => !hay.includes(` ${foldWords(s)} `));
  const note = unnamed ? ` · ${unnamed} unnamed claim(s), not scored` : "";
  return {
    score: ratio(spans.length - wrong.length, spans.length),
    raw: wrong.length
      ? `${spans.length - wrong.length}/${spans.length} attributed phrases are hers; fabricated: ${[...new Set(wrong)].map((s) => `"${s}"`).join(", ")}${note}`
      : `${spans.length}/${spans.length} attributed phrases are hers${note}`,
  };
}
