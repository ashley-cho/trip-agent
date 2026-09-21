"use client";

import type { Brief, TravelerProfile, Trip, TripShapeLeg } from "@/lib/types";
import type { Stay } from "@/lib/stays";
import { emptyProfile } from "@/lib/types";
import type { BriefPatch, EditOp, Phase, PlaceContext, Question, Recommendation, Turn } from "@/lib/agent/types";
import { rulesDriver } from "@/lib/agent/rules";
import { accountStopped } from "@/lib/account";
import { recordMiss } from "@/lib/misses";
import { lookupOnly, orphanWords } from "@/lib/lookup";
import { interpretRules } from "@/lib/discovery";
import { editOrphans, parseEditRules } from "@/lib/edit";
import { noteLimit, ownKey } from "@/lib/byok";
import { chargeTrip } from "@/lib/spend";
import type { Usage } from "@/lib/cost";
import { CITIES, DESTINATIONS } from "@/data/destinations";
import { isResearched } from "@/data/registry";
import type { DestinationPack } from "@/lib/research";

/**
 * Talks to the server driver when there is one. When there isn't — a static
 * build, an offline tab, a failed route — it runs the rules driver in the
 * browser instead of erroring. Same seam as the server, one layer out.
 */
/** Set by the standalone bundle (standalone/build.mjs); absent under Next. */
declare const __TRIP_AGENT_STANDALONE__: boolean | undefined;

/**
 * Everything currently in flight, so it can be called off.
 *
 * A trip is six or seven model calls in a chain and the long ones take the
 * best part of a minute. Watching it read up on the wrong country with no way
 * to say "no, stop" is the worst thirty seconds this app can give anyone.
 */
const inFlight = new Set<AbortController>();

export class Cancelled extends Error {
  constructor() { super("cancelled"); this.name = "Cancelled"; }
}

/**
 * The allowance is gone, and that is the end of the turn.
 *
 * This used to fall through to the rules driver, so the traveller got a full
 * itinerary assembled from the seeded catalogue with no indication that
 * anything had changed. It reads like the product and it isn't; a person over
 * the limit deserves to be told, not handed something quieter and worse.
 */
export class RateLimited extends Error {
  constructor(
    readonly reason: "visitor" | "daily" | undefined,
    readonly retryAfter: number,
  ) {
    super("rate limited");
    this.name = "RateLimited";
  }
}

export const isRateLimited = (e: unknown): e is RateLimited =>
  (e as { name?: string })?.name === "RateLimited";

/** Call off everything in flight. Anything waiting on it throws Cancelled. */
export function abortInFlight() {
  for (const c of [...inFlight]) c.abort();
  inFlight.clear();
}

export const wasCancelled = (e: unknown) =>
  e instanceof Cancelled
  || (e instanceof DOMException && e.name === "AbortError")
  || (e as { name?: string })?.name === "AbortError";

/**
 * Understanding what she typed is never done by regexes.
 *
 * The rules driver is a real thing and it stays: it does arithmetic, it
 * schedules, it prices, and none of that needs a model. What it must not do
 * is READ. It was reading, and it was the whole shape of a day's bugs:
 *
 *   "Don't want south east asia" became a shortlist of Southeast Asia.
 *   "too hot or cold or humid" became nothing.
 *   "just not overwhelmingly" became a place called "overwhelmingly not".
 *   "Not my kind of place" became "you like food and culture less".
 *
 * Each of those got a patch. Each patch was a filter that DELETED what the
 * parser could not read, because that is the only move a regex has. A pile of
 * regexes that drop what they cannot parse will always be worse than a model,
 * and she said so: worse than just talking to an llm.
 *
 * It is also, exactly, the degraded mode she ruled out on day one — no
 * degraded mode at all, just stop — arriving by a side door, because the
 * rules answer looks identical to a real one from the outside. The app looked
 * like it was working while every sentence in it was written by pattern
 * matching.
 *
 * So: these four actions are the ones that turn her words into meaning, and
 * they have no floor. If the model cannot answer, the turn stops and says so.
 * Everything else keeps its fallback, because describing an edit we ourselves
 * just made, or returning an empty list of hotels, cannot be wrong about what
 * she meant.
 */
export const COMPREHENSION = new Set(["interpret", "question", "pitch", "parseEdit"]);

/**
 * Stopping is the right answer and it has to be a rare one. Her number: under
 * five percent of turns.
 *
 * That is a design constraint, not a hope, and it splits failures in two.
 *
 *   Transient — a dropped connection, a 500, an overloaded model. These fix
 *   themselves in a second or two, and stopping on one would spend her
 *   five percent on nothing. Retried.
 *
 *   Account — a rejected key, an empty balance. These do not fix themselves
 *   and only she can act on them. Retrying is three times the wait and the
 *   same answer, so it stops immediately and says which one it is.
 *
 * A turn that stops because the deployment is out of credit is not the app
 * being unreliable. It is the app being out of credit, and it should say so
 * in those words rather than burning attempts to look busy.
 */
const COMPREHENSION_ATTEMPTS = 3;

/** Measured, so "under five percent" is a fact rather than an intention. */
const turns = { total: 0, stopped: 0 };
export const stopRate = () => ({
  ...turns,
  rate: turns.total ? turns.stopped / turns.total : 0,
});

/** No model answered, and no regex is going to pretend to be one. */
export class NoModel extends Error {
  constructor(readonly why?: string) {
    super("no model");
    this.name = "NoModel";
  }
}

export const noModel = (e: unknown): e is NoModel =>
  e instanceof NoModel || (e as { name?: string })?.name === "NoModel";

async function call<T>(body: Record<string, unknown>): Promise<T> {
  if (!COMPREHENSION.has(String(body.action))) return attempt<T>(body);
  /*
   * A message that is ONLY a name we hold has nothing in it to interpret.
   *
   * The lookup already exists as a floor under the stop. Here it runs first,
   * and only in the one case where there is provably no judgment to make:
   * every word she typed is the name or a carrier word, so the patch the
   * lookup would build is empty and the model has nothing left to read.
   * "i wanna visit japan" is that case, and it is the most common opening
   * message there is. On the measured trip it is the single most frequent
   * call in the product.
   *
   * Deliberately NOT the full gate. The gate's guarantee is that every word
   * lands somewhere, not that it lands somewhere RIGHT, and as a fallback a
   * slightly wrong read beats stopping while as a pre-filter it would beat a
   * correct one. "Faithful to what she typed" tops saving money, so the
   * shortcut is limited to the case where there is nothing to be unfaithful
   * to. Anything else -- a length, a budget, a refusal, a person she is
   * travelling with -- still goes to the model.
   */
  if (String(body.action) === "interpret") {
    const said = String(body.input ?? "");
    const bare = lookupOnly(said);
    if (bare) {
      console.info(`[lookup] "${said}" is ${bare.destinationId} and every word of it lands; no model needed`);
      return { driver: "catalogue", patch: { ...bare.patch, namedDestination: bare.destinationId } } as T;
    }
    /*
     * And a message that names nowhere, but every word of which still lands.
     *
     * The narrow version of this gate passed only a bare catalogue name. I
     * argued for that caution and then measured it: of the twelve openers the
     * app prints in the box she types into, it refused TWELVE. "Northern
     * lights, and I can drive." parses correctly to Iceland and was refused.
     * Against the scenario set with no model at all:
     *
     *   gate     held   her words survive   plan or honest refusal
     *   name      17%                 39%                     22%
     *   lookup    52%                 70%                     57%
     *   words     96%                 91%                    100%
     *
     * Every column improves and none of them falls, which is not what I
     * expected: a stop does not protect her words, it destroys them. The
     * caution was costing the thing it was meant to defend.
     *
     * What is still true, and is the reason this is a gate rather than a
     * fallback: it catches words that go NOWHERE, not words that go somewhere
     * WRONG. The Bali failure produced a patch. Nothing here would have
     * caught it, and nothing here is claimed to.
     *
     * TRIP_AGENT_GATE=name narrows it back to the bare name, without a
     * deploy, if that turns out to be wrong in front of a real person.
     */
    if (process.env.NEXT_PUBLIC_TRIP_AGENT_GATE !== "name") {
      const orphan = orphanWords(said);
      if (!orphan.length) {
        console.info(`[lookup] every word of "${said}" lands; no model needed`);
        return { driver: "catalogue", patch: interpretRules(said, body.brief as never) } as T;
      }
      /*
       * Typed at a plan, "make it cheaper" is an edit, and the editor reads
       * every word of it. app/page.tsx runs interpret first at the proposal
       * and hands the message to the editor afterwards, so a stop here is a
       * stop before the parser that understands the sentence gets to see
       * it. When the caller sent the trip on screen and the editor drops
       * nothing, the turn carries on with the brief parser's (possibly
       * empty) reading, and the editor does the work one step later.
       */
      if (body.trip && !editOrphans(said, body.trip as Trip).length) {
        console.info(`[lookup] "${said}" is an edit the editor reads whole; no model needed`);
        return { driver: "catalogue", patch: interpretRules(said, body.brief as never) } as T;
      }
      console.info(`[lookup] "${said}" would drop ${orphan.join(", ")}; stopping`);
      recordMiss({ kind: "gate", why: `would drop ${orphan.join(", ")}`, said, driver: "stopped" });
    }
  }
  turns.total++;
  let last: unknown;
  for (let i = 1; i <= COMPREHENSION_ATTEMPTS; i++) {
    try {
      return await attempt<T>(body);
    } catch (e) {
      if (wasCancelled(e) || isRateLimited(e)) throw e;
      last = e;
      // An account problem is the same answer three times. Don't make her
      // wait for it.
      if (noModel(e) && accountStopped((e as NoModel).why)) {
        // Not on her own key, and the deployment's is dead: show the box
        // that lets her put one in, the same box the rate limit shows.
        if (!ownKey()) noteLimit({ limited: true, reason: "account" });
        break;
      }
      if (!noModel(e)) break;
      if (i < COMPREHENSION_ATTEMPTS) await new Promise((r) => setTimeout(r, 400 * i));
    }
  }
  /*
   * Before stopping: is this simply the name of a place we hold?
   *
   * "i wanna visit japan" was answered with "I'm stopping here, this
   * deployment's Anthropic account is out of credit." Japan is in the
   * catalogue with seven bases and a hundred and eleven places, and the
   * scheduler that builds the trip is arithmetic. The app refused a question
   * it could answer completely.
   *
   * That was the no-floor rule applied too widely. Its reason is that regexes
   * INVENT meaning. Comparing the word "japan" against a list of destinations
   * invents nothing: it is an exact string match against known data, or it is
   * nothing. See lib/lookup.ts, which allows the turn through only when every
   * word she typed lands somewhere, and stops the moment one would be dropped.
   */
  if (String(body.action) === "interpret") {
    const only = lookupOnly(String(body.input ?? ""));
    if (only) {
      const patch: BriefPatch = { ...only.patch, namedDestination: only.destinationId };
      turns.stopped--;
      console.info(`[lookup] "${String(body.input ?? "")}" is ${only.destinationId} in the catalogue; `
        + `planning it without a model`);
      return { driver: "catalogue", patch } as T;
    }
  }

  /*
   * Before stopping an edit: does the rules editor read every word of it?
   *
   * Same rule as the lookup above. Comparing "slow it down" against the
   * editor's patterns invents nothing when every word lands in an op; the
   * degraded case this file refuses is the one where a word is dropped on
   * the floor and the rest is applied as if it were the whole instruction.
   * lib/edit.ts editOrphans asks exactly that, word by word.
   */
  if (String(body.action) === "parseEdit") {
    const said = String(body.input ?? "");
    const orphan = editOrphans(said, body.trip as Trip);
    if (!orphan.length) {
      turns.stopped--;
      console.info(`[lookup] every word of the edit "${said}" lands; no model needed`);
      return { driver: "catalogue", ops: parseEditRules(said, body.trip as Trip) } as T;
    }
    console.info(`[lookup] edit "${said}" would drop ${orphan.join(", ")}; stopping`);
    recordMiss({ kind: "gate", why: `edit would drop ${orphan.join(", ")}`, said, driver: "stopped",
      destination: (body.trip as Trip)?.concept?.destinationId });
  }

  turns.stopped++;
  console.warn(`[stopped] ${String(body.action)}: ${(last as NoModel)?.why ?? "no model"} `
    + `(${turns.stopped}/${turns.total} turns)`);
  throw last;
}

async function attempt<T>(body: Record<string, unknown>): Promise<T> {
  // In a bundle with no server behind it, don't attempt the round trip at all
  // — the fallback would still work, but it fills the console with failed
  // requests that look like bugs to anyone who opens devtools.
  if (typeof __TRIP_AGENT_STANDALONE__ !== "undefined" && __TRIP_AGENT_STANDALONE__) {
    if (COMPREHENSION.has(String(body.action))) throw new NoModel("no server in this build");
    return local<T>(body);
  }
  const ctl = new AbortController();
  inFlight.add(ctl);
  try {
    const res = await fetch("/api/agent", {
      method: "POST", headers: headers(), body: JSON.stringify(body), signal: ctl.signal,
    });
    if (res.status === 429) {
      const body429 = (await res.json().catch(() => ({}))) as
        { reason?: "visitor" | "daily"; retryAfter?: number };
      const retryAfter = Number(res.headers.get("retry-after")) || body429.retryAfter || 60;
      noteLimit({ limited: true, reason: body429.reason, retryAfter });
      throw new RateLimited(body429.reason, retryAfter);
    }
    if (!res.ok) throw new Error(String(res.status));
    const json = (await res.json()) as T & {
      ownKey?: boolean; cost?: Usage & { usd: number }; driver?: string; reason?: string;
    };
    noteLimit({ limited: false });
    /*
     * The server answered, and it answered with the floor. That is caught
     * here rather than at each call site because there are two ways to reach
     * it — no key configured, and a key whose call failed — and they arrive
     * looking the same. One check, both covered.
     */
    if (COMPREHENSION.has(String(body.action))
        && (json.driver === "rules" || json.driver === "fallback")) {
      throw new NoModel(json.reason);
    }
    // Attributed to whichever trip is open, so the number means "this trip"
    // rather than "this browser, ever".
    if (json.cost) chargeTrip(currentTripId, json.cost);
    return json;
  } catch (e) {
    // Being called off is not a failed request. Without this it lands in the
    // same catch as a 500 and quietly answers from the rules driver, so
    // pressing stop would produce an answer instead of stopping.
    if (wasCancelled(e)) throw new Cancelled();
    // Being out of allowance is a decision, not a transport failure. It is the
    // one error the rules driver must not paper over.
    if (isRateLimited(e)) throw e;
    if (noModel(e)) throw e;
    // And the same rule when it is the transport that failed rather than the
    // model: a regex answer to "what did she mean" is not a lesser answer,
    // it is a different product wearing this one's voice.
    if (COMPREHENSION.has(String(body.action))) throw new NoModel((e as Error)?.message);
    return local<T>(body, "fallback");
  } finally {
    inFlight.delete(ctl);
  }
}

/**
 * The key never goes in the body, so it can't end up in a logged payload or a
 * cached request. Absent for almost everyone: the shared key answers unless a
 * visitor has deliberately supplied their own.
 */

/**
 * Which trip to bill the next call to. Set by the page as it opens or starts
 * one; a module variable rather than a parameter so that adding measurement
 * didn't mean touching all fourteen call sites.
 */
let currentTripId = "";
export const billTo = (id: string) => { currentTripId = id; };

function headers(): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json" };
  const mine = ownKey();
  if (mine) h["x-user-anthropic-key"] = mine;
  return h;
}

/*
 * `why` decides what the badge says, and it was lying.
 *
 * Every answer from here was labelled "rules", whose tooltip reads "No API
 * key, so language understanding is pattern matching". That is true for a
 * standalone bundle and false for a deployment whose server just returned a
 * 500: there the model exists, it was reached, and it failed. Reporting a
 * transient failure as a configuration choice hides the failure and slanders
 * the configuration. "fallback" is the label that means "we fell back", and
 * it is the one the failure counter reads.
 */
async function local<T>(body: Record<string, unknown>, why: "rules" | "fallback" = "rules"): Promise<T> {
  const d = { ...rulesDriver, name: why };
  switch (body.action) {
    case "interpret":
      return { driver: d.name, patch: await d.interpret(String(body.input ?? ""), body.brief as Brief) } as T;
    case "question":
      return {
        driver: d.name,
        question: await d.nextQuestion(
          body.brief as Brief, body.history as Turn[], body.phase as Phase,
        ),
      } as T;
    case "pitch":
      return { driver: d.name, pitch: await d.pitch(body.rec as Recommendation, body.brief as Brief, body.place as PlaceContext | undefined) } as T;
    case "parseEdit":
      return { driver: d.name, ops: await d.parseEdit(String(body.input ?? ""), body.trip as Trip) } as T;
    case "suggest":
    case "researchNotes":
    case "researchPack":
    case "researchPlaces":
      return { driver: d.name, problem: "I can't research new destinations right now." } as T;
    case "stays":
      return { driver: d.name, stays: [] } as T;
    case "describeEdit":
      return { driver: d.name, text: await d.describeEdit(body.ops as EditOp[], (body.summary as string[]) ?? []) } as T;
    default:
      throw new Error(`unknown action ${String(body.action)}`);
  }
}

/**
 * What the server would need to look up and can't.
 *
 * A researched destination is registered into the browser's catalogue only.
 * Sending it with the call is cheaper and safer than teaching the server to
 * remember: nothing is written into a process that other people share.
 */
export function placeContext(destinationId: string): PlaceContext | undefined {
  if (!isResearched(destinationId)) return undefined;
  const destination = DESTINATIONS.find((d) => d.id === destinationId);
  if (!destination) return undefined;
  return { destination, cities: CITIES.filter((c) => c.destinationId === destinationId) };
}

export const agent = {
  /**
   * Is there room to research a destination before we start one?
   *
   * Free, and it has to be: a research run is four calls, the allowance can
   * empty between the second and the third, and the failure then lands after
   * she has already read thirty seconds of prose about somewhere she is not
   * going to be sent.
   */
  budget: (units?: number) =>
    call<{ ok: boolean; reason?: "visitor" | "daily"; retryAfter: number }>(
      { action: "budget", units },
    ),
  /** `trip` is the plan on screen, if any: with no model it lets an edit through (see call). */
  interpret: (input: string, brief: Brief, trip?: Trip | null) =>
    call<{ patch: BriefPatch; driver: string; reason?: string }>({ action: "interpret", input, brief, trip: trip ?? undefined }),
  question: (brief: Brief, history: Turn[] = [], phase: Phase = "discovery") =>
    call<{ question: Question | null; driver: string; reason?: string }>(
      { action: "question", brief, history, phase },
    ),
  pitch: (rec: Recommendation, brief: Brief) =>
    call<{ pitch: { headline: string; body: string }; driver: string; reason?: string }>(
      { action: "pitch", rec, brief, place: placeContext(rec.destinationId) },
    ),
  /*
   * The same paragraph, written from the catalogue entry, in this browser.
   *
   * Exposed on the agent rather than reached for directly so the turn still
   * asks the outside world for exactly one thing, and so a test can hand it a
   * driver that misbehaves. No network, no key, no cost: it is the floor, and
   * a floor you cannot reach when the model is failing is not a floor.
   */
  pitchFloor: (rec: Recommendation, brief: Brief) =>
    rulesDriver.pitch!(rec, brief, placeContext(rec.destinationId)),
  parseEdit: (input: string, trip: Trip) =>
    call<{ ops: EditOp[]; driver: string; reason?: string }>({ action: "parseEdit", input, trip }),
  // No local fallback: researching a destination is exactly the thing the
  // rules driver cannot do, and a fake answer here would be a fabricated trip.
  /**
   * Streams the search step. onChunk fires as prose arrives, so something is
   * on screen in about a second rather than after a minute. Returns whatever
   * text made it through, which is still usable if the function was killed
   * partway.
   */
  researchStream: async (
    place: string, days: number | undefined, origin: string | undefined,
    onChunk: (t: string) => void, interests?: string, avoid?: string[],
  ): Promise<{ text?: string; sources?: string[]; problem?: string; driver: string; reason?: string }> => {
    if (typeof __TRIP_AGENT_STANDALONE__ !== "undefined" && __TRIP_AGENT_STANDALONE__) {
      return { driver: "rules", problem: "I can't research new destinations right now." };
    }
    let text = "";
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ action: "researchStream", place, days, origin, interests, avoid }),
      });
      if (!res.ok || !res.body) throw new Error(String(res.status));
      /*
       * A 200 is not a stream.
       *
       * This branch used to hand `res.body` straight to a reader and push
       * whatever came out into the conversation. The route does not always
       * answer with a stream: when the driver has no researchStream — no key,
       * so the rules driver — it answers with an ordinary JSON body and a 200.
       * That body was decoded as prose and appended to an agent message, so
       * the traveller read
       *
       *   {"driver":"rules","problem":"no model is configured, so I can only
       *    plan what I already hold"}
       *
       * in a chat bubble, and the call then reported itself as `driver: "llm"`
       * with the JSON as its notes.
       *
       * The general rule, which is the point: text goes on screen only when
       * the server said it was sending text. Anything else is a result to
       * handle, and a JSON body describing a problem is that problem —
       * returned here the same shape every other failure in this function
       * returns, with no `text`, so the caller takes its "research did not
       * work" path instead of printing machine internals at her.
       */
      const kind = res.headers.get("content-type") ?? "";
      if (!/^text\/plain\b/i.test(kind)) {
        const meta = (await res.json().catch(() => ({}))) as
          { driver?: string; problem?: string; reason?: string; sources?: string[] };
        return {
          driver: meta.driver ?? "fallback",
          reason: meta.reason,
          problem: meta.problem ?? "I couldn't research that just now.",
        };
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let tail = "";
      // Only the short verdict is shown. Everything after the fence is
      // working detail for the scheduler, and streaming it at her produced a
      // six thousand character essay where a day-by-day plan belonged.
      let shown = 0;
      const showable = (all: string) => {
        const fence = all.match(/\n\s*-{3,}\s*(\n|$)/);
        return fence?.index !== undefined ? all.slice(0, fence.index) : all;
      };
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        tail += decoder.decode(value, { stream: true });
        // A NUL separates the prose from the trailing metadata line.
        const cut = tail.indexOf("\u0000");
        if (cut === -1) {
          if (tail) {
            text += tail; tail = "";
            const vis = showable(text);
            if (vis.length > shown) { onChunk(vis.slice(shown)); shown = vis.length; }
          }
        } else {
          const head = tail.slice(0, cut);
          if (head) {
            text += head;
            const vis = showable(text);
            if (vis.length > shown) { onChunk(vis.slice(shown)); shown = vis.length; }
          }
          const meta = JSON.parse(tail.slice(cut + 1) || "{}");
          return { text: text.trim(), ...meta };
        }
      }
      // Cut off mid-stream. Partial notes beat no notes.
      return text.trim()
        ? { text: text.trim(), driver: "llm", sources: [] }
        : { driver: "fallback", problem: "The search was cut off before it found anything." };
    } catch {
      return text.trim()
        ? { text: text.trim(), driver: "llm", sources: [] }
        : { driver: "fallback", problem: "I couldn't reach the search." };
    }
  },

  // Two requests, because both halves in one exceeded the function budget.
  /** Where on earth, unconstrained by what we happen to hold. */
  suggest: (brief: Brief) =>
    call<{ place?: string; why?: string; problem?: string; driver: string; reason?: string }>(
      { action: "suggest", brief },
    ),
  researchNotes: (place: string, days: number | undefined, origin?: string, interests?: string, avoid?: string[]) =>
    call<{ text?: string; sources?: string[]; problem?: string; driver: string; reason?: string }>(
      { action: "researchNotes", place, days, origin, interests, avoid },
    ),
  researchPack: (place: string, days: number, notes: string, sources: string[], interests?: string) =>
    call<{ pack?: DestinationPack; problem?: string; driver: string; reason?: string }>(
      { action: "researchPack", place, days, notes, sources, interests },
    ),
  researchPlaces: (
    destinationName: string, cityId: string, cityName: string,
    count: number, interests?: string, notes?: string,
  ) =>
    call<{ places?: unknown; problem?: string; driver: string; reason?: string }>(
      { action: "researchPlaces", destinationName, cityId, cityName, count, interests, notes },
    ),
  stays: (shape: TripShapeLeg[], brief: Brief, destinationId: string) =>
    call<{ stays: Stay[]; driver: string; reason?: string }>(
      { action: "stays", shape, brief, destinationId, place: placeContext(destinationId) },
    ),
  describeEdit: (ops: EditOp[], summary: string[]) =>
    call<{ text: string; driver: string; reason?: string }>({ action: "describeEdit", ops, summary }),
};

// --- traveler profile persistence (§16) ------------------------------------

const KEY = "trip-agent.profile.v1";

export function loadProfile(): TravelerProfile {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...emptyProfile(), seed: Math.floor(Math.random() * 1e6) };
    const p = JSON.parse(raw) as Partial<TravelerProfile>;
    const merged = { ...emptyProfile(), ...p };
    // Minted once, then stable for this traveller.
    if (merged.seed === undefined) merged.seed = Math.floor(Math.random() * 1e6);
    return merged;
  } catch {
    return emptyProfile();
  }
}

export function saveProfile(p: TravelerProfile) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode */ }
}

export function sendFeedback(record: Record<string, unknown>) {
  // Kept locally too, so a standalone build still captures the section 35
  // answers even with nowhere to POST them.
  try { localStorage.setItem("trip-agent.feedback." + Date.now(), JSON.stringify(record)); } catch { /* private mode */ }
  if (typeof __TRIP_AGENT_STANDALONE__ !== "undefined" && __TRIP_AGENT_STANDALONE__) return;
  fetch("/api/feedback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(record),
  }).catch(() => { /* feedback is best-effort */ });
}
