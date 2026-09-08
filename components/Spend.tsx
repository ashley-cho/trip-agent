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
    <details className="rounded-2xl border border-paper-edge bg-paper-card px-6 py-4">
      <summary className="cursor-pointer list-none text-[0.86rem] text-ink-faint transition hover:text-ink">
        Planning this trip cost <span className="text-ink">{money(usd)}</span> in model calls.
      </summary>
      <dl className="mt-3 space-y-1 border-t border-paper-edge pt-3 text-[0.84rem] text-ink-faint">
        <Row k="Calls" v={u.calls.toLocaleString()} />
        <Row k="Tokens in" v={u.inputTokens.toLocaleString()} />
        <Row k="Tokens out" v={u.outputTokens.toLocaleString()} />
        {u.cacheReadTokens > 0 && <Row k="Cached in" v={u.cacheReadTokens.toLocaleString()} />}
        {u.searches > 0 && <Row k="Web searches" v={String(u.searches)} />}
      </dl>
      <p className="mt-3 text-[0.78rem] leading-relaxed text-ink-faint">
        Token counts come from the API. The per-token prices are a table in this app&apos;s code
        and can go stale, so check them against Anthropic&apos;s pricing page before deciding
        anything with a dollar sign in it.
      </p>
    </details>
  );
}

/** The whole browser's spend, for sizing an allowance or a price. */
export function TotalSpend() {
  const [state, setState] = useState<{ usage: Usage; trips: number } | null>(null);

  useEffect(() => { setState(totalUsage()); }, []);
  if (!state || !state.usage.calls) return null;

  const usd = usdFor(state.usage);
  const per = usd / Math.max(1, state.trips);
  return (
    <p className="text-[0.8rem] leading-relaxed text-ink-faint">
      {state.trips} trip{state.trips === 1 ? "" : "s"} planned in this browser, {money(usd)} of
      model calls in total, about {money(per)} each.
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
