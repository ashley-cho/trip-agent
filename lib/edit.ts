import type {
  Brief, ItineraryDay, ItineraryItem, Place, Tag, TravelerProfile, Trip,
} from "@/lib/types";
import type { EditOp } from "@/lib/agent/types";
import { PACE_ACTIVITIES, type Pace } from "@/lib/types";
import { inferPace, paceDown } from "@/lib/discovery";
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
  [/\bhik|walk/i, "walk"],
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

  // free time
  if (/\b(more (free|down) ?time|free afternoon|breathing room|more space|nothing planned)\b/i.test(t)) {
    ops.push({ kind: "add_downtime", day });
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
  } else if (/\b(cheaper|too expensive|too much|less expensive|bring (it|the (cost|price)) down|tighter budget|on a budget|can'?t afford)\b/i.test(t)) {
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
  const wantsMore = (/\b(more|add|extra|another)\b/i.test(t) || wants.test(t))
    && !/\bno more\b/i.test(t);
  const wantsLess = /\b(don'?t (really )?(care|like)|not into|hate|no more|remove|drop|skip|cut|fewer|less)\b/i.test(t);

  const alreadyTouristy = ops.some((o) => o.kind === "less_touristy");
  if (wantsLess) {
    const tags = parseAvoidTags(t).filter((tag) => !(alreadyTouristy && tag === "iconic"));
    const direct = tagIn(t);
    const all = [...new Set([...tags, ...(direct ? [direct] : [])])];
    for (const tag of all) ops.push({ kind: "remove_tag", tag, day });
  }
  if (wantsMore && !wantsLess) {
    const tags = parseFavorTags(t);
    const direct = tagIn(t);
    const all = [...new Set([...tags, ...(direct ? [direct] : [])])];
    for (const tag of all.slice(0, 2)) ops.push({ kind: "more_tag", tag, day });
  }

  if (ops.length === 0) ops.push({ kind: "unknown", text: t });
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

export function applyOps(
  trip: Trip, ops: EditOp[], brief: Brief, profile: TravelerProfile,
): EditResult {
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

  for (const op of ops) {
    switch (op.kind) {
      case "remove_tag": {
        const removed: string[] = [];
        for (const d of t.days) {
          if (op.day && d.index !== op.day) continue;
          const keep: ItineraryItem[] = [];
          for (const i of d.items) {
            if (i.type === "activity" && i.tags.includes(op.tag)) {
              removed.push(i.name);
              if (i.placeId) p.rejectedPlaceIds.push(i.placeId);
              keep.push(freeTime(i, bank));
            } else keep.push(i);
          }
          d.items = keep;
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
        if (!summary.length) note("This is already about as light as it gets without emptying days out entirely.");
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
        const targets = op.day ? t.days.filter((d) => d.index === op.day) : [...t.days].sort((a, c) => acts(c) - acts(a)).slice(0, 1);
        for (const d of targets) {
          const ranked = d.items.filter((i) => i.type === "activity");
          const drop = ranked[ranked.length - 1];
          if (!drop) continue;
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
        if (!swapped) note("Nothing left in here is a tourist trap — the plan already leans local.");
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
        t = { ...replanned, concept: { ...replanned.concept, headline: t.concept.headline, vibe: t.concept.vibe, why: t.concept.why } };
        b = b2;
        const delta = t.concept.estimateUsd - before;
        told(`Added a night in ${cityById(op.cityId).name}. That's ${delta >= 0 ? "+" : "−"}$${Math.abs(delta)} on the total, mostly the room and one more day of eating.`);
        break;
      }

      case "cheaper": {
        // Anchor to the quote she is looking at, not to a budget she was
        // never asked for. Same 0.72 the "too expensive" chip uses, so the
        // two routes to the same complaint land in the same place.
        const was = t.concept.estimateUsd;
        const target = Math.max(600, Math.round((was * 0.72) / 100) * 100);
        b = { ...b, budgetUsd: Math.min(b.budgetUsd ?? Infinity, target), flexibleBudget: false };
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
        const replanned = planTrip(b, recommend(here(b, t)), p, { startDate: t.concept.startDate });
        t = { ...replanned, concept: { ...replanned.concept, headline: t.concept.headline, vibe: t.concept.vibe, why: t.concept.why } };
        told(`Re-cut to $${t.concept.estimateUsd.toLocaleString()} from $${was.toLocaleString()}.`);
        break;
      }
      case "set_budget": {
        b = { ...b, budgetUsd: op.usd, flexibleBudget: false };
        // Pinned, exactly like `cheaper` one branch above. It was not, so
        // "keep it under $1,500" re-scored the catalogue and turned a New
        // Zealand trip into Utah, day one in Zion, still wearing "I think you
        // should go to newzealand" and explaining itself as "Re-cut to $1,338
        // from $3,357". The fix I wrote for the no-number phrasing was never
        // applied to its twin.
        const before = t.concept.estimateUsd;
        const replanned = planTrip(b, recommend(here(b, t)), p, { startDate: t.concept.startDate });
        t = { ...replanned, concept: { ...replanned.concept, headline: t.concept.headline, vibe: t.concept.vibe, why: t.concept.why } };
        told(`Re-cut to $${t.concept.estimateUsd.toLocaleString()} from $${before.toLocaleString()}.`);
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
   * Re-cost last, because repair is allowed to delete things.
   *
   * This block used to run before the critic did, so an edit that dropped the
   * Alhambra still charged for it in the Estimate card's Activities row and
   * still offered a booking card for it, with a price and a cancellation
   * policy, in a trip it was no longer part of. Ten destinations of fifteen
   * were mis-costed; two were still selling a removed place.
   */
  const breakdown = costBreakdown(t.concept.destinationId, t.concept.shape, t.days, t.concept.trimmedForBudget, t.concept.origin);
  const estimateUsd = Object.values(breakdown).reduce((a, c) => a + c, 0);
  t = {
    ...t,
    concept: {
      ...t.concept, breakdown, estimateUsd,
      budgetShortfallUsd: b.budgetUsd !== undefined ? Math.max(0, estimateUsd - b.budgetUsd) : 0,
    },
    // Regenerate, or the booking list keeps offering things we just removed.
    bookings: mockBookings(t.concept.destinationId, t.concept.shape, t.days, t.concept.startDate, t.concept.origin, t.concept.trimmedForBudget),
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
  if (b.budgetUsd !== undefined && estimateUsd > b.budgetUsd) {
    // `note`, not `told`: this is a fact about the plan, not a claim that the
    // plan moved. Said with `told` it scored as "claimed a change that never
    // landed" on any turn that only reported the miss.
    note(`That's still $${(estimateUsd - b.budgetUsd).toLocaleString()} over the `
      + `$${b.budgetUsd.toLocaleString()} you gave me. I'd rather tell you than cut a day to make the number work — say the word and I'll drop one.`);
  }

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

  return { trip: t, brief: b, profile: p, summary, claimed, unresolved };
}

// --- helpers ---------------------------------------------------------------

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
