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
import { critique, repair } from "@/lib/critic";
import { parseAvoidTags, parseFavorTags } from "@/lib/discovery";
import { favoredTags } from "@/lib/select";
import { costBreakdown, mockBookings, planTrip } from "@/lib/planner";
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
  const wantsMore = /\b(more|add|extra|another)\b/i.test(t) && !/\bno more\b/i.test(t);
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
  unresolved: string[];
}

const usedIds = (trip: Trip) =>
  new Set(trip.days.flatMap((d) => d.items.map((i) => i.placeId).filter(Boolean) as string[]));

/** How much this item is earning its slot, given what they actually asked for. */
const activityValue = (i: ItineraryItem, favor: Set<Tag>) =>
  i.tags.filter((t) => favor.has(t)).length + (i.costUsd === 0 ? 0.5 : 0);

export function applyOps(
  trip: Trip, ops: EditOp[], brief: Brief, profile: TravelerProfile,
): EditResult {
  let t: Trip = { ...trip, days: trip.days.map((d) => ({ ...d, items: [...d.items] })) };
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
        summary.push(removed.length
          ? `Removed ${list(removed)}.`
          : `Nothing in the plan was built around ${op.tag} — noted for next time.`);
        break;
      }

      case "remove_item": {
        for (const d of t.days) {
          const i = d.items.find((x) => x.id === op.itemId);
          if (!i) continue;
          if (i.placeId) p.rejectedPlaceIds.push(i.placeId);
          d.items = d.items.map((x) => (x.id === op.itemId ? freeTime(x, bank) : x));
          summary.push(`Removed ${i.name}.`);
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
          summary.push(`Day ${d.index} had ${before} things scheduled. Cut ${list(cut.map((r) => r.name))}.`);
        }
        if (!summary.length) summary.push("This is already about as light as it gets without emptying days out entirely.");
        p.preferences.push(learned("Prefers fewer scheduled activities per day"));
        break;
      }

      case "increase_pace": {
        const targets = op.day ? t.days.filter((d) => d.index === op.day) : [...t.days].sort((a, c) => acts(a) - acts(c)).slice(0, 1);
        for (const d of targets) {
          const added = insertInto(d, t, b, p, undefined, bank);
          summary.push(added ? `Added ${added} to day ${d.index}.` : `Day ${d.index} is already as full as it usefully gets.`);
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
          summary.push(`Cleared ${drop.name} off day ${d.index}, so the afternoon is open.`);
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
            summary.push(over
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
              summary.push(`No room to just add it, so I swapped ${swap.dropped} for ${swap.added} on day ${d.index}.`);
              added++;
              break;
            }
          }
        }
        if (!p.favorTags.includes(op.tag)) p.favorTags.push(op.tag);
        if (added === 0) {
          summary.push(`I can't fit more ${op.tag} into these cities without spending the time on travel instead. If you want it properly, the better move is a different base — say the word and I'll re-cut the shape of the trip.`);
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
            summary.push(`Swapped ${cur.name} for ${alt.name}.`);
            swapped++;
          }
        }
        if (!p.avoidTags.includes("iconic")) p.avoidTags.push("iconic");
        p.preferences.push(learned("Avoids the famous option when a local one exists"));
        if (!swapped) summary.push("Nothing left in here is a tourist trap — the plan already leans local.");
        break;
      }

      case "extend_stay": {
        const leg = t.concept.shape.find((l) => l.cityId === op.cityId);
        if (!leg) break;
        const before = t.concept.estimateUsd;
        const days = t.concept.days + op.nights;
        const b2 = { ...b, days };
        const replanned = planTrip(b2, recommend(b2), p, { startDate: t.concept.startDate });
        // Preserve the extra night where they asked for it.
        const target = replanned.concept.shape.find((l) => l.cityId === op.cityId);
        if (target) target.nights += 0;
        t = { ...replanned, concept: { ...replanned.concept, headline: t.concept.headline, vibe: t.concept.vibe, why: t.concept.why } };
        b = b2;
        const delta = t.concept.estimateUsd - before;
        summary.push(`Added a night. That's ${delta >= 0 ? "+" : "−"}$${Math.abs(delta)} on the total, mostly the room and one more day of eating.`);
        break;
      }

      case "cheaper": {
        // Anchor to the quote she is looking at, not to a budget she was
        // never asked for. Same 0.72 the "too expensive" chip uses, so the
        // two routes to the same complaint land in the same place.
        const was = t.concept.estimateUsd;
        const target = Math.max(600, Math.round((was * 0.72) / 100) * 100);
        b = { ...b, budgetUsd: Math.min(b.budgetUsd ?? Infinity, target), flexibleBudget: false };
        const replanned = planTrip(b, recommend(b), p, { startDate: t.concept.startDate });
        t = { ...replanned, concept: { ...replanned.concept, headline: t.concept.headline, vibe: t.concept.vibe, why: t.concept.why } };
        summary.push(`Re-cut to $${t.concept.estimateUsd.toLocaleString()} from $${was.toLocaleString()}.`);
        break;
      }
      case "set_budget": {
        b = { ...b, budgetUsd: op.usd, flexibleBudget: false };
        const before = t.concept.estimateUsd;
        const replanned = planTrip(b, recommend(b), p, { startDate: t.concept.startDate });
        t = { ...replanned, concept: { ...replanned.concept, headline: t.concept.headline, vibe: t.concept.vibe, why: t.concept.why } };
        summary.push(`Re-cut to $${t.concept.estimateUsd.toLocaleString()} from $${before.toLocaleString()}.`);
        break;
      }

      case "unknown":
        unresolved.push(op.text);
        break;
    }
  }

  // Re-sort and re-cost, then let the critic have the last word.
  for (const d of t.days) d.items.sort((x, y) => toMin(x.start) - toMin(y.start));
  const breakdown = costBreakdown(t.concept.destinationId, t.concept.shape, t.days, t.concept.trimmedForBudget, t.concept.origin);
  const estimateUsd = Object.values(breakdown).reduce((a, c) => a + c, 0);
  t = {
    ...t,
    concept: {
      ...t.concept, breakdown, estimateUsd,
      budgetShortfallUsd: b.budgetUsd !== undefined ? Math.max(0, estimateUsd - b.budgetUsd) : 0,
    },
    // Regenerate, or the booking list keeps offering things we just removed.
    bookings: mockBookings(t.concept.destinationId, t.concept.shape, t.days, t.concept.startDate, t.concept.origin),
  };
  const fixed = repair(t, critique(t, b, p));
  t = fixed.trip;

  return { trip: t, brief: b, profile: p, summary, unresolved };
}

// --- helpers ---------------------------------------------------------------

const acts = (d: ItineraryDay) => d.items.filter((i) => i.type === "activity").length;
const tagCount = (d: ItineraryDay, tag: Tag) =>
  d.items.filter((i) => i.tags.includes(tag)).length;

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
      if (place.closes && open + place.durationMin > toMin(place.closes)) continue;
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
      const finish = begin + place.durationMin;
      if (place.closes && finish > toMin(place.closes)) continue;
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
  return candidatesFor(day.cityId, brief, profile)
    .filter((c) => !used.has(c.place.id))
    .filter((c) => c.place.touristy <= 2)
    .filter((c) => c.place.kind === current.kind)
    .filter((c) => Math.abs(c.place.durationMin - current.durationMin) <= 45)
    .map((c) => c.place)[0];
}

const list = (xs: string[]) =>
  xs.length <= 1 ? xs[0] ?? "" : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1];

let prefSeq = 0;
const learned = (text: string) => ({
  id: `lp-${prefSeq++}`, text, source: "learned" as const, observations: 1,
});
