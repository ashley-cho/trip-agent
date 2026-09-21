"use client";

import { useEffect, useState } from "react";
import {
  clearOwnKey, limitState, looksLikeKey, maskKey, noteLimit, onLimit, ownKey, setOwnKey,
  type LimitState,
} from "@/lib/byok";

/**
 * What happens when the shared allowance runs out.
 *
 * Before this, hitting the limit dropped the app back to its offline planner
 * with no explanation, and the only clue was a small badge reading "rules
 * only". People would reasonably conclude the product had got worse rather
 * than that they had run into a ceiling.
 *
 * So: say what happened, and offer the way through. Their own key, entered by
 * them, kept in their browser, spent by them. No account, no payment page, no
 * upsell. The risks are stated rather than buried, because a page asking for
 * an API key owes people that.
 */
export function OwnKey() {
  const [state, setState] = useState<LimitState>({ limited: false });
  const [mine, setMine] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    setMine(ownKey());
    setState(limitState());
    return onLimit(setState);
  }, []);

  // Already on their own key: a quiet line, and a way back out.
  if (mine) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-faint">
        <span>Running on your own key, {maskKey(mine)}. You&apos;re paying Anthropic directly.</span>
        <button
          onClick={() => { clearOwnKey(); setMine(null); noteLimit({ limited: false }); }}
          className="underline-offset-2 transition hover:text-ink hover:underline"
        >
          Remove it
        </button>
      </div>
    );
  }

  if (!state.limited && !open) return null;

  const save = () => {
    if (!looksLikeKey(draft)) {
      setProblem("That doesn't look like an Anthropic key. They start with sk-ant-.");
      return;
    }
    if (!setOwnKey(draft)) { setProblem("This browser wouldn't store it. Private window?"); return; }
    setMine(draft.trim());
    setDraft("");
    setProblem(null);
    noteLimit({ limited: false });
  };

  const mins = state.retryAfter ? Math.ceil(state.retryAfter / 60) : null;

  return (
    <div className="rounded-none border border-paper-edge bg-paper-card px-5 py-4">
      <p className="text-[14px] leading-relaxed text-ink-soft">
        <span className="text-ink">
          {state.reason === "account"
            ? "This deployment's Anthropic account is out of credit."
            : state.reason === "daily"
              ? "This app has used up today's shared allowance."
              : "You've used up your share of the allowance for now."}
        </span>{" "}
        Vamos runs on one Anthropic key that someone pays for, so there&apos;s a ceiling on it.
        Planning still works below, on the offline version, which is noticeably less good:
        no research, no written recommendation, no named hotels.
        {state.reason === "account"
          ? " Your own key gets the full version back right now."
          : mins ? ` The shared one comes back in about ${mins} minute${mins === 1 ? "" : "s"}.` : ""}
      </p>

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="mt-3 rounded-none border border-paper-edge px-4 py-1.5 text-[14px] text-ink-soft transition hover:border-ink-faint hover:text-ink"
        >
          Use my own Anthropic key instead
        </button>
      ) : (
        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={draft}
              placeholder="sk-ant-…"
              onChange={(e) => { setDraft(e.target.value); setProblem(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") save(); }}
              className="min-w-[17rem] flex-1 rounded-none border border-paper-edge bg-paper px-4 py-2 font-mono text-[14px] outline-none transition focus:border-ink-faint"
            />
            <button
              onClick={save}
              disabled={!draft.trim()}
              className="rounded-none bg-ink px-5 py-2 text-[14px] text-paper transition hover:bg-black disabled:opacity-30"
            >
              Use it
            </button>
          </div>

          {problem && <p className="mt-2 text-[14px] text-ink">{problem}</p>}

          <div className="mt-3 space-y-1.5 text-[13px] leading-relaxed text-ink-faint">
            <p>
              Make one at{" "}
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noreferrer noopener"
                className="underline underline-offset-2 transition hover:text-ink"
              >
                console.anthropic.com
              </a>
              . A planned trip costs a few cents. Set a spend limit on the key while
              you&apos;re there; it takes a minute and it means a mistake can only cost you
              what you decided.
            </p>
            <p>
              Worth knowing before you paste it: the key is kept in this browser&apos;s storage,
              so any script running on this page could read it, and it&apos;s sent to this app&apos;s
              server with each request to make the call. It isn&apos;t written down there.
              Removing it here removes it completely.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
