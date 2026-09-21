"use client";

import { useEffect, useState } from "react";
import { money, usdFor, type Usage } from "@/lib/cost";
import { totalUsage, tripUsage } from "@/lib/spend";

/**
 * What this cost to plan.
 *
 * Shown because the number decides things: whether the free allowance is
 * generous or reckless, whether charging is worth the trouble of becoming a
 * merchant, and what a credit would have to be worth. Every previous figure
 * in this project was an estimate. This one is the API's own token count.
 */
export function TripSpend({ tripId }: { tripId: string }) {
  const [u, setU] = useState<Usage | null>(null);

  useEffect(() => { setU(tripUsage(tripId)); }, [tripId]);
  if (!u || !u.calls) return null;

  const usd = usdFor(u);
  return (
    <details className="rounded-none border border-paper-edge bg-paper-card px-6 py-4">
      <summary className="cursor-pointer list-none text-[14px] text-ink-faint transition hover:text-ink">
        Planning this trip cost <span className="text-ink">{money(usd)}</span> in model calls.
      </summary>
      <dl className="mt-3 space-y-1 border-t border-paper-edge pt-3 text-[14px] text-ink-faint">
        <Row k="Calls" v={u.calls.toLocaleString()} />
        <Row k="Tokens in" v={u.inputTokens.toLocaleString()} />
        <Row k="Tokens out" v={u.outputTokens.toLocaleString()} />
        {u.cacheReadTokens > 0 && <Row k="Cached in" v={u.cacheReadTokens.toLocaleString()} />}
        {u.searches > 0 && <Row k="Web searches" v={String(u.searches)} />}
      </dl>
      <p className="mt-3 text-[13px] leading-relaxed text-ink-faint">
        Token counts come from the API. The per-token prices are a table in this app&apos;s code
        and can go stale, so check them against Anthropic&apos;s pricing page before deciding
        anything with a dollar sign in it.
      </p>
    </details>
  );
}

/**
 * What the TRIPS in this browser cost. Not what the account spent.
 *
 * "11 trips planned in this browser, $1.77 of model calls in total, about
 * 16¢ each" was read, reasonably, as an account total — and the account had
 * just burned through $20. Both numbers were true and the sentence was not,
 * because "in total" was doing work the ledger cannot support.
 *
 * The ledger is keyed by trip id and lives in this browser's localStorage, so
 * three whole categories of spend are invisible to it by construction:
 *
 *   - anything on another device or browser;
 *   - anything that does not belong to a trip, which on the day this was
 *     written meant sixty-seven destinations researched into the shared
 *     catalogue at roughly 27¢ each — about $18 that no trip was ever
 *     charged for, against $1.77 that was;
 *   - anything calling the API directly rather than through lib/client.ts,
 *     which is where chargeTrip is wired.
 *
 * A number that can only ever be a floor must say so. The honest fix is one
 * word of scope, not a bigger number: this is what planning cost, and the
 * only place that knows the account total is the Anthropic console.
 */
export function TotalSpend() {
  const [state, setState] = useState<{ usage: Usage; trips: number } | null>(null);

  useEffect(() => { setState(totalUsage()); }, []);
  if (!state || !state.usage.calls) return null;

  const usd = usdFor(state.usage);
  const per = usd / Math.max(1, state.trips);
  return (
    <p className="text-[13px] leading-relaxed text-ink-faint">
      {state.trips} trip{state.trips === 1 ? "" : "s"} planned in this browser, {money(usd)} of
      model calls to plan them, about {money(per)} each. Researching somewhere new
      costs more and isn&apos;t counted here; your account total is in the Anthropic console.
    </p>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <dt>{k}</dt>
      <dd className="tabular-nums">{v}</dd>
    </div>
  );
}
