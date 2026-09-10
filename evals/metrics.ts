import type { Brief, ItineraryDay, TravelerProfile, Trip } from "@/lib/types";
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
