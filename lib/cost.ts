/**
 * What a trip actually costs to plan.
 *
 * Every figure in this project about "a few cents a trip" was, until now, my
 * estimate rather than a measurement. Anthropic returns exact token counts on
 * every call and we were throwing them away. You cannot price a product on a
 * guess, and you cannot size an allowance on one either.
 *
 * These prices are a table in the code, not something fetched from Anthropic,
 * so they can go stale. The UI says so, and this is the one place to correct
 * them.
 */

export interface Usage {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  /** Written with the default five minute TTL. */
  cacheWriteTokens: number;
  /** Written with the one hour TTL, which costs 2x input rather than 1.25x. */
  cacheWrite1hTokens: number;
  /** Server-side web searches, billed per search rather than per token. */
  searches: number;
}

export const emptyUsage = (): Usage => ({
  calls: 0, inputTokens: 0, outputTokens: 0,
  cacheReadTokens: 0, cacheWriteTokens: 0, cacheWrite1hTokens: 0, searches: 0,
});

export function addUsage(a: Usage, b: Partial<Usage>): Usage {
  return {
    calls: a.calls + (b.calls ?? 0),
    inputTokens: a.inputTokens + (b.inputTokens ?? 0),
    outputTokens: a.outputTokens + (b.outputTokens ?? 0),
    cacheReadTokens: a.cacheReadTokens + (b.cacheReadTokens ?? 0),
    cacheWriteTokens: a.cacheWriteTokens + (b.cacheWriteTokens ?? 0),
    cacheWrite1hTokens: a.cacheWrite1hTokens + (b.cacheWrite1hTokens ?? 0),
    searches: a.searches + (b.searches ?? 0),
  };
}

/** USD per million tokens. Check against Anthropic's pricing page. */
/**
 * `cacheWrite` is the five-minute price, 1.25x input. A one hour entry costs
 * 2x input to write, and this app asks for one hour (see lib/agent/llm.ts),
 * so writes have to be priced at the TTL they were actually written with or
 * the app under-reports its own bill.
 */
interface Price { input: number; output: number; cacheRead: number; cacheWrite: number; }

/** What a one hour write costs: 2x base input, against 1.25x for five minutes. */
const write1h = (p: Price) => p.input * 2;

/*
 * Checked against platform.claude.com/docs/en/about-claude/pricing rather than
 * from memory. Longest matching prefix wins, so a dated snapshot like
 * claude-sonnet-4-5-20250929 prices as Sonnet 4.5, and claude-sonnet-5 is not
 * mistaken for it.
 */
const PRICES: Record<string, Price> = {
  "claude-fable-5-1":  { input: 10, output: 50, cacheRead: 0.25, cacheWrite: 12.50 },
  "claude-mythos-5-1": { input: 10, output: 50, cacheRead: 0.25, cacheWrite: 12.50 },
  "claude-fable-5":    { input: 10, output: 50, cacheRead: 1, cacheWrite: 12.50 },
  "claude-mythos-5":   { input: 10, output: 50, cacheRead: 1, cacheWrite: 12.50 },
  "claude-opus-5":     { input: 5, output: 25, cacheRead: 0.50, cacheWrite: 6.25 },
  "claude-opus-4-8":   { input: 5, output: 25, cacheRead: 0.50, cacheWrite: 6.25 },
  "claude-opus-4-7":   { input: 5, output: 25, cacheRead: 0.50, cacheWrite: 6.25 },
  "claude-opus-4-6":   { input: 5, output: 25, cacheRead: 0.50, cacheWrite: 6.25 },
  "claude-opus-4-5":   { input: 5, output: 25, cacheRead: 0.50, cacheWrite: 6.25 },
  "claude-opus-4-1":   { input: 15, output: 75, cacheRead: 1.50, cacheWrite: 18.75 },
  "claude-opus-4":     { input: 15, output: 75, cacheRead: 1.50, cacheWrite: 18.75 },
  "claude-sonnet-5":   { input: 2, output: 10, cacheRead: 0.20, cacheWrite: 2.50 },
  "claude-sonnet-4-6": { input: 3, output: 15, cacheRead: 0.30, cacheWrite: 3.75 },
  "claude-sonnet-4-5": { input: 3, output: 15, cacheRead: 0.30, cacheWrite: 3.75 },
  "claude-sonnet-4":   { input: 3, output: 15, cacheRead: 0.30, cacheWrite: 3.75 },
  "claude-haiku-4-5":  { input: 1, output: 5, cacheRead: 0.10, cacheWrite: 1.25 },
  "claude-haiku-3-5":  { input: 0.80, output: 4, cacheRead: 0.08, cacheWrite: 1 },
};

const DEFAULT_MODEL = "claude-sonnet-5";
/** Server-side web search, per thousand searches. */
const SEARCH_PER_1K = 10;

export function priceOf(model: string): Price {
  // Longest prefix, not first match. "claude-sonnet-5" is a prefix of nothing
  // else, but "claude-opus-4" is a prefix of "claude-opus-4-5", and taking the
  // first hit would have priced a $5 model at $15.
  const hit = Object.keys(PRICES)
    .filter((k) => model.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return PRICES[hit ?? DEFAULT_MODEL];
}

export function usdFor(u: Usage, model = DEFAULT_MODEL): number {
  const p = priceOf(model);
  return (
    (u.inputTokens / 1e6) * p.input +
    (u.outputTokens / 1e6) * p.output +
    (u.cacheReadTokens / 1e6) * p.cacheRead +
    (u.cacheWriteTokens / 1e6) * p.cacheWrite +
    (u.cacheWrite1hTokens / 1e6) * write1h(p) +
    (u.searches / 1000) * SEARCH_PER_1K
  );
}

/**
 * Money, at the scale this actually happens.
 *
 * A trip costs cents, so rounding to two decimal places renders most of them
 * as "$0.00", which tells you nothing and looks like a bug. Below a cent it
 * says so in tenths.
 */
export function money(usd: number): string {
  if (usd <= 0) return "$0";
  if (usd < 0.01) return `${(usd * 100).toFixed(1)}¢`;
  if (usd < 1) return `${Math.round(usd * 100)}¢`;
  return `$${usd.toFixed(2)}`;
}
