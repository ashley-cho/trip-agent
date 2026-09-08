"use client";

import { useState } from "react";

const QUESTIONS = [
  { id: "would_take", text: "Would you actually take this trip?" },
  { id: "saved_time", text: "Did this save you meaningful planning time?" },
  { id: "understood", text: "Did it feel like I understood your travel style?" },
  { id: "would_trust", text: "Would you trust me to book it?" },
] as const;

/**
 * Section 35, captured in the product rather than in a survey afterwards.
 * These answers are what new eval scenarios get written from.
 */
export function Feedback({ onSubmit }: { onSubmit: (answers: Record<string, number>, note: string) => void }) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const complete = QUESTIONS.every((q) => answers[q.id] !== undefined);

  if (sent) {
    return (
      <section className="rise rounded-2xl border border-paper-edge bg-paper-card px-6 py-5 text-[0.95rem] text-ink-soft">
        Noted — that goes straight into what I test against.
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-paper-edge bg-paper-card px-6 py-5">
      <h3 className="font-voice text-[1.15rem]">Be honest with me</h3>
      <div className="mt-4 space-y-4">
        {QUESTIONS.map((q) => (
          <div key={q.id} className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[0.93rem] text-ink-soft">{q.text}</span>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: n }))}
                  aria-label={`${q.text} — ${n} of 5`}
                  className={`h-8 w-8 rounded-full border text-center text-[0.8rem] transition
                    ${answers[q.id] === n
                      ? "border-accent bg-accent text-paper"
                      : "border-paper-edge hover:border-ink-faint"}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="What would have made this better?"
        className="mt-4 w-full resize-none rounded-xl border border-paper-edge bg-paper px-3.5 py-2.5 text-[0.92rem] outline-none placeholder:text-ink-faint focus:border-ink-faint"
      />
      <button
        disabled={!complete}
        onClick={() => { onSubmit(answers, note); setSent(true); }}
        className="mt-3 rounded-full bg-ink px-5 py-2 text-[0.88rem] text-paper transition hover:bg-black disabled:opacity-25"
      >
        Send
      </button>
    </section>
  );
}
