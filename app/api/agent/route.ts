import { NextResponse } from "next/server";
import { driverForKey, resolveDriver } from "@/lib/agent/llm";
import { usdFor } from "@/lib/cost";
import type { Brief, Trip, TripShapeLeg } from "@/lib/types";
import type { EditOp, Phase, Recommendation, Turn } from "@/lib/agent/types";
import { budgetHeaders, charge, clamp, costOf, LIMITS, peek, RESEARCH_UNITS, visitorId, isLocalDev } from "@/lib/guard";
import { safePlaceContext } from "@/lib/place-context";

export const runtime = "nodejs";

/**
 * Researching a destination means the model runs web searches server-side and
 * then writes a full data pack, which takes thirty to sixty seconds. Vercel's
 * default function timeout is ten. So every research call on the deployment
 * was killed mid-flight, fell back to rules, and the traveller was handed the
 * catalogue menu — the exact dead end this feature exists to remove. Sixty is
 * the Hobby plan's ceiling.
 */
export const maxDuration = 60;

/**
 * One route, five actions. The API key never leaves the server; the planner,
 * critic and cost model all run client-side because they need no secrets.
 *
 * Every response carries `driver`, and it reports what actually happened
 * rather than what was configured. The LLM driver falls back to rules on any
 * error, so a driver *named* "llm" tells you nothing — the fallback counter
 * does. Three honest values:
 *   "llm"      the model answered this call
 *   "fallback" a model was configured, this call failed, rules answered
 *   "rules"    no key, rules by design
 */
/** Anthropic's format, checked before we hand it to the SDK. */
const KEY_SHAPE = /^sk-ant-[A-Za-z0-9_\-]{20,}$/;

export async function POST(req: Request) {
  /*
   * A visitor spending their own key.
   *
   * Read from a header rather than the body so it never lands in a logged
   * payload, used to build a driver for this one request, and never written
   * anywhere: no database, no log line, no cache. When it's present the
   * shared allowance doesn't apply, because the whole point of the allowance
   * is protecting one particular Anthropic bill and this isn't it.
   */
  const supplied = (req.headers.get("x-user-anthropic-key") ?? "").trim();
  const ownKey = KEY_SHAPE.test(supplied) ? supplied : null;
  const driver = ownKey ? driverForKey(ownKey) : resolveDriver();
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return bad("malformed body"); }

  const before = driver.stats?.fallbacks ?? 0;

  /*
   * What this request actually cost, from the API's own token counts rather
   * than an estimate. Returned to the browser so a trip can be priced by what
   * it really took, not by a number somebody guessed in a planning doc.
   */
  const spent = () => {
    const u = driver.usage?.();
    if (!u || !u.calls) return undefined;
    return { ...u, usd: usdFor(u, process.env.TRIP_AGENT_MODEL || undefined) };
  };

  const verdict = () => {
    if (!driver.stats) return { driver: driver.name };
    const fellBack = driver.stats.fallbacks > before;
    return fellBack
      ? { driver: "fallback", reason: driver.stats.lastError ?? "unknown error", ownKey: !!ownKey, cost: spent() }
      : { driver: "llm", ownKey: !!ownKey, cost: spent() };
  };

  const action = String(body.action ?? "");

  // A public deployment spends a real API key. Over the allowance the browser
  // client falls back to its own rules driver, so the trip still gets planned;
  // it just stops costing anything.
  // Their key, their spend. The lighter limit that still applies is about not
  // letting one visitor monopolise the function, not about money.
  // Dogfooding on your own laptop is not a visitor to be rationed. The daily
  // ceiling still applies; only the per-visitor hourly one is lifted.
  const local = isLocalDev(req);
  const billing = local
    ? { id: `dev:${visitorId(req)}`, allowance: 1000 }
    : ownKey
      ? { id: `byok:${visitorId(req)}`, allowance: 4 }
      : { id: visitorId(req), allowance: 1 };

  /*
   * The allowance is spent when a model call is made, not when a request
   * arrives.
   *
   * Every action here used to be charged on arrival, whether or not anything
   * was going to reach Anthropic. With no key configured `resolveDriver()`
   * returns the rules driver: no network, no tokens, no bill — and yet four
   * or five local sessions in an hour spent the sixty-unit visitor allowance
   * and the tester was told "That's my limit for the hour" by an app that had
   * not made a single API call. `isLocalDev` did not save her, because
   * `next start` sets NODE_ENV=production and that switch is off in
   * production by design, so the same thing hit anyone testing the
   * deployment.
   *
   * What the allowance is for is stated at the top of lib/guard.ts: it
   * protects one Anthropic bill. A request that generates no bill has nothing
   * to protect against, so it costs nothing.
   *
   * So: ask first, do the work, charge only if the driver actually attempted
   * a model call. `stats` exists only on a model-backed driver and
   * `stats.attempts` is incremented immediately before each API call, which
   * makes it the honest answer to "did this request cost money" — including
   * for a call that then failed and fell back to rules, because that one
   * reached Anthropic too.
   *
   * The pre-check is `peek`, so being over the limit is still a 429 before
   * any work is done, rather than a research run that dies half way. Two
   * requests racing can both pass it and both charge; that overspends by one
   * action on a per-instance counter that the file's own header already calls
   * approximate, and it is the right trade against refusing calls that were
   * never going to cost anything.
   */
  const modelBacked = !!driver.stats;
  const attemptsBefore = driver.stats?.attempts ?? 0;
  let charged = false;
  const settle = () => {
    if (charged || (driver.stats?.attempts ?? 0) <= attemptsBefore) return;
    charged = true;
    charge(action, billing.id, billing.allowance);
  };

  const spend = modelBacked
    ? peek(costOf(action), billing.id, billing.allowance)
    : { ok: true as const };
  if (!spend.ok) {
    /*
     * No degraded mode. The browser used to take this response and quietly
     * answer from its own rules driver, so a traveller over the limit got a
     * canned trip that read like a real one and never learned why it had got
     * worse. Better to stop and say so: the client throws on this status now,
     * and the wording it shows is built from `reason` and `retry-after`.
     */
    return NextResponse.json(
      { limited: true, reason: spend.reason, retryAfter: spend.retryAfter ?? 60 },
      { status: 429, headers: { "retry-after": String(spend.retryAfter ?? 60), ...budgetHeaders() } },
    );
  }

  // Free, and deliberately outside the switch below: asking whether there is
  // room for a research run must never itself consume the room.
  if (action === "budget") {
    const want = Math.min(200, Math.max(1, Number(body.units) || RESEARCH_UNITS));
    // Same exemption as the charge above, or the preflight would report no
    // room for a research run the charge would then happily allow.
    const v = peek(want, billing.id, billing.allowance);
    return NextResponse.json({ ...v, retryAfter: v.retryAfter ?? 0 });
  }

  try {
    switch (action) {
      case "interpret": {
        const patch = await driver.interpret(clamp(body.input, LIMITS.input), body.brief as Brief);
        return NextResponse.json({ ...verdict(), patch });
      }
      case "question": {
        const question = await driver.nextQuestion(
          body.brief as Brief,
          (body.history as Turn[]) ?? [],
          (body.phase as Phase) ?? "discovery",
        );
        return NextResponse.json({ ...verdict(), question });
      }
      case "pitch": {
        const pitch = await driver.pitch(
          body.rec as Recommendation, body.brief as Brief, safePlaceContext(body.place),
        );
        return NextResponse.json({ ...verdict(), pitch });
      }
      case "parseEdit": {
        const ops = await driver.parseEdit(clamp(body.input, LIMITS.input), body.trip as Trip);
        return NextResponse.json({ ...verdict(), ops });
      }
      // Streamed, so the traveller reads the agent's take on the place while
      // the searches are still running, instead of watching a spinner for a
      // minute. The body is prose, then a final line of JSON metadata.
      case "researchStream": {
        if (!driver.researchStream) {
          return NextResponse.json({ driver: "rules", problem: "no model is configured, so I can only plan what I already hold" });
        }
        const place = clamp(body.place, LIMITS.place);
        const days = daysOrNone(body.days);
        const origin = body.origin ? clamp(body.origin, LIMITS.place) : undefined;
        const interests = clamp(body.interests, LIMITS.input);
        const avoid = (Array.isArray(body.avoid) ? body.avoid : [])
          .slice(0, 12).map((x: unknown) => clamp(x, LIMITS.place)).filter(Boolean);
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            const send = (t: string) => {
              try { controller.enqueue(encoder.encode(t)); } catch { /* client went away */ }
            };
            const out = await driver.researchStream!(place, days, origin, send, interests, avoid);
            // The stream outlives the POST return, so this call charges
            // itself rather than relying on the finally below.
            settle();
            send(`\n\u0000${JSON.stringify({
              ...verdict(),
              sources: out.sources ?? [],
              problem: out.problem,
            })}`);
            controller.close();
          },
        });
        return new Response(stream, {
          headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
        });
      }
      case "researchNotes": {
        if (!driver.researchNotes) {
          return NextResponse.json({ driver: "rules", problem: "no model is configured, so I can only plan what I already hold" });
        }
        const out = await driver.researchNotes(
          clamp(body.place, LIMITS.place), daysOrNone(body.days),
          body.origin ? clamp(body.origin, LIMITS.place) : undefined,
          clamp(body.interests, LIMITS.input),
        );
        return NextResponse.json({ ...verdict(), ...out });
      }
      case "suggest": {
        if (!driver.suggest) {
          return NextResponse.json({ driver: "rules", problem: "no model is configured" });
        }
        const out = await driver.suggest(body.brief as Brief);
        return NextResponse.json({ ...verdict(), ...out });
      }
      case "researchPack": {
        if (!driver.researchPack) {
          return NextResponse.json({ driver: "rules", problem: "no model is configured" });
        }
        const out = await driver.researchPack(
          clamp(body.place, LIMITS.place), days7(body.days),
          clamp(body.notes, 8000), (body.sources as string[]) ?? [],
          clamp(body.interests, LIMITS.input),
        );
        return NextResponse.json({ ...verdict(), ...out });
      }
      case "researchPlaces": {
        if (!driver.researchPlaces) return NextResponse.json({ driver: "rules", places: [] });
        const out = await driver.researchPlaces(
          clamp(body.destinationName, LIMITS.place),
          clamp(body.cityId, 80),
          clamp(body.cityName, LIMITS.place),
          Math.min(20, Math.max(4, Math.round(Number(body.count) || 10))),
          clamp(body.interests, LIMITS.input),
          clamp(body.notes, 6000),
        );
        return NextResponse.json({ ...verdict(), ...out });
      }
      case "research": {
        if (!driver.research) {
          return NextResponse.json({
            driver: "rules",
            problem: "no model is configured, so I can only plan what I already hold",
          });
        }
        const out = await driver.research(
          clamp(body.place, LIMITS.place),
          daysOrNone(body.days),
          body.origin ? clamp(body.origin, LIMITS.place) : undefined,
          clamp(body.interests, LIMITS.input),
        );
        return NextResponse.json({ ...verdict(), ...out });
      }
      case "stays": {
        if (!driver.stays) return NextResponse.json({ driver: "rules", stays: [] });
        const stays = await driver.stays(
          body.shape as TripShapeLeg[], body.brief as Brief, clamp(body.destinationId, 60),
          safePlaceContext(body.place),
        );
        return NextResponse.json({ ...verdict(), stays });
      }
      case "describeEdit": {
        const text = await driver.describeEdit(body.ops as EditOp[], ((body.summary as string[]) ?? []).slice(0, 12).map((x) => clamp(x, LIMITS.summary)));
        return NextResponse.json({ ...verdict(), text });
      }
      default:
        return bad(`unknown action "${action}"`);
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  } finally {
    // A call that threw still reached Anthropic and still cost tokens, so it
    // is charged like any other. A rules-driver request never gets here with
    // a raised attempt count and so is never charged at all.
    settle();
  }
}

/** A trip length, not whatever number arrived in the body. */
const days7 = (v: unknown) => Math.min(21, Math.max(1, Math.round(Number(v) || 7)));

/*
 * The same, except that "she didn't say" survives the wire.
 *
 * flow.ts deliberately sends `b.days`, which is undefined when she has never
 * given a length, so researchPrompt takes its "they have NOT told you how long
 * they have" branch. JSON.stringify drops an undefined key, so the body
 * arrives without it, and days7 turned that into 7: Number(undefined) is NaN,
 * NaN || 7 is 7. The fix in research.ts held and was undone one hop later, on
 * the server, which is how "Seven days door to door does not get you to
 * Everest Base Camp" reached someone who never gave a length.
 *
 * researchPack still uses days7, because the scheduler needs a real number.
 */
const daysOrNone = (v: unknown) =>
  v === undefined || v === null || v === "" || !Number.isFinite(Number(v))
    ? undefined
    : days7(v);

const bad = (message: string) => NextResponse.json({ error: message }, { status: 400 });
