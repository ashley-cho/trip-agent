"use client";

import type { Brief, TravelerProfile, Trip, TripShapeLeg } from "@/lib/types";
import type { Stay } from "@/lib/stays";
import { emptyProfile } from "@/lib/types";
import type { BriefPatch, EditOp, Phase, PlaceContext, Question, Recommendation, Turn } from "@/lib/agent/types";
import { rulesDriver } from "@/lib/agent/rules";
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

async function call<T>(body: Record<string, unknown>): Promise<T> {
  // In a bundle with no server behind it, don't attempt the round trip at all
  // — the fallback would still work, but it fills the console with failed
  // requests that look like bugs to anyone who opens devtools.
  if (typeof __TRIP_AGENT_STANDALONE__ !== "undefined" && __TRIP_AGENT_STANDALONE__) {
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
    const json = (await res.json()) as T & { ownKey?: boolean; cost?: Usage & { usd: number } };
    noteLimit({ limited: false });
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
function placeContext(destinationId: string): PlaceContext | undefined {
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
  interpret: (input: string, brief: Brief) =>
    call<{ patch: BriefPatch; driver: string; reason?: string }>({ action: "interpret", input, brief }),
  question: (brief: Brief, history: Turn[] = [], phase: Phase = "discovery") =>
    call<{ question: Question | null; driver: string; reason?: string }>(
      { action: "question", brief, history, phase },
    ),
  pitch: (rec: Recommendation, brief: Brief) =>
    call<{ pitch: { headline: string; body: string }; driver: string; reason?: string }>(
      { action: "pitch", rec, brief, place: placeContext(rec.destinationId) },
    ),
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
    place: string, days: number, origin: string | undefined,
    onChunk: (t: string) => void, interests?: string,
  ): Promise<{ text?: string; sources?: string[]; problem?: string; driver: string; reason?: string }> => {
    if (typeof __TRIP_AGENT_STANDALONE__ !== "undefined" && __TRIP_AGENT_STANDALONE__) {
      return { driver: "rules", problem: "I can't research new destinations right now." };
    }
    let text = "";
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ action: "researchStream", place, days, origin, interests }),
      });
      if (!res.ok || !res.body) throw new Error(String(res.status));
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
  researchNotes: (place: string, days: number, origin?: string, interests?: string) =>
    call<{ text?: string; sources?: string[]; problem?: string; driver: string; reason?: string }>(
      { action: "researchNotes", place, days, origin, interests },
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
