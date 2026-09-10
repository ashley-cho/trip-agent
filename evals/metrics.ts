import type { Brief, ItineraryDay, TravelerProfile, Trip } from "@/lib/types";
import type { EditOp } from "@/lib/agent/types";
import { PACE_ACTIVITIES, ALL_VIBES } from "@/lib/types";
import { critique, intraDayKm } from "@/lib/critic";
import { inferPace } from "@/lib/discovery";
import { avoidedTags, coreTags, supportTags, unserved, SIGNATURE_TAGS } from "@/lib/select";
import { DESTINATIONS, destinationById, cityById } from "@/data/destinations";
import { anchorOf, labelDrift, proseDrift, subjectDrift, threadDrift, type Drift } from "@/lib/drift";
import type { Question, Turn } from "@/lib/agent/types";

// ---------------------------------------------------------------------------
// Every metric returns 0..1 (higher is better) plus a raw figure, so the
// scorecard can show both "0.83" and "5 of 6 days".
// ---------------------------------------------------------------------------

export interface Metric {
  score: number;
  raw: string;
  /**
   * There was nothing here to measure, so this cell is not a number.
   *
   * It exists because the harness now runs the product's own turn, and the
   * product is allowed to end a session without a plan: it refuses to pitch
   * somewhere she never named, it stops when research fails rather than
   * substituting a country. Twenty of the metrics below read a Trip. On a
   * session that produced none, a 0 would say the app built a bad trip and a
   * 1 would say it built a good one, and it built neither.
   *
   * So the cell is dropped from the row mean and from the column mean, and
   * the count of dropped cells is printed. What stops that being a free pass
   * is `outcome_fidelity`, which is computed on every row and asks whether
   * ending without a plan was the right answer to this scenario.
   */
  na?: boolean;
}
export type Scores = Record<string, Metric>;

/** A cell with nothing in it. See Metric.na. */
export const na = (raw: string): Metric => ({ score: 1, raw, na: true });

/** The mean of the cells that are actually numbers. */
export function meanOf(ms: Metric[]): number {
  const live = ms.filter((m) => !m.na);
  return live.length ? live.reduce((a, m) => a + m.score, 0) / live.length : 1;
}

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

export type Outcome = "plan" | "refusal";

/**
 * 28. It ends the way this scenario should end.
 *
 * New with the harness that runs `advance()` instead of reimplementing it,
 * and it is the price of `Metric.na`.
 *
 * The product is allowed to finish a session with no itinerary. It refuses to
 * rank the catalogue when she named nowhere; it refuses to substitute a
 * country when research fails; it stops rather than pitch a destination she
 * never asked for. Those refusals are the product working. But twenty of the
 * metrics above read a Trip, and a row with no Trip drops them — so without
 * something scoring the refusal ITSELF, the cheapest way to a green scorecard
 * would be an app that refuses everything.
 *
 * So the scenario declares which ending is correct and this asks whether it
 * got that one. `unresearched-place` names a place the catalogue does not
 * hold, and the harness's research stub never returns a pack, so the only
 * honest ending is "I couldn't work up the Faroe Islands, and I'm not going
 * to send you somewhere else" — declared `outcome: "refusal"`, scored 100%
 * when that is what happens, and 0% the moment the app plans Korea instead.
 *
 * The reverse is the mutation guard: break a gate in lib/flow.ts and the
 * scenarios that should reach an itinerary stop reaching one, and this goes
 * red on every one of them while the plan-quality columns go quiet.
 */
export function outcomeFidelity(got: Outcome, want: Outcome, why: string): Metric {
  if (got === want) {
    return { score: 1, raw: want === "plan" ? "planned it" : `refused, correctly — ${why}` };
  }
  return got === "refusal"
    ? { score: 0, raw: `no plan, and this scenario should have produced one — ${why}` }
    : { score: 0, raw: "planned a trip this scenario says it should have refused" };
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
  subject_stability: "Stayed on her subject",
  prose_grounding: "Prose matches the plan",
  thread_continuity: "Keeps the thread",
  label_honesty: "Honest thinking text",
  outcome_fidelity: "Plan or honest refusal",
};

// ---------------------------------------------------------------------------
// Drift. Four metrics, four surfaces, ONE set of detectors — the same
// functions lib/flow.ts acts on at runtime, imported rather than reimplemented.
//
// That is the whole point of them being in lib/drift.ts. Three times today a
// test in this repo was green against the exact bug it was written for, and
// every one of those was a checker that had its own private copy of the thing
// it was checking. A metric that cannot disagree with the runtime is worth
// having; a metric that reimplements it measures itself.
//
// Two of the four are scored from the artefacts a scenario already produces —
// the recommendation and the pitch. Two need a turn to have actually run, so
// they read what `advance()` reported through `io.noteDrift`. Both kinds are
// mutation-verified in scripts/regress-drift.ts.
// ---------------------------------------------------------------------------

/**
 * 24. The plan is still about the place she named.
 *
 * Not the same question as `destination_fidelity`, which compares the answer
 * to a value written in the scenario file. This compares it to HER BRIEF, so
 * it holds on scenarios with no expected destination, on the sweep, and on
 * anything a real traveller types. "Someone asked for more detail on New
 * Orleans and was told to go to Paris" scores zero here and 100% on every
 * other metric on the scorecard.
 */
export function subjectStability(
  brief: Brief, profile: TravelerProfile, chosenId: string | null,
  events: Drift[] = [],
): Metric {
  /*
   * The drift the TURN caught comes first, and it is what makes this metric
   * survive its own guard.
   *
   * lib/flow.ts stops rather than pitching a destination she never named. So
   * once the harness drives the real turn, the id that reaches the scorecard
   * can only ever be an id that passed the guard, and reading the id alone
   * would score 100% on exactly the bug this metric exists for — the same
   * failure `thread_continuity` and `label_honesty` are written against, one
   * paragraph up. What the app CAUGHT is what it got wrong.
   */
  const caught = events.filter((d) => d.kind === "subject");
  if (caught.length) return { score: 0, raw: caught.map((d) => d.says).join("; ") };
  const a = anchorOf(brief, null, profile);
  if (a.open) return { score: 1, raw: "she named nowhere" };
  const anchored = `anchored on ${[...a.ids, ...a.words].join(", ")}`;
  /*
   * No destination was spoken at all. That is not drift — it is the app
   * declining to name one — and it is scored here rather than dropped,
   * because "it stayed on her subject" is exactly what an honest refusal did.
   * Whether refusing was the right answer is `outcome_fidelity`'s question.
   */
  if (!chosenId) return { score: 1, raw: `${anchored}; nothing else was pitched` };
  const d = subjectDrift(a, chosenId);
  return d ? { score: 0, raw: d.says } : { score: 1, raw: anchored };
}

/**
 * 25. The prose is about the trip underneath it.
 *
 * Three failures, one detector: it names somewhere else, it promises a city
 * this itinerary does not visit, or it never mentions the destination at all.
 * The genuinely-torn case is exempt for the same reason
 * `single_recommendation` allows one alternative there.
 */
export function proseGrounding(
  prose: string,
  rec: { destinationId: string; confidence: string; alternativeId?: string } | undefined,
  trip: Trip | null,
  events: Drift[] = [],
): Metric {
  /*
   * Same reasoning as `subject_stability` above, and the same two surfaces:
   * lib/flow.ts runs `proseDrift` over the streamed research write-up and
   * again over the pitch, and WITHHOLDS the paragraph when either wanders. So
   * the prose that reaches this function is prose that already passed, and a
   * paragraph the app refused to show is a paragraph it wrote wrong.
   */
  const caught = events.filter((d) => d.kind === "prose");
  if (caught.length) return { score: 0, raw: caught.map((d) => d.says).join("; ") };
  if (!rec || !trip || !prose.trim()) return na("no prose was spoken");
  if (rec.confidence !== "high" && rec.alternativeId) return { score: 1, raw: "torn, names the runner-up on purpose" };
  const d = destinationById(rec.destinationId);
  const plannedCities = [...new Set([
    ...trip.days.map((x) => x.cityId),
    ...trip.concept.shape.flatMap((l) => [l.cityId, l.dayTrip, l.extraDayTrip]),
  ])].filter((x): x is string => !!x);
  const drift = proseDrift(
    { name: d?.name ?? rec.destinationId, id: rec.destinationId, plannedCities },
    prose,
  );
  return drift
    ? { score: 0, raw: drift.says }
    : { score: 1, raw: `grounded in ${d?.name ?? rec.destinationId}` };
}

/**
 * 26. It does not ask what it has already been told.
 *
 * Counted over every question the scenario was offered — the ones the harness
 * put to her in discovery, and the ones a real turn put through the gate in
 * lib/flow.ts. A question that was DROPPED by the gate still counts against
 * the score: the app handled it correctly, and it should not have been asked.
 * Scoring the gate instead of the drift would make this metric go green the
 * moment the guard was added, which is the opposite of what it is for.
 */
export function threadContinuity(
  offered: { q: Question; history: Turn[]; brief: Brief }[],
  fromTurn: { asked: number; drift: Drift[] } = { asked: 0, drift: [] },
): Metric {
  const pure = offered.map((o) => threadDrift(o.q, o.history, o.brief)).filter((d): d is Drift => !!d);
  const turned = fromTurn.drift.filter((d) => d.kind === "thread");
  const total = offered.length + fromTurn.asked + turned.length;
  if (!total) return { score: 1, raw: "no questions asked" };
  const bad = pure.length + turned.length;
  return {
    score: ratio(total - bad, total),
    raw: bad
      ? `${bad}/${total} already answered: ${[...pure, ...turned].map((d) => d.says).join("; ")}`
      : `${total} question${total === 1 ? "" : "s"}, none re-asked`,
  };
}

/**
 * 27. The words on the spinner describe the work.
 *
 * Scored on what the turn TRIED to show her, not on what survived the guard —
 * same reasoning as `thread_continuity`. A label the guard withheld is a label
 * the app built wrong.
 */
export function labelHonesty(
  rec: { labels: (string | null)[]; drift: Drift[] },
): Metric {
  const shown = rec.labels.filter((l): l is string => l !== null);
  const bad = rec.drift.filter((d) => d.kind === "label");
  const total = shown.length + bad.length;
  if (!total) return { score: 1, raw: "no thinking text shown" };
  return {
    score: ratio(total - bad.length, total),
    raw: bad.length
      ? `${bad.length}/${total} wrong: ${bad.map((d) => d.evidence).join("; ")}`
      : `${total} label${total === 1 ? "" : "s"}, all honest`,
  };
}

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
 * THE RULE, verbatim from the product owner: "it must stay faithful to the
 * user's input, that tops everything" and "every single thing that the user
 * types or selects must sustain in that session at least."
 *
 * WHAT THIS USED TO BE, AND WHY IT WAS WORTHLESS. The first version took its
 * denominator from the BRIEF: everything that had ever appeared in a snapshot
 * of `activities`, `constraints`, the place fields and the two scalars, and
 * asked whether it was still there at the end. It read 100% on every scenario
 * and it could not have read anything else. Nothing in this codebase removes
 * from those fields mid-session — `applyPatch` is additive for every list it
 * touches, `union` only grows, `mergeActivities` replaces a thin wording with
 * a fuller one and never drops — so the metric was a ratchet on a property
 * that happens to hold, not a test of the rule above.
 *
 * The deletion the rule is actually about happens EARLIER, at parse time, and
 * a brief-sourced denominator can never see it: `NOT_AN_ACTIVITY` in
 * lib/discovery.ts refuses a phrase before it ever reaches `activities`, so
 * the phrase appears in no snapshot, is in no denominator, and is scored as
 * nothing at all. "i want to go to portugal for a rest" ends the session with
 * the word "rest" nowhere on the brief, nowhere in the plan and in nothing the
 * app ever said — and the old metric called that a perfect score.
 *
 * The previous version wrote that blindness down as a deliberate choice —
 * "CUSTODY, not judgement" — on the grounds that judging a refusal would mean
 * holding a second opinion about what counts as a thing to do, "built out of
 * the same vocabulary as the list it was grading". That reasoning is sound
 * about VOCABULARY and it does not license the conclusion. This version keeps
 * the ban on a second vocabulary and drops the blindness, by asking a question
 * that needs no opinion about what a phrase MEANS:
 *
 *   she typed it — can she still find it anywhere?
 *
 * WHERE A PHRASE MAY BE FOUND. Three places, and they are the three the
 * product actually offers:
 *
 *   ON THE BRIEF   — still in a derived field, so everything downstream that
 *                    reads the brief still knows about it. This is the one
 *                    that matters most: `brief.activities` is what lib/flow.ts
 *                    reports on, so a phrase that reaches it is guaranteed to
 *                    be either served or named out loud.
 *   IN THE PLAN    — visible in the itinerary she is looking at: a day theme,
 *                    an item name, the headline or the pitch.
 *   SAID BACK      — named to her as something not done. The unmatched-activity
 *                    report, the unenforced-constraint note, the `unresolved`
 *                    clauses from lib/edit.ts, whatever the edits replied.
 *
 * Anything else is the failure: the phrase went in and there is no way back to
 * it. That, and not "a field shrank", is what "silently vanishing" means.
 *
 * WHERE THE DENOMINATOR COMES FROM. What she typed, segmented by the app's own
 * grammar and by nothing else. `purposePhrases` below is `statedActivity`'s
 * clause split and its rightmost-purpose-clause scan, narrowest match first —
 * the same reading of the same English — with every VOCABULARY gate removed:
 * no `NOT_AN_ACTIVITY`, no `WHO_NOT_WHAT`, no month list, no place list. The
 * metric agrees with the parser about WHERE in the sentence she said what the
 * trip is for, and holds no opinion at all about whether the answer was a good
 * one. That is the line the old comment was reaching for, drawn in the one
 * place it can be drawn without a second word list.
 *
 * Every scalar and phrase that ever reached the brief is still in the
 * denominator too, so the ratchet the old version provided is not lost — it is
 * just no longer the whole test.
 *
 * WORD-LEVEL ON THE BRIEF, CONTIGUOUS IN WHAT SHE READS. A phrase stored on
 * the brief is found when every content word in it is found, stems compared;
 * contiguity cannot be required there, because the app legitimately reshapes
 * ("hiking" becomes "hiking in the alps", "the faroe islands" moves from
 * `unknownCandidates` to `namedDestination`) and legitimately splits ("the
 * surfing and the seafood" becomes two entries). Requiring EVERY word rather
 * than any word is what stops "the exchange rate" passing on the word "the".
 * This is `quotable`'s test in lib/brief.ts, run in the opposite direction.
 *
 * The plan and what was said are matched as contiguous runs instead, because
 * they are thousands of words of generated prose and a bag test over them is
 * satisfied by coincidence. See `runs` below for the case that forced it.
 *
 * A SHORTLIST IS NARROWED, NOT LOST. `candidates` and `unknownCandidates` hold
 * the options she named while still choosing, and picking one clears the rest.
 * "japan or korea, help me pick" then "korea then" drops japan, and an option
 * DECLINED and a phrase silently deleted look identical from here. Counted,
 * named in `raw`, kept out of the ratio — same treatment `attribution_accuracy`
 * gives a claim that names nothing.
 *
 * WITHDRAWAL IS NOT LOSS. `flexibleDuration`, `flexibleBudget` and
 * `budgetIsOurs` in the final brief excuse the scalar each governs. There is
 * no field in which she withdraws a phrase, so nothing excuses a dropped one.
 *
 * `stated` and `opening` are NOT survival surfaces, and that is unchanged.
 * They are the append-only raw record; counting them would make every phrase
 * survive by construction, which is how the old metric would have looked had
 * it been written the other obvious wrong way. Surviving in the transcript is
 * not surviving.
 */
type Kept = { kind: "typed" | "activity" | "aside" | "constraint" | "place" | "length" | "budget" | "option"; text: string };

const foldWords = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
/** The same text with the spaces taken out, for ids: "newzealand" is "New Zealand". */
const squeeze = (s: string) => foldWords(s).replace(/ /g, "");

/** Everything on this brief that traces to a phrase, plus the two scalars. */
function tracked(b: Brief): Kept[] {
  const k = (kind: Kept["kind"]) => (text: string): Kept => ({ kind, text });
  return [
    ...(b.activities ?? []).map(k("activity")),
    /*
     * The reason/quality/companion half of what she said the trip was for.
     * Counted exactly like an activity: it is a phrase she typed that the app
     * chose to keep, and the question here is only whether it is still there.
     */
    ...(b.asides ?? []).map(k("aside")),
    ...(b.constraints ?? []).map(k("constraint")),
    ...[b.namedDestination, b.regionLabel, ...(b.avoidPlaces ?? []), ...(b.visitedNames ?? [])]
      .filter((x): x is string => !!x).map(k("place")),
    ...[...(b.candidates ?? []), ...(b.unknownCandidates ?? [])].map(k("option")),
    ...(b.days !== undefined ? [{ kind: "length" as const, text: `${b.days} days` }] : []),
    ...(b.budgetUsd !== undefined && !b.budgetIsOurs
      ? [{ kind: "budget" as const, text: `$${b.budgetUsd}` }] : []),
  ];
}

/**
 * `statedActivity`'s reading of the sentence, with its vocabulary removed.
 *
 * Same clause split, same rightmost-purpose-clause scan, same narrowest-match-
 * wins rule and the same six-word ceiling, so this and the parser always agree
 * about which span of the message is the answer to "what is the trip for".
 * What is deliberately NOT here is every test `ok()` applies to the span once
 * it has it — the reason list, the companion list, the month list, the place
 * lists. Those are the thing under measurement; re-running them here would
 * produce a metric that can only ever agree with the code it grades.
 */
const PURPOSE_TAIL =
  /^\b(?:for|to)\s+((?!go\b|visit\b|travel\b|leave\b|get\b|be\b)[a-zÀ-ɏ][\w'À-ɏ-]*(?:\s+[\w'À-ɏ-]+){0,5})\s*$/i;

/**
 * The words in a phrase that answer WHEN rather than WHAT.
 *
 * "i want to eat my way through a city for a week and a bit" puts "a week and
 * a bit" in the purpose slot. `statedActivity` refuses it, correctly and
 * without losing anything: the answer is on the brief as `days: 8`. But the
 * word "week" is not inside that number and no lexical test will ever find it
 * there, so scoring the phrase by its text reds a conversion that is right.
 *
 * So the time words are taken out and what is LEFT decides:
 *
 *   nothing left       -> a pure when, scored against the scalar: did the
 *                         length, month or date she gave survive at all.
 *   something left     -> that is the request, and it is scored like any
 *                         other. "heading to denmark for a week of design
 *                         museums" is refused whole by the parser because it
 *                         contains "week", and "design museums" is then gone
 *                         with no trace anywhere. Bucketing the phrase as a
 *                         when would have hidden exactly that.
 *
 * Seasons are deliberately absent: "spring" is half of "hot springs", and
 * losing that word to a time list would blunt a real request to save a rare
 * one. A season phrase therefore scores as an ordinary phrase, which fails
 * toward a false red — the safe direction.
 */
const TIME_STEM = new Set(["day", "night", "week", "month", "weekend", "fortnight",
  "januari", "februari", "march", "april", "may", "jun", "juli", "august",
  "septemb", "octob", "novemb", "decemb", "jan", "feb", "mar", "apr", "sep", "oct", "nov", "dec"]);

export function purposePhrases(text: string): string[] {
  const out: string[] = [];
  const t = text.trim().replace(/[.!?]+$/, "");
  for (const clause of t.split(/[.;!?]+|,\s+/).map((c) => c.trim()).filter(Boolean)) {
    for (let i = clause.length - 1; i >= 0; i--) {
      const m = clause.slice(i).match(PURPOSE_TAIL);
      if (!m) continue;
      const said = m[1].trim().replace(/\s+(please|thanks|thank you)$/i, "").trim();
      if (said) out.push(said);
      break;
    }
  }
  return out;
}

/**
 * Words that carry no request on their own.
 *
 * This list decides only which words are IGNORED when checking whether a
 * phrase can be found. It never decides whether a phrase counts, so a word
 * missing from it costs a false red at worst and can never hide a deletion —
 * the opposite direction from `NOT_AN_ACTIVITY`, which is why a word list is
 * safe here and dangerous there.
 *
 * Three kinds, all of them English grammar rather than anything about travel:
 * determiners, pronouns and prepositions; politeness; and the light verbs.
 *
 * The light verbs are the ones this actually needed. "i also really want to
 * spend time in hot springs" is `statedActivity`'s phrase verbatim, and the
 * request in it is "hot springs" — "spend" and "time" are how English gets to
 * the noun. Without them the metric red-flagged a trip that had put Sky Lagoon
 * and a geothermal beach on the itinerary and said so. Same for "see the
 * northern lights", where the request is the lights.
 *
 * Checked against every entry in `NOT_AN_ACTIVITY`: none of them is emptied by
 * this list, so it cannot blunt the deletions this metric exists to catch.
 */
const EMPTY_WORD = new Set([
  // determiners, pronouns, prepositions, copulas
  "the", "a", "an", "some", "any", "of", "and", "or", "for", "to", "in", "on",
  "at", "with", "my", "our", "your", "his", "her", "their", "its", "this",
  "that", "these", "those", "it", "is", "are", "am", "be", "been", "was",
  "were", "i", "we", "you", "s", "d", "ll", "re", "t", "m",
  // politeness and filler
  "please", "thanks", "thank", "just", "really", "very", "bit", "lots", "lot",
  "maybe", "also", "actually",
  // light verbs and the generic nouns that ride with them
  "go", "going", "see", "seeing", "do", "doing", "have", "having", "get",
  "getting", "spend", "spending", "take", "taking", "try", "trying", "enjoy",
  "enjoying", "explore", "exploring", "experience", "experiencing", "want",
  "wanting", "like", "love", "need", "make", "making", "time", "times",
  "thing", "things", "something", "anything",
]);

/**
 * The stem test lib/select.ts uses, reimplemented rather than imported.
 *
 * Importing it would mean a broken stemmer moved the goalposts along with the
 * code and this number stayed green through the bug — the same reason
 * `attribution_accuracy` implements its own run test instead of calling
 * `quotable`.
 */
function metricStem(w: string): string {
  const x = w.toLowerCase().replace(/[^a-z0-9]/g, "");
  const cut = (re: RegExp, min: number) => {
    const y = x.replace(re, "");
    return y.length >= min ? y : x;
  };
  let y = cut(/(ings|ing)$/, 3);
  if (y === x) y = cut(/(ers|er)$/, 4);
  if (y === x) y = cut(/(ies|es|s)$/, 3);
  return y.length > 3 ? y.replace(/e$/, "") : y;
}

const contentStems = (s: string) => foldWords(s).split(" ")
  .filter((w) => w && !EMPTY_WORD.has(w)).map(metricStem);

/**
 * Everywhere a phrase she typed is allowed to have ended up.
 *
 * Assembled by the harness from the state she is actually left looking at, and
 * passed in rather than reconstructed here: a metric that rebuilds the plan's
 * prose out of its own idea of what the app says is measuring the harness.
 */
export interface SessionSurfaces {
  /** Every message she typed, in order: the opening, every answer, every edit. */
  typed: string[];
  /** The finished itinerary as text: the pitch, the concept lines, day themes, item names. */
  plan: string[];
  /** Everything the app said back to her, including what it said it could not do. */
  spoken: string[];
}

export function wordsSurvive(snapshots: Brief[], session: SessionSurfaces): Metric {
  const end = snapshots[snapshots.length - 1];
  if (!end) return { score: 1, raw: "no session" };

  const typed = session.typed.length
    ? session.typed
    : [end.opening ?? "", ...(end.stated ?? []).filter((x) => x.how === "typed").map((x) => x.text)];
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
  /*
   * Source one: everything she typed that the app read as the point of the
   * trip. This is the half the old metric could not see, and it is where the
   * `NOT_AN_ACTIVITY` deletions live — a phrase refused here reaches no
   * snapshot at all.
   */
  for (const message of typed) {
    for (const phrase of purposePhrases(message)) {
      if (!contentStems(phrase).length) continue;
      const id = `typed:${foldWords(phrase)}`;
      if (!seen.has(id)) seen.set(id, { kind: "typed", text: phrase });
    }
  }
  /*
   * Source two: everything that ever reached the brief. The old denominator,
   * kept whole — a phrase the parser DID take and something later dropped is
   * still a loss, and it is a loss this source and only this source can see.
   */
  for (const snap of snapshots) {
    for (const c of tracked(snap)) {
      const id = `${c.kind}:${foldWords(c.text)}`;
      if (!seen.has(id) && foldWords(c.text) && isHers(c)) seen.set(id, c);
    }
  }
  if (!seen.size) return { score: 1, raw: "nothing typed was taken" };

  /*
   * The three places a phrase is allowed to be. The brief comes first and on
   * its own is the strong result: `brief.activities` is what lib/flow.ts
   * reports against, so a phrase that is still there is guaranteed to be
   * either in the plan or named out loud. The other two catch the phrase that
   * left the brief and is still visible to her somewhere.
   *
   * And two brief surfaces, not one, because `asides` is deliberately inert.
   *
   * A phrase in `asides` is KEPT — that is the whole point of the field, and
   * for a phrase the parser refused at the front door it is the right and
   * complete answer. But a phrase the parser once ACCEPTED as a thing to do
   * and later holds only as an aside has been demoted: it has lost the +0.6
   * `asked` weight, the research interest line, `unserved`'s report and its
   * quotability, while still looking present to a test that reads the whole
   * brief at once. So the acted-on fields are tracked separately and a phrase
   * that was on `activities` has to still be somewhere that acts.
   */
  const actedStems = new Set(tracked(end).filter((c) => c.kind !== "aside")
    .flatMap((c) => contentStems(c.text))
    .concat(contentStems(end.regionLabel ?? ""))
    .concat(end.month ? contentStems(end.month) : [])
    .concat(end.dates ? contentStems(String(end.dates)) : [])
    .concat(end.origin ? contentStems(String(end.origin)) : []));
  const briefStems = new Set([...actedStems,
    ...(end.asides ?? []).flatMap(contentStems)]);
  /*
   * The two surfaces she READS are matched as contiguous runs, not as a bag.
   *
   * A bag over the whole itinerary is far too easy to satisfy by accident: the
   * plan is thousands of words of generated prose, and "for the scenery" and
   * "for work" are one content word each. "for work" scored as recoverable off
   * an item reason reading "a good room to work out what you actually like" —
   * a false pass, which is the direction that matters, because a false pass is
   * a deletion the metric misses.
   *
   * So the phrase's content words have to appear in that order, adjacent once
   * the empty words are dropped. Storage on the brief stays a bag, because
   * `mergeActivities` and the move from `unknownCandidates` to
   * `namedDestination` legitimately reshape a phrase in place.
   *
   * KNOWN LIMIT, and the direction it fails in: a one-word phrase is still one
   * word, and a run of one matches any occurrence of it anywhere in the plan.
   * Nothing lexical can separate her "work" from the reason bank's "work out".
   * It fails toward a false pass on single common words only, it is written
   * down here rather than papered over, and the phrases it could hide are the
   * ones scripts/regress-parsers.ts pins by name.
   */
  const runs = (texts: string[]) => ` ${texts.map((t) => contentStems(t).join(" ")).join(" | ")} `;
  const planText = runs(session.plan);
  const spokenText = runs(session.spoken);
  const readable = (hay: string, stems: string[]) => hay.includes(` ${stems.join(" ")} `);

  const where = (c: Kept): "brief" | "plan" | "said" | null => {
    if (c.kind === "length") {
      return end.days !== undefined
        ? (`${end.days} days` === c.text ? "brief" : null)
        : (end.flexibleDuration === true ? "brief" : null);
    }
    if (c.kind === "budget") {
      return end.budgetUsd !== undefined
        ? (`$${end.budgetUsd}` === c.text ? "brief" : null)
        : ((end.flexibleBudget === true || end.budgetIsOurs === true) ? "brief" : null);
    }
    const stems = contentStems(c.text).filter((w) => !TIME_STEM.has(w) && !/^\d+$/.test(w));
    if (!stems.length) {
      /*
       * Nothing but a time expression. Scored against the answer it became:
       * she said "a week", the brief says 8 days, or a month, or a date range,
       * and any of those is her answer kept. None of them at all is it lost.
       */
      return (end.days !== undefined || end.flexibleDuration === true
        || !!end.month || !!end.dates || !!end.anchorDate) ? "brief" : null;
    }
    // A phrase that reached `activities` is held to the acted-on fields; every
    // other kind, `asides` included, may be anywhere on the brief.
    const held = c.kind === "activity" ? actedStems : briefStems;
    if (stems.every((w) => held.has(w))) return "brief";
    if (readable(planText, stems)) return "plan";
    if (readable(spokenText, stems)) return "said";
    return null;
  };

  const all = [...seen.values()];
  const gone = all.filter((c) => where(c) === null);
  const lost = gone.filter((c) => c.kind !== "option");
  const narrowed = gone.filter((c) => c.kind === "option");
  const scored = all.filter((c) => c.kind !== "option");
  const note = narrowed.length
    ? ` · ${narrowed.length} shortlist option(s) narrowed away, not scored: ${narrowed.map((c) => `"${c.text}"`).join(", ")}`
    : "";
  if (!scored.length) return { score: 1, raw: `nothing typed was taken${note}` };
  return {
    score: ratio(scored.length - lost.length, scored.length),
    raw: lost.length
      ? `${scored.length - lost.length}/${scored.length} recoverable; VANISHED: ${lost.map((c) => `"${c.text}"`).join(", ")}${note}`
      : `${scored.length}/${scored.length} typed phrases recoverable${note}`,
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
