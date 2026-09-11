/**
 * What stands between a public URL and someone else's Anthropic bill.
 *
 * The key lives on the server, which is right, but it also means anyone who
 * can load the page can spend it. Every model-backed action therefore costs
 * units: cheap for the ones that shape a conversation, expensive for the ones
 * that run searches and write a data pack. A visitor gets an hourly allowance
 * and the deployment gets a daily one.
 *
 * Be honest about what this is. Serverless instances don't share memory, so
 * counters here are per warm instance and a determined attacker spraying
 * requests across cold starts gets more than the numbers below suggest. It
 * stops casual abuse and runaway loops. The only hard ceiling is a spend limit
 * set on the Anthropic account itself, which no amount of application code can
 * substitute for.
 *
 * Being over a limit is never an error the traveller sees. The route returns
 * 429, the browser client falls back to its own rules driver, and the trip
 * still gets planned. It just gets planned by the dumber half of the product.
 */

/** What each action costs. Research runs web searches and writes a full pack. */
const COST: Record<string, number> = {
  interpret: 1,
  question: 1,
  pitch: 1,
  parseEdit: 1,
  describeEdit: 1,
  // One call, no search. Cheap on purpose: it is the step that decides
  // whether an expensive research run is even needed.
  suggest: 1,
  stays: 3,
  researchStream: 6,
  researchNotes: 6,
  researchPack: 6,
  // Cheaper than a full research call and there are several per trip, so a
  // researched destination costs about two conversations' worth in total.
  researchPlaces: 4,
  research: 10,
  // The whole run, in one request: notes, pack, and a fill-in call per base.
};

/**
 * What an action would cost, for a caller that has to decide whether to charge
 * it. Exported so the route can ask before it does the work and charge after,
 * rather than charging on arrival — see the note there. Unknown actions are
 * free, exactly as `charge` treats them.
 */
export const costOf = (action: string): number => COST[action] ?? 0;

const num = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

/*
 * Two different jobs, and only one of them is protecting the bill.
 *
 * PER_DAY is the ceiling on what the deployment can spend. That is the number
 * that stops a bad afternoon costing real money, and it has not moved.
 *
 * PER_VISITOR_HOURLY is anti-abuse per person: it stops ONE caller consuming
 * the whole day in ten minutes. At 60 it also stopped the owner filling her
 * own catalogue — seeding sixty destinations returned `429 visitor, retry
 * after 3387s` on the ninth, and the honest reading of that is that the
 * per-person number was standing in for a spend limit it was not the right
 * tool for.
 *
 * So the per-person allowance is loosened and the spend ceiling is untouched.
 * What a stranger can do is reach the daily cap faster; what they cannot do
 * is raise it, which means the worst case for the bill is exactly what it was
 * before. That is the trade, stated rather than buried: this moves WHO can
 * spend the budget, not HOW MUCH there is.
 */
const PER_VISITOR_HOURLY = () => num("TRIP_AGENT_VISITOR_UNITS", 400);
/** Per warm instance. Sized so a quiet day costs single-digit dollars. */
const PER_DAY = () => num("TRIP_AGENT_DAILY_UNITS", 1500);

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

interface Spend { at: number; units: number; }

const visitors = new Map<string, Spend[]>();
let day = { started: Date.now(), units: 0 };

/** Vercel sets x-forwarded-for. Take the first hop; the rest is spoofable. */
export function visitorId(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Running it on your own machine is not a visitor.
 *
 * The limit exists so a stranger on the public deployment cannot spend
 * someone else's key. On localhost the only person spending the key is the
 * person who owns it, and the limit was stopping her testing her own app
 * mid-sentence, then telling her to come back in forty minutes.
 *
 * Deliberately narrow: the dev server only, recognised from the request's own
 * Host header. A deployed build is never localhost, so this cannot loosen
 * anything in production, and the daily ceiling is untouched either way.
 */
export function isLocalDev(req: Request): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const host = (() => {
    try { return new URL(req.url).hostname; } catch { return ""; }
  })();
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function prune(now: number) {
  for (const [id, spends] of visitors) {
    const kept = spends.filter((s) => now - s.at < HOUR);
    if (kept.length) visitors.set(id, kept);
    else visitors.delete(id);
  }
  // Bound the map regardless, so a spray of unique addresses can't grow it
  // without limit. Oldest first.
  if (visitors.size > 5000) {
    const oldest = [...visitors.entries()]
      .sort((a, b) => (a[1][0]?.at ?? 0) - (b[1][0]?.at ?? 0))
      .slice(0, visitors.size - 5000);
    for (const [id] of oldest) visitors.delete(id);
  }
}

export interface Verdict {
  ok: boolean;
  /** Seconds until the visitor could try again. Only set when ok is false. */
  retryAfter?: number;
  reason?: "visitor" | "daily";
}

/**
 * Charge an action against both allowances. Actions with no model behind them
 * are free, so the deterministic half of the product never rate-limits.
 */
/**
 * Would this action be allowed, without recording it?
 *
 * A researched destination is four calls and twenty-four units, and the
 * allowance can run out between the second and the third. That left someone
 * reading a paragraph about the Faroe Islands for thirty seconds and then
 * getting nothing at all, which is the worst possible place to stop. Asking
 * first costs one free round trip and turns it into a sentence up front.
 */
export function peek(units: number, id: string, allowanceMultiplier = 1): Verdict {
  const now = Date.now();
  if (now - day.started > DAY) day = { started: now, units: 0 };
  prune(now);
  if (allowanceMultiplier === 1 && day.units + units > PER_DAY()) {
    return { ok: false, reason: "daily", retryAfter: Math.ceil((day.started + DAY - now) / 1000) };
  }
  const spends = visitors.get(id) ?? [];
  const spent = spends.reduce((s, x) => s + x.units, 0);
  if (spent + units > PER_VISITOR_HOURLY() * allowanceMultiplier) {
    const oldest = spends[0]?.at ?? now;
    return { ok: false, reason: "visitor", retryAfter: Math.ceil((oldest + HOUR - now) / 1000) };
  }
  return { ok: true };
}

/** What a whole researched destination costs: notes, pack, and the fill-in. */
export const RESEARCH_UNITS = COST.researchNotes + COST.researchPack + COST.researchPlaces * 3;

/*
 * Seeding runs the whole thing in one request, so it costs the whole thing.
 * Derived rather than written down: a knob moved above must not leave the
 * seeding path charging last week's price.
 */
COST.seed = RESEARCH_UNITS;

export function charge(action: string, id: string, allowanceMultiplier = 1): Verdict {
  const units = COST[action];
  if (!units) return { ok: true };

  const now = Date.now();
  if (now - day.started > DAY) day = { started: now, units: 0 };
  prune(now);

  // Someone on their own key doesn't touch the deployment's daily budget at
  // all: that number exists to protect one Anthropic bill, and it isn't theirs.
  if (allowanceMultiplier === 1 && day.units + units > PER_DAY()) {
    return { ok: false, reason: "daily", retryAfter: Math.ceil((day.started + DAY - now) / 1000) };
  }

  const spends = visitors.get(id) ?? [];
  const spent = spends.reduce((s, x) => s + x.units, 0);
  if (spent + units > PER_VISITOR_HOURLY() * allowanceMultiplier) {
    const oldest = spends[0]?.at ?? now;
    return { ok: false, reason: "visitor", retryAfter: Math.ceil((oldest + HOUR - now) / 1000) };
  }

  spends.push({ at: now, units });
  visitors.set(id, spends);
  if (allowanceMultiplier === 1) day.units += units;
  return { ok: true };
}

/**
 * Length caps. Nothing a person types about a holiday is longer than this, and
 * an endpoint that takes unbounded text is an endpoint someone will use to
 * write their homework on your account.
 */
export const LIMITS = {
  input: 600,
  place: 80,
  summary: 400,
};

export const clamp = (v: unknown, max: number) => String(v ?? "").slice(0, max);

/** For the response headers, so the behaviour is visible rather than magic. */
export function budgetHeaders(): Record<string, string> {
  return {
    "x-trip-agent-day-units": String(day.units),
    "x-trip-agent-day-limit": String(PER_DAY()),
  };
}
