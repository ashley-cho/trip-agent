"use client";

import { useState } from "react";
import type { Trip } from "@/lib/types";
import { REJECT_REASONS, type RejectReasonId } from "@/lib/reject";
import { cityById, destinationById } from "@/data/destinations";
import { Composer } from "./Chat";
import { Photo } from "./Photo";

const money = (n: number) => "$" + Math.round(n).toLocaleString();

export function Proposal({
  trip, onShow, onReject, onSay, busy,
}: {
  trip: Trip;
  onShow: () => void;
  onReject: (reason: RejectReasonId) => void;
  /** Free text, in the card. See the note on the composer below. */
  onSay: (text: string) => void;
  busy?: boolean;
}) {
  const c = trip.concept;
  const dest = destinationById(c.destinationId);
  const [arguing, setArguing] = useState(false);

  return (
    <div className="rise mx-auto w-full max-w-readable space-y-8 rounded-3xl border border-paper-edge bg-paper-card p-8 sm:p-10">
      <header className="space-y-4">
        <Photo
          query={[cityById(dest.hubCityId).name, `${cityById(dest.hubCityId).name} ${dest.name}`]}
          near={{ lat: cityById(dest.hubCityId).lat, lng: cityById(dest.hubCityId).lng }}
          alt={dest.name}
          ratio="21 / 9"
          className="group -mx-8 -mt-8 rounded-none sm:-mx-10 sm:-mt-10"
          rounded=""
        />
        <div className="space-y-1.5">
          <h2 className="font-voice text-[2.4rem] leading-tight">{dest.name}</h2>
          <p className="text-[0.95rem] text-ink-soft">
            {c.days} days · about {money(c.estimateUsd)} per person
          </p>
        </div>
      </header>

      <Section title="The vibe">
        <p className="font-voice text-[1.08rem] leading-relaxed">{c.vibe}</p>
      </Section>

      <Section title="The shape">
        <ol className="space-y-2.5">
          {c.shape.map((leg, i) => (
            <li key={`${leg.cityId}-${i}`} className="flex gap-3">
              <Photo
                query={[cityById(leg.cityId).name, `${cityById(leg.cityId).name} ${dest.name}`]}
                near={{ lat: cityById(leg.cityId).lat, lng: cityById(leg.cityId).lng }}
                alt={cityById(leg.cityId).name}
                ratio="1 / 1"
                className="group mt-0.5 hidden w-16 shrink-0 rounded-xl sm:block"
                rounded="rounded-xl"
              />
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent sm:hidden" />
              <div>
                <span className="font-voice text-[1.06rem]">{cityById(leg.cityId).name}</span>
                <span className="text-ink-soft"> — {leg.nights} night{leg.nights === 1 ? "" : "s"}</span>
                {leg.dayTrip && (
                  <div className="text-[0.9rem] text-ink-soft">
                    with a day out to {cityById(leg.dayTrip).name}
                  </div>
                )}
                <div className="mt-0.5 text-[0.86rem] text-ink-faint">{cityById(leg.cityId).base}</div>
              </div>
              {i < c.shape.length - 1 && <span className="sr-only">then</span>}
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Why I picked this">
        <p className="font-voice text-[1.08rem] leading-relaxed">{c.why}</p>
      </Section>

      <Section title="What you should know">
        <WhatYouShouldKnow trip={trip} />
      </Section>

      <Costs trip={trip} />

      <div className="space-y-3">
        <button
          onClick={onShow}
          disabled={busy}
          className="w-full rounded-full bg-ink px-6 py-3.5 font-voice text-[1.05rem] text-paper transition hover:bg-black disabled:opacity-40"
        >
          Show me the trip
        </button>

        {/* An opinionated recommendation still has to be arguable. Without
            this the card had one button on it and no way to disagree. */}
        {!arguing ? (
          <button
            onClick={() => setArguing(true)}
            disabled={busy}
            className="w-full rounded-full border border-paper-edge px-5 py-2.5 text-[0.92rem] text-ink-soft transition hover:border-ink-faint hover:text-ink disabled:opacity-40"
          >
            Not this one
          </button>
        ) : (
          <div className="rounded-2xl border border-paper-edge px-5 py-4">
            <p className="text-[0.92rem] text-ink-soft">
              What&apos;s wrong with it? I&apos;ll use the answer rather than just showing you a list.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {REJECT_REASONS.map((r) => (
                <button
                  key={r.id}
                  disabled={busy}
                  onClick={() => { setArguing(false); onReject(r.id); }}
                  className="rounded-full border border-paper-edge bg-paper px-3.5 py-1.5 text-[0.86rem] text-ink-soft transition hover:border-ink-faint hover:text-ink disabled:opacity-40"
                >
                  {r.label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-[0.84rem] text-ink-faint">
              Or say it in your own words, just below.
            </p>
          </div>
        )}

        {/* Section 28: free text, where the card actually asks for it. This
            used to live above the proposal, so the sentence offering it was a
            screen and a half below the box it referred to. */}
        <Composer
          disabled={busy}
          placeholder={"Somewhere warmer, make it five days, I want mountains\u2026"}
          onSend={onSay}
          autoFocus={arguing}
        />
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h3 className="text-[0.72rem] font-semibold uppercase tracking-[0.13em] text-ink-faint">{title}</h3>
      {children}
    </section>
  );
}

/**
 * Everything the plan is quietly assuming, in one place both screens render.
 *
 * These paragraphs lived in the Proposal body alone. The itinerary is the
 * screen that prints "Oct 13 (Tue)" on every card and enforces opening hours
 * against those weekdays — and it was the screen that never said the dates
 * were ours. Same for the simpler rooms: the itinerary showed the discounted
 * Hotels row and no sentence explaining it. The over-budget miss had exactly
 * this bug and was fixed by moving it; these are the rest of the family.
 */
export function WhatYouShouldKnow({ trip }: { trip: Trip }) {
  const c = trip.concept;
  const lines = [
    c.caveat,
    c.overrideNote,
    c.dateNote,
    c.unenforcedNote,
    c.trimmedForBudget
      ? "To hold your number I've put you in simpler rooms in the same neighborhoods, and leaned on "
        + "things that cost nothing. Say the word and I'll spend more."
      : undefined,
    c.paceShortfall,
  ].filter(Boolean) as string[];
  if (!lines.length) return null;
  return (
    <>
      {lines.map((line, i) => (
        <p key={line} className={`${i ? "mt-2 " : ""}text-[0.95rem] leading-relaxed text-ink-soft`}>{line}</p>
      ))}
    </>
  );
}

export function Costs({ trip }: { trip: Trip }) {
  const b = trip.concept.breakdown;
  const driving = destinationById(trip.concept.destinationId).arrival === "drive";
  const rows: [string, number][] = [
    [driving ? "Fuel and tolls" : "Flights", b.flights],
    ["Hotels", b.lodging],
    [driving ? "Parking and entry fees" : "Trains and transit", b.transport],
    ["Activities", b.activities], ["Food", b.food],
  ];
  return (
    <div className="rounded-2xl bg-paper-sunk p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-[0.72rem] font-semibold uppercase tracking-[0.13em] text-ink-faint">Estimate</span>
        <span className="font-voice text-[1.35rem]">{money(trip.concept.estimateUsd)}</span>
      </div>
      <dl className="space-y-1.5 text-[0.9rem]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between text-ink-soft">
            <dt>{k}</dt>
            <dd className="tabular-nums">{money(v)}</dd>
          </div>
        ))}
      </dl>
      {trip.concept.budgetShortfallUsd > 0 && (
        /*
         * The miss lives with the number it misses.
         *
         * This block was in the Proposal body only, so once she moved to the
         * itinerary "keep it under $1,500" was answered with "Re-cut to $2,238
         * from $2,789" and the $1,500 was never mentioned again. Thirteen
         * destinations of fifteen went over in silence.
         */
        <p className="mt-3 rounded-lg bg-warn px-3.5 py-2.5 text-[0.93rem] leading-relaxed text-ink">
          {trip.concept.budgetStated === false
            /*
             * "Over what you said" may only be said about a number she said.
             * `cheaper` anchors a target at 72% of the quote and writes it to
             * the brief, and this paragraph called that hers on 14 of 15
             * destinations.
             */
            ? <>This is about {money(trip.concept.budgetShortfallUsd)} above the number I aimed
              for when you said it was too expensive. Going lower means dropping a day rather than
              trimming the extras — say the word.</>
            : <>This still lands about {money(trip.concept.budgetShortfallUsd)} over what you said. I&apos;d
              rather tell you than quietly cut the trip down to fit. Dropping a day gets you most of the way there.</>}
        </p>
      )}
      <p className="mt-3 text-[0.78rem] leading-relaxed text-ink-faint">
        Seeded estimates, not live prices. Nothing here is booked or charged.
      </p>
    </div>
  );
}
