import { ROAD_TRIP, detectRegion, regionIds } from "@/lib/regions";
import { wantsAbroad } from "@/lib/abroad";
import { addDays, bareMonth, monthName, parseDateRange, singleDate } from "@/lib/dates";
import type { Phase } from "@/lib/agent/types";
import { originFromText } from "@/lib/origin";
import type { Brief, Pace, Tag, Vibe } from "@/lib/types";
import { ALL_VIBES, VIBE_LABEL } from "@/lib/types";
import type { BriefPatch, Question } from "@/lib/agent/types";
import { CITIES, DESTINATIONS, isKnownDestination } from "@/data/destinations";
import { CLAUSE_BREAK_SOURCE, firstBreak } from "@/lib/clauses";

// ---------------------------------------------------------------------------
// Shared discovery logic. Both drivers use `isSufficient` and `inferPace` —
// only the *wording* and free-text parsing differ between rules and LLM.
// ---------------------------------------------------------------------------

/**
 * Section 5: stop asking the moment a high-confidence recommendation is
 * possible. Three signals is the floor and, deliberately, also the ceiling —
 * constraints are collected as free text alongside the recommendation instead
 * of as a fourth blocking question.
 */
export function isSufficient(b: Brief): boolean {
  const durationKnown = b.days !== undefined || b.flexibleDuration === true;
  const vibeKnown = b.vibes.length > 0 || b.surpriseMe === true || b.namedDestination !== undefined;
  const budgetKnown = b.budgetUsd !== undefined || b.flexibleBudget === true;
  return durationKnown && vibeKnown && budgetKnown;
}

/** Pace is inferred, not asked — asking it is the questionnaire smell. */
export function inferPace(b: Brief): Pace {
  if (b.pace) return b.pace;
  const v = new Set(b.vibes);
  const restful = v.has("relaxation");
  const active = v.has("adventure") || v.has("city");
  const curious = v.has("exploration") || v.has("culture");
  if (restful && !active && !curious) return "relaxed";
  if (restful && (active || curious)) return "mixed";
  if (active && !restful) return "busy";
  if (curious && !restful) return "mixed";
  return "mixed";
}

export function effectiveDays(b: Brief): number {
  if (b.days) return b.days;
  return 7; // "I'm flexible" resolves to a week
}

// --- free-text parsing (rules driver; the LLM driver replaces this) --------

const AVOID_PATTERNS: [RegExp, Tag][] = [
  [/\b(early|wake up early|mornings?|dawn|sunrise)\b/i, "earlystart"],
  [/\bmuseum/i, "museum"],
  [/\b(hik|trek|climb)/i, "hike"],
  [/\b(touristy|tourist trap|crowds?|crowded|packed)\b/i, "iconic"],
  [/\b(nightlife|clubs?|partying|bars? all night)\b/i, "nightlife"],
  [/\bshopping\b/i, "shopping"],
  [/\bbeach/i, "beach"],
  [/\b(church|cathedral|monaster)/i, "church"],
  [/\bcastles?\b/i, "castle"],
  [/\b(boats?|sailing|seasick)\b/i, "boat"],
  [/\b(art galler|galleries)\b/i, "art"],
];

const FAVOR_PATTERNS: [RegExp, Tag][] = [
  [/\bwine|vineyard|winer|port\b/i, "wine"],
  [/\bfood|eat|restaurant|market|cook/i, "food"],
  [/\bnature|outdoors?|green|countryside\b/i, "nature"],
  [/\bbeach|coast|sea|ocean\b/i, "coast"],
  [/\bhistor|ancient|old town\b/i, "history"],
  [/\bart\b|galler/i, "art"],
  [/\barchitect/i, "architecture"],
  [/\bcoffee|caf[eé]\b/i, "coffee"],
  [/\bwalk|wander|stroll/i, "walk"],
  [/\bmusic|live music|concert/i, "music"],
  [/\bspa|sauna|hot spring|hot water|bath ?house|lagoon|soak/i, "spa"],
];

export function parseAvoidTags(text: string): Tag[] {
  const out = new Set<Tag>();
  for (const [re, tag] of AVOID_PATTERNS) if (re.test(text)) out.add(tag);
  return [...out];
}

export function parseFavorTags(text: string): Tag[] {
  const out = new Set<Tag>();
  for (const [re, tag] of FAVOR_PATTERNS) if (re.test(text)) out.add(tag);
  return [...out];
}

// Prefix stems must NOT carry a trailing \b — "\bexplor\b" can never match
// "exploration", which silently dropped a stated vibe for months of a demo.
const VIBE_PATTERNS: [RegExp, Vibe][] = [
  [/\b(?:nature|outdoor|hik|mountain|forest|green|countrysid|scener)/i, "nature"],
  [/\b(?:explor|wander|discover|histor|sightsee|old town|roam|get lost)/i, "exploration"],
  [/\b(?:food|eat|wine|drink|restaurant|culinar|cuisine|market|dining|foodie)/i, "food"],
  [/\b(?:relax|rest|unwind|slow|chill|decompress|do nothing|recharge|switch off|lazy|quiet)/i, "relaxation"],
  [/\b(?:art\b|culture|cultural|museum|galler|architect|design|histor)/i, "culture"],
  [/\b(?:adventur|active|surf|div|climb|kayak|trek|bike|cycl)/i, "adventure"],
  [/\b(?:city|nightlife|urban|bars?\b|nights? out|buzz|energy|lively|going out)/i, "city"],
  // Phrasings people actually use, which named no vibe before and so fell
  // through to "nothing stated".
  [/\b(?:beach|sunbath|sunshine|in the sun|warm|hot weather|tropical|by the (sea|pool)|swim)/i, "relaxation"],
  [/\b(?:beautiful|scenic|scenery|landscape|views?\b|stunning|dramatic|mountains?|wilderness)/i, "nature"],
  [/\b(?:romantic|honeymoon|anniversary|just the two of us)/i, "relaxation"],
  [/\b(?:never been|somewhere new|somewhere different|off the beaten|unfamiliar|haven'?t been)/i, "exploration"],
];

// People type "ten days" as often as "10 days", and silently defaulting to a
// week when they told you otherwise is the worst kind of parsing failure —
// invisible, and it changes the whole trip.
const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
};
const WORD_NUM_RE = new RegExp(`\\b(${Object.keys(WORD_NUMBERS).join("|")})\\b`, "i");

const DURATION_PATTERNS: [RegExp, (m: RegExpMatchArray) => number][] = [
  [/\b(\d+)\s*(?:-|to|–)\s*(\d+)\s*(?:days?|nights?)\b/i, (m) => Math.round((+m[1] + +m[2]) / 2)],
  [/\b(\d+)\s*(?:days?|nights?)\b/i, (m) => +m[1]],
  [/\b(\d+)\s*weeks?\b/i, (m) => +m[1] * 7],
  [/\b(a|one)\s*week\b/i, () => 7],
  [/\btwo\s*weeks?\b/i, () => 14],
  [/\blong weekend\b/i, () => 4],
  [/\bweekend\b/i, () => 3],
  [new RegExp(`${WORD_NUM_RE.source}\\s*(?:days?|nights?)\\b`, "i"), (m) => WORD_NUMBERS[m[1].toLowerCase()]],
  [new RegExp(`${WORD_NUM_RE.source}\\s*weeks?\\b`, "i"), (m) => WORD_NUMBERS[m[1].toLowerCase()] * 7],
  [/\b(?:a|one)\s*week\s*(?:and a bit|and a half|plus)\b/i, () => 9],
];

const BUDGET_PATTERNS: [RegExp, (m: RegExpMatchArray) => number][] = [
  [/\$\s*(\d[\d,]*)\s*(?:-|to|–)\s*\$?\s*(\d[\d,]*)/, (m) =>
    Math.round((num(m[1]) + num(m[2])) / 2)],
  // "about 10 days" is not a ten dollar budget. This pattern was reading the
  // number out of every hedged duration, so "middle east for about 10 days"
  // came back as a $10 trip and the agent opened by telling her she wasn't
  // flying anywhere. The hedge words are the same ones people use about
  // length, so the unit after the number is what tells them apart.
  [/\b(?:around|about|roughly|under|up to|max(?:imum)?)\s*\$?\s*(\d[\d,]*)(?![\d,])\s*(k\b)?(?!\s*(?:days?|nights?|weeks?|months?|years?|hours?|hrs?|mins?|people|persons?|adults?|kids?|children|degrees?|km|miles?))/i,
    (m) => num(m[1]) * (m[2] ? 1000 : 1)],
  [/\$\s*(\d[\d,]*)\s*(k\b)?/i, (m) => num(m[1]) * (m[2] ? 1000 : 1)],
  [/\b(\d+)\s*k\b/i, (m) => +m[1] * 1000],
  // "budget 2500", "2500 budget", "budget of 3k". Common, and none of the
  // patterns above caught it because they all wanted a currency symbol.
  [/\bbudget\s*(?:of|is|:|=)?\s*\$?\s*(\d[\d,]*)\s*(k\b)?/i, (m) => num(m[1]) * (m[2] ? 1000 : 1)],
  [/\b(\d[\d,]*)\s*(k\b)?\s*budget\b/i, (m) => num(m[1]) * (m[2] ? 1000 : 1)],
];

const num = (s: string) => Number(s.replace(/,/g, ""));

/** The cheapest a whole trip could credibly be. Under it, we misread. */
export const BUDGET_FLOOR = 100;

/** [pattern, fixed cost, per-day cost, label] */
const BUDGET_IDIOMS: [RegExp, number, number, string][] = [
  [/\b(without breaking the bank|on a (tight |shoe ?string )?budget|budget[- ]friendly|as cheap as possible|nothing expensive|keep it cheap|cheaply|shoestring|don'?t want to spend much|not spend much)\b/i, 500, 180, "cheap"],
  [/\b(money'?s no object|no expense spared|splurge|go all out|treat myself|blow out|really nice)\b/i, 1200, 500, "splurge"],
  [/\b(mid[- ]range|nothing fancy|reasonable|sensible|middle of the road)\b/i, 700, 280, "mid"],
];

/**
 * The alias table, and it is exported because there must be exactly one.
 *
 * lib/agent/llm.ts resolves a place name from her own sentence and had its
 * own idea of what counts as a name, which is how "flying to new zealand"
 * became a place to go and research: the destination's id is "newzealand"
 * and its name is not "New Zealand", so nothing matched and it was filed as
 * somewhere we've never heard of. Two tables meant two answers.
 */
/*
 * The stem entries carry `\w*`, because the alternation ends in `\b`.
 *
 * "andaluc" was written as a stem and then given a trailing word boundary by
 * the group, so it could only ever match the exact string "andaluc". The
 * Spanish spelling she is most likely to type, "andalucia", matched nothing:
 * the app treated Andalusia as somewhere it had never heard of and went off to
 * research a destination it already holds. Same for "tuscany", "cadaqués" and
 * "teotihuacán". The comment above FAVOR_PATTERNS learned this once already.
 */
export const NAMED_DESTINATIONS: [RegExp, string][] = [
  [/\b(portugal|lisbon|lisboa|porto|sintra|algarve|douro)\b/i, "portugal"],
  [/\b(spain|seville|sevilla|granada|andalus\w*|andaluc\w*|c[oó]rdoba|malaga|m[aá]laga)\b/i, "andalusia"],
  [/\b(mexico|cdmx|oaxaca|teotihuac\w*|mexico city)\b/i, "mexico"],
  [/\b(japan|tokyo|kyoto|osaka|nippon)\b/i, "japan"],
  [/\b(copenhagen|k[oø]benhavn|denmark|danish)\b/i, "denmark"],
  [/\b(barcelona|catalonia|catalunya|costa brava|girona|cadaqu\w*)\b/i, "catalonia"],
  [/\b(iceland|reykjav[ií]k|vik\b|golden circle|sn[aæ]fellsnes)\b/i, "iceland"],
  [/\b(korea|seoul|busan|jeonju|gyeongju)\b/i, "korea"],
  [/\b(utah|zion|moab|arches|canyonlands|springdale|southwest|canyon country)\b/i, "southwest"],
  [/\b(seattle|olympic|washington state|puget|port angeles|pacific northwest|pnw)\b/i, "pacificnw"],
  [/\b(big sur|carmel|monterey|central coast|paso robles|highway 1|pch)\b/i, "centralcoast"],
  [/\b(new zealand|nz\b|aotearoa|queenstown|milford|fiordland|wanaka|glenorchy|south island)\b/i, "newzealand"],
  [/\b(ital(y|ia)|rome|roma|florence|firenze|tuscan\w*|chianti|siena|amalfi)\b/i, "italy"],
  [/\b(bali|ubud|indonesia|canggu|seminyak|nusa)\b/i, "bali"],
  [/\b(france|paris|provence|avignon|luberon|french)\b/i, "france"],
  /*
   * Two of the towns below are ordinary English words and one is a phrase
   * people say about their children. "Split" is kept because she is far more
   * likely to type the city than to use the verb without an object, and the
   * `\b` on either side of it stops "splitting" and "splits". "My Son", the
   * Cham sanctuary near Hoi An, is deliberately NOT here: "travelling with my
   * son" is a sentence this parser has to read correctly and the temple is not
   * worth losing it.
   */
  [/\b(scotland|scottish|highlands|inverness|skye|glen ?coe|cairngorms|loch ness|ben nevis)\b/i, "highlands"],
  [/\b(cyclades|santorini|thira|naxos|paros|antiparos|greece|greek islands)\b/i, "cyclades"],
  [/\b(croatia|croatian|dalmatia\w*|split|dubrovnik|hvar|trogir|krka)\b/i, "dalmatia"],
  [/\b(thailand|thai|chiang ?mai|chiang ?rai|doi inthanon|lanna)\b/i, "northernthailand"],
  [/\b(vietnam\w*|hanoi|h[ao]i an|ha ?long|ninh binh)\b/i, "vietnam"],
  [/\b(taiwan\w*|taipei|jiufen|pingxi|yangmingshan|formosa)\b/i, "taiwan"],
  [/\b(peru|cusco|cuzco|machu ?picchu|sacred valley|ollantaytambo|aguas calientes|urubamba|pisac|inca trail)\b/i, "peru"],
  [/\b(patagonia|torres del paine|el chalt[eé]n|chalten|el calafate|puerto natales|fitz ?roy|cerro torre|perito moreno)\b/i, "patagonia"],
  [/\b(costa rica|la fortuna|arenal|monteverde|manuel antonio|quepos|r[ií]o celeste|guanacaste)\b/i, "costarica"],
];

/**
 * People name a reason as often as a place. "I'm an LOTR fan" is a destination
 * request; the parser used to see a sentence with no place in it and ask what
 * sounds good right now, which is insulting when they have just told you.
 */
/**
 * A fandom or an obsession names a destination. A travel STYLE does not:
 * "road trip" and "national parks" describe a shape of trip that half the
 * catalogue can serve, so they are marked weak and only ever nudge.
 */
const INTEREST_HINTS: [RegExp, string, string, boolean?][] = [
  [/\b(lord of the rings|lotr|tolkien|hobbit|middle.?earth|rivendell|shire)\b/i, "newzealand",
   "Most of what you're picturing is within two hours of Queenstown, and the good news is that the best of it was never built: Lothlórien and Isengard are a beech forest and a valley up a gravel road at Glenorchy, unfenced and unsigned. I've put you there rather than at a film set."],
  [/\b(anime|manga|ghibli|otaku|k[ei]iretsu|onsen|samurai|shinto)\b/i, "japan",
   "I've leaned the trip toward the things that hold up in person rather than the merchandise: the contemporary galleries, a neighbourhood bathhouse, and the districts the war and the bubble both missed."],
  [/\b(gaud[ií]|sagrada|modernista|modernisme)\b/i, "catalonia",
   "I've included the Gaudí that earns its queue and swapped the rest for the modernisme nobody lines up for, which is frankly better buildings."],
  [/\b(eat pray love|yoga retreat|spiritual|meditation retreat)\b/i, "bali",
   "Fair warning: the book made Ubud what it is now, for better and worse. I've kept you north of the centre and pointed at the terraces people actually farm."],
  [/\b(roman empire|gladiator|caesar|renaissance|medici|michelangelo|colosseum)\b/i, "italy",
   "The Forum and Palatine from the top down, and the Renaissance in the rooms it was painted for rather than in a museum."],
  [/\b(viking|norse|saga|northern lights|aurora)\b/i, "iceland",
   "Þingvellir is where they held parliament from 930, and it's a rift between two continental plates as well. The aurora I can point you at but not promise."],
  [/\b(frida|kahlo|d[ií]a de (los )?muertos|day of the dead|aztec|maya)\b/i, "mexico",
   "Book the Kahlo house ahead, and give the anthropology museum a proper morning: the Mexica and Maya halls are the reason to come."],
  [/\b(k-?pop|k-?drama|korean food|kimchi|bts)\b/i, "korea",
   "I've pointed the trip at the eating and the neighbourhoods rather than the studio tours, which are thin."],
  [/\b(flamenco|moorish|al-?andalus|alhambra|reconquista)\b/i, "andalusia",
   "The Alhambra needs booking weeks out and is worth arranging the trip around. Flamenco in a fifty-seat room, not a dinner show."],
  [/\b(hygge|scandi|danish design|mid.?century|bauhaus)\b/i, "denmark",
   "A century of chairs, explained well enough that you'll care about chairs by the end, and a city built to be cycled."],
  [/\b(slickrock|canyoneering|zion|moab|arches|canyonlands)\b/i, "southwest",
   "Two parks four hours apart, a rental car, and dark skies. Cheapest week of real landscape you can get from here."],
  [/\b(national parks?|road ?trip)\b/i, "southwest",
   "Two parks four hours apart, a rental car, and dark skies. Cheapest week of real landscape you can get from here.",
   true],
  [/\b(wine (tasting|country|region)|vineyard|sommelier)\b/i, "france",
   "Châteauneuf-du-Pape is ninety minutes from Avignon, and the domaines there will pour without an appointment."],
];

export function detectInterest(text: string): { id: string; echo: string; weak: boolean } | undefined {
  for (const [re, id, echo, weak] of INTEREST_HINTS) if (re.test(text)) return { id, echo, weak: weak === true };
  return undefined;
}

/**
 * What she said she wants to do, in HER words.
 *
 * detectInterest returns a catalogue blurb as its `echo`: "Two parks four
 * hours apart, a rental car, and dark skies. Cheapest week of real landscape
 * you can get from here." That is marketing copy about a destination, and it
 * was being written into `activities` and handed to the model as
 * their_own_words_safe_to_quote. The field built to stop the app putting words
 * in her mouth was being filled with the app's own words.
 *
 * So the echo stays where it belongs, as a reason to lean toward a
 * destination, and this reads the sentence instead. It takes the tail of a
 * purpose clause -- "for surfing", "to see the northern lights" -- which is
 * how people say what a trip is for, and is exactly what "portugal for
 * surfing" needed: that message set no activities at all, because no interest
 * hint matches the word surfing.
 */
const PURPOSE = /\b(?:for|to)\s+((?!go\b|visit\b|travel\b)[a-z\u00C0-\u024F][\w'\u00C0-\u024F-]*(?:\s+[\w'\u00C0-\u024F-]+){0,5})\s*$/gi;

/**
 * People and occasions are who and why, not what to do.
 *
 * "i want to go to japan for my mum" filed "my mum" as an activity, and the
 * app then said out loud: "One thing this doesn't cover: my mum. Nothing I
 * have for Japan does that, so I've left it out rather than pretend." Same for
 * "our honeymoon". The `why` line printed "You said my mum."
 */
const WHO_NOT_WHAT =
  /\b(my|our|his|her|their)\s+(\d+(st|nd|rd|th)|mum|mom|mother|dad|father|parents?|partner|wife|husband|family|kids?|children|friends?|sister|brother|son|daughter|boyfriend|girlfriend|birthday|anniversary|honeymoon|wedding|graduation|retirement)\b/i;

/**
 * Reasons for the trip that are not things to do there.
 *
 * "flying to lisbon for work" filed "work" and "going to tokyo for a
 * conference" filed "a conference", and `unserved` then said out loud
 * "Nothing I have for Japan does that". Nothing does, and nothing should.
 */
const NOT_AN_ACTIVITY =
  /^(the\s+|a\s+|an\s+|some\s+)?(work|business|a? ?conference|a? ?meeting|a? ?wedding|a? ?funeral|school|uni|university|studying|an? ?interview|my job|the job|weather|sun|sunshine|exchange rate|money|budget|prices?|costs?|cheap flights?|flights?|language|kids?|weekend|holidays?|vacation|rest|break|treat|change of scene|atmosphere|vibes?|fun|novelty|inspiration|romance|peace and quiet|quiet|silence|adventure|scenery|views?|escape|time off|a bit of everything)$/i;

/*
 * The list above is a reason-for-the-trip filter, and it is a word list, which
 * is the shape that has gone wrong here twice. It is safe in this one place
 * because of the direction it fails in: an entry that is MISSING costs one
 * honest sentence saying the matcher could not place the phrase, while an
 * entry that is present removes a word from the brief. So it holds only
 * phrases that name a reason, a quality or a companion — never a thing to do
 * at the destination. Measured on 150 briefs, these accounted for 22 of 71
 * reports, every one of them noise.
 */


/**
 * The same phrase with the WHEN taken out of it.
 *
 * Durations and months are how she says when, and a purpose clause often
 * carries both at once. The test used to be "does this tail contain a time
 * word", and it threw the whole tail away when it did — so "heading to denmark
 * for a week of design museums" filed no activity at all and "design museums"
 * left the session without a trace. Same shape as the place rule twenty lines
 * below, which had already learned this: what disqualifies a tail is having
 * nothing left in it once the when is removed, not merely containing one.
 *
 * Returns "" when the tail was nothing but a when — "5 days", "a week and a
 * bit", "october" — which is still refused, and still loses nothing: that
 * answer is on the brief as `days`, `month` or `dates`.
 */
const DURATION =
  /\b(?:\d+|an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|couple|few|several)?\s*\b(?:days?|nights?|weeks?|months?|weekend|fortnight)\b/gi;
const MONTH_OR_SEASON =
  /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|spring|summer|autumn|winter)\b/gi;
/**
 * Only the connectives a removal strands, and only when something WAS removed.
 *
 * A first version also trimmed a leading article, which turned "the sun" into
 * "sun" — and TIME_WORD is anchored at the start and knows "sun" as Sunday, so
 * the phrase went from being kept as an aside to being refused as a weekday.
 * A phrase with no when in it must come out of here byte-identical.
 */
const ORPHAN = /^(?:of|in|on|for|and|or)\b\s*|\s*\b(?:of|in|on|for|and|or)$/gi;

function withoutTime(phrase: string): string {
  const cut = phrase.replace(DURATION, " ").replace(MONTH_OR_SEASON, " ")
    .replace(/\s+/g, " ").trim();
  if (cut === phrase.replace(/\s+/g, " ").trim()) return phrase;
  let out = cut;
  // Trimming can expose another orphan underneath the first: "a week of" goes
  // to "of", and "in june for" to "in ... for".
  for (let i = 0; i < 3; i++) out = out.replace(ORPHAN, "").replace(/\s+/g, " ").trim();
  return out;
}

/**
 * What she said the trip was for, and what the parser did with it.
 *
 * `activity` is a thing to do at the destination — the only kind of phrase
 * that may reach `brief.activities`, because that field drives the +0.6
 * `asked` weight in the scorer, the research interest line, `unserved`'s
 * out-loud report and the "You said" line. Putting a reason in there is what
 * made a Japan trip announce "One thing this doesn't cover: my mum".
 *
 * `aside` is the SAME phrase, when the parser has decided it is a reason, a
 * quality or a companion rather than a thing to do. It used to be dropped on
 * the floor, and that is the thing this return value exists to stop. From
 * Ashley, and it outranks everything else here: "it must stay faithful to the
 * user's input, that tops everything" and "every single thing that the user
 * types or selects must sustain in that session at least." She typed "a rest",
 * "the scenery", "for work"; the app deleted the words and told her nothing.
 * Keeping them costs nothing — nothing downstream reads `asides` — and the
 * alternative is a brief that has quietly lost a sentence she wrote.
 *
 * Only the two vocabulary refusals become asides. A tail that is a WHEN
 * ("in june", "5 days") or a WHERE ("montenegro", "patagonia") is not lost by
 * being refused here: it is on the brief as `month`, `days`, `namedDestination`
 * or a candidate, which is where it belongs. An aside is the residue — the
 * phrase that lands nowhere at all.
 */
export function statedPurpose(text: string): { activity?: string; aside?: string } {
  const t = text.trim().replace(/[.!?]+$/, "");
  /*
   * A place named anywhere in the message is not an activity anywhere in it.
   *
   * The place check ran on the captured tail alone and only against the static
   * list, so "going to montenegro in june" filed "montenegro in june" and "i
   * want to go to sri lanka with my partner" filed "sri lanka with my
   * partner" — three of the fifteen activity entries the project's own corpus
   * produces. Both then fed the +0.6 `asked` weight, so on a Montenegro trip a
   * place whose blurb mentions Montenegro outranked everything.
   */
  const named = detectNamedPlaces(t);
  const placeWords = [...named.known, ...named.unknown]
    .flatMap((x) => x.toLowerCase().split(/[\s-]+/))
    .filter((w) => w.length >= 3);
  /*
   * The RIGHTMOST purpose clause, not the first.
   *
   * Anchored at the end and matched leftmost-first, "i wanna go to portugal
   * for surfing" matched at "to" and captured "portugal for surfing", which
   * then failed the is-this-a-place check and returned nothing at all. So the
   * one message this function exists for produced no activity. Every candidate
   * is tried and the last one that survives wins, which is also the right
   * reading of English: the clause nearest the end is the purpose.
   */
  type Verdict = { activity: string } | { aside: string };
  const ok = (raw?: string): Verdict | undefined => {
    const raw2 = raw?.trim().replace(/\s+(please|thanks|thank you)$/i, "").trim();
    if (!raw2 || raw2.split(/\s+/).length > 6) return undefined;
    /*
     * "for 5 days", "for october", "for two weeks" are answers about when, and
     * a tail that is nothing else is refused. A tail that still says something
     * once the when is removed keeps what is left: "a week of design museums"
     * is a length AND a thing to do, and refusing it whole lost the second.
     */
    const said = withoutTime(raw2);
    if (!said || TIME_WORD.test(said) || /^\d/.test(said)) return undefined;
    /*
     * Who she is going with, and why she is going. Neither is a thing to do,
     * and both are still hers — so they come back as asides rather than being
     * deleted. The refusal is unchanged; only the silence around it is.
     */
    if (WHO_NOT_WHAT.test(said) || /\b(with|and)\s+(my|our|his|her|their)\b/i.test(said)) return { aside: said };
    if (NOT_AN_ACTIVITY.test(said.trim())) return { aside: said };
    /*
     * KNOWN LIMIT of this parser, written down rather than papered over.
     *
     * A region nobody has researched yet is in neither NAMED_DESTINATIONS nor
     * the live registry, so "i want to go to chile for patagonia" still files
     * patagonia as an activity. Offline there is no signal that separates
     * "patagonia" from "surfing" — both are one lowercase word this codebase
     * has never seen — and every rule I tried that caught the first also ate
     * the second, which is the worse direction: losing a real request beats
     * carrying an odd one. The model driver resolves places properly; this is
     * the floor, not the hot path.
     */
    /*
     * Only when the tail is NOTHING BUT the place.
     *
     * A first version rejected any tail containing a place word, which threw
     * away "the montenegro coast" — she wants the coast, and the place name is
     * just how she said which coast. What is not an activity is a tail with no
     * activity left in it once the place is taken out: "montenegro in june" is
     * a where and a when.
     */
    const words = said.toLowerCase().replace(/['\u2019]s\b/g, "").split(/[\s-]+/);
    const left = words.filter((w) => w.length >= 3 && !placeWords.includes(w)
      && !/^(the|and|for|with|its|this|that|some|any|our|his|her|their)$/.test(w));
    if (!left.length) return undefined;
    /*
     * A place is where, not what. "go to portugal" must not become an activity.
     *
     * NAMED_DESTINATIONS is the static list, so a destination researched at
     * runtime is not in it: "hm i wanna go to patagonia" filed patagonia as an
     * activity, and the trip then announced "One thing this doesn't cover:
     * patagonia" about a Patagonia itinerary. The registry knows what the
     * catalogue holds right now; the regex list only knows what it shipped
     * with.
     */
    if (NAMED_DESTINATIONS.some(([re]) => re.test(said))) return undefined;
    if (isKnownDestination(said.toLowerCase().trim().replace(/\s+/g, "-"))) return undefined;
    return { activity: said };
  };
  /*
   * Per clause, not per message.
   *
   * Anchoring at the end of the whole string lost "i want to go to iceland to
   * see the northern lights. give me an itinerary": the purpose clause is
   * there, it just is not last, and the brief came back with no reason in it
   * at all -- which cost a turn, because the question gate reads whether she
   * has said why.
   */
  /*
   * A rejected purpose clause is still the purpose.
   *
   * The candidates were scanned widest-first and the last survivor won, so
   * when the narrowest one was REJECTED the wider capture around it stood
   * instead — and the wider capture starts at the place name. "greece for a
   * rest" filed the activity "greece for a rest", "chile for adventure" filed
   * "chile for adventure". Both then fed the +0.6 `asked` weight, which is
   * the exact failure the place-strip above exists to prevent, arriving by a
   * different door. So the scan runs narrowest-first and stops at the first
   * verdict either way: if the purpose she stated is not a thing to do, the
   * answer is that there is no activity, not a wider guess containing it.
   */
  let activity: string | undefined;
  let aside: string | undefined;
  for (const clause of t.split(/[.;!?]+|,\s+/).map((c) => c.trim()).filter(Boolean)) {
    for (let i = clause.length - 1; i >= 0; i--) {
      const m = clause.slice(i).match(/^\b(?:for|to)\s+((?!go\b|visit\b|travel\b|leave\b|get\b|be\b)[a-z\u00C0-\u024F][\w'\u00C0-\u024F-]*(?:\s+[\w'\u00C0-\u024F-]+){0,5})\s*$/i);
      if (!m) continue;
      const cand = ok(m[1]);
      if (cand && "activity" in cand) activity = cand.activity;
      else if (cand) aside = cand.aside;
      break;
    }
  }
  return { activity, aside };
}

/**
 * What she wants to DO, and nothing else. Every caller that feeds the planner,
 * the scorer, the research prompt or anything she reads goes through this one;
 * `statedPurpose` is for the callers that also have to keep what it refused.
 */
export function statedActivity(text: string): string | undefined {
  return statedPurpose(text).activity;
}

/**
 * Someone naming a place we don't cover is the most important thing they will
 * say, and the old parser threw it away silently: "I want to go to Ubud"
 * produced an empty brief and a confident recommendation for South Korea.
 */
// The capture stops at a conjunction. Without that, "go to africa and see some
// animals" captured "africa and see" and the agent announced it didn't cover
// "Africa And See".
const NAMED_PLACE = /\b(?:go|going|travel|travelling|traveling|fly|flying|head|heading|visit|trip)\s+(?:to|out to)\s+((?!and\b|or\b|then\b)[a-z\u00C0-\u024F][\w'\u00C0-\u024F-]*(?:\s+(?!and\b|or\b|then\b|see\b|do\b|eat\b|for\b|with\b)[a-z\u00C0-\u024F][\w'\u00C0-\u024F-]*){0,2})/i;

/**
 * A clause that is plainly an activity, not a place. "see some animals" became
 * a destination to research because the split on "and" handed it over as a
 * bare candidate.
 */
/**
 * Words that are English rather than geography. Not a gazetteer, a stoplist of
 * the shapes that actually turned up: "we love hiking and volcanoes" -> Love,
 * "hot springs and long walks" -> Hot Springs.
 */
const COMMON_WORD = /\b(?:love|loves?|like|likes?|want|wants?|need|hot|cold|warm|long|short|slow|fast|cheap|nice|good|great|best|quiet|busy|springs?|walks?|hikes?|trails?|beaches?|mountains?|museums?|churches?|markets?|bars?|nights?|days?|weeks?|trips?|holidays?|vacations?)\b/i;

const NOT_A_PLACE_PHRASE = /^(?:see|do|eat|drink|visit|explore|relax|swim|hike|walk|shop|stay|find|watch|get|try|ride|surf|ski|party|chill|rest|sleep|meet|learn)\b|\b(?:some|any|lots?|plenty|things?|stuff|animals?|food|people|weather|sun|beaches?|mountains?|culture|history)\b/i;

/**
 * The other half of how people say where: "roadtripping in Australia", "a week
 * in Croatia", "driving around Portugal". The cue list above only caught
 * "go to"-shaped sentences, so the fallback parser lost Australia entirely.
 */
const TRIP_IN = /\b(?:road ?trip(?:ping)?|travel(?:ling|ing)?|driving|holiday|vacation|honeymoon|trip|weeks?|days?|nights?)\s+(?:in|around|through|across|to)\s+([a-z\u00C0-\u024F][\w'\u00C0-\u024F-]*(?:\s+[a-z\u00C0-\u024F][\w'\u00C0-\u024F-]*){0,2})/i;

// Words that follow "go to" without naming a destination.
/**
 * A month is not a country. "9 days in october" hits the TRIP_IN cue
 * ("days in X") and was captured as a place, so the agent went off to research
 * a destination called October and came back with Japan on a Portugal trip.
 * Time words can never be the thing we fly someone to.
 */
const TIME_WORD =
  /^(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:rs|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?|spring|summer|autumn|fall|winter|today|tomorrow|tonight|weekend|weekends|week|weeks|month|months|day|days|night|nights|year|years|christmas|xmas|easter|thanksgiving|halloween|new|early|mid|late|peak|off|high|low|shoulder|about|around|roughly)\b/i;

const NOT_A_PLACE = new Set([
  "the", "a", "an", "bed", "sleep", "work", "school", "sea", "beach", "beaches",
  "mountains", "somewhere", "anywhere", "nowhere", "places", "nature", "ground",
  "town", "city", "country", "countryside", "coast", "hell", "waste", "one",
  "many", "few", "it", "them", "you", "us", "me", "my", "your", "this", "that",
]);

/**
 * Every place they named, not the first one. "croatia or southern france" was
 * returning france and silently dropping croatia, which is the single most
 * trust-destroying thing this parser can do: she named two places and the
 * agent answered as though she'd named neither.
 */
/**
 * "I've been to Bryce, Grand Canyon, Zion already."
 *
 * Three things have to happen to that sentence and only one of them used to.
 * The places have to be banned; they must NOT be read as a shortlist she wants
 * (naming somewhere you've done is the opposite of asking to go there); and
 * the rest of the message has to survive, because "I wanna go on a road trip"
 * is still in there.
 *
 * Returns the ids and names she's ruled out, plus the message with those
 * clauses removed so the ordinary parsing never sees them.
 */
// "went to" is how most people say it, and it was not in here: "we went to
// iceland last year, somewhere new please" recorded nothing and the app
// recommended Iceland.
const BEEN_CUE =
  /\b(?:i(?:'ve| have)?\s+)?(?:already\s+)?(?:been\s+to|went\s+to|been|done|did|visited|seen)\b/i;
const ALREADY_TAIL = /\b(?:already|before|last\s+(?:year|month|summer|winter|spring|fall|time)|a\s+few\s+times|twice)\b/i;

export function detectVisited(text: string): {
  ids: string[]; names: string[]; rest: string;
} {
  const ids: string[] = [];
  const names: string[] = [];
  const keep: string[] = [];
  let cued = false;

  // Sentence by sentence, because "I want somewhere warm. I've been to Bali."
  // is one request and one ban, and reading the message as either is wrong in
  // both directions.
  for (const sentence of text.split(/(?<=[.!?])\s+|\n+/)) {
    const at = sentence.search(BEEN_CUE);
    if (at < 0) { keep.push(sentence); continue; }

    const before = sentence.slice(0, at);
    const after = sentence.slice(at);

    // The veto has to be scoped to the clause that carries the cue. Her whole
    // message was "i wanna go on a road trip - i've been to bryce canyon,
    // grand canyon, zion, etc. already": a request and a ban in one sentence.
    // Vetoing on any want anywhere in the sentence threw the ban away, and the
    // agent recommended the three places she had just ruled out.
    const negated = /\b(?:never|not|hardly|haven'?t|have not|ain'?t)\s*$/i.test(before)
      || /\bnever\b/i.test(after.slice(0, 20));
    /*
     * `asking` is scoped to the cue's own clause, like `negated` above it.
     *
     * It read the whole tail, so "i've been to bali and i want somewhere new"
     * found "want" three words later and threw the ban away — and the agent
     * then recommended Bali. Every phrasing where the ban and the request
     * share a sentence failed; the only one that worked put a full stop
     * between them, which is the one the test used.
     *
     * "but" is deliberately not a boundary: "i've been to bali but i want to
     * go back" is a request for Bali, and reversing it is what "but" is for.
     */
    // CLAUSE_BREAK too: without it a dash left `cueClause` as the whole tail,
    // "i've been to bali - i want somewhere new" found "want", threw the ban
    // away, and the app recommended Bali. Fifteen of fifteen.
    const bound = firstBreak(after, "\\s+(?:and|so|then)\\s+");
    const cueClause = bound < 0 ? after : after.slice(0, bound);
    const tail = bound < 0 ? "" : after.slice(bound);
    const asking = /\b(?:want|wanna|would like|hoping|dying)\b/i.test(cueClause);
    // "I've been", "already", "before", "we went": evidence this is past tense
    // rather than "been meaning to".
    /*
     * "I've been MEANING to visit Japan" is not a place she has been.
     *
     * The "i've" satisfied the past-tense evidence, so the whole message was
     * treated as a ban: Japan ruled out — the opposite of what she said — her
     * ten days, her March and her budget discarded with the swallowed clause,
     * and "food" and "temples" recorded as countries she had already visited.
     * Fifteen of fifteen. The comment on this line already named the case.
     */
    const meaning = /\bbeen\s+(?:meaning|wanting|dying|hoping|planning|keen)\b/i.test(sentence);
    const past = !meaning && (ALREADY_TAIL.test(sentence)
      || /\b(?:i|we)(?:'ve| have)\b/i.test(sentence.slice(0, at + 8))
      || /\bwent\s+to\b/i.test(cueClause));

    if (negated || asking || !past) { keep.push(sentence); continue; }

    /*
     * Mined per clause, exactly like `asking` and `negated` above it.
     *
     * The polarity of the cue was clause-scoped and the place scan was not: it
     * ran over the whole tail, so "i've been to bali but not japan" banned
     * Japan, and "i've been to portugal, i want to go to japan" banned the
     * place she was asking for. `recommend` skips namedDestination when it is
     * in visitedIds, so both answered with a third country. 15 of 15, on every
     * separator except the full stop and the newline.
     */
    const NOT_BEEN = /\b(?:never|not|no|haven'?t|have not|hadn'?t|didn'?t|ain'?t|yet)\b/i;
    const WANTING = /\b(?:want|wanna|would like|i'?d like|hoping|dying|keen|prefer|rather|thinking|lets|let'?s|go to|head to|take me)\b/i;
    const banClauses = after
      .split(new RegExp(`(?:${CLAUSE_BREAK_SOURCE}|\\b(?:but|and|or|though|except|then)\\b)`, "i"))
      .filter((c) => !NOT_BEEN.test(c) && !WANTING.test(c));
    for (const clause of banClauses) {
      for (const [re, id] of NAMED_DESTINATIONS) {
        if (re.test(clause) && !ids.includes(id)) ids.push(id);
      }
    }
    for (const raw of banClauses.join(" , ").split(/\s*(?:,|\band\b|\bor\b|\betc\.?)\s*/i)) {
      const name = raw.replace(BEEN_CUE, "").replace(ALREADY_TAIL, "")
        .replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "").trim();
      if (!name || name.split(/\s+/).length > 3) continue;
      if (NOT_A_PLACE.has(name.toLowerCase()) || TIME_WORD.test(name)) continue;
      /*
       * "Noted, no Somewhere New."
       *
       * NOT_A_PLACE was checked against the whole phrase, so "somewhere new",
       * "want somewhere warm" and "bali though" all became places she had been
       * — read back to her in the acknowledgement line, in the interest line,
       * and in the model's never-suggest list. A phrase that opens with a word
       * that is not a place is not a place.
       */
      const head = name.toLowerCase().split(/\s+/)[0];
      if (NOT_A_PLACE.has(head)) continue;
      if (/\b(want|wanna|somewhere|anywhere|else|new|different|though|instead|rather|please)\b/i.test(name)) continue;
      if (!/^[\p{L}][\p{L} '\-]{2,}$/u.test(name)) continue;
      if (!names.some((n) => n.toLowerCase() === name.toLowerCase())) names.push(name);
    }
    if (before.trim()) keep.push(before.trim().replace(/[\s\-–—:;,]+$/, ""));
    // What she asked for after the ban is still a request; keep it for the
    // rest of the parser rather than letting the ban swallow the sentence.
    if (tail && /\b(?:want|wanna|would like|hoping|prefer|looking for|rather|somewhere|different|new)\b/i.test(tail)) {
      /*
       * Minus the places. "i've already been to japan and korea, somewhere
       * else" splits at the "and", so the tail carried Korea — and putting it
       * back into `rest` made it look like a request, which the retraction
       * filter then honoured by deleting the ban it had just recorded. The
       * brief said "already been to japan, korea" and shipped Korea.
       */
      let rest2 = tail.replace(/^[\s,;]+/, "").replace(/^(?:and|so|then)\s+/i, "").trim();
      /*
       * Only the part of the tail that CONTINUES the ban.
       *
       * The tail is also where her request lives, and this loop filed it as
       * somewhere she had already been — then deleted it from `rest`, so
       * nothing downstream ever saw it. "i've been to portugal, i want to go
       * to japan" recorded visitedIds ["portugal","japan"], left
       * namedDestination undefined and answered Korea: both places she typed
       * treated as places she was done with. Fifteen of fifteen, and every
       * separator but the full stop and the newline — the two the test used.
       *
       * A clause that asks for the place is not a report of having been.
       */
      const tailClauses = rest2.split(
        new RegExp(`(?:${CLAUSE_BREAK_SOURCE}|\\b(?:and|or|but|then)\\b)`, "i"));
      const stillBan = tailClauses.filter((c) => !NOT_BEEN.test(c) && !WANTING.test(c));
      for (const [re, id] of NAMED_DESTINATIONS) {
        if (!stillBan.some((c) => re.test(c))) continue;
        if (!ids.includes(id)) ids.push(id);
        rest2 = rest2.replace(new RegExp(re.source, "gi"), " ");
      }
      rest2 = rest2.replace(/\s{2,}/g, " ").replace(/^[\s,;]+|[\s,;]+$/g, "").trim();
      if (rest2) keep.push(rest2);
    }
    cued = true;
  }

  /*
   * A message that is nothing but a ban leaves `keep` empty, and this fell
   * back to the FULL original text — so "been to lisbon and porto before" was
   * re-read downstream as a request for Portugal, which then cancelled the ban
   * it had just recorded. Falling back is right when nothing matched at all
   * and wrong the moment something did.
   */
  /*
   * Joined with a newline, not a space.
   *
   * CLAUSE_BREAK counts "\n" as a clause boundary, and this function runs
   * FIRST on every message — including the ones with no been-cue in them at
   * all, where it still splits on \n+ and glues the pieces back with a space.
   * So the newline never reached a single downstream reader: "portugal 9
   * days, not Porto\ni want lots of food" came out as one clause and Porto
   * was never ruled out. A line break she typed is a boundary she meant.
   */
  return { ids, names, rest: keep.join("\n").trim() || (cued ? "" : text) };
}

/** Which catalogue destinations a phrase names, if any. */
export function destinationIdsNamedIn(text: string): string[] {
  const ids: string[] = [];
  for (const [re, id] of NAMED_DESTINATIONS) if (re.test(text) && !ids.includes(id)) ids.push(id);
  return ids;
}

/**
 * Turn a captured phrase into a place name, or reject it. One copy.
 *
 * There were two, and they had drifted exactly as the comment in
 * detectNamedPlace predicted. The singular one stripped a leading article and
 * cut at a name-ending word; the plural one did neither. So:
 *
 *   "i want to go to the faroe islands or the azores"
 *      singular -> faroe islands        plural -> nothing at all
 *   "i wanna go to turkey but not istanbul"
 *      singular -> turkey               plural -> "turkey but not"
 *
 * and because interpretRules prefers the singular's single answer, the Azores
 * was silently dropped from a two-place message, which the comment above
 * NOT_A_PLACE calls the single most trust-destroying thing this parser can do.
 *
 * The word-count cap stays with the callers: the plural allows three, the
 * singular never had one, and this is not the change to alter that.
 */
/**
 * What the trip costs is not where the trip goes.
 *
 * "8 days in Portugal in October, good food and long walks, budget about
 * $2500" was parsed as TWO places: Portugal, and a country called Budget. The
 * comma-list scan cuts a clause at its first name-ending word, so "budget
 * about $2500" became the bare phrase "budget", nothing here recognised it,
 * and the app went off to research it — which, with no model configured, put
 * `{"driver":"rules","problem":...}` on screen in a chat bubble.
 *
 * This is the same shape as NOT_AN_ACTIVITY above, one path over: that list
 * catches a reason for the trip being filed as a thing to DO there, this one
 * catches a reason, a cost or a piece of logistics being filed as a PLACE.
 *
 * The direction it fails in is the opposite of NOT_AN_ACTIVITY's, so it is
 * held to a stricter rule. A word in this list can never be researched as a
 * destination again, so a wrong entry silently deletes somewhere real from
 * her message — the thing the comment above NOT_A_PLACE calls the most
 * trust-destroying thing this parser can do. Every entry is therefore a word
 * that is not the name of anywhere on earth: money, paperwork and the machinery
 * of getting there. Anything that is also a town — Bath, Nice, Reading, Split —
 * is deliberately absent, and belongs nowhere near a list like this.
 */
const NOT_A_PLACE_REASON =
  /^(?:budgets?|monies|money|cash|funds|savings|spend|spending|prices?|pricing|costs?|totals?|subtotal|fares?|airfare|flights?|transfers?|hotels?|accommodation|lodging|insurance|visas?|passports?|luggage|baggage|packing|bookings?|itinerary|logistics|exchange rate)$/i;

/**
 * A phrase carrying an amount of money is a budget line, not a place name.
 *
 * Tested against the CLEANED phrase, never the raw one: "montenegro with a
 * $3000 budget" cleans to "montenegro" long before this runs, and testing the
 * raw would have thrown away the country she actually named.
 */
const MONEY_PHRASE = /[$£€¥₩₹]|\b\d[\d,]*\s*(?:k|usd|eur|gbp|dollars?|euros?|pounds?|quid|bucks)\b/i;

/** Exact-match against the catalogue, folded, so an accent or a "the" can't miss. */
const foldName = (x: string) =>
  x.toLowerCase().replace(/^the\s+/, "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
const CATALOGUE_NAMES = new Set([
  ...CITIES.flatMap((c) => [foldName(c.name), foldName(c.id)]),
  ...DESTINATIONS.flatMap((d) => [foldName(d.name), foldName(d.id)]),
]);
const isCatalogueName = (phrase: string) => CATALOGUE_NAMES.has(foldName(phrase));

export function cleanPlacePhrase(raw?: string): string | undefined {
  const t = raw?.trim();
  if (!t) return undefined;
  const words = t.replace(/^the\s+/i, "").split(/\s+/).filter(Boolean);
  const stop = words.findIndex((w) => ENDS_THE_NAME.test(w));
  const phrase = (stop === -1 ? words : words.slice(0, stop)).join(" ")
    .replace(/\s+(for|in|on|next|this|about|around|recs?)$/i, "")
    .replace(/[.?!]+$/, "")
    .trim();
  if (!phrase) return undefined;
  /*
   * A name the catalogue actually holds is a place, whatever it looks like.
   *
   * Everything below this line is a guard against English being read as a
   * country, and the guards are right about English: "my" leads a possessive
   * and "long" leads "long walks". They are wrong about Vietnam. My Son and Ha
   * Long Bay are both cities we ship, and "vietnam for 9 days but not ha long
   * bay" came back with an empty avoidPlaces and a day out to Ha Long Bay in
   * the itinerary — the exclusion dropped on the floor in silence, which is
   * the bug the whole avoid layer exists to stop. Neither name is reachable
   * from the other branches' data, so this only appeared once all three
   * catalogues were in one tree.
   *
   * The check is an exact match on a name we hold, not a substring: "long
   * walks" is still not Ha Long Bay, and "my sister" is still not My Son.
   */
  if (isCatalogueName(phrase)) return phrase;
  if (NOT_A_PLACE.has(phrase.split(/\s+/)[0].toLowerCase())) return undefined;
  if (TIME_WORD.test(phrase) || /^\d/.test(phrase)) return undefined;
  // "i don't want to spend all day in museums" matched the in-a-place cue and
  // filed a country called Museums.
  if (COMMON_WORD.test(phrase)) return undefined;
  // Money and paperwork. Checked on the head word too, so "budget 2500" goes
  // the same way "budget" does.
  if (NOT_A_PLACE_REASON.test(phrase) || NOT_A_PLACE_REASON.test(phrase.split(/\s+/)[0])) return undefined;
  if (MONEY_PHRASE.test(phrase)) return undefined;
  return phrase;
}

export function detectNamedPlaces(text: string): { known: string[]; unknown: string[] } {
  const known: string[] = [];
  for (const [re, id] of NAMED_DESTINATIONS) if (re.test(text) && !known.includes(id)) known.push(id);

  const parts = text.split(/\s+(?:or|and|versus|vs\.?)\s+|,\s*/i)
    .map((x) => x.trim().replace(/[.?!]+$/, "").trim())
    .filter(Boolean);

  /*
   * "Montenegro or Albania" is a shortlist even though neither half carries a
   * cue like "go to". But shape alone is not evidence: "hot springs and long
   * walks" and "we love hiking and volcanoes" are the same shape, and were
   * filed as places to research, which deleted the Azores she had named one
   * message earlier and sent the app to look up a country called Love.
   *
   * So a bare list must also read like proper nouns rather than like English:
   * every part a single word or two, none of them a word this parser already
   * knows is not a place.
   */
  const bareParts = parts.filter((x) => !NAMED_DESTINATIONS.some(([re]) => re.test(x)));
  const listShaped = parts.length > 1
    && text.trim().split(/\s+/).length <= 6
    && !NEGATOR.test(text)
    && bareParts.every((x) => {
      const w = x.trim().split(/\s+/);
      return w.length <= 2
        && !NOT_A_PLACE.has(w[0].toLowerCase())
        && !NOT_A_PLACE_PHRASE.test(x)
        && !COMMON_WORD.test(x);
    });

  // Three words is this caller's cap; everything else is the shared cleaner.
  const clean = (raw?: string) => {
    const phrase = cleanPlacePhrase(raw);
    return phrase && phrase.split(/\s+/).length <= 3 ? phrase : undefined;
  };

  /*
   * A clause she is refusing is not a place she wants to go.
   *
   * "no museums, no churches" was filed as two countries to research, and
   * because researchTried then held them, every later message was answered
   * with "No Museums still isn't coming together for me". An ordinary sentence
   * bricked the conversation permanently.
   */
  const unknown: string[] = [];
  let anyCued = known.length > 0;
  for (const part of parts) {
    if (NAMED_DESTINATIONS.some(([re]) => re.test(part))) continue;
    // Cut at the refusal rather than discarding the clause: "turkey but not
    // istanbul" still has a country in front of the "but not".
    const m = part.match(NEGATOR);
    const head = m?.index === undefined ? part : part.slice(0, m.index).trim();
    if (!head) continue;
    const cued = clean((head.match(NAMED_PLACE) ?? head.match(TRIP_IN))?.[1]);
    if (cued) { anyCued = true; if (!unknown.includes(cued)) unknown.push(cued); }
  }
  // Once one half is known to be a place, the other halves are too.
  if (anyCued || listShaped) {
    for (const part of parts) {
      if (NAMED_DESTINATIONS.some(([re]) => re.test(part))) continue;
      if (NAMED_PLACE.test(part) || TRIP_IN.test(part)) continue;
      const bare = clean(part.replace(/^(i|we)?\s*(want|wanna|would like|think|thinking|hear|heard)?\s*(to\s+go\s+to|to\s+visit|about)?\s*/i, ""));
      if (bare && /^[\p{L}][\p{L} '\-]{2,}$/u.test(bare)
          && !NOT_A_PLACE_PHRASE.test(bare) && !unknown.includes(bare)) {
        unknown.push(bare);
      }
    }
  }
  return { known, unknown };
}

/**
 * Words that end a place name wherever they appear, not only at the end.
 * "iceland TO see", "japan FOR two weeks", "oaxaca WITH my sister",
 * "turkey BUT not istanbul" — which is how a country became "turkey but not".
 */
export const ENDS_THE_NAME =
  /^(?:to|for|in|on|at|with|and|or|but|nor|yet|so|then|though|although|except|besides|without|because|while|during|over|about|around|next|this|last|see|seeing|eat|eating|do|doing|visit|visiting|explore|exploring|find|finding|hike|hiking|ski|skiing|surf|surfing|relax|relaxing|chase|chasing|shop|shopping|meet|learn|try|trying|ride|riding|watch|watching)$/i;

export function detectNamedPlace(text: string): { known?: string; unknown?: string } {
  /*
   * Position first, catalogue second. The same ranking error as the one
   * above, one layer down.
   *
   * The catalogue patterns used to run first, against the WHOLE message with
   * no positional requirement, and returned before the going-to search ever
   * ran. So the weakest reading won:
   *
   *   "i want to go to the faroe islands, i loved iceland"  -> Iceland
   *   "i want great french food"                            -> France
   *   "somewhere with danish pastry"                        -> Denmark
   *
   * A cue says she is going there. A word appearing anywhere in a sentence
   * does not. Where she said she is going is read first, and the catalogue
   * is only consulted for whatever that turns up.
   */
  /*
   * After a retraction, read the clause AFTER it.
   *
   * Both patterns match leftmost, so "i want to go to iceland, actually make
   * it japan" returned Iceland — she changed her mind inside one message and
   * the parser kept the half she had just withdrawn. "iceland, no wait, japan"
   * happened to work only because "no wait" leaves no cue in front of Iceland.
   *
   * The retraction has to name somewhere for this to fire; "actually, forget
   * it" retracts without proposing anything and is left to the pushback layer.
   */
  const RETRACTION = /\b(actually|no wait|forget|scrap that|instead|on second thought(s)?|change (it|that) to|make it)\b/i;
  const cut = text.search(RETRACTION);
  const after2 = cut >= 0 ? text.slice(cut) : "";
  // "actually no, make it japan" — the "no" belongs to the retraction, not to
  // Japan, so it is stripped before the tail is checked for a refusal.
  const tail2 = after2.replace(RETRACTION, "").replace(/^[\s,]*(?:no|nope|wait)\b[\s,]*/i, "");
  if (tail2 && !/\b(not|no|never|isn'?t|don'?t)\b/i.test(tail2)) {
    // A retraction rarely repeats the "go to": "actually make it japan" names
    // the place bare, so the tail is read for a destination directly.
    for (const [re, id] of NAMED_DESTINATIONS) if (re.test(tail2)) return { known: id };
    const later = tail2.match(NAMED_PLACE) ?? tail2.match(TRIP_IN);
    const cleaned = later && cleanPlacePhrase(later[1]);
    if (cleaned) return { unknown: cleaned };
  }
  const m = text.match(NAMED_PLACE) ?? text.match(TRIP_IN);
  const said = (() => {
    if (!m) return undefined;
    return cleanPlacePhrase(m[1]);
  })();

  if (said) {
    for (const [re, id] of NAMED_DESTINATIONS) if (re.test(said)) return { known: id };
    return { unknown: said };
  }
  // Nowhere named as a destination, so a catalogue word anywhere in the
  // sentence is the best signal left. It is still only a mention.
  for (const [re, id] of NAMED_DESTINATIONS) if (re.test(text)) return { known: id };
  return {};
}

/** Rules-based free-text interpretation. Intentionally shallow — this is the
 *  component the LLM driver most improves on, and the eval harness measures it. */
/** Splits on sentence and contrast boundaries so negation stays scoped. */
export function splitClauses(text: string): string[] {
  /*
   * CLAUSE_BREAK, like every other reader of a clause boundary.
   *
   * This one was never converted: it split on .!?; "but", "though",
   * "although", and a comma ONLY when a negation word followed it. So
   * "portugal for 9 days, not Porto - i want lots of food" produced a single
   * clause starting at "not", `cleanPlacePhrase` saw seven words, the
   * three-word ceiling dropped it, and brief.avoidPlaces came back EMPTY: the
   * planner routed the trip through Porto and the critic had nothing to warn
   * about. 113 of 165 destination/separator pairs. The same glue swallowed
   * whole requirements — "no more than 2 hours driving a day - must be
   * wheelchair accessible" reached the card as neither.
   */
  return text
    .split(new RegExp(`(?<=[.!?;])\\s+|${CLAUSE_BREAK_SOURCE}|\\s+but\\s+|\\s+though\\s+|\\s+although\\s+`, "i"))
    .map((c) => c.trim())
    .filter(Boolean);
}

const NEGATOR = /\b(not|no|don'?t|do not|isn'?t|nothing|never(?!\s+been)|avoid|skip|without|rather not|hate|less|fewer|except)\b/i;

const DEFERRAL = /^(i'?m |i am )?(flexible|open|easy|not sure|whatever('?s| is)? (makes )?sense|whatever|surprise me|you (pick|choose|decide)|no preference|don'?t know|dunno|up to you|any)\b/i;

const FAR = /\b(looks? nothing like home|another world|completely different|far away|as far as|exotic|other side of the world|long way (from|away)|proper trip abroad|somewhere foreign)/i;

/**
 * "food i don't care" is not a request for food and not an aversion to it.
 * The negator sits AFTER the subject, so clause-scoped negation reads the
 * whole phrase as affirmed and files food as something they want. Indifference
 * removes a vibe from the wanted set without ever adding it to avoid: they
 * said it doesn't matter, not that it's a problem.
 */
const INDIFFERENCE: RegExp[] = [
  /([a-z &]{3,30}?)\s*,?\s*i\s+(?:really\s+)?don'?t\s+(?:really\s+)?care\b/gi,
  /\bi\s+don'?t\s+(?:really\s+)?care\s+(?:about|for)\s+([a-z &]{3,30})/gi,
  /([a-z &]{3,30}?)\s+doesn'?t\s+(?:really\s+)?matter\b/gi,
  /\b(?:whatever|no preference|not fussed|not bothered)\s+(?:for|on|about)\s+([a-z &]{3,30})/gi,
];

const WARM = /\b(beach|sunbath|sunshine|in the sun|warm|hot weather|tropical|somewhere hot|by the sea|swim)/i;

export function interpretRules(input: string, brief: Brief): BriefPatch {
  const patch: BriefPatch = {};
  const raw = input.trim();
  if (!raw) return patch;

  // Ruled-out places come out first, and the rest of the sentence is parsed
  // without them, so "I've been to Zion" can never also mean "take me to Zion".
  const been = detectVisited(raw);
  if (been.names.length) patch.visitedNames = been.names;
  const text = been.rest;

  // "Lie on a beach" is a climate request. Without this, it reads as nature
  // plus relaxation and cheerfully proposes a black sand beach in Iceland.
  if (WARM.test(text)) patch.wantsWarm = true;
  // Some people want somewhere pleasant; some want to be a long way off.
  if (FAR.test(text)) patch.wantsFar = true;

  // "I'm flexible" means different things depending on what was just asked,
  // so resolve it against whichever slot is still open.
  if (DEFERRAL.test(text)) {
    const pending = nextQuestionRules(brief);
    if (pending?.id === "duration") patch.flexibleDuration = true;
    else if (pending?.id === "vibes") patch.surpriseMe = true;
    else if (pending?.id === "budget") patch.flexibleBudget = true;
  }

  // Deliberately NOT gated on the field being empty. People correct
  // themselves — "ok, make it $2,500 then" after picking a chip — and
  // ignoring a restated number leaves them stuck with no way to change it.
  // The patterns below require an explicit unit or currency marker, so a
  // stray number in an unrelated sentence won't overwrite anything.
  if (/\b(flexible|whenever|not sure|don'?t know)\b/i.test(text) && /\b(long|days?|week|time)\b/i.test(text)) {
    patch.flexibleDuration = true;
  }
  // Stated dates beat a stated duration, and carry the calendar with them:
  // the month, the weekdays, and which day is the flight home.
  const range = parseDateRange(text);
  if (range) {
    patch.dates = { start: range.start, end: range.end };
    patch.days = Math.min(21, Math.max(2, range.days));
    const mn = monthName(range.start);
    if (mn) patch.month = mn;
  } else {
    for (const [re, fn] of DURATION_PATTERNS) {
      const m = text.match(re);
      if (m) { patch.days = Math.min(21, Math.max(2, fn(m))); break; }
    }
    /*
     * A month, or a departure with no return, still tells us when.
     *
     * parseDateRange needs two dates and returns null otherwise, and `month`
     * was only ever set from a parsed range — so "portugal, 9 days in march"
     * carried nothing about March past this line. The planner fell back to its
     * default of 45 days out, the itinerary printed real October weekdays, and
     * seven destinations carry a season caveat that could never fire because
     * nothing downstream knew what she had said.
     */
    const one = singleDate(text);
    if (one) {
      patch.month = monthName(one);
      const n = patch.days ?? brief.days;
      // A departure date is the start. The end follows from the length when we
      // have one; when we don't, the month is what survives.
      if (n) patch.dates = { start: one, end: addDays(one, n - 1) };
    } else {
      const mn = bareMonth(text);
      if (mn) patch.month = mn;
    }
  }

  if (/\bwhatever makes sense|no budget|flexible on (money|budget)|don'?t care about (cost|money)\b/i.test(text)) {
    patch.flexibleBudget = true;
  }
  for (const [re, fn] of BUDGET_PATTERNS) {
    const m = text.match(re);
    if (!m) continue;
    const usd = fn(m);
    // Whatever slips past the patterns, a whole trip does not cost less than
    // this. Below the floor it is a misread number, and saying nothing about
    // budget is far better than planning against a wrong one: the agent asks
    // for it in the next breath anyway. Keep looking rather than stopping, so
    // a stray small match can't shadow the real figure later in the sentence.
    if (usd < BUDGET_FLOOR) continue;
    patch.budgetUsd = usd;
    break;
  }

  // "Without breaking the bank" is a budget, just not a number. Reading it and
  // stating the assumption beats asking a question they already answered.
  if (patch.budgetUsd === undefined && brief.budgetUsd === undefined) {
    const days = patch.days ?? brief.days ?? 7;
    for (const [re, base, perDay, label] of BUDGET_IDIOMS) {
      const m = text.match(re);
      if (!m) continue;
      patch.budgetUsd = Math.round((base + perDay * days) / 50) * 50;
      patch.budgetInferred = m[0].toLowerCase();
      patch.flexibleBudget = false;
      break;
    }
  }

  // Clause by clause, and within a clause the negator only governs what comes
  // AFTER it. "in the nature without breaking the bank" is a request for
  // nature; treating the whole sentence as negated threw the vibe away.
  const vibes = new Set<Vibe>(brief.vibes);
  const negatedVibes = new Set<Vibe>();
  for (const clause of splitClauses(text)) {
    const m = clause.match(NEGATOR);
    const cut = m?.index ?? -1;
    const affirmed = cut >= 0 ? clause.slice(0, cut) : clause;
    const denied = cut >= 0 ? clause.slice(cut) : "";
    for (const [re, v] of VIBE_PATTERNS) {
      if (affirmed && re.test(affirmed)) vibes.add(v);
      if (denied && re.test(denied)) negatedVibes.add(v);
    }
  }
  // Stated indifference. Removed from what they want, never added to what
  // they're avoiding — "food i don't care" is a shrug, not a complaint.
  for (const re of INDIFFERENCE) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      const phrase = m[1];
      if (!phrase) continue;
      for (const [vre, v] of VIBE_PATTERNS) if (vre.test(phrase)) negatedVibes.add(v);
    }
  }
  for (const v of negatedVibes) vibes.delete(v);
  if (negatedVibes.size) patch.removeVibes = [...negatedVibes];
  if (vibes.size !== brief.vibes.length) patch.vibes = [...vibes];

  // unknownAcknowledged used to mean "we've shown them the catalogue menu, so
  // don't ask again". The menu is gone, and this flag was quietly switching
  // research off on the second message: she asked for Thailand, the model
  // queued it correctly, and by the time discovery finished the flag said it
  // had been dealt with. It is now set only when research actually fails.

  // Where they're flying from. Guessed from the browser's timezone on load;
  // a typed correction always wins, and only a phrase with an origin cue in
  // it counts as one.
  const statedOrigin = originFromText(text);
  if (statedOrigin) patch.origin = statedOrigin;

  // A region is a constraint on the whole catalogue, so it is read before any
  // interest hint gets to name a destination.
  const region = detectRegion(text);
  if (region && !brief.region) {
    patch.region = region.id;
    patch.regionLabel = region.label;
    patch.regionIds = regionIds(region);
  }
  if (ROAD_TRIP.test(text)) patch.roadTrip = true;
  // A literal phrase, which is exactly what this layer is for.
  if (wantsAbroad(text)) patch.wantsInternational = true;

  /*
   * A destination she names later still wins.
   *
   * This whole block was skipped once `brief.namedDestination` was set, so
   * after turn one "actually make it italy", "can we do japan instead",
   * "change it to japan" and "how about iceland" all produced an empty patch —
   * eleven of twelve phrasings — and the agent carried on talking about
   * Portugal with nothing said. `readPushback`'s clearest signal is a patch
   * whose destination differs from the current one, and the deterministic
   * driver could never produce it.
   *
   * The shortlist branch stays gated: a second place mentioned in passing on a
   * settled brief is not a request to reopen the choice. A place she names
   * with a cue — "go to X", "make it X", "X instead" — is.
   */
  const settled = !!brief.namedDestination;
  if (!settled) {
    const all = detectNamedPlaces(text);
    if (all.known.length + all.unknown.length > 1) {
      patch.candidates = all.known;
      patch.unknownCandidates = all.unknown;
    }
  }
  {
    /*
     * The ranking, and it is load-bearing.
     *
     *   1. a place she named, whether or not we hold data for it
     *   2. a region she named
     *   3. a destination inferred from an interest
     *
     * Sorted by how directly the signal states what she wants. It used to be
     * sorted by how much data we hold, which put a place she typed BELOW a
     * keyword match, because "we have no pack for Hokkaido" was being read as
     * "Hokkaido is a weak signal". Coverage is a fact about the catalogue. It
     * is not a fact about her sentence, and it does not get to demote her
     * words.
     */
    const found = detectNamedPlace(text);
    const interest = detectInterest(text);
    // A named place wins on where; a stated reason still shapes the answer, so
    // both are read. Saying "LOTR fan, and I want NZ" should not lose the LOTR.
    // Her words. interest.echo is a catalogue blurb and never goes here.
    const purpose = statedPurpose(text);
    if (purpose.activity) patch.activities = [purpose.activity];
    // Refused as a thing to do, kept as something she said. Nothing downstream
    // reads this; it exists so the phrase is still there at the end.
    if (purpose.aside) patch.asides = [purpose.aside];
    // An interest hint may not overrule a region. "A roadtrip in Europe" was
    // matching /road ?trip/ and hard-selecting the Utah canyon country, which
    // is the weakest signal in the sentence beating the only firm one.
    const regionNamed = !!(patch.region ?? brief.region);
    if (found.known) {
      patch.namedDestination = found.known;
    } else if (found.unknown) {
      /*
       * A place she named that we don't hold beats an interest we recognise,
       * always.
       *
       * This branch used to do the opposite: "i want to go to hokkaido for 10
       * days. food, onsen and driving." matched "onsen" against the interest
       * table, filed Japan as the destination, and set unknownAcknowledged —
       * a flag documented as meaning "we tried and told her" — without anyone
       * having tried anything. The research gate read that flag, skipped the
       * lookup, and the recommender pitched Portugal.
       *
       * A reason is a reason. It shapes the trip and it is kept as an echo.
       * It does not get to choose the country when she has already named one.
       */
      /*
       * Do not throw away the other places in the same sentence.
       *
       * The plural pass above sets unknownCandidates when it finds more than
       * one place; this line then overwrote it with the single cued one. So
       * "the faroe islands or the azores" reached the brief as the Faroes
       * alone. Now that both parsers share a cleaner they agree on the pair,
       * and the cued place simply leads the list it is part of.
       */
      patch.unknownCandidates = patch.unknownCandidates?.length
        ? [...new Set([found.unknown, ...patch.unknownCandidates])]
        : [found.unknown];
    } else if (interest && !regionNamed && !interest.weak) {
      patch.namedDestination = interest.id;
    }
  }

  // Constraints come from the negated clauses only, so "I want wine but not
  // museums" doesn't file wine as something to avoid.
  const negatedClauses = splitClauses(text)
    .map((c) => { const m = c.match(NEGATOR); return m?.index === undefined ? "" : c.slice(m.index); })
    .filter(Boolean);
  if (negatedClauses.length) {
    /*
     * A place in a negated clause is a place she does not want.
     *
     * These clauses were already isolated here and only ever mined for tags,
     * so "but not istanbul" produced nothing at all: no tag matches a city
     * name. The same cleaner the positive parsers use runs on them now.
     */
    const avoided = negatedClauses
      .map((c) => cleanPlacePhrase(c.replace(NEGATOR, "").trim()))
      .filter((x): x is string => !!x && x.split(/\s+/).length <= 3)
      .filter((x) => !parseAvoidTags(x).length);
    if (avoided.length) patch.avoidPlaces = [...new Set(avoided)];

    const tags = [...new Set(negatedClauses.flatMap(parseAvoidTags))];
    /*
     * A refusal is recorded because she said it, not because we can act on it.
     *
     * This was gated on the clause ALSO producing a tag, a ruled-out place, or
     * one of four specific words — so "no more than two hours' driving a day"
     * and "nothing that needs booking months ahead" reached the brief as
     * nothing at all. Neither maps to any of the 28 tags, which is a fact
     * about our taxonomy and not a reason to drop what she typed. They are
     * kept, shown to the model, and named on the card as things the machinery
     * cannot check — see unenforcedNote.
     *
     * Just the negated clauses, still: filing the whole opening message made
     * "I like history and museums" read as something to avoid.
     */
    patch.constraints = [...brief.constraints, ...negatedClauses.map((c) => c.trim())];
    if (tags.length) patch.avoidTags = [...new Set([...brief.avoidTags, ...tags])];
  }

  /*
   * Having been to a town is not being done with the country she just asked for.
   *
   * `detectVisited` matches on NAMED_DESTINATIONS, which maps a town to its
   * destination — right for "take me there", wrong for "I've been there". So
   * "i want to go to portugal for 9 days, i've been to lisbon" recorded
   * visitedIds: ["portugal"], which recommend() reads as her turning the
   * country down, and she was sent to Japan. Thirty of thirty-four cases
   * drifted to a different country and nothing said so — off the strongest
   * rule she has given us.
   *
   * A destination she asks for in the same breath is not one she has ruled
   * out. Her own message, "i've been to bryce canyon, grand canyon, zion, etc.
   * already", still bans the southwest, because she asks for nothing there.
   */
  if (been.ids.length) {
    /*
     * This breath, not a standing preference.
     *
     * `?? brief.namedDestination` made "actually i've been to portugal
     * already, somewhere else" a no-op three turns after she named Portugal:
     * the ban was deleted by the request it was retracting.
     */
    const wanted = patch.namedDestination;
    const ids = been.ids.filter((id) => id !== wanted);
    if (ids.length) patch.visitedIds = ids;
  }

  /*
   * A requirement does not have to be phrased as a refusal.
   *
   * Constraints came from negated clauses only, so "it must be step free",
   * "only direct flights", "at least two nights in each place" and "we have to
   * be back by the 20th" reached the brief as nothing at all — not stored, not
   * sent to the model, not mentioned on the card. Fourteen of the nineteen
   * words `unenforced()` looks for could never occur in a clause it could see,
   * including its own headline example.
   */
  const REQUIREMENT =
    /\b(must|has to|have to|needs? to|need|only|at least|at most|no more than|no less than|within|under|over|max|maximum|minimum|step[- ]free|accessible|wheelchair|by the \d)\b/i;
  /*
   * A seventh alphabet is how this keeps going wrong.
   *
   * This split on plain commas on top of splitClauses — hand-patching one
   * separator rather than using the shared rule — and still had no "and", so
   * "iceland 8 days and it must be wheelchair accessible" arrived as one
   * thirteen-word clause, failed the length ceiling, and vanished. Two
   * requirements joined by "and" are two requirements.
   */
  const required = splitClauses(text)
    .flatMap((c) => c.split(new RegExp(`\\s*,\\s*|${CLAUSE_BREAK_SOURCE}|\\s+and\\s+`, "i")))
    .map((c) => c.trim())
    .filter((c) => REQUIREMENT.test(c) && !NEGATOR.test(c) && c.split(/\s+/).length <= 12);
  if (required.length) {
    patch.constraints = [...new Set([...(patch.constraints ?? brief.constraints), ...required])];
  }

  return patch;
}

/**
 * Did she rule out a PLACE, or just say something in the shape of one?
 *
 * `avoidPlaces` is `cleanPlacePhrase` applied to any negated clause with no
 * check that the phrase names anywhere: "nothing too fancy" files "too fancy",
 * "without breaking the bank" files "breaking the bank". Counting those as
 * knowing why skipped the vibes question entirely and went straight to a plan
 * — the identical regression the comment beside `knowsWhy` says it fixed for
 * raw constraint text, reopened through the field beside it.
 */
export function ruledOutAPlace(b: Brief): boolean {
  return (b.avoidPlaces ?? []).some((x) => {
    const q = x.trim().toLowerCase();
    if (!q) return false;
    return CITIES.some((c) => c.name.toLowerCase().includes(q) || q.includes(c.name.toLowerCase()))
      || NAMED_DESTINATIONS.some(([re]) => re.test(q))
      || isKnownDestination(q.replace(/\s+/g, "-"));
  });
}

// --- question bank ---------------------------------------------------------

export const QUESTIONS: Record<"duration" | "vibes" | "budget", Question> = {
  duration: {
    id: "duration",
    prompt: "How long can you disappear for?",
    kind: "single",
    options: [
      { value: "4", label: "3–4 days" },
      { value: "7", label: "5–7 days" },
      { value: "10", label: "1–2 weeks" },
      { value: "flexible", label: "I'm flexible" },
    ],
  },
  vibes: {
    id: "vibes",
    prompt: "What sounds good right now?",
    kind: "multi",
    hint: "Pick as many as fit.",
    options: [
      ...ALL_VIBES.map((v) => ({ value: v, label: VIBE_LABEL[v] })),
      { value: "surprise", label: "🤷 Surprise me" },
    ],
  },
  budget: {
    id: "budget",
    prompt: "Roughly what do you want to spend?",
    kind: "single",
    hint: "Flights and everything on the ground, per person.",
    options: [
      { value: "900", label: "Under $1,000" },
      { value: "1500", label: "$1,000–2,000" },
      { value: "2500", label: "$2,000–3,000" },
      { value: "4000", label: "$3,000+" },
      { value: "flexible", label: "Whatever makes sense" },
    ],
  },
};


const titleCase = (s: string) =>
  s.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

/**
 * What the rules layer still needs, split by phase.
 *
 * Discovery decides where to go. Logistics is how long and how much, and it
 * only matters once there is somewhere to plan — asking for a budget before
 * anyone has agreed on a country is the form this product exists to replace.
 */
/**
 * How much room the conversation has, for the driver that can actually hold
 * one. Naming a place used to END discovery — candidates got set, the slot
 * check was satisfied, and the agent jumped straight to a pitch having asked
 * nothing. In a real conversation naming somewhere is what STARTS it.
 *
 * So the rules keep only a floor and a ceiling, and the model decides
 * everything in between:
 *   "must"  we know where but not why, or nothing at all. Ask.
 *   "may"   enough to answer, but more would sharpen it. The model chooses.
 *   "stop"  four questions in. This product exists to decide, not to interview.
 */
/**
 * When the floor forces a question, it has to be the RIGHT question. The
 * fallback was always the vibes chips, so someone naming a place we had to
 * look up got asked "what sounds good right now?", answered it, and got asked
 * it again — because the thing actually missing was how long they had, and
 * answering about vibes never changed that.
 */
/**
 * "Try again", when the last thing the agent said was that it couldn't.
 *
 * The failure message ends "say the word and I'll try the Faroe Islands
 * again", and saying the word did nothing: the research had been marked
 * acknowledged, so nothing would look it up a second time and the answer was
 * still New Zealand. An offer the product can't honour is worse than no offer.
 */
export const RETRY_CUE =
  /\b(?:try|go)\b[^.?!]{0,40}\bagain\b|\bretry\b|\b(?:one more|another) (?:go|try|shot|attempt)\b|\bplease try\b/i;

export const wantsRetry = (text: string) => RETRY_CUE.test(text);

export function floorQuestion(b: Brief): Question {
  if (b.days === undefined && !b.flexibleDuration) return QUESTIONS.duration;
  return QUESTIONS.vibes;
}

export function discoveryGate(b: Brief, asked: number): "must" | "may" | "stop" {
  /*
   * How many questions she has to sit through before a trip appears.
   *
   * This used to be the constant 4, whatever she had already said. Measured
   * against her own opening messages, that meant "i want to go to hokkaido
   * for 10 days. food, onsen and driving. budget about $3,000, flying from
   * san francisco." — destination, interests, length, budget and origin, all
   * of it — still allowed four more questions before anything was planned.
   *
   * Her value proposition is "no more planning, just leave". A ceiling that
   * ignores the brief is the planning step, moved inside the product.
   *
   * So it reads what we know. Where and why between them settle almost
   * everything; each one she has already given buys back a question.
   */
  const knowsWhere = !!b.namedDestination || !!b.focusCityId
    || (b.candidates?.length ?? 0) > 0
    || (b.unknownCandidates?.length ?? 0) > 0
     || !!b.region;
  /*
   * Why they want it. Exclusions count, and that is the fix for the turn she
   * lost: "not istanbul or anywhere touristy, heard good things about their
   * coastal lines" set constraints and avoid tags and nothing else, so this
   * read false and the agent asked "what sounds good right now?" about a
   * message that had just told it. Saying what you don't want is saying what
   * you want.
   */
  /*
   * `constraints` no longer counts here.
   *
   * Every negated clause is now recorded on the brief, because she said it —
   * including "somewhere that looks nothing like home", which is a figure of
   * speech and tells us nothing about why. Counting the raw text made that
   * message look like a complete answer, cut the questions, and sent a
   * nature-and-adventure brief to Korea. What she does not want counts when
   * it resolves to something: a tag or a place.
   */
  const knowsWhy = b.vibes.length > 0 || b.surpriseMe === true || !!(b.activities?.length)
    || b.avoidTags.length > 0 || ruledOutAPlace(b);

  const ceiling = knowsWhere && knowsWhy ? 1 : knowsWhere || knowsWhy ? 2 : 3;

  /*
   * How long they have, asked BEFORE the ceiling can end the conversation.
   *
   * This check already existed and sat below `if (asked >= ceiling) return
   * "stop"`, so it could only fire on a turn the gate was going to allow
   * anyway. She answered two chips about hiking, which took her to the
   * ceiling, so the gate stopped, research ran with effectiveDays' default of
   * 7, and the agent told her "Seven days door to door does not get you to
   * Everest Base Camp" about a number she had never given. The one question
   * that decided the whole trip was the one the ceiling had just spent.
   *
   * I lifted it once, saw "i wanna go to turkey but not istanbul or anywhere
   * touristy" go from 2 turns to 4, and put it back down on the grounds that
   * speed is the first priority. She overruled that: "always ask ... it's
   * better than spitting out nonsensical bs". The turn budget is real, and it
   * does not buy the right to invent an answer.
   *
   * `unknownDestination` is in here now too. The interpret step files a single
   * named place there and nowhere else, and a single place is the most common
   * message there is, so reading only `unknownCandidates` missed it.
   *
   * Bounded to one question past the ceiling: always ask is not ask forever.
   */
  const mustResearch = (b.unknownCandidates?.length ?? 0) > 0
    || (!!b.region && !(b.regionIds ?? []).length);
  if (mustResearch && !b.unknownAcknowledged && b.days === undefined
      && !b.flexibleDuration && asked <= ceiling + 1) {
    return "must";
  }

  if (asked >= ceiling) return "stop";
  /*
   * One question is still owed when she named a place and nothing else.
   *
   * The ceiling above is a cap, not a floor, and without this a model that
   * says "I have enough" on the first turn plans a week in Portugal knowing
   * only the word Portugal. One question, at the start, and never again:
   * quality costs a turn here, and it is the only turn it costs.
   */
  if (!knowsWhy && asked === 0) return "must";
  return "may";
}

export function nextQuestionRules(b: Brief, phase: Phase = "discovery"): Question | null {
  // The "I don't cover X, here is everywhere I can plan properly" menu used to
  // live here. It was honest and it was useless: a fifteen-item list of
  // countries nobody asked about, in answer to someone telling you where they
  // want to go. The catalogue is an implementation detail and the traveller
  // should never meet it. Somewhere we don't hold is researched later, after
  // the conversation has told us enough to research it well.
  if (phase === "logistics") {
    /*
     * Length is asked once, and only when it changes the work.
     *
     * For somewhere we have to go and research, a long weekend and a
     * fortnight are different jobs and the answer is worth having first. For
     * a destination already in the catalogue it is a number we can default
     * and she can move, and asking for it is one more turn between her and
     * the thing she came for.
     */
    const mustResearch = (b.unknownCandidates?.length ?? 0) > 0
      || (!!b.region && !(b.regionIds ?? []).length);
    if (b.days === undefined && !b.flexibleDuration && mustResearch) return QUESTIONS.duration;
    /*
     * Budget is never a blocking question.
     *
     * It was asked before anything had been shown, which is the planning
     * step in miniature: answer a form, then receive a trip. Plan it, put
     * the number on the card, and let her say "cheaper" — which the editor
     * already understands. She raises money when money matters to her.
     */
    return null;
  }
  /*
   * Somewhere named is somewhere named, whether or not we happen to hold it.
   *
   * This checked namedDestination and candidates only. A place we don't have
   * data for lands in unknownCandidates, so "i wanna go to canada to see the
   * northern lights, heard about this cute little town up there" looked to
   * this function exactly like someone who had said nothing at all, and it
   * handed back the generic "What sounds good right now?".
   *
   * That question is then given to the model as the floor, and the model
   * rewords it rather than replacing it — which is why the reply came back as
   * "a surprise-me brief is the fun one" with options that were a paraphrase
   * of the vibe chips. It read as the app ignoring her message because that
   * is exactly what happened: by this point her message was gone.
   *
   * Turkey, Jerusalem, Egypt and Canada all hit it. Everything the catalogue
   * does not hold hit it, which since tonight is most of the world.
   */
  const knowsWhere = !!b.namedDestination || !!b.focusCityId
    || (b.candidates?.length ?? 0) > 0
    || (b.unknownCandidates?.length ?? 0) > 0
     || !!b.region;
  // Same reasoning as the ceiling above: raw refusal text is not an answer.
  const knowsWhy = b.vibes.length > 0 || b.surpriseMe === true || !!(b.activities?.length)
    || b.avoidTags.length > 0 || ruledOutAPlace(b);
  if (!knowsWhere && !knowsWhy) return QUESTIONS.vibes;
  return null;
}

/** One notch lighter, used by both the editor and the eval fairness check. */
export function paceDown(p: Pace): Pace {
  const order: Pace[] = ["busy", "mixed", "light", "relaxed"];
  return order[Math.min(order.length - 1, order.indexOf(p) + 1)];
}
