import type {
  Brief, ItineraryDay, ItineraryItem, Place, Tag, TagEdit, TravelerProfile, Trip,
} from "@/lib/types";
import type { EditOp } from "@/lib/agent/types";
import { PACE_ACTIVITIES, stating, type Pace } from "@/lib/types";
import { inferPace, paceDown, statedPurpose } from "@/lib/discovery";
import { placeById } from "@/data";
import { cityById } from "@/data/destinations";
import { candidatesFor } from "@/lib/select";
import { ReasonBank } from "@/lib/reasons";
import { toClock, toMin, travelMinutes } from "@/lib/geo";
import { closingMinute, fitsTimeOfDay, isOpenFor } from "@/lib/hours";
import { critique, repair } from "@/lib/critic";
import { parseAvoidTags, parseFavorTags } from "@/lib/discovery";
import { favoredTags } from "@/lib/select";
import { costBreakdown, mockBookings, planTrip } from "@/lib/planner";
import { namesOtherLength, whyLine } from "@/lib/concept";
import { withStays } from "@/lib/stays";
import { recommend } from "@/lib/recommend";
import { CLAUSE_BREAK_SOURCE } from "@/lib/clauses";

let seq = 1000;
const uid = (p: string) => `${p}-e${(seq++).toString(36)}`;

// ---------------------------------------------------------------------------
// Rules-based edit-intent parsing. The LLM driver replaces this method only;
// everything below `applyOps` is shared and stays deterministic.
// ---------------------------------------------------------------------------

const TAG_WORDS: [RegExp, Tag][] = [
  [/\bwine|vineyard|winer|port\b/i, "wine"],
  [/\bfood|eat|restaurant|meal|cook/i, "food"],
  [/\bmarket/i, "market"],
  [/\bnature|outdoor|green|countryside/i, "nature"],
  [/\bbeach|coast|sea|ocean|water/i, "coast"],
  [/\bmuseum/i, "museum"],
  [/\bart\b|galler/i, "art"],
  [/\bcastle|fort/i, "castle"],
  [/\bchurch|cathedral|monaster/i, "church"],
  [/\bhistor/i, "history"],
  // Split: one entry meant "drop the hiking" also removed every city walk, and
  // "more walking" pulled in mountain hikes. They are different days.
  [/\bhik|trek|trail/i, "hike"],
  [/\bwalk|stroll|wander/i, "walk"],
  [/\bnightlife|bar\b|bars\b|club/i, "nightlife"],
  [/\bmusic|live music|concert|fado/i, "music"],
  [/\bcoffee|caf[eé]/i, "coffee"],
  [/\bshop/i, "shopping"],
  [/\barchitect/i, "architecture"],
  [/\bview|viewpoint|lookout/i, "viewpoint"],
  [/\bspa|sauna|hot spring|hot water|bath ?house|onsen|jjimjilbang|lagoon|soak/i, "spa"],
  [/\bglacier|waterfall|volcano|crater|fjord/i, "nature"],
];

const tagIn = (text: string): Tag | undefined =>
  TAG_WORDS.find(([re]) => re.test(text))?.[1];

export function parseEditRules(input: string, trip: Trip): EditOp[] {
  const t = input.trim();
  if (!t) return [];
  const ops: EditOp[] = [];
  const dayMatch = t.match(/\b(?:day\s*(\d+)|(monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i);
  const day = dayMatch?.[1] ? Number(dayMatch[1]) : undefined;

  // slower / busier
  if (/\b(too busy|too much|too many|packed|slow (it |this )?down|overwhelming|a lot going on|too full|exhaust)/i.test(t)) {
    ops.push({ kind: "reduce_pace", day });
  } else if (/\b(more to do|too slow|too empty|not enough|bored|fill (it|the day)|busier)\b/i.test(t)) {
    ops.push({ kind: "increase_pace", day });
  }

  // touristy
  if (/\b(less touristy|too touristy|more local|off the beaten|avoid (the )?crowds|less crowded|too many tourists)\b/i.test(t)) {
    ops.push({ kind: "less_touristy" });
  }

  /*
   * Free time, in the part of the day she named.
   *
   * "Add a free afternoon" cleared the LAST activity of the day and reported,
   * accurately, that the morning was now open. The report was honest and the
   * action was not what she asked for, which is the worse half: she typed
   * "afternoon" and got a morning. If she names a window, that window is the
   * instruction.
   */
  if (/\b(more (free|down) ?time|free (morning|afternoon|evening|day)|breathing room|more space|nothing planned)\b/i.test(t)) {
    /*
     * The window has to come from the REQUEST, not from anywhere in the
     * sentence. Scanning the whole string for the first day-word reproduced
     * the exact bug this is here to fix: "keep the morning market but add a
     * free afternoon on day 2" took "morning", cleared the market she had
     * just said to keep, and reported the morning — she typed afternoon.
     * So the word must be attached to the ask.
     */
    const named = t.match(/\bfree\s+(morning|afternoon|evening)\b/i)
      ?? t.match(/\b(morning|afternoon|evening)\s+(?:free|off|open|clear|to myself|for myself)\b/i);
    const part = named?.[1].toLowerCase() as "morning" | "afternoon" | "evening" | undefined;
    ops.push(part ? { kind: "add_downtime", day, part } : { kind: "add_downtime", day });
  }

  // extra night
  // Escaped ranges, not literal accented characters: a bundle served without
  // a charset declaration turns À-ÿ into an invalid range and the whole
  // module throws at parse time.
  const stay = t.match(/\b(?:extra|another|one more)\s+night\s+in\s+([A-Za-z\u00C0-\u00FF]+)|stay\s+(?:in\s+)?([A-Za-z\u00C0-\u00FF]+)\s+(?:one |an )?(?:extra|another|longer)/i);
  if (stay) {
    const name = (stay[1] ?? stay[2] ?? "").toLowerCase();
    const leg = trip.concept.shape.find((l) => cityById(l.cityId).name.toLowerCase().includes(name));
    if (leg) ops.push({ kind: "extend_stay", cityId: leg.cityId, nights: 1 });
  }

  // budget
  const money = t.match(/\$\s*(\d[\d,]*)|\b(\d+)\s*k\b/i);
  if (money && /\b(budget|spend|cheaper|afford|keep it under|max)\b/i.test(t)) {
    const usd = money[1] ? Number(money[1].replace(/,/g, "")) : Number(money[2]) * 1000;
    ops.push({ kind: "set_budget", usd });
  } else if (/\b(cheaper|too expensive|too pricey|less expensive|bring (it|the (cost|price)) down|tighter budget|on a budget|can'?t afford)\b/i.test(t)
    // "too much" only when it is about money. "This is too much sightseeing"
    // was read as a budget complaint: it set a budget she never gave, anchored
    // at 72% of the quote, and every turn after it said "still $507 over the
    // $1,800 you gave me" — a number she had never said, attributed to her.
    || /\btoo much\b(?!\s+[a-z])/i.test(t)
    || /\b(costs?|spending|paying|price)\b[^.]{0,20}\btoo much\b/i.test(t)
    || /\btoo much\s+(money|to spend|for (that|this|me|us))\b/i.test(t)) {
    /*
     * "Cheaper" with no figure attached.
     *
     * The app stopped asking her budget up front, on purpose: answering a
     * form before seeing anything is the planning step she is trying not to
     * do. The cost is on the card instead. That only works if she can push
     * back on it in the words people actually use, and this branch needed a
     * dollar sign before it would fire, so "make it cheaper" did nothing at
     * all.
     *
     * No number means anchor to the quote, the same way the "too expensive"
     * reject chip does, rather than to a budget she may never have given.
     */
    ops.push({ kind: "cheaper" });
  }

  // more of / less of
  /*
   * Wanting a thing is a request for it.
   *
   * This only recognised an instruction: "more hot springs", "add hot
   * springs". So "i also really want to spend time in hot springs" parsed as
   * unknown, on an ICELAND trip with Sky Lagoon and the Secret Lagoon sitting
   * unused in the pool, and the traveller was told which day to point at. The
   * tag was recognisable the whole time; nothing was listening for the way
   * people actually say it.
   *
   * The text box is an input, not a command line. Someone who says they want
   * something has asked for it.
   */
  const wants = /\b(i(?:'| a)?d? ?(?:also )?(?:really |kind of |kinda )?(?:want|love|like|fancy)|would love|hoping (?:to|for)|keen (?:to|on)|dying to)\b/i;
  const LESS = /\b(don'?t (really )?(care|like)|not into|hate|no|remove|drop|skip|cut|fewer|less|without)\b/i;
  const MORE = /\b(more|add|extra|another)\b/i;

  const alreadyTouristy = ops.some((o) => o.kind === "less_touristy");
  /*
   * One sentence can say both, and it usually does.
   *
   * The tag scan ran over the WHOLE message and `wantsMore && !wantsLess`
   * threw the positive half away, so "fewer museums and more food" removed
   * museums AND removed food — every restaurant on the trip deleted, with
   * "they are exactly what you just said you didn't want" printed next to a
   * sentence in which she asked for more food. `food` also landed in
   * brief.avoidTags and profile.avoidTags permanently, so the critic flagged
   * every meal for the rest of the session. Fifteen of fifteen.
   *
   * So each clause is classified on its own words, and a tag is only removed
   * if the clause that names it is the negative one.
   */
  // CLAUSE_BREAK, so a dash, a colon, a slash, an ampersand or a newline breaks
  // a clause too. Splitting on commas and "and" alone put "fewer museums - more
  // food" back to deleting every restaurant on the trip, 15 of 15.
  const clauses = t.split(new RegExp(`(?<=[.!?;])\\s+|\\s*,\\s*|${CLAUSE_BREAK_SOURCE}|\\s+but\\s+|\\s+and\\s+|\\s+plus\\s+`, "i"))
    .map((c) => c.trim()).filter(Boolean);
  const polarity = (c: string): "less" | "more" | "none" => {
    if (LESS.test(c)) return "less";
    return (MORE.test(c) || wants.test(c)) ? "more" : "none";
  };
  const marked = clauses.map((c) => [c, polarity(c)] as const);
  const anyMarked = marked.some(([, p2]) => p2 !== "none");
  /*
   * Whether she asked for more of anything is a per-clause question too.
   *
   * Computed over the whole message with `&& !/no more/`, "no more museums but
   * more markets" was not a request for anything at all: the "no more" in the
   * first clause silenced the second.
   */
  const wantsLess = marked.some(([, p2]) => p2 === "less");
  const wantsMore = marked.some(([, p2]) => p2 === "more");
  // A clause with no polarity of its own inherits the message's, which is what
  // makes "less touristy please" and "more wine" keep working unchanged.
  /** The clauses a scan of this polarity reads, in the order she typed them. */
  const inScope = (want: "less" | "more") => marked
    .filter(([, p2]) => p2 === want || (p2 === "none" && !anyMarked))
    .map(([c]) => c);

  const before2 = [...ops];
  const removed = new Set<Tag>();
  const favored = new Set<Tag>();
  /** Clauses that produced an op, so the report below knows what was heard. */
  const handled = new Set<string>();
  /*
   * One clause at a time, and each one marked heard on its OWN result.
   *
   * The scan used to join every clause of a polarity into one string, read
   * tags out of the join, and then mark EVERY clause of that polarity heard
   * the moment ANY tag came back. So "more wine and more helicopters" made one
   * op, marked both clauses, and the second half left no trace anywhere: no
   * op, no `unresolved` entry, no sentence. Thirty of ninety clauses in the
   * project's own edit corpus went that way, and every one of those turns
   * looked like a success on screen, because the half it did do was described
   * accurately.
   *
   * Joining also lost clauses outright, not just their accounting: `tagIn`
   * returns the FIRST tag word in the string it is given, so in "more wine and
   * more nightlife and more paragliding" only wine was ever seen. Read per
   * clause, nightlife is found too.
   *
   * Her rule is that every clause she typed has to end in one of two states —
   * an op was made from it, or she is told it was not done. `handled` is the
   * record of the first, and it is now the truth: a clause is in it when that
   * clause produced a tag.
   */
  // Less first, so a tag she has just taken out is not put straight back by
  // the other half of the same sentence.
  for (const clause of wantsLess ? inScope("less") : []) {
    const tags = parseAvoidTags(clause).filter((tag) => !(alreadyTouristy && tag === "iconic"));
    const direct = tagIn(clause);
    const all = [...new Set([...tags, ...(direct ? [direct] : [])])];
    for (const tag of all) {
      if (removed.has(tag)) continue;
      removed.add(tag);
      ops.push({ kind: "remove_tag", tag, day });
    }
    // A second clause naming a tag the first already removed IS answered by
    // that op — it asked for something and got it.
    if (all.length) handled.add(clause);
  }
  for (const clause of wantsMore ? inScope("more") : []) {
    const tags = parseFavorTags(clause);
    const direct = tagIn(clause);
    const all = [...new Set([...tags, ...(direct ? [direct] : [])])].filter((x) => !removed.has(x));
    for (const tag of all.slice(0, 2)) {
      if (favored.has(tag)) continue;
      favored.add(tag);
      ops.push({ kind: "more_tag", tag, day });
    }
    if (all.length) handled.add(clause);
  }

  /*
   * Per clause, because the parsing is per clause.
   *
   * This was a whole-message test sitting on top of clause-scoped parsing —
   * the named class, inverted. "more hot springs and fewer temples" understood
   * the first half, so the second vanished with no `unresolved` note at all,
   * while "fewer temples" on its own was honestly reported. Same for "make it
   * cheaper and add a night in Tokyo": the night went, silently.
   */
  if (ops.length === 0) {
    ops.push({ kind: "unknown", text: t });
  } else if (marked.length > 1) {
    // Ops parsed before this point (less_touristy, reduce_pace, cheaper,
    // set_budget, extend_stay, ...) each came from a clause; whichever clause
    // carries their trigger word counts as heard.
    const CUES: [EditOp["kind"], RegExp][] = [
      ["less_touristy", /tourist/i],
      ["reduce_pace", /\b(busy|packed|rushed|too much|slow it|lighter)\b/i],
      ["increase_pace", /\b(more to do|not enough|empty)\b/i],
      ["add_downtime", /\b(free time|downtime|breathe|rest)\b/i],
      ["cheaper", /\b(cheap|expensive|afford|budget)\b/i],
      ["set_budget", /\$|\bbudget\b|\bunder\b/i],
      ["extend_stay", /\bnight\b/i],
      ["remove_item", /\b(remove|drop|cut)\b/i],
    ];
    for (const [clause] of marked) {
      // Heard by an op parsed earlier, if that op's own cue is in this clause.
      if (CUES.some(([kind, re]) => re.test(clause) && before2.some((o) => o.kind === kind))) continue;
      // Heard by the more/less scan above, because it produced a tag from THIS
      // clause. Anything else is a clause that asked for something and got
      // nothing, and the only honest thing left to do is say so.
      if (handled.has(clause)) continue;
      /*
       * No escape hatches left, and both of the ones that were here leaked.
       *
       * `pol === "none" && !ASKS.test(clause)` skipped every unpolarised
       * clause that did not carry one of a list of ask-verbs, which is how
       * "i'd love more markets and a cooking class" dropped the cooking class:
       * it names no more/less word and asks for nothing in those exact terms.
       *
       * The other tested whether the clause CONTAINS a tag word rather than
       * whether an op was made from it — so a clause that named a tag and
       * produced nothing (a tag already removed by the other half of the
       * sentence, a second thing past the per-clause ceiling) counted as
       * heard while nothing anywhere acted on it.
       *
       * A clause is heard when an op came from it. Otherwise she is told.
       */
      ops.push({ kind: "unknown", text: clause });
    }
  }
  return ops;
}

// ---------------------------------------------------------------------------
// Applying operations. Deterministic, and always re-validated by the critic.
// ---------------------------------------------------------------------------

export interface EditResult {
  trip: Trip;
  brief: Brief;
  profile: TravelerProfile;
  /** Plain statements of what changed, for the agent to speak. */
  summary: string[];
  /**
   * Does the summary ASSERT that the trip changed?
   *
   * "Removed the castle" claims a change. "This is already about as light as
   * it gets" claims the opposite, and both are in `summary`, so the length of
   * that array says nothing about what the traveller was told. Two eval
   * scenarios were failing on exactly that confusion: honest declines counted
   * as lies, which meant a real lie would have been lost in the noise.
   *
   * Compared against the actual diff, this is what catches the app saying it
   * changed something it did not, or changing something in silence.
   */
  claimed: boolean;
  unresolved: string[];
}

/**
 * Add one phrase to a list of her phrases, the way lib/brief.ts does it: a
 * repeat is dropped, a fuller wording of something already there replaces the
 * thinner one, and nothing is ever removed.
 */
function mergeSaid(had: string[] | undefined, one: string): string[] {
  const key = (x: string) => x.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const within = (outer: string, inner: string) => ` ${outer} `.includes(` ${inner} `);
  const out = [...(had ?? [])];
  const k = key(one);
  const at = out.findIndex((x) => key(x) === k || within(key(x), k) || within(k, key(x)));
  if (at === -1) out.push(one);
  else if (one.length > out[at].length) out[at] = one;
  return out;
}

const usedIds = (trip: Trip) =>
  new Set(trip.days.flatMap((d) => d.items.map((i) => i.placeId).filter(Boolean) as string[]));

/** How much this item is earning its slot, given what they actually asked for. */
const activityValue = (i: ItineraryItem, favor: Set<Tag>) =>
  i.tags.filter((t) => favor.has(t)).length + (i.costUsd === 0 ? 0.5 : 0);

/**
 * The brief, pinned to the trip she is looking at.
 *
 * An edit tunes the trip in front of her. It is not a fresh question about
 * where to go, so the recommender must not be free to answer one. A shortlist
 * or a region outranks a named destination inside recommend(), so both are
 * cleared alongside the pin.
 */
function here(b: Brief, t: Trip): Brief {
  return { ...b, namedDestination: t.concept.destinationId, candidates: undefined, regionIds: undefined };
}

/**
 * @param said The sentence she typed, when this edit came from her typing one.
 *
 * Once the itinerary is on screen the composer calls the editor directly:
 * `parseEdit` turns the sentence into ops and the ops move the days. Nothing
 * in that path ever recorded the sentence. So everything she typed after
 * clicking through to the itinerary was absent from `brief.stated` — the
 * append-only record whose whole job is to hold what she entered — and absent
 * from `activities`, which is what `quotable` licenses "You said" off, what
 * `interestLine` sends to research and what `unserved` reports against.
 *
 * "i also really want to spend time in hot springs" put Sky Lagoon on day 6
 * and a geothermal beach on day 2, and the phrase "hot springs" then existed
 * nowhere: not on the brief, not in the plan's prose, not in the reply. A
 * replan would have been built from a brief that had never heard it.
 *
 * From Ashley: "every single thing that the user types or selects must sustain
 * in that session at least." So the sentence is recorded here, at the one
 * point both the app and the eval harness pass through, and read with the same
 * rules parser the discovery path uses — no model call, no destination logic,
 * nothing that could answer a question she did not ask. `stating` dedupes, so
 * the caller that has already recorded it may pass it again harmlessly.
 */
export function applyOps(
  trip: Trip, ops: EditOp[], brief: Brief, profile: TravelerProfile, said?: string,
): EditResult {
  if (said?.trim()) {
    const purpose = statedPurpose(said);
    brief = stating(brief, said, "typed");
    if (purpose.activity) brief = { ...brief, activities: mergeSaid(brief.activities, purpose.activity) };
    if (purpose.aside) brief = { ...brief, asides: mergeSaid(brief.asides, purpose.aside) };
  }
  /*
   * The items are copied, not just the arrays holding them.
   *
   * `less_touristy` and its neighbours swap an item in place with
   * Object.assign(i, ...), and a shallow array copy shares those objects with
   * the caller. So an edit rewrote the trip the caller was still holding —
   * including the "before" copy the UI diffs against to show what changed, and
   * the saved trip on disk if the edit was later declined. An edit is a new
   * trip; it must not reach back into the old one.
   */
  let t: Trip = { ...trip, days: trip.days.map((d) => ({ ...d, items: d.items.map((i) => ({ ...i })) })) };
  let b: Brief = { ...brief, vibes: [...brief.vibes], avoidTags: [...brief.avoidTags], constraints: [...brief.constraints] };
  let p: TravelerProfile = {
    ...profile,
    preferences: [...profile.preferences],
    rejectedPlaceIds: [...profile.rejectedPlaceIds],
    deprioritizedPlaceIds: [...profile.deprioritizedPlaceIds],
    avoidTags: [...profile.avoidTags],
    favorTags: [...profile.favorTags],
    rejectedForTag: { ...profile.rejectedForTag },
  };
  const summary: string[] = [];
  /*
   * `told` asserts the trip moved. `note` says the opposite: nothing to do,
   * and here is why. Both are spoken; only one is a claim.
   */
  let claimed = false;
  const told = (line: string) => { summary.push(line); claimed = true; };
  const note = (line: string) => { summary.push(line); };
  const unresolved: string[] = [];
  const bank = new ReasonBank();

  /*
   * Changing her mind.
   *
   * `more_tag` and `remove_tag` do not only move the days: they write the tag
   * into brief.avoidTags and profile.avoidTags/favorTags and push the places
   * they touched onto profile.rejectedPlaceIds, and all of that outlived the
   * instruction that wrote it. So the opposite instruction was answered from a
   * world the first one had already narrowed. "I don't really care about
   * castles" then "actually i'd love more castles" got "I can't fit more
   * castle into these cities" — the two castles it might have put back were on
   * the rejected list, put there by the sentence she had just withdrawn, and
   * `castle` sat in avoidTags and favorTags at the same time.
   *
   * A reversal CLEARS the earlier preference rather than stacking on top of
   * it, and the places ruled out by one instruction are lifted with it. That
   * is the honest reading of "actually": it is not a new fact on top of the
   * old one, it replaces it.
   *
   * The undo only runs for a turn that is exactly one tag op with no day named
   * on it. That is the shape a change of mind actually has, and it is also the
   * only shape where the engine can be certain which days belong to which
   * instruction: in a two-op turn the critic's repair pass runs once over both,
   * and putting one op's days back would take the other op's work with it.
   * Everything else keeps today's behaviour, minus the contradiction.
   */
  /**
   * She has just asked FOR this tag, so everything that ruled it out comes off:
   * both avoid lists, and the places that were only rejected for carrying it.
   */
  const unavoid = (tag: Tag) => {
    b.avoidTags = b.avoidTags.filter((x) => x !== tag);
    p.avoidTags = p.avoidTags.filter((x) => x !== tag);
    const collateral = new Set(p.rejectedForTag?.[tag] ?? []);
    if (collateral.size) {
      p.rejectedPlaceIds = p.rejectedPlaceIds.filter((id) => !collateral.has(id));
      p.rejectedForTag = { ...p.rejectedForTag, [tag]: [] };
    }
  };
  /** And the mirror: asked for LESS of it, so it comes off the favour list. */
  const unfavor = (tag: Tag) => { p.favorTags = p.favorTags.filter((x) => x !== tag); };

  const journal: TagEdit[] = [...(trip.edits ?? [])];
  const only = ops.length === 1 ? ops[0] : undefined;
  const solo = only && (only.kind === "more_tag" || only.kind === "remove_tag")
    && only.day === undefined ? only : undefined;

  let undone: TagEdit | undefined;
  if (solo) {
    const want = solo.kind === "more_tag" ? "less" : "more";
    for (let i = journal.length - 1; i >= 0; i--) {
      const e = journal[i];
      if (e.tag !== solo.tag) continue;
      // Her most recent word on this tag already agrees with this one. Nothing
      // to reverse — this is more of the same, not a change of mind.
      if (e.dir !== want) break;
      // The days it changed have moved since. A stale copy would silently
      // discard whatever moved them, which is the failure this exists to stop.
      if (!e.days.every((d, k) => {
        const now = t.days.find((x) => x.index === d.index);
        return now && daySignature(now) === e.after[k];
      })) break;
      undone = e;
      journal.splice(i, 1);
      break;
    }
  }

  if (undone) {
    const was = new Set(t.days.flatMap((d) => d.items.map(itemKey)));
    const restore = new Map(undone.days.map((d) => [d.index, d]));
    t = { ...t, days: t.days.map((d) => {
      const old = restore.get(d.index);
      return old ? { ...old, items: old.items.map((i) => ({ ...i })) } : d;
    }) };
    /*
     * The same clearing the ops below do, because putting the days back is
     * only half of it: while the tag is still on an avoid list the critic's
     * repair pass at the end of this turn deletes exactly what was restored
     * and says "they are exactly what you just said you didn't want" about a
     * sentence she has just taken back.
     */
    if (undone.dir === "less") unavoid(undone.tag); else unfavor(undone.tag);

    const back = t.days.flatMap((d) => d.items)
      .filter((i) => i.type === "activity" || i.type === "meal")
      .filter((i) => !was.has(itemKey(i))).map((i) => i.name);
    /*
     * Undoing an ADD takes something off, so there is nothing to name as
     * restored. Say what actually happened either way; `told` because the
     * plan did move, and the evals score the sentence against the diff.
     */
    const gone = undone.days.flatMap((d) => d.items).length
      && !back.length;
    if (back.length) told(`Put ${list(back)} back.`);
    else if (gone) told(`Taken back off — the plan is where it was before the extra ${undone.tag}.`);
    else note(`That one had not changed anything, so there is nothing to put back.`);
  }

  /*
   * The ops that rebuild the trip go first.
   *
   * `extend_stay`, `cheaper` and `set_budget` replace `t` wholesale with a
   * fresh plan, throwing away whatever an earlier op in the same turn did to
   * the days — while that op's sentence stayed in the summary. So "too much
   * going on. also keep it under $2000" answered "Day 3 had 4 things
   * scheduled. Cut Ribeira das Naus." and shipped a trip with Ribeira das Naus
   * on day 3. Fifteen destinations of fifteen; 19 of 75 multi-op turns from
   * text a person actually types, and 124 of 240 from op pairs the model emits.
   *
   * Ordering them first means the mutators run on the trip that ships, so
   * every sentence in the summary describes the thing she is looking at.
   */
  /*
   * Sentences whose number is only knowable once the turn is over: the rooms
   * go back on after every op has run, and they move the total.
   */
  /*
   * Where the "nothing left is a tourist trap" line goes, if it is still true
   * once the critic has finished removing things.
   */
  let noTouristTrap = -1;
  /** Notes whose figure is only knowable once the turn is over. */
  const deferred: { at: number; text: (finalUsd: number) => string }[] = [];
  const priced: {
    at: number; before: number;
    /** What the op did, in words — true whatever the totals turn out to be. */
    what?: string;
    text: (delta: number) => string;
  }[] = [];
  const REPLANS = new Set(["extend_stay", "cheaper", "set_budget"]);
  const ordered = [...ops].sort((x, y) => Number(REPLANS.has(y.kind)) - Number(REPLANS.has(x.kind)));

  for (const op of undone ? [] : ordered) {
    switch (op.kind) {
      case "remove_tag": {
        /*
         * She has just said she does not want this. If an earlier turn put it
         * on the favour list, that is no longer her position — leaving both on
         * means the next replan is asked to seek out and avoid the same tag.
         */
        unfavor(op.tag);
        const removed: string[] = [];
        /*
         * Rejected BECAUSE of this tag, filed as such. Section 32 says a place
         * she turned down is never offered again, and that still holds — but
         * these were not turned down, the tag they carry was, and she is
         * allowed to take that back.
         */
        const collateral: string[] = [];
        for (const d of t.days) {
          if (op.day && d.index !== op.day) continue;
          const keep: ItineraryItem[] = [];
          for (const i of d.items) {
            if (i.type === "activity" && i.tags.includes(op.tag)) {
              removed.push(i.name);
              if (i.placeId) { p.rejectedPlaceIds.push(i.placeId); collateral.push(i.placeId); }
              keep.push(freeTime(i, bank));
            } else keep.push(i);
          }
          d.items = keep;
        }
        if (collateral.length) {
          p.rejectedForTag = { ...p.rejectedForTag,
            [op.tag]: [...new Set([...(p.rejectedForTag?.[op.tag] ?? []), ...collateral])] };
        }
        if (!b.avoidTags.includes(op.tag)) b.avoidTags.push(op.tag);
        if (!p.avoidTags.includes(op.tag)) p.avoidTags.push(op.tag);
        if (removed.length) told(`Removed ${list(removed)}.`);
        else note(`Nothing in the plan was built around ${op.tag} — noted for next time.`);
        break;
      }

      case "remove_item": {
        for (const d of t.days) {
          const i = d.items.find((x) => x.id === op.itemId);
          if (!i) continue;
          if (i.placeId) p.rejectedPlaceIds.push(i.placeId);
          d.items = d.items.map((x) => (x.id === op.itemId ? freeTime(x, bank) : x));
          told(`Removed ${i.name}.`);
        }
        break;
      }

      case "reduce_pace": {
        // "This feels too busy" is a statement about the trip, not one day.
        // Step the whole plan down a notch and cut everywhere that's over.
        const favor = favoredTags(b, p);
        const cur = inferPace(b);
        const next = paceDown(cur);
        if (!op.day) b.pace = next;
        const ceiling = PACE_ACTIVITIES[op.day ? cur : next];

        /*
         * "Nothing to cut" is a fact about THIS op, not about the turn.
         *
         * The fallback below tested `!summary.length`, and the replanning ops
         * run first and push into the same array — so "this is too busy, and
         * keep it under $3,000" answered the budget half and left the pace
         * half in silence. Fifteen of fifteen.
         */
        const saidBefore = summary.length;
        const targets = op.day ? t.days.filter((d) => d.index === op.day) : t.days;
        for (const d of targets) {
          const over = acts(d) - ceiling;
          if (over <= 0) continue;
          const cut = d.items
            .filter((i) => i.type === "activity")
            .sort((x, y) => activityValue(x, favor) - activityValue(y, favor))
            .slice(0, over);
          if (!cut.length) continue;
          for (const r of cut) if (r.placeId) p.deprioritizedPlaceIds.push(r.placeId);
          const before = acts(d);
          d.items = d.items.map((i) => (cut.some((r) => r.id === i.id) ? freeTime(i, bank) : i));
          told(`Day ${d.index} had ${before} things scheduled. Cut ${list(cut.map((r) => r.name))}.`);
        }
        if (summary.length === saidBefore) note("This is already about as light as it gets without emptying days out entirely.");
        p.preferences.push(learned("Prefers fewer scheduled activities per day"));
        break;
      }

      case "increase_pace": {
        /*
         * Not the arrival or departure day.
         *
         * It picked the emptiest day, which is almost always one of those two,
         * so "more to do" landed on a day the planner itself themed "Land in
         * Lisbon, do nothing much" whose transit line reads "Nothing is
         * scheduled against jet lag". 11 of 24 inserts. more_tag already
         * excludes the edges; this did not.
         */
        const middle = t.days.filter((d) => d.index > 1 && d.index < t.days.length);
        const pool = middle.length ? middle : t.days;
        const targets = op.day ? t.days.filter((d) => d.index === op.day)
          : [...pool].sort((a, c) => acts(a) - acts(c)).slice(0, 1);
        for (const d of targets) {
          const added = insertInto(d, t, b, p, undefined, bank);
          if (added) told(`Added ${added} to day ${d.index}.`);
          else note(`Day ${d.index} is already as full as it usefully gets.`);
        }
        break;
      }

      case "add_downtime": {
        /*
         * The window she named, if she named one. `WINDOW` is the same
         * morning/afternoon/evening split the sentence below reports with, so
         * the part cleared and the part announced can never disagree again.
         */
        const inPart = (i: ItineraryItem) => {
          if (!op.part) return true;
          const at = toMin(i.start);
          return op.part === (at >= 1020 ? "evening" : at >= 720 ? "afternoon" : "morning");
        };
        const targets = op.day
          ? t.days.filter((d) => d.index === op.day)
          : [...t.days].sort((a, c) => c.items.filter((i) => i.type === "activity" && inPart(i)).length
              - a.items.filter((i) => i.type === "activity" && inPart(i)).length
              || acts(c) - acts(a)).slice(0, 1);
        for (const d of targets) {
          const ranked = d.items.filter((i) => i.type === "activity" && inPart(i));
          const drop = ranked[ranked.length - 1];
          /*
           * Nothing in that window is a real answer, not a reason to clear
           * something elsewhere and call it what she asked for.
           */
          if (!drop) {
            /*
             * `note`, not `told`: this reports that NOTHING happened, and
             * `told` sets the flag that asserts the trip changed. The evals
             * score `moved === claimed`, so an honest non-change filed with
             * `told` reads as a fabricated one.
             */
            if (op.part) note(`Day ${d.index} has nothing scheduled in the ${op.part} already, so there is nothing to clear.`);
            continue;
          }
          d.items = d.items.map((i) => (i.id === drop.id ? freeTime(i, bank) : i));
          /*
           * Say which part of the day actually opened up.
           *
           * This claimed the afternoon whatever it cleared, and the item it
           * clears is the LAST activity of the day, so it was usually the
           * evening: "Cleared By the Wine off day 1, so the afternoon is open"
           * about a 10:07pm wine bar, on a day whose afternoon was already a
           * Free time block. False in 696 of 960 runs.
           */
          const at = toMin(drop.start);
          const part = at >= 1020 ? "evening" : at >= 720 ? "afternoon" : "morning";
          told(`Cleared ${drop.name} off day ${d.index}, so the ${part} is open.`);
        }
        p.preferences.push(learned("Wants unstructured time protected"));
        break;
      }

      case "more_tag": {
        /*
         * She has just asked for this, so it comes off the avoid lists.
         *
         * Without this the request was answered from a pool the earlier
         * refusal had already emptied: candidatesFor() drops every place
         * carrying an avoided tag, so "actually i'd love more castles" found
         * no castles and said so, and the critic then dropped anything that
         * did get in for carrying a tag she had asked for.
         */
        unavoid(op.tag);
        const wanted = op.count ?? 2;
        let added = 0;
        const order = op.day
          ? t.days.filter((d) => d.index === op.day)
          : [...t.days]
              .filter((d) => d.index !== 1 && d.index !== t.days.length)
              .sort((a, c) => tagCount(a, op.tag) - tagCount(c, op.tag));
        for (const d of order) {
          if (added >= wanted) break;
          const before = acts(d);
          const name = insertInto(d, t, b, p, op.tag, bank);
          if (name) {
            const ceiling = PACE_ACTIVITIES[inferPace(b)];
            const over = before + 1 > ceiling;
            told(over
              ? `Added ${name} on day ${d.index} — that puts day ${d.index} back to ${before + 1} things, which is more than the pace you asked for. Say the word and I'll drop something else off it.`
              : `Added ${name} on day ${d.index}.`);
            added++;
          }
        }
        // Nothing fit in the gaps — trade something out rather than refuse.
        if (added === 0) {
          for (const d of order) {
            const swap = swapInto(d, t, b, p, op.tag, bank);
            if (swap) {
              if (swap.dropped) {
                const vp = d.items.find((i) => i.name === swap.dropped)?.placeId;
                if (vp) p.deprioritizedPlaceIds.push(vp);
              }
              told(`No room to just add it, so I swapped ${swap.dropped} for ${swap.added} on day ${d.index}.`);
              added++;
              break;
            }
          }
        }
        if (!p.favorTags.includes(op.tag)) p.favorTags.push(op.tag);
        if (added === 0) {
          note(`I can't fit more ${op.tag} into these cities without spending the time on travel instead. If you want it properly, the better move is a different base — say the word and I'll re-cut the shape of the trip.`);
        }
        break;
      }

      case "less_touristy": {
        let swapped = 0;
        for (const d of t.days) {
          for (const i of d.items) {
            if (i.type !== "activity" || !i.placeId) continue;
            const cur = placeById(i.placeId);
            if (!cur || cur.touristy < 4) continue;
            const alt = bestAlternative(d, t, b, p, cur);
            if (!alt) continue;
            p.rejectedPlaceIds.push(cur.id);
            Object.assign(i, itemFrom(alt, i.start, bank.forPlace(alt, "afternoon", b)));
            told(`Swapped ${cur.name} for ${alt.name}.`);
            swapped++;
          }
        }
        if (!p.avoidTags.includes("iconic")) p.avoidTags.push("iconic");
        p.preferences.push(learned("Avoids the famous option when a local one exists"));
        /*
         * Deferred, because `repair` runs after this and drops what carries
         * the tag she just refused. "Nothing left in here is a tourist trap"
         * was printed directly above "Dropped The Louvre: it is exactly what
         * you just said you didn't want." Eleven of fifteen. A claim about
         * what is left has to be made after the last thing that removes any.
         */
        if (!swapped) { noTouristTrap = summary.length; note(""); }
        break;
      }

      case "extend_stay": {
        const leg = t.concept.shape.find((l) => l.cityId === op.cityId);
        if (!leg) break;
        const before = t.concept.estimateUsd;
        const days = t.concept.days + op.nights;
        const b2 = { ...b, days };
        /*
         * The night is added to the shape BEFORE the days are built from it.
         *
         * This used to replan at days + 1 and then move a night between legs
         * in the returned trip, which the itinerary had already been built
         * from. The result billed her for a second night in Provence, listed
         * two in the bookings, and gave her a fifth day in Paris and still
         * exactly one day in Provence. Eleven destinations of fifteen.
         *
         * Its ancestor said `target.nights += 0`, which did nothing at all, so
         * "one more night in Kyoto" bought a night in Tokyo. Both bugs are the
         * same mistake: deciding where the night goes after the trip is built.
         *
         * planTrip is pinned here too — recommend() unpinned would re-score
         * the catalogue and could answer with a different country while
         * wearing this trip's headline.
         */
        const shape = t.concept.shape.map((l) =>
          l.cityId === op.cityId && l === leg ? { ...l, nights: l.nights + op.nights } : { ...l });
        const replanned = planTrip(b2, recommend(here(b2, t)), p, { startDate: t.concept.startDate, shape });
        t = { ...replanned, concept: { ...replanned.concept, headline: t.concept.headline, vibe: t.concept.vibe, why: t.concept.why, stays: t.concept.stays } };
        b = b2;
        /*
         * The price is quoted at the end, not here.
         *
         * `t.concept.estimateUsd` mid-turn is the replan's catalogue lodging,
         * while `before` included her named rooms — and withStays is only
         * re-applied after every op has run. So on every trip with named
         * rooms the sentence had the wrong number AND the wrong sign: "Added
         * a night in Lisbon. That's −$1,327 on the total" beside an Estimate
         * card that went UP $433. Fifteen of fifteen.
         */
        priced.push({ at: summary.length, before,
          what: `Added a night in ${cityById(op.cityId).name}.`,
          text: (d: number) => `Added a night in ${cityById(op.cityId).name}. That's `
            + `${d >= 0 ? "+" : "−"}$${Math.abs(d).toLocaleString()} on the total, `
            + `mostly the room and one more day of eating.` });
        told("");
        break;
      }

      case "cheaper": {
        // Anchor to the quote she is looking at, not to a budget she was
        // never asked for. Same 0.72 the "too expensive" chip uses, so the
        // two routes to the same complaint land in the same place.
        const was = t.concept.estimateUsd;
        const target = Math.max(600, Math.round((was * 0.72) / 100) * 100);
        b = { ...b, budgetUsd: Math.min(b.budgetUsd ?? Infinity, target), flexibleBudget: false,
          // Ours, not hers — and it has to stay marked, or the next replan
          // reads it back to her as "what you said".
          budgetIsOurs: b.budgetUsd === undefined || target < b.budgetUsd };
        /*
         * Cheaper means cheaper HERE.
         *
         * recommend() was called unpinned, so a smaller budget re-scored the
         * whole catalogue and returned whatever now won. Measured on six
         * briefs it changed the destination six times: New Zealand became
         * Utah, Korea became Mexico, Bali became the Central Coast. The line
         * below then spliced the OLD headline, vibe and why onto it, and
         * concept.why is only ever written in flow.ts, which does not run
         * here. So she asked to make this trip cheaper and got a different
         * country described in the previous country's words, under the single
         * sentence "Re-cut to $2,238 from $4,396".
         *
         * Her rule: a place stated in the conversation never drifts unless she
         * says so. Wanting it cheaper is not saying so.
         */
        /*
         * Same beds. buildShape re-runs from scratch without this and
         * redistributes the nights — so "an extra night in Lisbon, and keep it
         * under $2,000" put the night back where the shape builder wanted it
         * while the summary still said it had gone to Lisbon. Five of fifteen.
         * Neither of these ops asked to change where she sleeps.
         */
        const replanned = planTrip(b, recommend(here(b, t)), p,
          { startDate: t.concept.startDate, shape: t.concept.shape });
        t = { ...replanned, concept: { ...replanned.concept, headline: t.concept.headline, vibe: t.concept.vibe, why: t.concept.why, stays: t.concept.stays } };
        /*
         * Only if it moved. "Re-cut to $2,374 from $2,374." claimed an edit
         * that did not happen; where there is nothing left to cut, the honest
         * sentence is the shortfall line that follows, not this one.
         */
        /*
         * No "did it move" branch here, unlike `set_budget`.
         *
         * `cheaper` anchors the target at 72% of the current quote, so the
         * re-plan is always cheaper: measured across 75 turns it left the
         * estimate unchanged in none of them. The guard its twin needs is
         * unreachable on this branch, and an unreachable branch is a claim
         * nobody can check.
         */
        priced.push({ at: summary.length, before: was,
          text: (d: number) => `Re-cut to $${(was + d).toLocaleString()} from $${was.toLocaleString()}.` });
        told("");
        break;
      }
      case "set_budget": {
        b = { ...b, budgetUsd: op.usd, flexibleBudget: false, budgetIsOurs: false };
        // Pinned, exactly like `cheaper` one branch above. It was not, so
        // "keep it under $1,500" re-scored the catalogue and turned a New
        // Zealand trip into Utah, day one in Zion, still wearing "I think you
        // should go to newzealand" and explaining itself as "Re-cut to $1,338
        // from $3,357". The fix I wrote for the no-number phrasing was never
        // applied to its twin.
        // Measured the way the final total is measured: with the named rooms
        // on. An earlier `extend_stay` in the same turn replans, which resets
        // lodging to the catalogue rate and deflates this by hundreds, so the
        // "already inside" decision was taken against a number that was never
        // on any screen and never shipped.
        const before = (t.concept.stays?.length ? withStays(t, t.concept.stays) : t).concept.estimateUsd;
        /*
         * A ceiling she names is not always a request to cut.
         *
         * "keep it under $4,100" on a $2,561 trip was answered "I can't get
         * this one down any further without taking something out of it" — a
         * failure report for a budget the trip already met, 15 of 15.
         */
        if (before <= op.usd) {
          // The figure is settled at the end of the turn like every other one:
          // `before` here is a mid-turn total, taken after an earlier op has
          // moved the trip and before the rooms go back on.
          deferred.push({ at: summary.length, text: (final) =>
            `That's already inside $${op.usd.toLocaleString()} — this one comes to $${final.toLocaleString()}.` });
          note("");
          break;
        }
        /*
         * Same beds. buildShape re-runs from scratch without this and
         * redistributes the nights — so "an extra night in Lisbon, and keep it
         * under $2,000" put the night back where the shape builder wanted it
         * while the summary still said it had gone to Lisbon. Five of fifteen.
         * Neither of these ops asked to change where she sleeps.
         */
        const replanned = planTrip(b, recommend(here(b, t)), p,
          { startDate: t.concept.startDate, shape: t.concept.shape });
        t = { ...replanned, concept: { ...replanned.concept, headline: t.concept.headline, vibe: t.concept.vibe, why: t.concept.why, stays: t.concept.stays } };
        /*
         * Only if it moved. "Re-cut to $2,374 from $2,374." claimed an edit
         * that did not happen; where there is nothing left to cut, the honest
         * sentence is the shortfall line that follows, not this one.
         */
        if (t.concept.estimateUsd !== before) {
          // Quoted at the end, for the reason in `priced`.
          priced.push({ at: summary.length, before: before,
            text: (d: number) => `Re-cut to $${(before + d).toLocaleString()} from $${before.toLocaleString()}.` });
          told("");
        } else {
          note("I can't get this one down any further without taking something out of it — the cost here is the shape of the trip, not the extras.");
        }
        break;
      }

      case "unknown":
        unresolved.push(op.text);
        break;
    }
  }

  /*
   * A pitch that names the old length is now false.
   *
   * Every op that replans preserves headline/vibe/why so an edit doesn't wipe
   * the prose the trip was sold with. That is right until the edit changes how
   * long the trip is: `extend_stay` replans at days + 1 and kept a paragraph
   * that still said nine days, printed directly under a card reading 10.
   *
   * Handled here rather than inside `extend_stay`, because it is a property of
   * any op that moves the length, not of that one op.
   */
  if (t.concept.days !== trip.concept.days && namesOtherLength(t.concept.why, t.concept.days)) {
    t = { ...t, concept: { ...t.concept, why: whyLine(t, b) } };
  }

  // Sort first: the critic reads the day in order.
  for (const d of t.days) tidy(d);
  /*
   * The last thing that touches the plan is allowed to change it, so it is
   * also required to say so.
   *
   * `repair` drops any item the critic calls a hard error: a venue that is
   * now closed, a hop that cannot be made in the time left. It ran on every
   * edit and never spoke. "Make it less touristy" on the Central Coast trip
   * deleted Bixby Creek and the drive south from day three and answered
   * "Nothing left in here is a tourist trap — the plan already leans local."
   * One thing removed, and the sentence next to it said nothing had changed.
   *
   * The eval caught this only after honest declines stopped being counted as
   * lies: the real one had been sitting inside the noise.
   */
  const before = new Map(t.days.flatMap((d) => d.items.map((i) => [i.id, [i.name, i.tags, i.type] as const])));
  /*
   * Repaired until it stops changing, not once.
   *
   * Deleting an item can create the next error: the critic discounts travel
   * time either side of a transit item, so removing the transit re-introduces
   * the minutes it was covering and the next stop no longer fits. One pass
   * left Korea shipping a day its own critic called impossible — "National
   * Museum of Korea starts at 12:04 but you can't be there before 12:20" —
   * with a summary that said the edit was done.
   *
   * Bounded at three, because a repair that hasn't converged by then is a bug
   * in the critic and an infinite loop is worse than a bad day.
   */
  let removed = 0;
  for (let pass = 0; pass < 3; pass++) {
    const step = repair(t, critique(t, b, p));
    t = step.trip;
    removed += step.removed;
    if (!step.removed) break;
  }
  const fixed = { removed };
  /*
   * Again, because repair deletes: free time, a museum, free time, minus the
   * museum, is two free blocks touching. The sweep in regress-money doesn't
   * currently produce one, so this is held honest by a direct test of `tidy`
   * rather than by the sweep.
   */
  for (const d of t.days) tidy(d);
  if (fixed.removed) {
    /*
     * A metro ride is not something she lost.
     *
     * "Had to drop Across town: it doesn't fit any more once the rest moved"
     * named a transit item to the traveller as a missing part of her day. The
     * hops are plumbing — they appear and disappear as the stops either side
     * of them move, and reporting them as casualties is noise that hides the
     * one line that matters.
     */
    const goneEntries = [...before.entries()]
      .filter(([id]) => !t.days.some((d) => d.items.some((i) => i.id === id)))
      .filter(([, [, , type]]) => type !== "transit" && type !== "logistics");
    const gone = goneEntries.map(([, [name]]) => name);
    /*
     * Say why it actually went.
     *
     * "Had to drop Sagrada Familia: it doesn't fit any more once the rest
     * moved" was the only sentence available, and it was false: she had just
     * asked for less touristy, that op adds `iconic` to avoidTags, and the
     * critic dropped it for carrying the tag she had refused. Dropping it is
     * right. Blaming the timetable for a choice she made is not.
     */
    // Both, because less_touristy pushes "iconic" to the PROFILE and not to
    // the brief, so reading only the brief found nothing and blamed the clock.
    const avoided = new Set([...(b.avoidTags ?? []), ...(p.avoidTags ?? [])]);
    const refused = goneEntries.filter(([, [, tags]]) => (tags ?? []).some((x) => avoided.has(x)));
    const byClock = goneEntries.filter((e) => !refused.includes(e)).map(([, [name]]) => name);
    if (refused.length) {
      told(`Dropped ${list(refused.map(([, [name]]) => name))}: `
        + `${refused.length === 1 ? "it is" : "they are"} exactly what you just said you didn't want.`);
    }
    if (byClock.length) {
      told(`Had to drop ${list(byClock)}: ${byClock.length === 1 ? "it doesn't" : "they don't"} fit any more once the rest moved.`);
    }
    if (!refused.length && !byClock.length && goneEntries.length) {
      told(`Dropped ${goneEntries.length} thing${goneEntries.length === 1 ? "" : "s"} that no longer fit.`);
    }
  }

  /*
   * Re-cost after repair, because repair is allowed to delete things.
   *
   * This block used to run before the critic did, so an edit that dropped the
   * Alhambra still charged for it in the Estimate card's Activities row and
   * still offered a booking card for it, with a price and a cancellation
   * policy, in a trip it was no longer part of. Ten destinations of fifteen
   * were mis-costed; two were still selling a removed place.
   *
   * withStays runs after this and rewrites lodging from the named properties,
   * so the budget is read from ITS total, below, and not from this one.
   */
  const breakdown = costBreakdown(t.concept.destinationId, t.concept.shape, t.days, t.concept.trimmedForBudget, t.concept.origin);
  const estimateUsd = Object.values(breakdown).reduce((a, c) => a + c, 0);
  t = {
    ...t,
    concept: {
      ...t.concept, breakdown, estimateUsd,
    },
    // Regenerate, or the booking list keeps offering things we just removed.
    bookings: mockBookings(t.concept.destinationId, t.concept.shape, t.days, t.concept.startDate, t.concept.origin, t.concept.trimmedForBudget),
  };

  /*
   * Put the rooms back.
   *
   * mockBookings is regenerated on every edit and costBreakdown never reads
   * concept.stays, but concept.stays itself survives. So after any edit the
   * Sleep panel still named "Memmo, about $340 a night, 2 nights" while the
   * Costs row had dropped Hotels from $2,040 to $690 and the Bookings list had
   * reverted to the placeholder "2 nights in Lisbon, $250". Three panels in
   * one Itinerary tree, ~$1,400 apart, after a message that only said
   * "Cleared Prova wine bar off day 4".
   *
   * withStays is the function that makes those three agree. It just was not
   * being called again.
   */
  if (t.concept.stays?.length) t = withStays(t, t.concept.stays);

  /*
   * The budget is measured against the trip that ships, rooms included.
   *
   * budgetShortfallUsd and the sentence beside it were computed before
   * withStays rewrote lodging from the named properties, so the Estimate card
   * and the orange warning under it disagreed: on one measured trip the card
   * read $1,879 against a $2,000 budget and the paragraph beside it said the
   * trip was $78 over. It was $121 under. 22 of 30.
   */
  const finalUsd = t.concept.estimateUsd;
  /*
   * "The $1,800 you gave me" has to be a number she gave.
   *
   * `cheaper` anchors a target to 72% of the quote and writes it to
   * brief.budgetUsd, which is the right mechanism and the wrong thing to quote
   * back at her as hers. Only a figure that arrived as a figure is hers.
   */
  // A number she typed this turn is hers too: `brief` is the pre-edit brief,
  // so comparing against it alone called her own "$1,500" an invention on the
  // one turn where naming it back to her mattered most.
  const gaveIt = ops.some((o) => o.kind === "set_budget");
  const hersBudget = b.budgetUsd !== undefined && !b.budgetIsOurs
    && (gaveIt || b.budgetUsd === brief.budgetUsd);
  t = {
    ...t,
    concept: {
      ...t.concept,
      budgetShortfallUsd: b.budgetUsd !== undefined ? Math.max(0, finalUsd - b.budgetUsd) : 0,
      // The panel says "over what you said". It may only say that about a
      // number she said: `cheaper` writes a target of its own to the brief.
      budgetStated: hersBudget,
    },
  };

  /*
   * A budget she gave us that the trip still misses has to be said out loud.
   *
   * The miss was written to concept.budgetShortfallUsd and rendered in one
   * component, on one screen. From the itinerary stage, "keep it under $1,500"
   * was answered "Re-cut to $2,238 from $2,789." and nothing anywhere named
   * the $1,500 or the $738. Thirteen destinations of fifteen. Cutting a day to
   * force the number would be worse; saying nothing is not the alternative.
   */
  if (b.budgetUsd !== undefined && finalUsd > b.budgetUsd) {
    // `note`, not `told`: this is a fact about the plan, not a claim that the
    // plan moved. Said with `told` it scored as "claimed a change that never
    // landed" on any turn that only reported the miss.
    note(hersBudget
      ? `That's still $${(finalUsd - b.budgetUsd).toLocaleString()} over the `
        + `$${b.budgetUsd.toLocaleString()} you gave me. I'd rather tell you than cut a day to make the number work — say the word and I'll drop one.`
      : `I could only get it to $${finalUsd.toLocaleString()}. Going much below that means dropping a day rather than trimming the extras — say the word and I'll do it.`);
  }

  /*
   * All the priced lines read from ONE baseline: the number she was looking at.
   *
   * Each op captured its own `before` mid-turn, so in a two-replan turn the
   * second quoted a total that existed for microseconds and was never on any
   * screen: "an extra night in Lisbon, and keep it under $2,500" answered
   * "Re-cut to $2,677 from $3,053" against a card that had read $2,839 — and
   * told her that adding a night made the trip $162 cheaper. Ten to twenty-one
   * of thirty, depending on the order.
   *
   * With more than one, the deltas would double-count against a shared
   * baseline, so they collapse into the one sentence that is true: what it
   * was, and what it is.
   */
  if (noTouristTrap >= 0) {
    summary[noTouristTrap] = summary.some((x) => /you just said you didn't want/.test(x))
      ? ""
      : "Nothing left in here is a tourist trap — the plan already leans local.";
  }
  for (const line of deferred) summary[line.at] = line.text(finalUsd);
  if (priced.length === 1) {
    summary[priced[0].at] = priced[0].text(finalUsd - trip.concept.estimateUsd);
  } else if (priced.length > 1) {
    /*
     * The deltas collapse into one true totals line, but what each op DID has
     * to survive it. Blanking every line but the first meant "an extra night
     * in Paris, and keep it under $2,500" added the night and never mentioned
     * it — the only sentence back was a total that had gone DOWN, which reads
     * as a refusal. Fifteen of fifteen.
     */
    const was = trip.concept.estimateUsd;
    const totals = was === finalUsd
      ? "That leaves the total where it was."
      : `That takes the total from $${was.toLocaleString()} to $${finalUsd.toLocaleString()}.`;
    summary[priced[0].at] = [priced[0].what, totals].filter(Boolean).join(" ");
    for (const line of priced.slice(1)) summary[line.at] = line.what ?? "";
  }

  /*
   * File this turn as reversible, if it was one instruction about one tag and
   * it actually moved something.
   *
   * Recorded here, at the end, rather than inside the op: `repair` runs after
   * every op and is allowed to delete, so the state an undo has to match is
   * the one that ships, not the one the op left mid-turn. An edit that changed
   * no day is not filed — there is nothing to put back, and a later "more X"
   * still clears the avoid lists on its own.
   *
   * Six deep, because this rides along with the trip into localStorage and an
   * unbounded history of itinerary days is how a save starts failing.
   */
  if (solo && !undone) {
    const touched = t.days.filter((d) => {
      const was = trip.days.find((x) => x.index === d.index);
      return was && daySignature(was) !== daySignature(d);
    });
    if (touched.length) {
      journal.push({
        tag: solo.tag,
        dir: solo.kind === "more_tag" ? "more" : "less",
        days: touched.map((d) => {
          const was = trip.days.find((x) => x.index === d.index)!;
          return { ...was, items: was.items.map((i) => ({ ...i })) };
        }),
        after: touched.map(daySignature),
      });
    }
  }
  t = { ...t, edits: journal.slice(-6) };

  return { trip: t, brief: b, profile: p, summary: summary.filter(Boolean), claimed, unresolved };
}

// --- helpers ---------------------------------------------------------------

/**
 * Everything about one day a traveller would notice changing.
 *
 * A local copy on purpose: `tripSignature` in evals/metrics.ts asks the same
 * question, and lib must not import the harness that scores it.
 */
const daySignature = (d: ItineraryDay) =>
  `${d.cityId}:${d.items.map(itemKey).join("|")}`;
const itemKey = (i: ItineraryItem) => `${i.name}@${i.start}`;

const acts = (d: ItineraryDay) => d.items.filter((i) => i.type === "activity").length;
const tagCount = (d: ItineraryDay, tag: Tag) =>
  d.items.filter((i) => i.tags.includes(tag)).length;

/**
 * Sort a day and fold any free time that ended up back to back.
 *
 * `freeTime` replaces one item in place with a downtime block of that item's
 * exact start and length, and nothing coalesced it with the downtime already
 * beside it. So "i don't care about museums" produced "10:00 Free time (1h30)"
 * followed immediately by "11:30 Free time (1h15)" — two cards, two different
 * reasons, for one empty morning. Eleven destinations of fifteen; the planner
 * never does it, only the editor did.
 *
 * The first block keeps its id and its reason, and grows to cover the rest.
 */
export function tidy(day: ItineraryDay): void {
  day.items.sort((x, y) => toMin(x.start) - toMin(y.start));
  for (let i = day.items.length - 1; i > 0; i--) {
    const prev = day.items[i - 1], cur = day.items[i];
    if (prev.type !== "downtime" || cur.type !== "downtime") continue;
    const end = Math.max(toMin(prev.start) + prev.durationMin, toMin(cur.start) + cur.durationMin);
    prev.durationMin = end - toMin(prev.start);
    day.items.splice(i, 1);
  }
}

function freeTime(from: ItineraryItem, bank: ReasonBank): ItineraryItem {
  return {
    id: uid("d"), type: "downtime", name: "Free time",
    start: from.start, durationMin: from.durationMin,
    reason: bank.forDowntime(), costUsd: 0, tags: [],
  };
}

function itemFrom(p: Place, start: string, reason: string): ItineraryItem {
  return {
    id: uid("i"), type: p.kind === "meal" ? "meal" : "activity", placeId: p.id,
    name: p.name, start, durationMin: p.durationMin, reason, costUsd: p.costUsd,
    tags: p.tags, lat: p.lat, lng: p.lng, neighborhood: p.neighborhood, note: p.note,
  };
}

/** Put something new into a day's free time, respecting hours and travel. */
function insertInto(
  day: ItineraryDay, trip: Trip, brief: Brief, profile: TravelerProfile,
  tag: Tag | undefined, bank: ReasonBank,
): string | null {
  const used = usedIds(trip);
  // Every free block is a candidate slot, not just the longest one — the
  // longest is often the one furthest from anything worth adding.
  const slots = day.items
    .filter((i) => i.type === "downtime" && i.durationMin >= 75)
    .sort((a, b) => b.durationMin - a.durationMin);
  if (!slots.length) return null;

  const deprio = new Set(profile.deprioritizedPlaceIds);
  const cands = candidatesFor(day.cityId, brief, profile)
    .filter((c) => !used.has(c.place.id))
    .filter((c) => (tag ? c.place.tags.includes(tag) : true))
    // Something they haven't seen beats putting back what we just cut — but
    // putting it back beats refusing the request.
    .sort((a, c) => Number(deprio.has(a.place.id)) - Number(deprio.has(c.place.id)));
  if (!cands.length) return null;

  const weekday = new Date(day.date + "T00:00:00Z").getUTCDay();

  for (const slot of slots) {
    const idx = day.items.indexOf(slot);
    const prev = [...day.items.slice(0, idx)].reverse().find((i) => i.lat != null);
    const startMin = toMin(slot.start);

    for (const { place } of cands.slice(0, 16)) {
      const hop = prev?.lat != null ? travelMinutes({ lat: prev.lat, lng: prev.lng! }, place) : 0;
      const begin = startMin + hop;
      if (place.closedDays?.includes(weekday)) continue;
      const open = place.opens ? Math.max(begin, toMin(place.opens)) : begin;
      // "More food" put a brewpub in a noon slot the planner would have
      // refused outright. The planner's rule, applied to the same decision.
      if (!fitsTimeOfDay(place, open)) continue;
      if (place.closes && open + place.durationMin > (closingMinute(place) ?? Infinity)) continue;
      if (open + place.durationMin > startMin + slot.durationMin) continue;

      const rest = startMin + slot.durationMin - (open + place.durationMin);
      const replacement: ItineraryItem[] = [
        itemFrom(place, toClock(open), bank.forPlace(place, "afternoon", brief)),
      ];
      if (rest >= 45) {
        replacement.push({
          id: uid("d"), type: "downtime", name: "Free time",
          start: toClock(open + place.durationMin), durationMin: rest,
          reason: bank.forDowntime(), costUsd: 0, tags: [],
        });
      }
      if (open > startMin + 15) {
        replacement.unshift({
          id: uid("d"), type: "downtime", name: "Free time", start: slot.start,
          durationMin: open - startMin, reason: bank.forDowntime(), costUsd: 0, tags: [],
        });
      }
      day.items.splice(idx, 1, ...replacement);
      return place.name;
    }
  }
  return null;
}

/**
 * When there's no free block big enough, trade something out instead of
 * refusing. Section 14: "I'll shift one city day toward Sintra's coastal side
 * rather than adding another museum."
 */
function swapInto(
  day: ItineraryDay, trip: Trip, brief: Brief, profile: TravelerProfile,
  tag: Tag, bank: ReasonBank,
): { added: string; dropped: string } | null {
  const used = usedIds(trip);
  const favor = favoredTags(brief, profile);
  const weekday = new Date(day.date + "T00:00:00Z").getUTCDay();

  const cands = candidatesFor(day.cityId, brief, profile)
    .filter((c) => !used.has(c.place.id) && c.place.tags.includes(tag));
  if (!cands.length) return null;

  // Cheapest thing to give up first.
  const victims = day.items
    .filter((i) => i.type === "activity")
    .sort((a, b) => activityValue(a, favor) - activityValue(b, favor));

  for (const victim of victims) {
    if (victim.tags.includes(tag)) continue;
    const idx = day.items.indexOf(victim);

    // The window is the victim plus any free time touching it.
    let lo = idx, hi = idx;
    while (lo > 0 && day.items[lo - 1].type === "downtime") lo--;
    while (hi < day.items.length - 1 && day.items[hi + 1].type === "downtime") hi++;

    const windowStart = toMin(day.items[lo].start);
    const windowEnd = toMin(day.items[hi].start) + day.items[hi].durationMin;
    const before = [...day.items.slice(0, lo)].reverse().find((i) => i.lat != null);
    const after = day.items.slice(hi + 1).find((i) => i.lat != null);

    for (const { place } of cands.slice(0, 10)) {
      if (place.closedDays?.includes(weekday)) continue;
      const inHop = before?.lat != null ? travelMinutes({ lat: before.lat, lng: before.lng! }, place) : 0;
      const outHop = after?.lat != null ? travelMinutes(place, { lat: after.lat, lng: after.lng! }) : 0;
      let begin = windowStart + inHop;
      if (place.opens) begin = Math.max(begin, toMin(place.opens));
      // Third caller of the same rule. The planner refuses an evening-only
      // place before 15:00; every path that places one has to agree.
      if (!fitsTimeOfDay(place, begin)) continue;
      const finish = begin + place.durationMin;
      if (place.closes && finish > (closingMinute(place) ?? Infinity)) continue;
      if (finish + outHop > windowEnd) continue;

      const replacement: ItineraryItem[] = [
        itemFrom(place, toClock(begin), bank.forPlace(place, "afternoon", brief)),
      ];
      const rest = windowEnd - (finish + outHop);
      if (rest >= 45) {
        replacement.push({
          id: uid("d"), type: "downtime", name: "Free time",
          start: toClock(finish), durationMin: rest, reason: bank.forDowntime(),
          costUsd: 0, tags: [],
        });
      }
      day.items.splice(lo, hi - lo + 1, ...replacement);
      return { added: place.name, dropped: victim.name };
    }
  }
  return null;
}

function bestAlternative(
  day: ItineraryDay, trip: Trip, brief: Brief, profile: TravelerProfile, current: Place,
): Place | undefined {
  const used = usedIds(trip);
  /*
   * The replacement has to be open when the thing it replaces was.
   *
   * This filtered on touristy, kind and duration and never on hours, and the
   * swap keeps the old item's start time. So "make it less touristy" in Mexico
   * put Museo Jumex, which opens at 11:00, into a 10:00 slot; the critic then
   * ruled it closed and repair deleted it in the same turn. She read "Swapped
   * Palacio de Bellas Artes for Museo Jumex" and then "Had to drop
   * Teotihuacan and Museo Jumex", ending with a day that lost its only
   * activity and gained nothing.
   */
  const at = toMin(day.items.find((i) => "placeId" in i && i.placeId === current.id)?.start ?? "09:00");
  const weekday = new Date(day.date + "T00:00:00Z").getUTCDay();
  const fits = candidatesFor(day.cityId, brief, profile)
    .filter((c) => !used.has(c.place.id))
    .filter((c) => c.place.touristy <= 2)
    .filter((c) => c.place.kind === current.kind)
    .filter((c) => isOpenFor(c.place, at, weekday))
    // And it has to belong in that part of the day: same rule as the planner.
    .filter((c) => fitsTimeOfDay(c.place, at))
    .map((c) => c.place);
  /*
   * A longer replacement pushes everything after it, and the critic then
   * deletes whatever no longer fits -- so "make it less touristy" ended with
   * "Swapped X for Y. Had to drop Y and the afternoon's other stop." Prefer
   * one that takes no longer than what it replaces; only widen if there is
   * nothing.
   */
  return fits.find((x) => x.durationMin <= current.durationMin)
    ?? fits.find((x) => x.durationMin - current.durationMin <= 45);
}

const list = (xs: string[]) =>
  xs.length <= 1 ? xs[0] ?? "" : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1];

let prefSeq = 0;
const learned = (text: string) => ({
  id: `lp-${prefSeq++}`, text, source: "learned" as const, observations: 1,
});
