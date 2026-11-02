"use client";

import { useState } from "react";
import type { Brief, Trip } from "@/lib/types";
import { REJECT_REASONS, type RejectReasonId } from "@/lib/reject";
import { cityById, destinationById, placeShown } from "@/data/destinations";
import { Composer } from "./Chat";
import { Photo } from "./Photo";

const money = (n: number) => "$" + Math.round(n).toLocaleString();

export function Proposal({
  trip, brief, onShow, onReject, onSay, busy,
}: {
  trip: Trip;
  /** Her words, for the line above the destination: "For hot springs and long walks". */
  brief?: Brief;
  onShow: () => void;
  onReject: (reason: RejectReasonId) => void;
  /** Free text, in the card. See the note on the composer below. */
  onSay: (text: string) => void;
  busy?: boolean;
}) {
  const c = trip.concept;
  const dest = destinationById(c.destinationId);
  const [arguing, setArguing] = useState(false);

  const bases = basesLine(trip);
  const forHer = (brief?.activities ?? []).map((a) => a.replace(/[.!?]+$/, ""));
  const overline = forHer.length
    ? `For ${forHer.length > 1 ? `${forHer.slice(0, -1).join(", ")} and ${forHer[forHer.length - 1]}` : forHer[0]}`
    : brief?.vibes.length ? `For ${brief.vibes.join(", ")}` : c.headline.replace(/^I think you should go to /i, "").replace(/\.$/, "");
  const title = placeShown(dest.id, c.shape, brief?.focusCityId);

  return (
    <div className="rise mx-auto w-full max-w-readable space-y-4">
      {/* The hero: the place as a photograph, its name set on it. The block
          behind is a dark ground, so the name still reads when no photo is
          found or while one loads. */}
      <header className="relative flex min-h-[22rem] flex-col justify-between overflow-hidden rounded-2xl bg-[#2d3a4a] p-5 text-white">
        <Photo
          query={[cityById(dest.hubCityId).name, `${cityById(dest.hubCityId).name} ${dest.name}`]}
          near={{ lat: cityById(dest.hubCityId).lat, lng: cityById(dest.hubCityId).lng }}
          alt={dest.name}
          ratio="auto"
          className="!absolute inset-0 h-full w-full !bg-transparent"
          rounded=""
        />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.5)_0%,rgba(0,0,0,0)_40%,rgba(0,0,0,0)_65%,rgba(0,0,0,.45)_100%)]" />
        <div className="relative space-y-1">
          <h2 className="font-voice text-[30px] font-normal leading-[1.1] tracking-[-0.02em] sm:text-[36px]">{title}</h2>
          <p className="text-[14px] text-white/85">{c.days} days · {bases}</p>
        </div>
        {/* The overline is her reason. When there is none it read the
            headline back, which for "provence" put PROVENCE over Provence. */}
        {overline.toLowerCase() !== title.toLowerCase() && (
          <div className="relative self-end text-right text-[11px] font-medium uppercase tracking-[0.12em] text-butter">{overline}</div>
        )}
      </header>

      <Section title="The shape">
        <ol>
          {c.shape.map((leg, i) => (
            <li key={`${leg.cityId}-${i}`} className="grid grid-cols-[6rem_1fr] gap-x-4 border-b border-paper-edge py-1.5 text-[16px]">
              <span className="font-medium">{cityById(leg.cityId).name}</span>
              <span className="leading-relaxed">
                {leg.nights} night{leg.nights === 1 ? "" : "s"}
                {leg.returnLeg
                  ? <span className="text-ink-faint">, back for the flight</span>
                  : <>
                      {leg.dayTrip && <>, with a day out to {cityById(leg.dayTrip).name}</>}
                      {cityById(leg.cityId).base && <span className="text-ink-faint"> · {cityById(leg.cityId).base}</span>}
                    </>}
              </span>
            </li>
          ))}
        </ol>
      </Section>

      {knowLines(trip).length > 0 && (
        <section className="space-y-1.5 rounded-2xl bg-butter px-5 py-4 text-[#111111]">
          <h3 className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#4c4b4b]">Worth knowing</h3>
          <WhatYouShouldKnow trip={trip} tone="on-butter" />
        </section>
      )}

      <div className="space-y-1 pt-1">
        <button
          onClick={onShow}
          disabled={busy}
          className="flex h-12 w-full items-center justify-center rounded-full bg-ink text-[12px] font-medium uppercase tracking-[0.14em] text-on-ink transition hover:opacity-85 disabled:opacity-40"
        >
          Show me the trip
        </button>

        {/* An opinionated recommendation still has to be arguable. Without
            this the card had one button on it and no way to disagree. */}
        {!arguing ? (
          <button
            onClick={() => setArguing(true)}
            disabled={busy}
            className="flex h-12 w-full items-center justify-center rounded-full border border-paper-edge text-[14px] text-ink transition hover:border-ink-faint disabled:opacity-40"
          >
            Not this one
          </button>
        ) : (
          <div className="rounded-2xl bg-paper-card px-5 py-4">
            <p className="text-[14px] text-ink-soft">
              What&apos;s wrong with it? I&apos;ll use the answer rather than just showing you a list.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {REJECT_REASONS.map((r) => (
                <button
                  key={r.id}
                  disabled={busy}
                  onClick={() => { setArguing(false); onReject(r.id); }}
                  className="rounded-full border border-paper-edge px-3.5 py-1.5 text-[14px] text-ink-soft transition hover:border-ink-faint hover:text-ink disabled:opacity-40"
                >
                  {r.label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-[13px] text-ink-faint">
              Or say it in your own words, just below.
            </p>
          </div>
        )}

        {/* Cost, once, small, at the end. It was in the header line, in a
            breakdown card and in the vibe; she does not want to be sold on
            it and she does not want to see it three times. */}
        <CostLine trip={trip} className="pt-1" />

        {/* Section 28: free text, where the card actually asks for it. This
            used to live above the proposal, so the sentence offering it was a
            screen and a half below the box it referred to. */}
        <Composer
          disabled={busy}
          placeholder={"Make it five days. Skip a base. More walking."}
          onSend={onSay}
          autoFocus={arguing}
        />
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1">
      <h3 className="pb-1 font-voice text-[22px] font-normal tracking-[-0.01em]">{title}</h3>
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
/** The bases you sleep in, once each, in order: "Seoul and Busan". */
export function basesLine(trip: Trip): string {
  const beds = [...new Set(trip.concept.shape.filter((l) => l.nights > 0).map((l) => cityById(l.cityId).name))];
  return beds.length > 1 ? `${beds.slice(0, -1).join(", ")} and ${beds[beds.length - 1]}` : (beds[0] ?? "");
}

export function knowLines(trip: Trip): string[] {
  const c = trip.concept;
  return [
    c.eventNote,
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
}

export function WhatYouShouldKnow({ trip, tone }: { trip: Trip; tone?: "on-butter" }) {
  const lines = knowLines(trip);
  if (!lines.length) return null;
  return (
    <>
      {lines.map((line, i) => (
        <p key={line} className={`${i ? "mt-1 " : ""}text-[15px] leading-relaxed ${tone === "on-butter" ? "text-[#111111]" : "text-ink-soft"}`}>{line}</p>
      ))}
    </>
  );
}

/**
 * Cost, once, as one line, on both screens. The breakdown card is gone: she
 * does not want to be sold on the price and does not want to see it three
 * times. The shortfall still lives with the number it misses, and "over what
 * you said" is still only said about a number she said.
 */
export function CostLine({ trip, className = "" }: { trip: Trip; className?: string }) {
  const c = trip.concept;
  const driving = destinationById(c.destinationId).arrival === "drive";
  return (
    <p className={`text-[14px] leading-relaxed text-ink-faint ${className}`}>
      About {money(c.estimateUsd)} a person, {driving ? "fuel" : "flights"} included.
      Seeded estimate; nothing is booked.
      {c.budgetShortfallUsd > 0 && (c.budgetStated === false
        ? ` About ${money(c.budgetShortfallUsd)} above the number I aimed for when you said it was too expensive; going lower means dropping a day.`
        : ` That is ${money(c.budgetShortfallUsd)} over what you said; dropping a day gets you most of the way there.`)}
    </p>
  );
}
