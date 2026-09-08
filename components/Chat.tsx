"use client";

import { useEffect, useRef, useState } from "react";
import type { Question } from "@/lib/agent/types";

export interface Msg { id: string; from: "agent" | "user"; text: string }

export function Bubble({ m }: { m: Msg }) {
  const agent = m.from === "agent";
  return (
    <div className={`rise flex ${agent ? "justify-start" : "justify-end"}`}>
      <div
        className={
          agent
            ? "max-w-[38rem] font-voice text-[1.06rem] leading-relaxed text-ink"
            : "max-w-[30rem] rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-[0.94rem] text-paper"
        }
      >
        {m.text}
      </div>
    </div>
  );
}

export function Thinking({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2.5 py-2" aria-label={label ?? "Thinking"}>
      <span className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="dot h-1.5 w-1.5 rounded-full bg-ink-faint"
                style={{ animationDelay: `${i * 0.16}s` }} />
        ))}
      </span>
      {/* Research takes the better part of a minute. Silence for that long
          reads as a hang, so say what it's doing. */}
      {label && <span className="text-[0.85rem] text-ink-faint">{label}</span>}
    </div>
  );
}

export function Chips({
  question, onPick, disabled,
}: { question: Question; onPick: (values: string[], label: string) => void; disabled?: boolean }) {
  const [picked, setPicked] = useState<string[]>([]);
  const multi = question.kind === "multi";
  if (!question.options?.length) return null;

  const toggle = (v: string) => {
    if (!multi) return onPick([v], question.options!.find((o) => o.value === v)!.label);
    setPicked((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));
  };

  return (
    <div className="rise space-y-3">
      <div className="flex flex-wrap gap-2">
        {question.options.map((o) => {
          const on = picked.includes(o.value);
          return (
            <button
              key={o.value}
              disabled={disabled}
              onClick={() => toggle(o.value)}
              className={`rounded-full border px-3.5 py-1.5 text-[0.9rem] transition
                ${on ? "border-accent bg-accent text-paper" : "border-paper-edge bg-paper-card text-ink hover:border-ink-faint"}
                disabled:opacity-40`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {multi && (
        <button
          disabled={disabled || picked.length === 0}
          onClick={() =>
            onPick(picked, picked.map((v) => question.options!.find((o) => o.value === v)!.label).join(", "))}
          className="rounded-full bg-ink px-4 py-1.5 text-[0.88rem] text-paper transition hover:bg-black disabled:opacity-25"
        >
          That&apos;s it
        </button>
      )}
    </div>
  );
}

export function Composer({
  onSend, placeholder, placeholders, disabled, autoFocus, working, onStop,
}: {
  onSend: (t: string) => void; placeholder: string; disabled?: boolean;
  /**
   * Rotating suggestions, shown in place of the fixed placeholder.
   *
   * The home screen used to carry a row of buttons underneath the box with
   * example openings on them. They were the same three every time and they
   * read as the options rather than as examples, which is the opposite of an
   * open text box. The examples belong in the box, one at a time, changing.
   */
  placeholders?: string[];
  autoFocus?: boolean;
  /** Something long is running, and this is what calls it off. */
  working?: boolean; onStop?: () => void;
}) {
  const [v, setV] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  /*
   * Start somewhere random so it is not the same line every visit, then move
   * on slowly. Stops the moment she types, because a prompt that keeps
   * changing under a half-written sentence is a distraction.
   */
  const [slot, setSlot] = useState(0);
  useEffect(() => {
    if (!placeholders?.length) return;
    setSlot(Math.floor(Math.random() * placeholders.length));
  }, [placeholders]);
  useEffect(() => {
    if (!placeholders || placeholders.length < 2 || v) return;
    const quick = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const id = setInterval(() => setSlot((n) => n + 1), quick ? 9000 : 4500);
    return () => clearInterval(id);
  }, [placeholders, v]);
  const shown = placeholders?.length
    ? placeholders[slot % placeholders.length]
    : placeholder;

  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }, [v]);

  const stoppable = !!working && !!onStop;

  const send = () => {
    const t = v.trim();
    if (!t || disabled) return;
    setV("");
    // Typing while it is thinking IS the correction. Wait for the wrong answer
    // to finish arriving before accepting the right instruction and it is not
    // a correction any more.
    if (stoppable) onStop!();
    onSend(t);
  };

  return (
    <div className="flex items-end gap-2 rounded-2xl border border-paper-edge bg-paper-card px-4 py-2.5
                    focus-within:border-ink-faint transition">
      <textarea
        ref={ref}
        rows={1}
        value={v}
        disabled={disabled && !stoppable}
        placeholder={shown}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
        className="flex-1 resize-none bg-transparent py-1 text-[0.96rem] outline-none placeholder:text-ink-faint disabled:opacity-50"
      />
      <button
        onClick={stoppable && !v.trim() ? onStop : send}
        disabled={stoppable ? false : (disabled || !v.trim())}
        aria-label={stoppable && !v.trim() ? "Stop" : "Send"}
        title={stoppable && !v.trim() ? "Stop" : "Send"}
        className="mb-0.5 rounded-full bg-ink p-2 text-paper transition hover:bg-black disabled:opacity-20"
      >
        {stoppable && !v.trim() ? (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
            <rect x="4" y="4" width="8" height="8" rx="1.5" fill="currentColor" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M8 13V3M8 3L3.5 7.5M8 3l4.5 4.5" stroke="currentColor" strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
    </div>
  );
}
