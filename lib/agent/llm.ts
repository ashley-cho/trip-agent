import Anthropic from "@anthropic-ai/sdk";
import { addUsage, emptyUsage, type Usage } from "@/lib/cost";
import type { Brief, Tag, Trip, Vibe } from "@/lib/types";
import { ALL_VIBES, unknownHead } from "@/lib/types";
import { TAGS } from "@/lib/research";
import type { AgentDriver, BriefPatch, EditOp, Question, Recommendation, Turn } from "./types";
import { rulesDriver } from "./rules";
import { DISCOVERY_RULES, EDIT_RULES, INTERPRET_RULES, VOICE } from "./prompts";
import { ENDS_THE_NAME, NAMED_DESTINATIONS, destinationIdsNamedIn, discoveryGate, floorQuestion } from "@/lib/discovery";
import { fold, resolvePlaceName } from "@/lib/places";
import { detectRegion } from "@/lib/regions";
import { CITIES, DESTINATIONS, destinationById } from "@/data/destinations";
import { tiebreakPrompt } from "@/lib/recommend";
import { addDays, bareMonth, monthName } from "@/lib/dates";
import { quotable } from "@/lib/brief";
import { originByName } from "@/lib/origin";
import { RESEARCH_SYSTEM, RESEARCH_TOOL, STRUCTURE_SYSTEM, researchPrompt, validatePack, PLACES_SYSTEM, PLACES_TOOL, placesPrompt } from "@/lib/research";
import { STAYS_SYSTEM, STAYS_TOOL, staysPrompt, validateStays } from "@/lib/stays";
import { namesOnlyChosen } from "@/lib/drift";

/** The catalogue, so the model maps geography itself instead of a regex table. */
function catalogue(): string {
  return DESTINATIONS.map((d) => `- ${d.id}: ${d.name}`).join("\n");
}

function researchError(place: string, e: unknown): string {
  const why = (e as Error)?.message?.split("\n")[0] ?? String(e);
  const timedOut = /timeout|timed out|aborted|FUNCTION_INVOCATION/i.test(why);
  return timedOut
    ? `Researching ${place} took longer than this deployment allows.`
    : `I couldn't research ${place}: ${why.slice(0, 140)}`;
}

function transcript(history: Turn[]): string {
  return history.slice(-10).map((t) => `${t.from === "user" ? "Them" : "You"}: ${t.text}`).join("\n");
}

/**
 * The pitch guard, now one implementation rather than two.
 *
 * `namesOnly` and its generic-word list lived here and guarded the pitch only.
 * The identical question — does this text name somewhere other than the place
 * it is about? — has to be asked of the streamed research paragraph and of the
 * scorecard as well, and three copies of it would have drifted apart inside a
 * week. It moved to lib/drift.ts whole; this is the same function under the
 * same name, and scripts/regress-pitchguard.ts still pins its behaviour.
 */
const namesOnly = namesOnlyChosen;

export const namesOnlyForTest = (chosen: string, prose: string, chosenId?: string) =>
  namesOnly(chosen, prose, chosenId);

/**
 * Read per call, not at module load: the doctor sets it after probing.
 *
 * Sonnet 5 rather than Sonnet 4.5, for two reasons checked against Anthropic's
 * own pages rather than remembered. It is cheaper, $2/$10 per million against
 * $3/$15, which takes a researched trip from about 31c to about 21c. And 4.5
 * is scheduled for retirement from 29 September 2026, three weeks out, after
 * which calls to it fail: a prototype quietly dying on a date nobody wrote
 * down is a bad way to find out about a deprecation.
 */
const model = () => process.env.TRIP_AGENT_MODEL || "claude-sonnet-5";

/**
 * Minimal shape we need, so a fake transport can stand in for tests.
 * `input_schema` is typed as a real object schema rather than a loose record:
 * the SDK requires `type: "object"` and a bare Record hid that behind a cast.
 */
export interface ToolSchema {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  /** The SDK's InputSchema carries an index signature; match it. */
  [k: string]: unknown;
}

export interface Transport {
  /** What this transport has spent so far. Absent on fakes and in tests. */
  usage?(): Usage;
  call(args: {
    system: string;
    user: string;
    tool: { name: string; description: string; input_schema: ToolSchema };
    maxTokens?: number;
  }): Promise<Record<string, unknown> | null>;
  /**
   * Same shape, but the model may search the web first. Optional so a fake
   * transport in a test, or a deployment without search, simply doesn't offer
   * it — and the caller degrades rather than throwing.
   */
  /**
   * Step one of research: the model searches the web and writes up what it
   * found, as prose. Structuring it is a separate, forced-tool call.
   */
  research?(args: {
    system: string;
    user: string;
    maxTokens?: number;
    maxSearches?: number;
    /**
     * Off by default, and off on the path a person waits on. With search on,
     * the model spent its whole output budget calling the tool and narrating
     * it — forty seconds to stream "I'll search for current information about
     * traveling to Botswana. Let me continue searching." and then hit the
     * ceiling before writing anything. Both useless and exactly the prose
     * section 12 bans.
     */
    search?: boolean;
    /** Called with each chunk as it arrives. */
    onChunk?: (text: string) => void;
  }): Promise<{ text: string; sources: string[] }>;
}

/**
 * Cache the part of every request that never changes.
 *
 * Anthropic bills a cache read at a tenth of a fresh input token and a cache
 * write at a quarter more, and this app's requests are unusually well shaped
 * for that: the system prompt and the tool schema are constants measured in
 * thousands of tokens, and the part that varies is a place name and a few
 * lines of notes. Every research run sent the whole constant prefix five
 * times at full price, and so did the next destination, and the one after it.
 * Seeding sixty-odd destinations in an afternoon paid for the same fixed
 * preamble three hundred times.
 *
 * The breakpoint goes on the LAST cacheable block, because a cache_control
 * marker caches everything before it in the prefix order tools, then system,
 * then messages.
 *
 * That order is the thing this got wrong. The marker was on the TOOL, under a
 * comment in this file asserting that "marking the tool covers the tool AND
 * the system prompt". It is the other way round: the tool comes FIRST in the
 * prefix, so marking it cached the tool and left the system prompt to be
 * billed in full on every single call. Anthropic's own notice said the hit
 * rate was low and that caching could save about $38 a month; this is why.
 * Measured on the real prompts, `interpret` sent about 1,095 tokens of
 * uncached system on every message she typed, and `record_destination` about
 * 560 on every research call.
 *
 * So the marker goes on the SYSTEM block, which covers tools + system: the
 * whole static half of every request, and the longest prefix available
 * without caching her own words, which change every turn and would never hit.
 *
 * Two honest limits. A prefix under the model's minimum (1024 tokens on the
 * models this runs on) is not cached at all, and the marker costs nothing in
 * that case — `pitch`, `suggest` and `stays` are all around 500 tokens and
 * get nothing from any of this. And the default entry lives five minutes,
 * measured from the START of the request that writes it, so a person who
 * thinks for a few minutes between messages pays the write again. The one
 * hour TTL below is for exactly that: a write costs 2x base instead of 1.25x,
 * a read costs 0.1x either way, and one write an hour beats a write every
 * time she pauses to think.
 *
 * Nothing downstream changes. `record` already counts cache_read_input_tokens
 * and cache_creation_input_tokens separately, and lib/cost.ts already prices
 * them separately, so the cost the app reports stays true without being told
 * anything about this.
 */
const CACHE = { type: "ephemeral" as const, ttl: "1h" as const };

/**
 * The same marker without the hour.
 *
 * The extended TTL is the one thing here that cannot be tested without a live
 * key, so a rejection of it must not be able to take the app down. The
 * transport retries once with this and logs it; the answer is identical
 * either way, because a cache parameter changes the bill and nothing else.
 */
const CACHE_5M = { type: "ephemeral" as const };

/** The system prompt, marked cacheable, in the blocks form the API needs. */
type CacheMark = typeof CACHE | typeof CACHE_5M;

const cacheableSystem = (system: string, cache: CacheMark = CACHE) =>
  [{ type: "text" as const, text: system, cache_control: cache as never }];

/** Does this error say the extended TTL was refused? */
const ttlRefused = (e: unknown) => {
  const m = String((e as { message?: string })?.message ?? e);
  return /ttl|cache_control|extended-cache/i.test(m);
};

export function anthropicTransport(apiKey: string): Transport {
  // Node's fetch ignores HTTPS_PROXY; curl honours it. In a sandboxed VM that
  // routes egress through a proxy, that difference is the whole reason every
  // call failed with "Connection error" while curl reported 200.
  const proxy = process.env.HTTPS_PROXY ?? process.env.https_proxy;
  const opts: ConstructorParameters<typeof Anthropic>[0] = { apiKey };
  if (proxy) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ProxyAgent, fetch: undiciFetch } = require("undici");
      const agent = new ProxyAgent(proxy);
      opts.fetch = ((url: string, init?: Record<string, unknown>) =>
        undiciFetch(url, { ...init, dispatcher: agent })) as never;
    } catch {
      // undici not installed; direct connection, which is right on a normal machine.
    }
  }
  const client = new Anthropic(opts);

  /*
   * Exact counts, from the API rather than from an estimate. Kept on the
   * transport so every driver method contributes without any of them having
   * to know this exists.
   */
  const used: Usage = emptyUsage();
  /*
   * Writes are recorded under the TTL they were made with, because the two
   * are not the same price: five minutes costs 1.25x base input, an hour
   * costs 2x. Reporting an hour's write at the five minute rate would make
   * the app wrong about its own bill in the direction that flatters it.
   *
   * The API returns the split in `cache_creation` where it supports it; where
   * it does not, `hour` says which one this call asked for.
   */
  const record = (u: unknown, searches = 0, hour = true) => {
    const x = (u ?? {}) as Record<string, number>;
    const split = (u as { cache_creation?: Record<string, number> })?.cache_creation;
    const total = x.cache_creation_input_tokens ?? 0;
    const w1h = split?.ephemeral_1h_input_tokens ?? (hour ? total : 0);
    const w5m = split?.ephemeral_5m_input_tokens ?? (hour ? 0 : total);
    Object.assign(used, addUsage(used, {
      calls: 1,
      inputTokens: x.input_tokens ?? 0,
      outputTokens: x.output_tokens ?? 0,
      cacheReadTokens: x.cache_read_input_tokens ?? 0,
      cacheWriteTokens: w5m,
      cacheWrite1hTokens: w1h,
      searches,
    }));
  };

  return {
    usage: () => ({ ...used }),

    async call({ system, user, tool, maxTokens = 1024 }) {
      // On the system block, not the tool: tools come first in the prefix, so
      // a marker there caches the tool and leaves the system uncached. See
      // the note at CACHE.
      const send = (cache: CacheMark) => client.messages.create({
        model: model(),
        max_tokens: maxTokens,
        system: system ? cacheableSystem(system, cache) : system,
        tools: [tool as never],
        tool_choice: { type: "tool", name: tool.name },
        messages: [{ role: "user", content: user }],
      });
      let res;
      let hour = true;
      try {
        res = await send(CACHE);
      } catch (e) {
        if (!ttlRefused(e)) throw e;
        console.warn("[llm] the one hour cache TTL was refused; falling back to five minutes");
        hour = false;
        res = await send(CACHE_5M);
      }
      record(res.usage, 0, hour);
      // Running out of output tokens mid-answer is not an error. The API
      // returns the tool call with whatever it managed to write, so a pack
      // that stopped after its cities arrives looking exactly like a model
      // that had no places to suggest. That is how a week in the Yucatan
      // became "only 0 usable places came back". It is not allowed to be
      // silent again.
      if (res.stop_reason === "max_tokens") {
        console.warn(`[llm] ${tool.name} hit the ${maxTokens}-token ceiling; the answer is cut off`);
      }
      const block = res.content.find((c) => c.type === "tool_use");
      return block && block.type === "tool_use" ? (block.input as Record<string, unknown>) : null;
    },

    async research({ system, user, maxTokens = 4000, maxSearches = 3, search = false, onChunk }) {
      // No searching by default. The model knows Botswana; what it does not
      // know is this Tuesday's opening hours, and paying forty seconds up
      // front to look those up is the wrong trade on the one call a person is
      // sitting and waiting for.
      const open = (cache: CacheMark) => client.messages.stream({
        model: model(),
        max_tokens: maxTokens,
        system: cacheableSystem(system, cache),
        ...(search
          ? { tools: [{ type: "web_search_20250305", name: "web_search", max_uses: maxSearches } as never] }
          : {}),
        messages: [{ role: "user", content: user }],
      });

      /*
       * A stream rejects at the first await, not at open(), so the TTL
       * fallback has to wrap the await rather than the call.
       */
      let text = "";
      const run = async (cache: CacheMark) => {
        text = "";
        const stream = open(cache);
        if (onChunk) stream.on("text", (t: string) => { text += t; onChunk(t); });
        return stream.finalMessage();
      };
      let res;
      let hour = true;
      try {
        res = await run(CACHE);
      } catch (e) {
        if (!ttlRefused(e)) throw e;
        console.warn("[llm] the one hour cache TTL was refused; falling back to five minutes");
        hour = false;
        res = await run(CACHE_5M);
      }
      record(
        res.usage,
        Number((res.usage as unknown as Record<string, Record<string, number>>)
          ?.server_tool_use?.web_search_requests ?? 0),
        hour,
      );
      if (!onChunk) {
        text = (res.content as unknown as Record<string, unknown>[])
          .filter((c) => c.type === "text")
          .map((c) => String(c.text ?? ""))
          .join("\n");
      }

      const sources = new Set<string>();
      for (const c of res.content as unknown as Record<string, unknown>[]) {
        const results = (c as { content?: unknown }).content;
        if (!Array.isArray(results)) continue;
        for (const r of results as Record<string, unknown>[]) {
          const url = typeof r.url === "string" ? r.url : undefined;
          if (url) sources.add(url);
        }
      }
      return { text: text.trim(), sources: [...sources].slice(0, 12) };
    },
  };
}

// --- validation ------------------------------------------------------------
// Nothing from the model is trusted. Anything that fails validation is dropped
// and the rules driver answers instead, so a bad response degrades rather
// than breaking the app.

// Derived, not hand-maintained. It was a literal list and had already fallen
// two behind: "adventure" and "film" were missing, so "less adventure stuff"
// on a New Zealand trip parsed correctly and was then dropped on the floor
// here, changing nothing and saying nothing. Fifty lines above, the slop guard
// already derives itself from TAGS for exactly this reason.
const VALID_TAGS = new Set<string>(TAGS);
const VALID_VIBES = new Set<string>(ALL_VIBES);

const str = (v: unknown, max = 4000) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
const int = (v: unknown, lo: number, hi: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? Math.round(v) : undefined;

/**
 * Somewhere we could actually fly a person. A month, a season or a duration is
 * none of those, and researching one produces a confident itinerary for a
 * country nobody mentioned: "9 days in october" was captured as a place called
 * October, and the trip came back as Kyoto and Takayama on a Portugal brief.
 */
const NOT_A_DESTINATION =
  /^(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|spring|summer|autumn|fall|winter|next|this|last|early|mid|late|peak|shoulder|weekend|week|month|year|days?|nights?|somewhere|anywhere|abroad|overseas|warm(?:er)?|cold(?:er)?|cheap(?:er)?|budget|luxury|beach(?:es)?|mountains?|city|cities|countryside|nature|food|history|culture|adventure|relaxation|nowhere|home)\b/i;

/**
 * Words that describe a place without being one.
 *
 * "i'm open to traveling nearby countries" came back as a place called Nearby
 * Countries, which the agent then spent forty seconds reading up on before
 * recommending Mexico for a trip that started in London. A phrase made
 * entirely of these words is a shape, not a destination: no amount of research
 * will find it, and researching it is how the wrong country gets planned.
 */
const GENERIC_SCOPE = new Set([
  "nearby", "near", "close", "closer", "nearer", "surrounding", "neighbouring",
  "neighboring", "adjacent", "next", "door", "other", "another", "different",
  "new", "some", "somewhere", "anywhere", "elsewhere", "several", "few", "couple",
  "place", "places", "country", "countries", "city", "cities", "town", "towns",
  "spot", "spots", "destination", "destinations", "option", "options",
  "region", "regions", "area", "areas", "continent", "abroad", "overseas",
  "trip", "trips", "holiday", "vacation", "travel", "traveling", "travelling",
  "the", "a", "an", "of", "to", "in", "and", "or", "any", "all", "more",
]);

/*
 * The app already owns a vocabulary of things people want to DO, and every one
 * of them is a word that is not a place. "viewpoint" is a tag; "viewpoints" is
 * what she typed next to "lisbon", and it got researched as a country.
 *
 * Deriving the guard from TAGS and the vibes rather than a list I maintain by
 * hand means it stays true as the vocabulary grows, and it covers the words
 * that actually appear in these sentences because they are the same words the
 * rest of the product uses.
 */
for (const w of [...TAGS, ...ALL_VIBES]) {
  GENERIC_SCOPE.add(w.toLowerCase());
  GENERIC_SCOPE.add(`${w.toLowerCase()}s`);
}

export function isPlaceName(s: string): boolean {
  const t = s.trim();
  if (!t || /^\d/.test(t) || NOT_A_DESTINATION.test(t)) return false;
  // Every word generic means the whole phrase is. "Costa Brava" survives;
  // "nearby countries", "somewhere new", "another city" do not.
  const words = t.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  return words.length > 0 && !words.every((w) => GENERIC_SCOPE.has(w));
}

/**
 * A phrase she typed, against what the catalogue actually holds.
 *
 * Destinations first, then their cities, because "Lisbon" is a city inside
 * Portugal and planning Portugal for it is still the right trip; "Hokkaido"
 * is not in Japan's city list at all and planning Japan for it is not.
 */
/**
 * A catalogue city she typed, found in her own words rather than the model's.
 *
 * `place_named` is optional, and the model routinely skips it: asked about
 * Oaxaca it fills destination_ids with mexico, which already answers the
 * question as far as it is concerned, and the city is never surfaced. Live,
 * that meant "oaxaca" still came back as "Mexico City & Oaxaca" even with the
 * whole subject mechanism shipped.
 *
 * So the code looks for itself. Reading her sentence for a city we hold does
 * not depend on the model choosing to mention it, which is the point: this
 * rule is not one the model gets a vote on.
 */
/**
 * Did she say this as a place she wants to GO, or just mention it?
 *
 * "i want to go to hokkaido for 10 days. food, onsen and driving." came back
 * with unknown_places of ["hokkaido", "onsen", "driving"], which is three
 * plausible-looking strings and only one destination. Dropping the list
 * wholesale sent her to Japan; keeping it wholesale would send her to research
 * a country called Onsen.
 *
 * The difference is in the sentence, not the word. A destination follows a
 * going-to cue: "go to X", "trip to X", "ten days in X". Interests come after
 * it, in a list. So a candidate has to appear in that position to count.
 */
/*
 * Bare "see" and "explore" were cues here and they are not.
 * "go to the faroe islands to SEE puffins" produced a second phrase,
 * "puffins", which went into the research queue as a destination. A cue has
 * to mean "I am going there"; "see" mostly means "while I am there".
 * Somewhere named after "see" is still caught by the model and by the
 * catalogue match, which is where that job belongs.
 */
const GOING_TO =
  /\b(?:go(?:ing)? to|fly(?:ing)? to|head(?:ing)? to|visit(?:ing)?|trip to|travel(?:ling|ing)? to|holiday in|vacation in|be in|spend[^.]{0,20}\bin|days? in|weeks? in|nights? in)\s+([a-z\u00C0-\u024F][\w'\u00C0-\u024F-]*(?:\s+[a-z\u00C0-\u024F][\w'\u00C0-\u024F-]*){0,3})/gi;

/** Trailing words that are never part of the name: "hokkaido for 10 days". */
const NOT_PART_OF_A_NAME =
  /^(?:for|in|on|at|with|over|during|about|around|roughly|next|this|last|early|mid|late|and|or|a|an|the|my|our|some|\d+|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|spring|summer|autumn|fall|winter|days?|nights?|weeks?|months?)$/i;

/**
 * Where she said she wants to go, read from her own sentence.
 *
 * The strongest signal available and it needs no model at all. "i want to go
 * to hokkaido for 10 days" puts hokkaido after a going-to cue; "food, onsen
 * and driving" comes after the full stop, in a list. One of those is a
 * destination and the other two are interests, and the position says which.
 *
 * This exists because both other routes failed live. The model omits
 * place_named, and its destination_ids said "japan" for a Hokkaido trip.
 */
/**
 * "croatia or southern france" is two places, not one.
 *
 * The capture takes up to four words after a going-to cue, and nothing split
 * them, so the whole clause was filed as a single destination named "croatia
 * or southern france" and the half we actually hold was thrown away. The
 * regression test hid it by passing "..." as the sentence.
 */
const LIST_SEPARATOR = /\s+(?:or|and|vs\.?|versus)\s+/;

/**
 * A phrase that resolves, found by trimming from the right.
 *
 * "i want to go to iceland to see the northern lights" captures four words
 * after the cue: "iceland to see the". The trailing trimmer pops "the", then
 * stops dead at "see", which is not in its list. So the phrase stayed
 * "iceland to see", resolved to nothing, and was filed as somewhere we do not
 * cover, which cleared the model's perfectly correct "iceland" and sent her
 * to New Zealand.
 *
 * The distinction that matters: "hokkaido" is a real place we do not hold and
 * has to win. "iceland to see" is a mangled capture wrapped around a place we
 * DO hold. Trimming right-to-left separates them cleanly. Hokkaido has no
 * prefix that resolves, so it stays unknown and gets researched. Iceland has
 * one on the first trim.
 */
function resolvePrefix(phrase: string) {
  const words = phrase.split(/\s+/).filter(Boolean);
  for (let n = words.length; n > 0; n--) {
    const candidate = words.slice(0, n).join(" ");
    const hit = resolvePlaceName(candidate);
    if (hit) return { phrase: candidate, hit };
  }
  return { phrase, hit: undefined };
}


function destinationPhrases(said: string): string[] {
  const out: string[] = [];
  for (const m of said.toLowerCase().matchAll(GOING_TO)) {
    for (const part of m[1].split(LIST_SEPARATOR)) {
      const words = part.replace(/^the\s+/, "").split(/\s+/).filter(Boolean);
      // Cut at the first word that ends a name, rather than only popping from
      // the right. Popping stops at the first word it does not recognise,
      // which is how "see" survived in the middle of "iceland to see".
      const cut = words.findIndex((w) => ENDS_THE_NAME.test(w));
      const head = cut === -1 ? words : words.slice(0, cut);
      while (head.length && NOT_PART_OF_A_NAME.test(head[head.length - 1])) head.pop();
      const phrase = head.join(" ").trim();
      if (phrase && isPlaceName(phrase) && !out.includes(phrase)) out.push(phrase);
    }
  }
  return out.slice(0, 3);
}

function destinationPhrase(said: string): string | undefined {
  return destinationPhrases(said)[0];
}

function saidAsDestination(said: string, phrase: string): boolean {
  const want = phrase.toLowerCase().replace(/^the\s+/, "").trim();
  if (!want) return false;
  for (const m of said.toLowerCase().matchAll(GOING_TO)) {
    if (m[1].replace(/^the\s+/, "").includes(want)) return true;
  }
  return false;
}

function cityNamedIn(said: string): { destinationId: string; cityId: string } | undefined {
  const t = ` ${said.toLowerCase()} `;
  for (const c of CITIES) {
    const name = c.name.toLowerCase();
    if (name.length < 4) continue;
    const at = t.indexOf(name);
    if (at < 0) continue;
    // Whole word only, so "port" doesn't match inside "airport".
    if (/[a-z]/.test(t[at - 1] ?? " ") || /[a-z]/.test(t[at + name.length] ?? " ")) continue;
    // "flying from san francisco" is where she starts, not where she is going.
    if (/\bfrom\s+$/.test(t.slice(Math.max(0, at - 12), at))) continue;
    return { destinationId: c.destinationId, cityId: c.id };
  }
  return undefined;
}


/**
 * How close are two words, allowing for a typo?
 *
 * Damerau-Levenshtein, capped at `max` so it bails early. A transposition
 * counts as one edit rather than two, because "portgual" is one slip of the
 * fingers, not two.
 */
function editsWithin(a: string, b: string, max: number): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > max) return false;
  let prev2: number[] = [];
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      let v = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prev2[j - 2] + 1);
      }
      row[j] = v;
      if (v < best) best = v;
    }
    if (best > max) return false;
    prev2 = prev;
    prev = row;
  }
  return prev[b.length] <= max;
}

/**
 * Did she type this place, typo and all?
 *
 * "i wanna go see the northern lights in canad" is Canada. The model read it
 * as Canada, correctly, and the exact-substring test threw that reading away
 * because one letter was missing: the brief ended up with no destination at
 * all, the reply talked about Yellowknife anyway, and two turns later an
 * open-world suggestion sent her to Tromso. A whole country lost to a
 * keystroke.
 *
 * So the corroboration is fuzzy, but only in the ways a keyboard is:
 *
 * - The first three letters must match. That is what keeps "ireland" from
 *   corroborating a model that said "Iceland": one edit apart, but a
 *   different country, and substituting one for the other is the exact bug
 *   this guard exists to prevent.
 * - Exactly one edit, transpositions included, so "canad" is Canada and
 *   "portgual" is Portugal.
 * - One edit and no more. "niger" is two letters short of "nigeria" and is
 *   also a country in its own right; two edits is where a slip stops being a
 *   slip and starts being a different word.
 *
 * Anything looser and the guard stops guarding.
 */
function nearlySaid(said: string, hint: string): boolean {
  const want = fold(hint);
  // Exact first, at any length: "bali" and "peru" are corroborated the way
  // they always were, and only the near-misses reach the fuzzy path.
  if (fold(said).includes(want)) return true;
  if (want.length < 5) return false;
  // fold() squashes a whole sentence into one string, so tokenise the raw
  // text and fold word by word.
  const words = said.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/).filter(Boolean);
  const span = Math.min(hint.trim().split(/\s+/).length + 1, 4);
  for (let n = 1; n <= span; n++) {
    for (let i = 0; i + n <= words.length; i++) {
      const tok = words.slice(i, i + n).join("");
      if (tok.length < 4) continue;
      if (tok.slice(0, 3) !== want.slice(0, 3)) continue;
      if (editsWithin(tok, want, 1)) return true;
    }
  }
  return false;
}

/**
 * Does this message mention a place at all?
 *
 * Deliberately generous: a going-to phrase, anything in the shared alias
 * table, or any destination or city we hold, named anywhere in the sentence.
 * A false positive costs nothing (the model decides as usual); a false
 * negative would pin her in place while she was trying to move, so this errs
 * toward saying yes.
 */
function refersToAPlace(said: string, hints: string[] = []): boolean {
  const text = said.trim();
  if (!text) return false;
  /*
   * The model read a place out of this sentence and the sentence agrees.
   *
   * "thinking about roadtripping in australia" has no going-to cue and names
   * nowhere we hold, so every check below says no. But the model returned
   * "Australia", and "australia" is right there in what she typed. Her words
   * corroborating the model's reading is the strongest evidence there is.
   *
   * A hint she did NOT say proves nothing, which is the whole point: the
   * model answering "bali" to "make it five days" still fails this.
   */
  const folded = fold(text);
  if (hints.some((h) => h && fold(h).length > 2 && nearlySaid(text, h))) return true;
  if (destinationPhrases(text).length) return true;
  // A region is a place. "a roadtrip in europe" names nowhere we hold and
  // everywhere we hold, and deleting it here turned a continent into a blank.
  if (detectRegion(text)) return true;
  for (const [re] of NAMED_DESTINATIONS) {
    re.lastIndex = 0;
    if (re.test(text)) return true;
  }
  const words = ` ${fold(text)} `;
  const hit = (name: string) => {
    const f = fold(name);
    return f.length > 3 && words.includes(f);
  };
  if (DESTINATIONS.some((d) => hit(d.id) || hit(d.name))) return true;
  return CITIES.some((c) => hit(c.id) || hit(c.name));
}

function validatePatch(raw: Record<string, unknown> | null, said = ""): BriefPatch | null {
  if (!raw) return null;
  const p: BriefPatch = {};

  // --- where ---------------------------------------------------------------
  const ids = (Array.isArray(raw.destination_ids) ? raw.destination_ids : [])
    .filter((x): x is string => typeof x === "string" && knownDests().includes(x));
  const unique = [...new Set(ids)];
  if (unique.length === 1) {
    p.namedDestination = unique[0];
  } else if (unique.length > 1) {
    // A shortlist a person actually said out loud is a decision between a
    // couple of places. A region is a filter over many. Same field would give
    // both the same confidence, and "I'm torn between seven" is not an answer.
    if (unique.length <= 3) p.candidates = unique;
    else p.regionIds = unique;
  }
  const scope = str(raw.scope, 60);
  if (scope && unique.length > 1) p.regionLabel = scope;

  /*
   * The one place this conversation is about.
   *
   * Everything below used to work off a LIST of unknown places, which is how
   * "i want to go to lisbon for 4 days, food, viewpoints and tiles" ended up
   * researching a country called Viewpoints, failing, and pitching Mexico
   * City. The model had done nothing wrong: it resolved Lisbon and wrote a
   * good paragraph about it. The code then went looking somewhere else.
   *
   * So the model is now asked for one thing, the phrase she used for where she
   * wants to go, and that phrase is the subject for the rest of the trip:
   *
   *   - it matches a destination we hold        -> plan that
   *   - it matches a CITY inside one we hold    -> plan that destination
   *   - it matches nothing                      -> go and research it, and do
   *     not quietly widen it to the country around it. Hokkaido is not Japan
   *     and the Yucatan is not Mexico.
   *
   * Anything else in the same sentence is interest, not geography.
   */
  const subject = str(raw.place_named, 60);
  const subjectOk = subject && isPlaceName(subject) ? subject : undefined;

  // The model skipped it, so read her sentence instead. Two backstops, in
  // order: somewhere she named that we do NOT hold beats a catalogue match,
  // because Hokkaido is not Japan; then a city we DO hold, because Oaxaca is
  // the trip rather than a stop on a tour of Mexico.
  if (!subjectOk) {
    // What she said, before what the model made of it.
    const phrases = destinationPhrases(said);
    if (phrases.length) {
      /*
       * "southern france" is France. A compass word in front of a country
       * narrows it, it does not make it somewhere we've never heard of, and
       * treating it as unknown sent a France shortlist off to research a
       * place called Southern France.
       */
      const MODIFIER = /^(?:southern|northern|eastern|western|south|north|east|west|central|coastal|rural|upper|lower|the)\s+/i;
      const hits = phrases.map((phrase) => {
        const direct = resolvePlaceName(phrase);
        if (direct) return { phrase, hit: direct };
        if (MODIFIER.test(phrase)) {
          const bare = phrase.replace(MODIFIER, "");
          const hit = resolvePlaceName(bare);
          if (hit) return { phrase: bare, hit };
        }
        // Last resort before calling it somewhere we don't cover: does a
        // prefix of it resolve? Cheap insurance against a capture that ran on
        // past the name, which is the failure that cost her the Iceland trip.
        const trimmed = resolvePrefix(phrase);
        return trimmed.hit ? { phrase: trimmed.phrase, hit: trimmed.hit } : { phrase, hit: undefined };
      });
      const held = hits.filter((h) => h.hit);
      const unheld = hits.filter((h) => !h.hit);
      p.candidates = undefined;
      p.regionIds = undefined;
      if (held.length === 1 && unheld.length === 0) {
        p.namedDestination = held[0].hit!.destinationId;
        p.focusCityId = held[0].hit!.cityId;
      } else {
        /*
         * A shortlist, and both halves survive. Somewhere she named that we
         * do not hold is the subject (Hokkaido is not Japan), and somewhere
         * she named that we DO hold stays on the list rather than being
         * cleared along with it: "croatia or southern france" is a choice she
         * has not made yet, and dropping France makes it for her.
         */
        p.namedDestination = undefined;
        p.focusCityId = undefined;
        if (held.length) p.candidates = held.map((h) => h.hit!.destinationId);
        if (unheld.length) {
          p.unknownCandidates = unheld.map((h) => h.phrase);
        }
      }
    }
  }

  if (!subjectOk && !p.unknownCandidates?.length && p.focusCityId === undefined) {
    const listed = (Array.isArray(raw.unknown_places) ? raw.unknown_places : [])
      .map((x) => str(x, 40))
      .filter((x): x is string => !!x && isPlaceName(x) && saidAsDestination(said, x));
    const typed = cityNamedIn(said);
    if (listed.length) {
      p.namedDestination = undefined;
      p.candidates = undefined;
      p.regionIds = undefined;
      p.unknownCandidates = [listed[0]];
    } else if (typed) {
      p.namedDestination = typed.destinationId;
      p.focusCityId = typed.cityId;
      p.candidates = undefined;
      p.regionIds = undefined;
    }
  }

  if (subjectOk) {
    const hit = resolvePlaceName(subjectOk);
    if (hit) {
      p.namedDestination = hit.destinationId;
      p.focusCityId = hit.cityId;
      p.candidates = undefined;
      p.regionIds = undefined;
    } else {
      // Named somewhere we don't hold. It is the subject, not the country it
      // happens to sit in, so the catalogue match is discarded.
      p.namedDestination = undefined;
      p.candidates = undefined;
      p.regionIds = undefined;
      p.unknownCandidates = [subjectOk];
    }
  }

  const unknown = (Array.isArray(raw.unknown_places) ? raw.unknown_places : [])
    .map((x) => str(x, 40))
    .filter((x): x is string => !!x)
    .filter(isPlaceName)
    .slice(0, 3);
  // A subject settles it. Other nouns from the same breath are interests.
  if (subjectOk) {
    // nothing more to do: the subject already decided where.
  } else if (p.unknownCandidates?.length) {
    // Already decided by a backstop above.
  } else if (unknown.length) {
    // With nowhere resolved, a bare shortlist is still a shortlist, but
    // anything she only mentioned in passing is not one of the options.
    const real = unknown.filter((x) => saidAsDestination(said, x));
    /*
     * The fallback to the unfiltered list only applies when nothing else has
     * resolved. Once somewhere IS resolved, only a place she actually named as
     * somewhere to GO may displace it.
     *
     * "i want to go to lisbon for 4 days. food, viewpoints and tiles."
     * resolved Lisbon correctly, then threw it away here: "tiles" survived the
     * is-this-a-place filter, nothing in the list was said as a destination,
     * and the fallback took the whole list anyway. The trip still came out as
     * Portugal, so no test that asserted on the destination ever saw it. What
     * it actually produced was an agent about to go and research Tiles.
     *
     * "croatia or southern france" is the case this must not break: Croatia
     * IS said as a destination, so it stays a live half of the shortlist even
     * though France resolved.
     */
    const settled = !!(p.namedDestination || p.focusCityId);
    const keep = real.length ? real : (settled ? [] : unknown);
    if (keep.length) {
      p.unknownCandidates = keep;
    }
  } else if (scope && unique.length === 0 && isPlaceName(scope)) {
    // The model named somewhere, mapped it to nothing we hold, and didn't
    // list it as unknown. "Roadtripping in Australia" came back with an empty
    // destination_ids, an empty unknown_places, and Australia sitting in scope
    // where nothing read it — so the place she named vanished and the agent
    // offered her the Olympic Peninsula. Scope is the backstop: anywhere named
    // that maps to nothing is a place to go and research.
    p.unknownCandidates = [scope];
  }
  // Somewhere they have been is a ban, and it has to be subtracted from the
  // places they were read as asking for. Otherwise "I've been to Zion" lands
  // as a request for Zion and the agent recommends it back to them.
  /*
   * A destination only changes when her message actually refers to a place.
   *
   * The last rule in the ladder, and the one that closes the case she hit:
   * she was looking at a Utah pitch, said "i wanna go abroad", and the app
   * was free to hand back any destination the model happened to name in that
   * turn. Same for "make it five days", "sounds good", "what's the food
   * like" — messages about length, agreement and dinner were all allowed to
   * move the trip to another country.
   *
   * This is not the regex overruling the model about WHICH place. The model
   * still owns that entirely, whenever she referred to one. It is a floor: a
   * turn that names nowhere cannot relocate her. Interpretation is the
   * model's job; inventing a subject she never raised is not.
   */
  /*
   * She named one place we hold, the model named a different one, and hers
   * is nowhere in the sentence. Hers wins.
   *
   * "i'm thinking japan" has no going-to cue, so the phrase backstop above
   * never looks at it, and the model's answer stood unopposed. Kept narrow
   * on purpose: exactly one place in her text, exactly one from the model,
   * and the model's not mentioned by her. A shortlist, a comparison, or any
   * sentence naming two places falls straight through to the model, which is
   * where that judgement belongs.
   */
  if (p.namedDestination && !p.focusCityId) {
    const hers = destinationIdsNamedIn(said);
    if (hers.length === 1 && hers[0] !== p.namedDestination
        && !destinationIdsNamedIn(said).includes(p.namedDestination)) {
      p.namedDestination = hers[0];
      p.candidates = undefined;
      p.regionIds = undefined;
    }
  }

  const modelSaid = [
    typeof raw.place_named === "string" ? raw.place_named : "",
    typeof raw.scope === "string" ? raw.scope : "",
    ...(Array.isArray(raw.unknown_places) ? raw.unknown_places : [])
      .filter((x): x is string => typeof x === "string"),
  ];
  if (!refersToAPlace(said, modelSaid)) {
    for (const k of ["namedDestination", "focusCityId", "candidates", "regionIds",
                     "unknownCandidates", "region", "regionLabel"] as const) {
      delete p[k];
    }
  }

  const been = (Array.isArray(raw.been_to) ? raw.been_to : [])
    .map((x) => str(x, 40))
    .filter((x): x is string => !!x && isPlaceName(x))
    .slice(0, 8);
  if (been.length) {
    p.visitedNames = been;
    const ids = been.flatMap((name) => destinationIdsNamedIn(name));
    if (ids.length) {
      p.visitedIds = [...new Set(ids)];
      const drop = new Set(p.visitedIds);
      if (p.namedDestination && drop.has(p.namedDestination)) p.namedDestination = undefined;
      if (p.candidates) {
        p.candidates = p.candidates.filter((id) => !drop.has(id));
        if (p.candidates.length === 0) p.candidates = undefined;
      }
      if (p.regionIds) p.regionIds = p.regionIds.filter((id) => !drop.has(id));
    }
  }

  /*
   * What she wants to do, kept whole.
   *
   * This read one `interest_echo` string. A list is what lets the sufficiency
   * check ask "is surfing served?" about one entry rather than grepping a
   * paragraph, and it means a second interest in the same message does not
   * have to be crammed into the same sentence to survive.
   *
   * interest_echo is still accepted, because an older client or a model that
   * has seen the old schema will send it, and dropping it would lose her words
   * for the sake of a field rename.
   */
  /*
   * Places she has ruled out.
   *
   * avoidPlaces was added and wired through the rules parser, the research
   * prompt and the planner, and never given a slot in THIS schema, which is
   * the primary driver. So on the path almost every real conversation takes,
   * "turkey but not istanbul" still dropped the exclusion on the floor: the
   * exact bug the field exists to fix, reported as fixed.
   */
  const noGo = (Array.isArray(raw.avoid_places) ? raw.avoid_places : [])
    .map((x: unknown) => str(x, 60))
    .filter((x): x is string => !!x);
  if (noGo.length) p.avoidPlaces = [...new Set(noGo)];

  /*
   * A whole part of the world, and a climate, are refusals too.
   *
   * Whatever the model calls the region, it is matched through the same
   * detector the rules parser uses, so "SE Asia", "south-east asia" and
   * "Southeast Asia" are one answer. Anything it names that is not a region
   * we know is dropped rather than guessed at.
   */
  const noRegion = (Array.isArray(raw.avoid_regions) ? raw.avoid_regions : [])
    .map((x: unknown) => detectRegion(str(x, 60) ?? "")?.id)
    .filter((x): x is string => !!x);
  if (noRegion.length) p.avoidRegions = [...new Set(noRegion)];

  const crowdRaw = raw.crowds as { min?: unknown; max?: unknown } | undefined;
  if (crowdRaw && typeof crowdRaw === "object") {
    const scale = (v: unknown) => {
      const n = Math.round(Number(v));
      return Number.isFinite(n) && n >= 1 && n <= 5 ? n : undefined;
    };
    const band = { min: scale(crowdRaw.min), max: scale(crowdRaw.max) };
    if (band.min !== undefined || band.max !== undefined) p.crowds = band;
  }

  const noClimate = (Array.isArray(raw.avoid_climate) ? raw.avoid_climate : [])
    .map((x: unknown) => str(x, 20)?.toLowerCase())
    .filter((x): x is "hot" | "cold" | "humid" => x === "hot" || x === "cold" || x === "humid");
  if (noClimate.length) p.avoidClimate = [...new Set(noClimate)];

  const acts = (Array.isArray(raw.activities) ? raw.activities : [])
    .map((x: unknown) => str(x, 200))
    .filter((x): x is string => !!x);
  const echo = str(raw.interest_echo, 400);
  if (echo) acts.push(...echo.split(/\s*;\s*/).map((x) => x.trim()).filter(Boolean));
  if (acts.length) p.activities = [...new Set(acts)];

  // --- when ----------------------------------------------------------------
  // Dates come from the model; the arithmetic on them does not. A length it
  // worked out in its head is exactly the kind of thing to recompute.
  const startDate = isoDate(raw.start_date);
  const endDate = isoDate(raw.end_date);
  if (startDate && endDate) {
    const span = Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86_400_000);
    if (span >= 1 && span <= 60) {
      p.dates = { start: startDate, end: endDate };
      p.days = Math.min(21, Math.max(2, span));
      const mn = monthName(startDate);
      if (mn) p.month = mn;
    }
  }
  /*
   * A month, or a departure with no return, still tells us when.
   *
   * This branch needed BOTH dates, so "8 days, flying out on october 12" and
   * "9 days in march" left `month` unset and the planner fell back to its
   * default of 45 days out — printing real weekdays for the wrong season. The
   * rules driver has the same fix; both doors have to behave the same or the
   * bug is only fixed for whoever is not paying for a model.
   */
  if (!p.dates && startDate) {
    const mn = monthName(startDate);
    if (mn) p.month = mn;
    const n = p.days ?? int(raw.days, 2, 30);
    if (n) p.dates = { start: startDate, end: addDays(startDate, n - 1) };
  }
  if (!p.month) {
    const m = str(raw.month, 20);
    const mn = m && bareMonth(m);
    if (mn) p.month = mn;
  }
  if (p.days === undefined) {
    const days = int(raw.days, 2, 30);
    if (days) p.days = days;
  }
  if (raw.flexible_duration === true && p.days === undefined) p.flexibleDuration = true;

  // --- money ---------------------------------------------------------------
  const budget = int(raw.budget_usd, 100, 100000);
  if (budget) p.budgetUsd = budget;
  const phrase = str(raw.budget_phrase, 60);
  if (budget && phrase) p.budgetInferred = phrase.toLowerCase();
  if (raw.flexible_budget === true && !budget) p.flexibleBudget = true;

  // --- what ----------------------------------------------------------------
  if (Array.isArray(raw.vibes)) {
    const v = raw.vibes.filter((x): x is Vibe => typeof x === "string" && VALID_VIBES.has(x));
    if (v.length) p.vibes = [...new Set(v)];
  }
  if (Array.isArray(raw.not_vibes)) {
    const v = raw.not_vibes.filter((x): x is Vibe => typeof x === "string" && VALID_VIBES.has(x));
    if (v.length) {
      p.removeVibes = [...new Set(v)];
      // A vibe can't be both wanted and not wanted in the same message.
      if (p.vibes) p.vibes = p.vibes.filter((x) => !p.removeVibes!.includes(x));
    }
  }
  if (Array.isArray(raw.avoid_tags)) {
    const t = raw.avoid_tags.filter((x): x is Tag => typeof x === "string" && VALID_TAGS.has(x as Tag));
    if (t.length) p.avoidTags = [...new Set(t)];
  }
  if (raw.surprise_me === true) p.surpriseMe = true;
  const c = str(raw.constraint);
  if (c) p.constraints = [c];

  // --- shape and climate ---------------------------------------------------
  if (raw.road_trip === true) p.roadTrip = true;
  /*
   * A dated event the trip hangs on.
   *
   * Only taken when the model gives a real, future, plausible date. It is
   * told to leave this empty rather than guess, because an invented date
   * silently misplaces the entire itinerary and nothing downstream can tell.
   */
  {
    const ev = str(raw.anchor_event, 80);
    const at = str(raw.anchor_date, 10);
    if (ev) p.anchorEvent = ev;
    if (at && /^\d{4}-\d{2}-\d{2}$/.test(at)) {
      const when = Date.parse(`${at}T12:00:00Z`);
      const now = Date.now();
      // Future, and inside a window someone could actually plan for.
      if (!Number.isNaN(when) && when > now && when < now + 5 * 365 * 24 * 3600 * 1000) {
        p.anchorDate = at;
      }
    }
  }
  if (raw.wants_international === true) p.wantsInternational = true;
  if (raw.wants_warm === true) p.wantsWarm = true;
  if (raw.wants_far === true) p.wantsFar = true;
  if (raw.wants_near === true) p.wantsNear = true;
  const from = str(raw.origin_city, 40);
  if (from) {
    const o = originByName(from);
    if (o) p.origin = o;
  }

  return p;
}

/** yyyy-mm-dd, and a real date. "2026-02-31" parses and is not a day. */
function isoDate(v: unknown): string | undefined {
  const t = typeof v === "string" ? v.trim().slice(0, 10) : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return undefined;
  const d = new Date(t + "T12:00:00Z");
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10) === t ? t : undefined;
}

/**
 * Read live, never frozen. This was a hardcoded set of six ids from when the
 * catalogue had six destinations. It has fifteen. So the tool enum offered the
 * model six choices and the validator discarded any answer naming one of the
 * other nine: with a live model, Italy, France, Iceland, Korea, Utah, the
 * Olympic Peninsula, Big Sur, New Zealand and Bali were unreachable by name.
 * Reading DESTINATIONS also means a researched destination is nameable the
 * moment it registers.
 */
const knownDests = () => DESTINATIONS.map((d) => d.id);

const OP_KINDS = new Set([
  "remove_tag", "reduce_pace", "increase_pace", "more_tag",
  "less_touristy", "add_downtime", "extend_stay", "set_budget", "unknown",
]);

function validateOps(raw: Record<string, unknown> | null, trip: Trip): EditOp[] | null {
  if (!raw || !Array.isArray(raw.operations)) return null;
  const out: EditOp[] = [];
  const cityIds = new Set(trip.concept.shape.map((l) => l.cityId));
  for (const o of raw.operations) {
    if (!o || typeof o !== "object") continue;
    const r = o as Record<string, unknown>;
    const kind = str(r.kind);
    if (!kind || !OP_KINDS.has(kind)) continue;
    const day = int(r.day, 1, trip.days.length);
    switch (kind) {
      case "remove_tag":
      case "more_tag": {
        const tag = str(r.tag) as Tag | undefined;
        if (!tag || !VALID_TAGS.has(tag)) continue;
        out.push(kind === "remove_tag"
          ? { kind: "remove_tag", tag, day }
          : { kind: "more_tag", tag, day, count: int(r.count, 1, 4) });
        break;
      }
      case "reduce_pace": out.push({ kind: "reduce_pace", day }); break;
      case "increase_pace": out.push({ kind: "increase_pace", day }); break;
      case "less_touristy": out.push({ kind: "less_touristy" }); break;
      case "add_downtime": out.push({ kind: "add_downtime", day }); break;
      case "extend_stay": {
        const cityId = str(r.city_id);
        const nights = int(r.nights, 1, 5);
        if (!cityId || !cityIds.has(cityId) || !nights) continue;
        out.push({ kind: "extend_stay", cityId, nights });
        break;
      }
      case "set_budget": {
        const usd = int(r.usd, 100, 100000);
        if (!usd) continue;
        out.push({ kind: "set_budget", usd });
        break;
      }
      case "unknown": out.push({ kind: "unknown", text: str(r.text) ?? "" }); break;
    }
  }
  return out;
}

const BANNED = /hidden gem|vibrant|nestled|bustling|must-see|must see|gateway to|something for everyone|immerse yourself|picturesque|charming|stunning|breathtaking|feast for the senses|start your day/i;

/** Section 12 is a hard requirement, so it's enforced at the boundary too. */
function cleanProse(s: string | undefined, maxLen = 900): string | null {
  if (!s) return null;
  const t = s.trim();
  if (!t || t.length > maxLen) return null;
  if (BANNED.test(t)) return null;
  return t;
}

// --- driver ----------------------------------------------------------------

/**
 * Everything the model is told about the traveller so far.
 *
 * This had eight fields while the brief had twenty. Places she'd named, why
 * she wanted them, her dates, where she was flying from and whether she was
 * driving were all invisible to the model that was supposed to be having the
 * conversation, so it could not react to any of them. Every field added to the
 * brief has to arrive here too.
 */
/**
 * "You said X" where X is one of our own tags.
 *
 * The seven vibes are picked by a model off a fixed list to drive scoring.
 * Quoted back at her they are a fabricated quote, in the one line whose job
 * is to prove the app listened. Only the taxonomy words are checked: a
 * paraphrase of something she genuinely said is fine, and policing all
 * attribution by string match would reject honest pitches all day.
 *
 * Returns the offending word, or undefined when the attribution is honest.
 */
export function fabricatedAttribution(text: string, b: Brief): string | undefined {
  // Everything she entered, not just her first message. This read `opening`
  // alone, so a word she typed on turn three was treated as fabricated when
  // the pitch quoted it back correctly.
  /*
   * Typed only. A chip label is ours, not hers.
   *
   * Widening this to all of `stated` fixed a false positive (a real quote of
   * something she typed on turn three was flagged as invented) and opened a
   * false negative that is the exact thing this function exists to catch:
   * clicking the "Adventure" vibe chip put the word "Adventure" into `stated`,
   * so "You said adventure" passed. The chips are the taxonomy. That is the
   * bug, not a quote of it.
   */
  /*
   * `activities` is not automatically hers, and `constraints` is the opposite
   * of hers.
   *
   * The list is also filled by the model and by freeform chips the model
   * writes, so trusting it whole let a paraphrase authorise "you said X".
   * `constraints` is worse: it holds her NEGATED clauses, so "no adventure
   * sports" counted as evidence that she had asked for adventure.
   */
  const hers = [
    b.opening ?? "", ...quotable(b),
    ...(b.stated ?? []).filter((x) => x.how === "typed").map((x) => x.text),
  ].join(" ").toLowerCase();
  for (const m of text.matchAll(/you (?:said|told me|mentioned|wanted)\b([^.!?]*)/gi)) {
    const clause = (m[1] ?? "").toLowerCase();
    for (const v of ALL_VIBES) {
      if (new RegExp(`\\b${v}\\b`).test(clause) && !new RegExp(`\\b${v}`).test(hers)) return v;
    }
  }
  return undefined;
}

const briefSummary = (b: Brief) => JSON.stringify({
  opening: b.opening,
  days: b.days ?? null,
  dates: b.dates ?? null,
  built_around: b.anchorEvent ? { event: b.anchorEvent, date: b.anchorDate ?? null } : null,
  month: b.month ?? null,
  flexible_duration: b.flexibleDuration ?? false,
  // Named to make the provenance unmissable. As `vibes` the model read these
  // as things she had told it, and pitched New Zealand with "You said nature,
  // adventure and relaxation" to someone who had said "i wanna hike a national
  // park". They are tags we picked off a fixed list.
  vibes_our_internal_tags_never_quote: b.vibes,
  budget_usd: b.budgetUsd ?? null,
  flexible_budget: b.flexibleBudget ?? false,
  constraints: b.constraints,
  avoid_tags: b.avoidTags,
  places_they_ruled_out_never_send_them_here: b.avoidPlaces ?? null,
  /*
   * And the two refusals that are not places.
   *
   * "region" below is somewhere she WANTS, and for one message these two were
   * the same field: "Don't want south east asia" set it to Southeast Asia and
   * the answer was Bali. The model was never shown a way to say no to a part
   * of the world or to a climate, so on this path it could not have honoured
   * one either.
   */
  regions_they_ruled_out_never_send_them_here: b.avoidRegions ?? null,
  climates_they_ruled_out_never_send_them_here: b.avoidClimate ?? null,
  how_busy_they_want_it_1_to_5: b.crowds ?? null,
  named_destination: b.namedDestination ?? null,
  shortlist: b.candidates ?? null,
  region: b.regionLabel ?? null,
  places_to_look_up: b.unknownCandidates ?? null,
  already_been_never_suggest: b.visitedNames ?? b.visitedIds ?? null,
  /*
   * Only the entries whose every word she typed. The model is asked for "their
   * own words" and cannot be held to it, so the same list that authorises an
   * attribution offline is the one it is shown here — otherwise the gate
   * exists on the free path and nowhere else.
   */
  their_own_words_safe_to_quote: quotable(b),
  everything_they_asked_for_including_our_paraphrases_never_quote: b.activities ?? null,
  // The model was given her first message and nothing else, then told "if you
  // write 'you said', what follows has to be something they typed". Everything
  // after turn one was invisible to it.
  // Labelled, because a chip is our sentence and she only clicked it. Stripping
  // `how` here handed the model the provenance flag's own counter-example.
  everything_they_have_said: (b.stated ?? [])
    .map((x) => (x.how === "typed" ? x.text : `[a chip we wrote, she clicked it] ${x.text}`)),
  road_trip: b.roadTrip ?? false,
  must_leave_the_country: b.wantsInternational ?? false,
  flying_from: b.origin?.label ?? null,
  wants_warm: b.wantsWarm ?? false,
  wants_far: b.wantsFar ?? false,
  wants_near: b.wantsNear ?? false,
  surprise_me: b.surpriseMe ?? false,
});

/**
 * Silent fallback is correct for a live app and catastrophic for measurement.
 * With the API unreachable, every call fell through to the rules driver and the
 * eval printed "driver: llm — 95%" while making zero successful model calls.
 * Anything that reports a score has to be able to see that.
 */
export interface DriverStats {
  attempts: number;
  fallbacks: number;
  lastError?: string;
}

export function createLlmDriver(
  transport: Transport,
  stats: DriverStats = { attempts: 0, fallbacks: 0 },
): AgentDriver & { stats: DriverStats; usage: () => Usage } {
  const fallback = rulesDriver;
  /**
   * Record that rules answered this call instead of the model, and WHY.
   *
   * Every bare fell() reported itself to the traveller as "model failed —
   * unknown error", which is both useless and, half the time, untrue. A
   * string is a perfectly good reason; only a thrown Error needs unwrapping.
   */
  const fell = (e?: unknown) => {
    stats.fallbacks++;
    if (typeof e === "string") stats.lastError = e;
    else if (e) stats.lastError = (e as Error).message?.split("\n")[0] ?? String(e);
  };

  return {
    name: "llm",

    stats,

    /** What this driver's calls actually cost, in tokens. */
    usage: () => transport.usage?.() ?? emptyUsage(),

    async interpret(input, brief) {
      stats.attempts++;
      try {
        const raw = await transport.call({
          system: `${VOICE}\n\n${INTERPRET_RULES}\n\nThe destinations you can plan today:\n${catalogue()}`,
          user: `Known so far:\n${briefSummary(brief)}\n\nToday is ${new Date().toISOString().slice(0, 10)}.\n\nThey just said:\n"""${input}"""`,
          tool: {
            name: "record_brief",
            description: "Record what this message tells you about the trip.",
            input_schema: {
              type: "object" as const,
              properties: {
                // --- where -------------------------------------------------
                destination_ids: {
                  type: "array",
                  items: { type: "string", enum: knownDests() },
                  description: "Catalogue destinations consistent with what they just said. One id if they named a place you cover. SEVERAL if they named a region or a shortlist — every European destination for 'a roadtrip in Europe', both for 'Croatia or southern France'. Empty if they said nothing about where.",
                },
                scope: {
                  type: "string",
                  description: "What they said about where, in their words: 'Europe', 'Croatia or southern France', 'Patagonia'. Omit if they said nothing about where.",
                },
                place_named: {
                  type: "string",
                  description: "The ONE place they want to go, in their own words, exactly as they said it: 'lisbon', 'hokkaido', 'the yucatan', 'indian wells'. Geography only. Things they want to DO are never places: 'viewpoints', 'tiles', 'food', 'nightlife', 'hiking' all belong in interest_echo. Omit when they have named nowhere, or when they are still choosing between several.",
                },
                been_to: {
          type: "array" as const,
          items: { type: "string" as const },
          description:
            "Places they say they have ALREADY BEEN or already done, in their own words. "
            + "'I've been to Zion and the Grand Canyon' is two entries. These are bans, not "
            + "requests: never list somewhere here that they want to go, and never list "
            + "somewhere in destination_ids that appears here.",
        },
        unknown_places: {
                  type: "array",
                  items: { type: "string" },
                  description: "Only for a SHORTLIST they are choosing between, none of which are in the catalogue: 'Croatia or Slovenia'. When they have settled on one place, put it in place_named and leave this empty. Never put an interest here.",
                },
                activities: {
                  type: "array",
                  items: { type: "string" },
                  description: "What they want to DO, in their own words, one entry per thing: ['surfing'], ['hike a national park', 'see the northern lights'], ['eat well', 'nothing touristy']. Copy their phrasing; do not translate it into a category. This is an open list, so anything they name belongs here even when no vibe fits it: surfing, via ferrata, birding, a specific match, a fandom, a memory. The vibes above are OUR coarse tags and lose all of that, so if you only fill vibes the thing they asked for stops existing.",
                },
                // --- when --------------------------------------------------
                days: { type: "number", description: "Nights on the ground, if stated or derivable from dates" },
                start_date: { type: "string", description: "yyyy-mm-dd. Resolve '10/12' against today's date; if no year is given pick the next time that date occurs." },
                anchor_event: { type: "string", description: "A dated event the trip is built AROUND, if they named one: an eclipse, a festival, a marathon, a wedding, a migration. Not a season and not a month." },
                anchor_date: { type: "string", description: "yyyy-mm-dd, the real calendar date of that event. Fill this ONLY if you actually know the date. If you are not sure, give anchor_event and leave this empty rather than guessing: a trip built on an invented date is worse than one that asks." },
                end_date: { type: "string", description: "yyyy-mm-dd" },
                month: { type: "string", description: "The month they named with no day attached: 'march', 'in august'. Fill this whenever they say WHEN without giving dates — it decides the season the trip is planned for. Leave empty if they gave real dates." },
                flexible_duration: { type: "boolean" },
                // --- money -------------------------------------------------
                budget_usd: { type: "number", description: "Total per person. Read phrases too: 'without breaking the bank', 'money no object'." },
                budget_phrase: { type: "string", description: "The phrase you read a budget from, if it wasn't a number." },
                flexible_budget: { type: "boolean" },
                // --- what --------------------------------------------------
                vibes: { type: "array", items: { type: "string", enum: ALL_VIBES }, description: "What they want from the trip." },
                not_vibes: {
                  type: "array",
                  items: { type: "string", enum: ALL_VIBES },
                  description: "Vibes to REMOVE. Both refusal ('not a city trip') and indifference ('food, I don't care') belong here. Indifference is not aversion, so do not also put it in avoid_tags.",
                },
                avoid_tags: { type: "array", items: { type: "string" }, description: "Specific things they don't want." },
                avoid_places: {
                  type: "array",
                  items: { type: "string" },
                  description: "PLACES they have ruled out, in their words: 'i wanna go to turkey but not istanbul' -> ['istanbul']. A place, not a thing: 'not museums' is an avoid_tag, not this. Never put the place they DO want here.",
                },
                avoid_regions: {
                  type: "array",
                  items: { type: "string" },
                  description: "Whole PARTS OF THE WORLD they ruled out: 'don't want south east asia' -> ['southeast asia']. Name the region however they said it. This is the opposite of a region they want: never put a region they DO want here, and never leave a refused one out because it also appears in the sentence they liked.",
                },
                avoid_climate: {
                  type: "array",
                  items: { type: "string", enum: ["hot", "cold", "humid"] },
                  description: "Climates they ruled out. 'anywhere too hot or cold or humid' is all three: one 'too' governs the whole list. 'tropical', 'muggy', 'sticky' are humid; 'freezing', 'snowy' are cold. Asking FOR warmth is wants_warm, not this.",
                },
                crowds: {
                  type: "object",
                  description: "How busy they want it, on the same 1-5 scale places use (1 nobody has heard of it, 5 coach park). A BAND, not a direction: 'some retail going on and still some people around, just not overwhelmingly' is {min: 2, max: 3}. Set only the end they gave. Leave it out entirely if they said nothing about how busy anywhere is.",
                  properties: {
                    min: { type: "number", description: "They want at least this much life. 'not dead', 'some people around'." },
                    max: { type: "number", description: "They want at most this much. 'not overwhelming', 'nothing too touristy'." },
                  },
                },
                constraint: { type: "string", description: "Verbatim thing they don't want, if any" },
                surprise_me: { type: "boolean", description: "They declined to state a preference and asked you to choose" },
                // --- shape and climate -------------------------------------
                road_trip: { type: "boolean", description: "They want to drive it." },
                wants_international: { type: "boolean", description: "They asked to leave their own country: 'abroad', 'overseas', 'somewhere outside the US'. A hard constraint, not a preference." },
                wants_warm: { type: "boolean", description: "They asked for sun, heat or a beach. A climate request." },
                wants_far: { type: "boolean", description: "They want somewhere genuinely unlike home." },
                wants_near: { type: "boolean", description: "They said the last suggestion was too far." },
                origin_city: { type: "string", description: "Where they're flying FROM, if they said. Expand airport codes: 'sfo' is San Francisco. If they are ALREADY going somewhere and this trip hangs off that one — extending a work trip, tacking days onto a wedding, a stopover — the departure point is that place, not home: 'i'm going to London for work and want to extend' departs from London." },
              },
            },
          },
          maxTokens: 1200,
        });
        const patch = validatePatch(raw, input);
        // The rules parser stays underneath as insurance for a dropped call or
        // an offline build. When the model answers, the model wins.
        const base = await fallback.interpret(input, brief);
        if (!patch) {
          fell("the model recorded nothing usable about the trip");
          return base;
        }
        /*
         * What the rules parser is allowed to contribute, and nothing else.
         *
         * This used to be the other way round: everything merged beneath the
         * model, with a named list of fields where the model won. A denylist,
         * and it failed exactly the way denylists fail. I forgot
         * `unknownAcknowledged`, so the rules parser's "already dealt with"
         * flag survived under the model's answer, switched the research off,
         * and "i want to go to hokkaido" was pitched Portugal.
         *
         * Inverted, the default is safe. The rules parser reads literal
         * tokens: how many days, how much money, what dates, where from.
         * A regex is the right tool for those and cannot be wrong about them
         * in an interesting way. Everything else in a message is judgment —
         * what is a place, which Japan she means, whether "driving" is a
         * country — and judgment is the model's job. If I add a field and
         * forget it here, the rules parser contributes nothing, which is the
         * direction this should fail in.
         */
        const RULES_MAY_SET = [
          "days", "flexibleDuration", "dates", "month",
          "budgetUsd", "flexibleBudget", "budgetInferred",
          "origin",
          // "abroad" / "overseas" / "not in the US" is a literal phrase, not a
          // judgement, so the regex layer is the right place to read it and
          // it belongs on this list.
          "wantsInternational",
        ] as const;

        const merged: BriefPatch = { ...patch };
        for (const k of RULES_MAY_SET) {
          if (merged[k] === undefined && base[k] !== undefined) {
            (merged as Record<string, unknown>)[k] = base[k];
          }
        }
        return merged;
      } catch (e) {
        fell(e);
        return fallback.interpret(input, brief);
      }
    },

    async nextQuestion(brief, history = [], phase = "discovery"): Promise<Question | null> {
      const structural = await fallback.nextQuestion(brief, history, phase);

      // Logistics is two known fields with fixed chips. Rewording buys nothing
      // and risks the parse.
      if (phase === "logistics") return structural;

      // Discovery is the conversation. The rules layer keeps only a floor and
      // a ceiling; inside those the model decides whether to ask again and
      // what to say. The old slot check ended discovery the moment a place was
      // named, so "Croatia or southern France" got a pitch and no questions.
      const asked = history.filter((t) => t.from === "agent" && t.text.includes("?")).length;
      const gate = discoveryGate(brief, asked);
      if (gate === "stop") return null;
      // Below the floor the conversation must not end, so there has to be
      // something to fall back to. The slot check returns null once a place is
      // named, which is exactly the case the floor exists for.
      const floor = structural ?? floorQuestion(brief);

      stats.attempts++;
      try {
        const named = [...(brief.candidates ?? []), ...(brief.unknownCandidates ?? [])];
        const raw = await transport.call({
          system: `${VOICE}\n\n${DISCOVERY_RULES}`,
          user: [
            history.length ? `The conversation so far:\n${transcript(history)}` : "",
            ``,
            `What you already know: ${briefSummary(brief)}`,
            named.length ? `They named: ${named.join(", ")}. React to these specifically before you ask anything.` : "",
            (brief.unknownCandidates?.length ?? 0) > 0 && brief.days === undefined
              ? `You will be looking ${brief.unknownCandidates!.join(" and ")} up properly before you plan it, and how long they have changes that completely. Say the idea is a good one, ask how long they've got, and tell them you can take it from there.`
              : "",
            brief.month ? `They're travelling in ${brief.month}, so say something true about that time of year there.` : "",
            ``,
            `Questions asked so far: ${asked}.`,
            gate === "must"
              ? `You do NOT have enough yet — you may know where, but not what they're after. You must ask. Do not set done.`
              : `You may ask again or stop. Set done only if another question would change nothing.`,
            asked >= 3 ? `This is your last question. Make it the one that most changes your answer.` : ``,
          ].filter(Boolean).join("\n"),
          tool: {
            name: "ask",
            description: "Either the next thing you want to know, or that you have enough.",
            input_schema: {
              type: "object" as const,
              properties: {
                done: {
                  type: "boolean",
                  description: "True when you could make a confident recommendation and another question would only be politeness.",
                },
                prompt: {
                  type: "string",
                  description: "What you say. React to what they told you, then ask one thing, ending in a question mark. Two or three sentences at most. REQUIRED whenever done is false; there is no third option.",
                },
                options: {
                  type: "array",
                  description: "0-4 short answers in their own words. Omit when the question is genuinely open.",
                  items: { type: "string" },
                },
              },
              /*
               * Both fields, always.
               *
               * Nothing was required here to begin with, so an empty object
               * was a valid answer and the model returned one often enough to
               * be the single largest source of "model failed — rules" in the
               * app. Requiring `done` alone wasn't enough either: it then
               * answered done:false with no question attached, which is the
               * same dead end wearing a different hat. A JSON schema cannot
               * say "prompt is required only when done is false", so ask for
               * both every time and let `done` decide which one is used. The
               * occasional discarded sentence is a much better trade than a
               * turn with nothing in it.
               */
              required: ["done", "prompt"],
            },
          },
          maxTokens: 500,
        });

        // The floor is not the model's to override.
        if (raw?.done === true && gate !== "must") return null;

        const prompt = cleanProse(str(raw?.prompt), 400);
        if (!prompt || !/\?/.test(prompt)) {
          // The model saying "I have enough to recommend" while the floor says
          // one more question is required is a DISAGREEMENT, not a failure.
          // The floor wins, because it exists to stop the agent pitching
          // blind, but nothing failed and saying so put "model failed — rules"
          // on the screen for a call that worked perfectly. That badge is the
          // one thing in this app that has to be believable.
          if (raw?.done === true) return floor;
          /*
           * At the floor we tell it "you must ask, do not set done", and it
           * answers done:false with no question: it has nothing it wants to
           * ask and we forbade it the honest way of saying so. Required fields
           * don't help, because this isn't a malformed answer, it's a refusal.
           *
           * That is still a disagreement the floor wins, and it was showing up
           * as "model failed — rules" on calls where the model was working
           * perfectly. Above the floor the model is free to stop, so nothing
           * back is a genuine failure there and still counts as one.
           */
          /*
           * No question and no `done` means it has nothing it wants to ask.
           *
           * That is an answer, not a failure, and required fields don't force
           * the issue because the model is declining rather than malforming.
           * Counting it put "model failed — rules" on twelve of fifteen trips
           * in the sweep, every one of them with the model working perfectly.
           * A badge nobody believes is worse than no badge.
           */
          if (!prompt) return gate === "must" ? floor : structural;
          fell("the model wrote a question with no question in it");
          return gate === "must" ? floor : structural;
        }
        const options = (Array.isArray(raw?.options) ? raw.options : [])
          .map((o) => cleanProse(str(o), 40))
          .filter((o): o is string => !!o)
          .slice(0, 4);
        return {
          id: "open",
          prompt,
          kind: "single",
          // The chips are things a person would say, so an answer goes back
          // through interpret exactly as if it had been typed.
          freeform: true,
          options: options.map((label) => ({ value: label, label })),
        };
      } catch (e) {
        fell(e);
        return gate === "must" ? floor : structural;
      }
    },

    async pitch(rec: Recommendation, brief: Brief, place) {
      const d = place?.destination ?? destinationById(rec.destinationId);
      const tie = tiebreakPrompt(rec);
      stats.attempts++;
      try {
        const raw = await transport.call({
          system: VOICE,
          user: [
            `Traveller: ${briefSummary(brief)}`,
            `You have chosen: ${d.name}.`,
            `Your own notes on it: ${d.pitch}`,
            `Supporting reasons available: ${JSON.stringify(d.because)}`,
            `Confidence: ${rec.confidence}.`,
            // Told to argue the substitute as "the closest thing to what they
            // were actually after", the model did exactly that: someone asked
            // for three days at the Indian Wells tennis tournament, got the Big
            // Sur coast, and was told it "delivers that same math, just with
            // better scenery than a stadium concourse". Sometimes there is no
            // closest thing. A trip built around one specific event has no
            // substitute, and pretending otherwise is the bait-and-switch this
            // whole product exists not to be.
            unknownHead(brief)
              ? [
                  `They asked for ${unknownHead(brief)}. You could not work it up, you have already told them so plainly, and they know this is somewhere else.`,
                  `Pitch ${d.name} on its own merits, for the kind of trip they described. Do NOT claim it gives them what they wanted at ${unknownHead(brief)}, do not compare the two, and do not talk about data or coverage.`,
                  `If what they wanted was tied to that place specifically, a fixture, an event, one particular thing, then say in the body that this is a different trip rather than a replacement for that one.`,
                ].join(" ")
              : "",
            tie ? `You are genuinely torn. The runner-up case: ${tie}` : "",
            ``,
            `Write the recommendation. Headline is one sentence stating the decision.`,
            `Body is two to four sentences saying why, answering what they actually asked for.`,
            `If you attribute anything to them, it must come from opening, their_own_words_safe_to_quote, or everything_they_have_said, in their wording. Never quote the internal tags back at them as if they had said them.`,
            `Do not list alternatives. Do not hedge if confidence is high.`,
          ].filter(Boolean).join("\n"),
          tool: {
            name: "write_pitch",
            description: "The destination recommendation, in the agent's voice.",
            input_schema: {
              type: "object" as const,
              properties: { headline: { type: "string" }, body: { type: "string" } },
              required: ["headline", "body"],
            },
          },
          maxTokens: 500,
        });
        const headline = cleanProse(str(raw?.headline), 160);
        const body = cleanProse(str(raw?.body));
        // A pitch that names somewhere other than the destination we actually
        // planned is worse than a dull one. "I'm sending you to Montenegro"
        // over a Rome itinerary is the single most trust-destroying sentence
        // this product can produce, so it is rejected outright.
        if (headline && body && !namesOnly(d.name, `${headline} ${body}`, d.id)) {
          fell("the pitch named somewhere other than the destination we planned");
          return fallback.pitch(rec, brief, place);
        }
        // Telling her she said something she didn't is the same class of harm
        // as naming the wrong destination, in the same paragraph, so it is
        // rejected the same way rather than trusted to a prompt rule. The
        // prompt rule went in first and the very next deploy still produced
        // "You said nature and adventure" to someone who wrote "i wanna hike
        // a national park".
        const invented = fabricatedAttribution(`${headline} ${body}`, brief);
        if (invented) {
          fell(`the pitch told her she said "${invented}", which she did not`);
          return fallback.pitch(rec, brief, place);
        }
        if (headline && body) return { headline, body };
        /*
         * `place` has to go through. Without it the rules driver looks the
         * destination up in the static catalogue, and a researched one is not
         * in there: server-side `destinationById` returns undefined for a
         * miss, the next line reads a field off it, and the pitch 500s. So
         * the destinations this fallback exists to cover — the Faroes,
         * Hokkaido, anywhere researched — were the ones it could not serve,
         * and the resulting 500 was then reported to her as "no API key".
         */
      } catch (e) { fell(e); return fallback.pitch(rec, brief, place); }
      fell("the pitch named somewhere other than the destination we planned");
      return fallback.pitch(rec, brief, place);
    },

    /**
     * The catalogue is a cache, not a boundary. When someone names somewhere
     * we don't hold, go and get it rather than handing them a menu of fifteen
     * countries they didn't ask about.
     *
     * Everything that comes back is validated hard before it reaches the
     * planner. The model supplies facts; the scheduling, the opening hours and
     * the arithmetic stay deterministic.
     */
    /**
     * Step one, streamed. Whatever has arrived when the caller stops reading
     * is still usable, so a killed function degrades into shorter notes
     * instead of nothing at all.
     */
    async researchStream(place, days, origin, onChunk, interests, avoid) {
      if (!transport.research) {
        return { problem: "this build has no web access, so I can only plan what I already hold" };
      }
      stats.attempts++;
      try {
        const { text, sources } = await transport.research({
          system: RESEARCH_SYSTEM,
          user: researchPrompt(place, days, origin, interests, avoid),
          onChunk,
        });
        if (!text) { fell("the research call came back empty"); return { problem: `I couldn't find enough on ${place} to plan it.` }; }
        return { text, sources };
      } catch (e) {
        fell(e);
        return { problem: researchError(place, e) };
      }
    },

    /** Step one on its own request: search the web, write up what you found. */
    async researchNotes(place, days, origin, interests, avoid) {
      if (!transport.research) {
        return { problem: "this build has no web access, so I can only plan what I already hold" };
      }
      stats.attempts++;
      try {
        const { text, sources } = await transport.research({
          system: RESEARCH_SYSTEM,
          user: researchPrompt(place, days, origin, interests, avoid),
        });
        if (!text) {
          fell(`the search for ${place} came back empty`);
          return { problem: `I searched but couldn't find enough on ${place} to plan it.` };
        }
        return { text, sources };
      } catch (e) {
        fell(e);
        return { problem: researchError(place, e) };
      }
    },

    /** Step two on its own request: no searching, schema tool forced. */
    async researchPlaces(destinationName, cityId, cityName, count, interests, notes) {
      stats.attempts++;
      try {
        const raw = await transport.call({
          system: PLACES_SYSTEM,
          user: placesPrompt(destinationName, cityId, cityName, count, interests, notes),
          tool: PLACES_TOOL,
          // A dozen places, not a whole destination, so this comfortably
          // finishes inside the function's ceiling even when three of them are
          // in flight at once.
          maxTokens: 4000,
        });
        if (!raw) { fell(`nothing came back for ${cityName}`); return { places: [], problem: `nothing usable came back for ${cityName}` }; }
        return { places: (raw as Record<string, unknown>).places };
      } catch (e) {
        fell(e);
        return { places: [], problem: `couldn't fill in ${cityName}` };
      }
    },

    async researchPack(place, days, notes, sources, interests) {
      stats.attempts++;
      try {
        const raw = await transport.call({
          system: STRUCTURE_SYSTEM,
          user: [
            `Your notes on ${place}, for a ${days}-day trip:`,
            interests ? `They asked for: ${interests}. Keep the cities and places that serve that; do not swap in the standard tourist route.` : "",
            ``,
            notes,
          ].filter(Boolean).join("\n"),
          tool: RESEARCH_TOOL,
          // Fifteen places took 55 seconds of silence after the streamed
          // answer had already finished, so this call asks for a short spine
          // and the per-base passes do the rest. The ceiling is generous
          // anyway: this is the one call where running out of room used to
          // cost the traveller the destination they had just been promised.
          maxTokens: 10000,
        });
        if (!raw) {
          fell(`nothing structured came back for ${place}`);
          return { problem: `I found plenty on ${place} but couldn't turn it into a plan.` };
        }
        const { pack, problems } = validatePack(raw, sources);
        if (!pack) {
          fell(problems[0] ?? `what came back about ${place} wasn't usable`);
          return { problem: problems[0] ?? `what came back about ${place} wasn't usable` };
        }
        return { pack };
      } catch (e) {
        fell(e);
        return { problem: researchError(place, e) };
      }
    },

    /** Both steps back to back. Used by scripts, where nothing times out. */
    async research(place, days, origin, interests) {
      const notes = await this.researchNotes!(place, days, origin, interests);
      if (!notes.text) return { problem: notes.problem };
      // The notes call is told the truth about an unstated length; the pack
      // call needs a real number for the scheduler to do arithmetic with.
      return this.researchPack!(place, days ?? 7, notes.text, notes.sources ?? [], interests);
    },

    /**
     * Named lodging. "4 nights in Lisbon" is a placeholder; a name, a price, a
     * reason and the catch is a booking someone can act on.
     */
    /**
     * Where on earth, with no list attached.
     *
     * Deliberately given no catalogue at all. Handing it the fifteen we hold
     * and asking it to choose is the closed world with extra steps, and the
     * closed world is the thing being fixed: "surprise me" could only ever
     * return one of fifteen, so Oregon, Florida and Alaska were unreachable
     * unless the traveller named them herself.
     *
     * What comes back is a place NAME, not an id. The caller resolves it: a
     * name we hold plans instantly, a name we don't gets researched and joins
     * the catalogue. Both paths already exist, which is why this is a small
     * call and not a new subsystem.
     */
    async suggest(brief) {
      stats.attempts++;
      try {
        const raw = await transport.call({
          system: VOICE,
          user: [
            `Traveller: ${briefSummary(brief)}`,
            "Where on earth would you send them? One place.",
            "",
            "Rules:",
            "- Anywhere in the world. You are not choosing from a list.",
            "- A place you can actually plan a trip AROUND: a country, a region, an island, or a city and its surroundings. Not a continent, not a whole hemisphere, not a single building.",
            "- Somewhere their stated length actually suits. Ten days is not a weekend and a weekend is not ten days.",
            "- Fit what they told you. If they said nothing much, pick something with an obvious reason rather than something safe.",
            "- Do not pick somewhere they said they have already been, or somewhere they ruled out.",
          ].join("\n"),
          tool: {
            name: "suggest",
            description: "Name one destination.",
            input_schema: {
              type: "object",
              required: ["place"],
              properties: {
                place: {
                  type: "string",
                  description: "The place, as a person would say it: 'Oregon', 'the Amalfi Coast', 'Kyoto', 'Newfoundland'.",
                },
                why: {
                  type: "string",
                  description: "One sentence, for your own reasoning. Not shown to them.",
                },
              },
            },
          },
          maxTokens: 300,
        });
        const place = str(raw?.place, 60);
        if (!place || !isPlaceName(place)) {
          fell("the model named nowhere usable");
          return { problem: "no suggestion" };
        }
        return { place, why: str(raw?.why, 300) };
      } catch (e) {
        fell(e);
        return { problem: "suggest failed" };
      }
    },

    async stays(shape, brief, destinationId, place) {
      stats.attempts++;
      try {
        const raw = await transport.call({
          system: STAYS_SYSTEM,
          user: staysPrompt(shape, brief, destinationId, place),
          tool: STAYS_TOOL,
          maxTokens: 2500,
        });
        if (!raw) { fell("no rooms came back"); return []; }
        return validateStays(raw, shape);
      } catch (e) {
        fell(e);
        return [];
      }
    },

    async parseEdit(input, trip) {
      stats.attempts++;
      try {
        const raw = await transport.call({
          system: `${VOICE}\n\n${EDIT_RULES}`,
          user: [
            `Current plan: ${trip.days.length} days in ${destinationById(trip.concept.destinationId).name}.`,
            ...trip.days.map((d) => `Day ${d.index} (${d.theme}): ` +
              d.items.filter((i) => i.type === "activity").map((i) => i.name).join(", ")),
            ``,
            `They said: """${input}"""`,
          ].join("\n"),
          tool: {
            name: "edit_plan",
            description: "Typed operations to apply to the itinerary.",
            input_schema: {
              type: "object" as const,
              properties: {
                operations: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      kind: { type: "string", enum: [...OP_KINDS] },
                      tag: { type: "string" },
                      day: { type: "number" },
                      count: { type: "number" },
                      city_id: { type: "string" },
                      nights: { type: "number" },
                      usd: { type: "number" },
                      text: { type: "string" },
                    },
                    required: ["kind"],
                  },
                },
              },
              required: ["operations"],
            },
          },
        });
        const ops = validateOps(raw, trip);
        if (ops && ops.length) return ops;
        /*
         * An empty list is an answer, not a failure.
         *
         * "what's the weather like in October?" has no operation in it, and
         * the model saying so is the model being right. This counted it as a
         * fallback anyway, so the header pill read "model failed — rules" for
         * a whole evening of ordinary questions, and the one signal for
         * whether the model path is healthy was measuring nothing.
         *
         * The rules parser still runs underneath, because it is what turns a
         * question into an `unknown` op, and `unknown` is what reaches the
         * honest reply in lib/answer.ts. It is a backstop here, not a
         * correction.
         */
        if (ops) return fallback.parseEdit(input, trip);
        fell("the model's edit didn't parse");
      } catch (e) { fell(e); return fallback.parseEdit(input, trip); }
      return fallback.parseEdit(input, trip);
    },

    async describeEdit(ops, summary) {
      if (!summary.length) return fallback.describeEdit(ops, summary);
      stats.attempts++;
      try {
        const raw = await transport.call({
          system: `${VOICE}\n\nYou just changed someone's itinerary. Tell them what you did in one or two sentences. Agree with them if they were right. Do not apologise. Do not re-list everything.`,
          user: `Changes made:\n${summary.map((s) => `- ${s}`).join("\n")}`,
          tool: {
            name: "reply",
            description: "What the agent says back.",
            input_schema: { type: "object" as const, properties: { text: { type: "string" } }, required: ["text"] },
          },
          maxTokens: 300,
        });
        const text = cleanProse(str(raw?.text), 500);
        if (text) return text;
      } catch (e) { fell(e); return fallback.describeEdit(ops, summary); }
      fell("the model didn't say what it changed");
      return fallback.describeEdit(ops, summary);
    },
  };
}

/** Picks a driver from the environment. No key means the app still works. */

/**
 * The driver the server route uses. Cached so `stats` accumulates across
 * requests: the UI reads the fallback counter to tell the user whether the
 * model actually answered, rather than trusting the driver's name. A driver
 * called "llm" that fell back on every call is exactly the lie this counter
 * exists to catch.
 */
export function resolveDriver(): AgentDriver & { stats?: DriverStats; usage?: () => Usage } {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return rulesDriver;
  /*
   * Built per request rather than cached.
   *
   * The singleton made the numbers lie: token usage and the fallback counter
   * both accumulated across every request a warm instance handled, so "what
   * did this trip cost" and "did this call fall back" were answered with
   * somebody else's traffic mixed in. Constructing the SDK client is cheap;
   * an honest measurement is not optional.
   */
  return createLlmDriver(anthropicTransport(key));
}

/**
 * A driver on somebody else's key, for one request.
 *
 * Built, used, dropped, like the shared one. Holding somebody else's
 * credentials in memory across requests would be a liability with no
 * matching benefit.
 */
export function driverForKey(key: string): AgentDriver & { stats?: DriverStats; usage?: () => Usage } {
  return createLlmDriver(anthropicTransport(key));
}

/**
 * The tool-call reader, exposed for tests.
 *
 * The anchor date is the one field where a plausible-looking wrong answer is
 * invisible downstream: the itinerary is built on it and nothing afterwards
 * can tell it was invented. So the acceptance rule is tested directly rather
 * than only through a whole conversation.
 */
/** The typo tolerance, on its own, for the regression suite. */
export const nearlySaidForTest = (said: string, hint: string) => nearlySaid(said, hint);

export const validateForTest = (raw: Record<string, unknown>, said = "") =>
  validatePatch(raw, said);
