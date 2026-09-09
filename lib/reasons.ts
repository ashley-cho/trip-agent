import type { Brief, Place, Tag } from "@/lib/types";
import { activityWords } from "@/lib/select";

// Section 13: every meaningful item carries a reason, and section 12 says the
// reasons must not read as generated. So: a hand-written bank, keyed on what
// the traveler actually asked for, with used-clause tracking to stop repeats.

type Slot = "morning" | "midday" | "afternoon" | "evening";

const BY_TAG: Partial<Record<Tag, string[]>> = {
  wine: [
    "You asked for wine. This is the version that isn't a tasting-room performance.",
    "Wine was explicit on your list, and this is where it's poured by someone with an opinion.",
    "Wine kept coming up in what you told me, so it gets a proper slot rather than a glass at dinner.",
  ],
  food: [
    "Food was near the top of your list, and this is where it's good rather than merely convenient.",
    "You wanted to eat well. This is the unshowy version of that.",
    "This is the meal I would build the day around, so the hours either side are kept clear.",
    "Eating well was the brief. At this hour, this is where that happens.",
  ],
  history: [
    "You said history, but not entire days of it. One substantial stop, then the day opens up.",
    "History without a guided tour attached — you can move through this at your own speed.",
    "Old, and still used for what it was built for, which is rarer than it sounds.",
  ],
  museum: [
    "One museum, not a week of them. You were clear about that.",
    "The single collection here worth the indoor hours.",
    "Indoors, which the weather may make you grateful for, and short enough not to eat the day.",
  ],
  walk: [
    "Unstructured walking was half the point of this trip, so there's no fixed route on this block.",
    "You wanted to explore on foot rather than tick things off. This block is exactly that.",
    "On foot, no ticket, no queue. Half the point of coming here is being able to do this.",
    "A stretch of the day with no schedule attached beyond the direction of travel.",
  ],
  viewpoint: [
    "Thirty minutes, free, and the best light of the day falls here.",
    "A short stop that earns its place purely on what you can see from it.",
    "Short, free, and it puts everything you have walked through into shape.",
    "Worth the climb for orienting yourself, before the rest of the trip.",
  ],
  nature: [
    "Green in the middle of a city trip, and the day is built to leave room for it.",
    "The outdoor counterweight to the built-up days either side of it.",
    "Green, quiet, and a deliberate break from the built-up half of this trip.",
    "The reason to come at all, at the hour it looks best.",
  ],
  coast: [
    "The coast is what balances out the built-up days either side of it.",
    "You asked for water. This is the closest real version of it.",
    "On the water rather than near it, which is a different thing entirely.",
  ],
  market: [
    "Markets were on your list, and this one still works as a market rather than a photo stop.",
    "Where the food actually comes from, which is more interesting than where it's served.",
    "Where the food you have been eating all week actually comes from.",
  ],
  coffee: [
    "A slow start, because you said you didn't want to be out early.",
    "Somewhere to sit for forty minutes before the day starts properly.",
    "A deliberate slow start. Nothing today is scheduled tightly enough to make this a rush.",
    "Somewhere to sit and decide what the day is, rather than being handed one.",
  ],
  contemporary: [
    "This covers the modern side of the city without another grand old museum.",
    "The modern counterweight, so the trip isn't only old stone.",
    "Something built this century, so the trip is not entirely a period piece.",
  ],
  art: [
    "Art was on your list, and this is the collection worth the time over the famous one.",
    "You asked for art specifically, so this gets a real block rather than a passing look.",
    "You asked for art. This is the room worth standing still in.",
  ],
  music: [
    "You asked for music, and this is the version that isn't staged for visitors.",
    "Live, small room, and not staged for an audience of visitors.",
    "Live, small, and local, which is the version worth staying up for.",
  ],
  local: [
    "Picked because it's the local option, not the famous one.",
    "This is where people who live here go, not where visitors get sent.",
    "Chosen for who else is in the room, not for what is on the sign outside.",
    "Unremarkable from the street, which is usually the tell.",
  ],
  architecture: [
    "The clearest single piece of architecture in the city, and it takes twenty minutes.",
    "Worth standing in front of for its own sake, not as a checklist item.",
    "Worth ten minutes of standing and looking up before you go in.",
  ],
  hike: [
    "Hiking, in a two-hour dose rather than a whole day.",
    "Enough effort to feel like something, not enough to wreck the afternoon.",
    "Real effort, in a dose that leaves you able to enjoy the evening.",
  ],
  garden: [
    "Somewhere to sit down outdoors in the middle of the day.",
    "Green, quiet, and free — a good place to lose an hour on purpose.",
    "Somewhere to sit outdoors in the middle of the day and account for nothing.",
  ],
  spa: ["You wanted to actually rest, and this is the most direct way to do it."],
  boat: ["On the water rather than looking at it, which is a different day entirely."],
  shopping: ["Browsing rather than buying, and the street is the interesting part."],
  nightlife: ["You said city energy. This is where it is, at the hour it happens."],
  castle: ["Substantial, walkable, and done in an hour — not a whole morning surrendered."],
  church: ["The one religious building here that's worth going inside for the room itself."],
};

const BY_SLOT: Record<Slot, string[]> = {
  morning: ["Scheduled early because it's quietest before ten and unpleasant after eleven."],
  midday: ["A real sit-down lunch, because the afternoon after it is deliberately empty."],
  afternoon: ["Slotted here because it's a five-minute walk from where you'll already be."],
  evening: ["Timed for the hour the city actually does this, rather than when it's convenient for visitors."],
};

const MEAL_REASONS: Record<Slot, string[]> = {
  morning: ["Breakfast where you're staying, without going out of your way for it."],
  /*
   * Lunch reasons, about lunch.
   *
   * Six of the eight were near-duplicates of BY_TAG lines for spa, boat,
   * castle, church and shopping: "Hot water is the local answer to a long
   * day", "Go in for the room itself, it costs nothing and takes fifteen
   * minutes". pick() returns the first unused, so from the third lunch onward
   * the wrong one was served -- a pastel de nata counter in Lisbon captioned
   * "Slow, on the water, and it reframes everything you have been walking
   * past". 466 trips out of 675.
   */
  midday: [
    "A real sit-down lunch, because the afternoon after it is deliberately empty.",
    "Lunch is the bigger meal here, so this is the one worth planning.",
    "This is the hour the place stops performing for visitors and gets on with it.",
    "Long enough to be a break, short enough that the day still has an afternoon in it.",
    "Where people who work nearby eat, at the hour they eat.",
    "Cheap, quick and better than the sit-down version two streets over.",
    "Order what the counter is busiest with; that is the thing they are good at.",
    "A proper stop rather than something eaten walking, because the morning earned it.",
  ],
  afternoon: ["A late lunch, which is what the schedule around it allows for."],
  evening: [
    "Dinner at the hour the city actually eats, not two hours before it.",
    "The one booking worth making for this day.",
  ],
};

export const DOWNTIME_REASONS = [
  "This is a vacation, not a scavenger hunt.",
  "Nothing planned. Wander, read, nap, sit at a café, or do whatever looks interesting.",
  "Deliberately empty. The day either side of this is full enough.",
  "This is the block that makes the rest of the day feel unhurried rather than efficient.",
  "Left open on purpose. The best hours of most trips are the ones nobody planned.",
  "No plan. If you find something here, that is the trip working.",
  "This is where the day stops being a schedule.",
  "Unbooked, and it should stay that way unless you ask me to fill it.",
];

/** Tracks what's been said already, so a 7-day trip doesn't repeat itself. */
/**
 * Lines that tell her she said something.
 *
 * Eleven of these are written in the second person -- "You asked for wine",
 * "Markets were on your list", "You said history" -- and forPlace served them
 * off the place's own tags, so they fired on a brief where she had picked
 * nothing at all. Measured: 300 of 300 trips. It is the same fabrication the
 * pitch was fixed for months ago, in the one panel labelled "Why this?".
 *
 * They are good lines and they stay. They are just gated now on whether she
 * actually typed the word they claim she said. A vibe chip does not count: the
 * chips are our taxonomy, which is the whole reason this rule exists.
 */
/*
 * Every way a line can claim she said something.
 *
 * The first version of this regex caught six of the twelve. The other six
 * phrase the same claim differently -- "You were clear about that", "was the
 * brief", "one of your interests", "near the top of your list", "half the
 * point of this trip", "the city days you asked for" -- and sailed through the
 * gate, so the plainest message in the product, "i want to go to portugal for
 * a week", still produced "One museum, not a week of them. You were clear
 * about that." She was not clear about that. She said nothing about museums.
 */
const ATTRIBUTES = new RegExp([
  "you said", "you asked", "you told me", "you didn'?t want", "you wanted",
  "you were clear", "on your list", "top of your list", "one of your interests",
  "was the brief", "half the point", "what you asked for", "your list",
].join("|"), "i");

/**
 * What she actually typed, with refusals removed.
 *
 * activityWords stops at "no", "not", "avoid", "hate" and so on, so "no wine,
 * i hate wine" no longer licenses "You asked for wine" -- which it did, because
 * the word was present in the sentence and nothing looked at what surrounded
 * it. Chips stay excluded: they are our taxonomy.
 */
function herWords(brief: Brief): Set<string> {
  const sources = [
    brief.opening ?? "",
    ...(brief.activities ?? []),
    ...(brief.stated ?? []).filter((x) => x.how === "typed").map((x) => x.text),
  ];
  return new Set(sources.flatMap((t) => activityWords(t)));
}

/**
 * Did she type the thing THIS SENTENCE says she asked for?
 *
 * The gate used to be keyed on the tag the line is filed under, plus a map of
 * that tag's synonyms. A tag's pool is not one claim, though: the `coast` pool
 * contains "The coast is what balances out the city days you asked for", so
 * typing "beaches and swimming" licensed a sentence asserting she had asked
 * for city days — on a Pacific Northwest trip with no city days in it.
 * Twelve destinations of fifteen, on ordinary briefs.
 *
 * A sentence is its own claim. It may say "you asked for X" only if X is a
 * word she typed, so the check reads the line's own words. Errs toward
 * silence: "beach" will not license a line that says "coast", and a reason
 * that doesn't fire costs nothing.
 */
function claimed(line: string, hers: Set<string>): boolean {
  return activityWords(line).some((w) => hers.has(w));
}

export class ReasonBank {
  private used = new Set<string>();

  private pick(pool: string[], allow: (line: string) => boolean = () => true): string | null {
    const fresh = pool.filter((s) => !this.used.has(s) && allow(s));
    const choice = fresh[0] ?? null;
    if (choice) this.used.add(choice);
    return choice;
  }

  forPlace(place: Place, slot: Slot, brief: Brief): string {
    const favored = new Set<Tag>(brief.vibes.flatMap((v) => VIBE_TAG_HINT[v] ?? []));
    // Prefer a reason tied to something they actually asked for.
    const ordered = [
      ...place.tags.filter((t) => favored.has(t)),
      ...place.tags.filter((t) => !favored.has(t)),
    ];
    const hers = herWords(brief);
    for (const tag of ordered) {
      const pool = BY_TAG[tag];
      if (pool) {
        // "You asked for wine" is only allowed if she typed wine.
        const r = this.pick(pool, (line) => !ATTRIBUTES.test(line) || claimed(line, hers));
        if (r) return r;
      }
    }
    const early = brief.avoidTags?.includes("earlystart");
    return this.pick(BY_SLOT[slot], (line) => !ATTRIBUTES.test(line) || !!early)
      ?? BY_SLOT[slot].find((l) => !ATTRIBUTES.test(l))
      ?? BY_SLOT[slot][0];
  }

  forMeal(slot: Slot): string {
    return this.pick(MEAL_REASONS[slot]) ?? MEAL_REASONS[slot][0];
  }

  forDowntime(): string {
    return this.pick(DOWNTIME_REASONS) ?? DOWNTIME_REASONS[0];
  }

  /** Allow reuse once the bank is exhausted rather than falling back to slop. */
  reset() { this.used.clear(); }
}

const VIBE_TAG_HINT: Record<string, Tag[]> = {
  nature: ["nature", "coast", "hike", "garden", "viewpoint"],
  exploration: ["walk", "history", "local", "architecture"],
  food: ["food", "wine", "market", "coffee"],
  relaxation: ["walk", "garden", "spa", "coast"],
  culture: ["art", "museum", "architecture", "music", "contemporary"],
  adventure: ["hike", "boat", "coast"],
  city: ["nightlife", "music", "contemporary", "shopping"],
};
