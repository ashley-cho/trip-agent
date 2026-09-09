"use client";

import { useState } from "react";
import type { ItineraryDay, ItineraryItem, Trip, TravelerProfile } from "@/lib/types";
import { cityById } from "@/data/destinations";
import { prettyTime, toMin, toClock } from "@/lib/geo";
import { MiniMap } from "./MiniMap";
import { Costs, WhatYouShouldKnow } from "./Proposal";
import { destinationById } from "@/data/destinations";
import { prettyDate } from "@/lib/dates";
import { Photo } from "./Photo";
import { tripLinks, legDates, hotelLink, mapsLink } from "@/lib/links";

const money = (n: number) => "$" + Math.round(n).toLocaleString();
const dur = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}` : `${m}m`);
const dayName = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });

const ICON: Record<string, string> = {
  meal: "🍽", transit: "🚆", logistics: "🧳", downtime: "", activity: "",
};

export function Itinerary({
  trip, profile, onRemove,
}: { trip: Trip; profile: TravelerProfile; onRemove: (item: ItineraryItem) => void }) {
  const [open, setOpen] = useState<number[]>([1]);
  const toggle = (i: number) => setOpen((o) => (o.includes(i) ? o.filter((x) => x !== i) : [...o, i]));

  return (
    <div className="space-y-4">
      {trip.days.map((d) => (
        <Day key={d.index} day={d} isOpen={open.includes(d.index)} onToggle={() => toggle(d.index)} onRemove={onRemove} />
      ))}
      <div className="rounded-2xl bg-paper-sunk p-5">
        <span className="mb-2 block text-[0.72rem] font-semibold uppercase tracking-[0.13em] text-ink-faint">
          What you should know
        </span>
        <WhatYouShouldKnow trip={trip} />
      </div>
      {trip.passedOn.length > 0 && <PassedOn trip={trip} />}
      <Sleep trip={trip} />
      <Costs trip={trip} />
      <BookIt trip={trip} />
      <Bookings trip={trip} />
      {(profile.preferences.length > 0 || profile.seenDestinationIds.length > 0) && <Learned profile={profile} />}
    </div>
  );
}

function Day({
  day, isOpen, onToggle, onRemove,
}: { day: ItineraryDay; isOpen: boolean; onToggle: () => void; onRemove: (i: ItineraryItem) => void }) {
  const acts = day.items.filter((i) => i.type === "activity").length;
  const rest = day.items.filter((i) => i.type === "downtime").reduce((s, i) => s + i.durationMin, 0);

  return (
    <section className="overflow-hidden rounded-2xl border border-paper-edge bg-paper-card">
      <button onClick={onToggle} className="flex w-full items-center gap-4 px-6 py-5 text-left transition hover:bg-paper-hover">
        <div className="min-w-0 flex-1">
          <div className="text-[0.72rem] uppercase tracking-[0.13em] text-ink-faint">
            Day {day.index} · {prettyDate(day.date)}
          </div>
          <h3 className="mt-0.5 truncate font-voice text-[1.3rem]">{day.theme}</h3>
        </div>
        <div className="hidden shrink-0 text-right text-[0.8rem] text-ink-faint sm:block">
          {acts} {acts === 1 ? "thing" : "things"}
          {rest >= 60 && <> · {dur(rest)} free</>}
        </div>
        <svg width="12" height="12" viewBox="0 0 12 12"
             className={`shrink-0 text-ink-faint transition-transform ${isOpen ? "rotate-180" : ""}`}>
          <path d="M2 4.5L6 8.5L10 4.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </svg>
      </button>

      {isOpen && (
        <div className="space-y-5 border-t border-paper-edge px-6 pb-7 pt-6">
          <ol className="space-y-1">
            {day.items.map((it) => <Row key={it.id} item={it} onRemove={onRemove} />)}
          </ol>
          <MiniMap day={day} />
        </div>
      )}
    </section>
  );
}

function Row({ item, onRemove }: { item: ItineraryItem; onRemove: (i: ItineraryItem) => void }) {
  const [why, setWhy] = useState(false);
  const end = toClock(toMin(item.start) + item.durationMin);

  // Section 10: free time is presented as a decision, not as a hole.
  if (item.type === "downtime") {
    return (
      <li className="rise flex gap-5 rounded-xl border border-dashed border-paper-dashed bg-paper-sunk px-4 py-4">
        <div className="w-[6.6rem] shrink-0 text-[0.84rem] tabular-nums text-ink-faint">
          {prettyTime(item.start)}–{prettyTime(end)}
        </div>
        <div className="min-w-0">
          <div className="font-voice text-[1.05rem] text-ink">{item.name}</div>
          <p className="mt-0.5 text-[0.9rem] leading-relaxed text-ink-soft">{item.reason}</p>
        </div>
      </li>
    );
  }

  const muted = item.type === "transit" || item.type === "logistics";

  return (
    <li className="group flex gap-5 rounded-xl px-4 py-3.5 transition hover:bg-paper-hover">
      <div className="w-[6.6rem] shrink-0 pt-0.5 text-[0.84rem] tabular-nums text-ink-faint">
        {prettyTime(item.start)}
        <div className="text-[0.74rem] text-ink-faint/70">{dur(item.durationMin)}</div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2.5">
          <span className={muted ? "text-[0.98rem] text-ink-soft" : "font-voice text-[1.12rem]"}>
            {ICON[item.type] ? `${ICON[item.type]} ` : ""}{item.name}
          </span>
          {item.neighborhood && <span className="text-[0.8rem] text-ink-faint">{item.neighborhood}</span>}
          {item.costUsd > 0 && <span className="text-[0.8rem] tabular-nums text-ink-faint">{money(item.costUsd)}</span>}
          {!muted && (
            <a
              href={mapsLink(item.name, item.lat, item.lng)}
              target="_blank"
              rel="noreferrer noopener"
              className="text-[0.78rem] text-ink-faint underline-offset-2 opacity-0 transition hover:text-accent hover:underline group-hover:opacity-100"
            >
              Map
            </a>
          )}
        </div>

        {item.note && <p className="mt-1 text-[0.92rem] leading-relaxed text-ink-soft">{item.note}</p>}

        {!muted && (
          <div className="mt-1.5 flex items-center gap-3">
            <button onClick={() => setWhy((w) => !w)}
                    className="text-[0.8rem] text-accent underline-offset-2 hover:underline">
              {why ? "Hide" : "Why this?"}
            </button>
            <button onClick={() => onRemove(item)}
                    className="text-[0.8rem] text-ink-faint opacity-0 transition hover:text-ink group-hover:opacity-100">
              Remove
            </button>
          </div>
        )}
        {why && (
          <p className="rise mt-2 border-l-2 border-accent-soft pl-3 text-[0.9rem] leading-relaxed text-ink-soft">
            {item.reason}
          </p>
        )}
      </div>
    </li>
  );
}

/** Section 34 made visible: the famous things this trip deliberately skips. */
function PassedOn({ trip }: { trip: Trip }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-2xl border border-paper-edge bg-paper-card px-6 py-5">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between text-left">
        <h3 className="font-voice text-[1.15rem]">What I left out, and why</h3>
        <span className="text-[0.8rem] text-ink-faint">{open ? "Hide" : `${trip.passedOn.length} things`}</span>
      </button>
      {open && (
        <ul className="rise mt-4 space-y-3.5">
          {trip.passedOn.map((p) => (
            <li key={p.placeId}>
              <div className="font-voice text-[1.02rem]">{p.name}</div>
              <p className="text-[0.9rem] leading-relaxed text-ink-soft">{p.note}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Where you sleep, by name.
 *
 * "4 nights in Lisbon, somewhere in Alfama" is a plan. "Memmo Alfama, and the
 * street is steep enough that a taxi can't reach the door" is a trip. The
 * downside is printed as loudly as the reason, and the link goes to a search
 * for those exact nights rather than pretending anything is held.
 */
function Sleep({ trip }: { trip: Trip }) {
  const c = trip.concept;
  const stays = c.stays ?? [];
  if (!stays.length) return null;
  const dates = legDates(c.shape, c.startDate);

  return (
    <section className="rounded-2xl border border-paper-edge bg-paper-card px-6 py-5">
      <h3 className="mb-4 font-voice text-[1.15rem]">Where you sleep</h3>
      <ul className="space-y-6">
        {stays.map((s) => {
          const city = cityById(s.cityId);
          const d = dates.get(s.cityId);
          return (
            <li key={s.cityId} className="flex flex-col gap-4 border-t border-paper-edge pt-5 sm:flex-row">
              <Photo
                query={[s.name, `${s.neighborhood} ${city.name}`, city.name]}
                near={{ lat: city.lat, lng: city.lng }}
                alt={`${s.neighborhood}, ${city.name}`}
                ratio="4 / 3"
                className="group w-full shrink-0 sm:w-40"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2.5">
                  <span className="font-voice text-[1.14rem]">{s.name}</span>
                  <span className="text-[0.84rem] text-ink-faint">{s.neighborhood}, {city.name}</span>
                </div>
                <div className="mt-0.5 text-[0.84rem] tabular-nums text-ink-faint">
                  about {money(s.nightlyUsd)} a night
                  {d && <> · {d.nights} night{d.nights === 1 ? "" : "s"}, {prettyDate(d.in)} to {prettyDate(d.out)}</>}
                </div>
                <p className="mt-2 text-[0.94rem] leading-relaxed text-ink-soft">{s.why}</p>
                {s.downside && (
                  <p className="mt-1.5 border-l-2 border-accent-soft pl-3 text-[0.9rem] leading-relaxed text-ink-soft">
                    {s.downside}
                  </p>
                )}
                {s.backups.length > 0 && (
                  <p className="mt-2 text-[0.86rem] text-ink-faint">
                    If it&apos;s full: {s.backups.join(" or ")}.
                  </p>
                )}
                <a
                  href={hotelLink(s.name, city.name, d)}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-3 inline-block rounded-full border border-paper-edge px-4 py-1.5 text-[0.86rem] text-ink-soft transition hover:border-ink-faint hover:text-ink"
                >
                  Check these nights
                </a>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The outbound links, in the order you would actually book them. */
function BookIt({ trip }: { trip: Trip }) {
  const links = tripLinks(trip);
  if (!links.length) return null;
  return (
    <section className="rounded-2xl border border-paper-edge bg-paper-card px-6 py-5">
      <h3 className="font-voice text-[1.15rem]">Go and book it</h3>
      <p className="mb-4 mt-1 text-[0.86rem] leading-relaxed text-ink-faint">
        Searches with your dates already filled in. I don&apos;t hold anything and I don&apos;t
        see the prices, so treat my estimate as the guess it is until these tell you otherwise.
      </p>
      <ul className="space-y-2.5">
        {links.map((l) => (
          <li key={l.href} className="border-t border-paper-edge pt-2.5">
            <a
              href={l.href}
              target="_blank"
              rel="noreferrer noopener"
              className="flex items-baseline justify-between gap-4 group"
            >
              <span className="min-w-0">
                <span className="text-[0.98rem] group-hover:text-accent group-hover:underline underline-offset-2">{l.label}</span>
                <span className="block text-[0.84rem] text-ink-faint">{l.note}</span>
              </span>
              <span className="shrink-0 text-[0.8rem] text-ink-faint">&#8599;</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Bookings({ trip }: { trip: Trip }) {
  const [added, setAdded] = useState<string[]>([]);
  const total = trip.bookings.reduce((s, b) => s + b.priceUsd, 0);

  return (
    <section className="rounded-2xl border border-paper-edge bg-paper-card px-6 py-5">
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="font-voice text-[1.15rem]">Bookings</h3>
        <span className="text-[0.8rem] tabular-nums text-ink-faint">{money(total)}</span>
      </div>
      <p className="mb-4 inline-block rounded bg-accent-soft px-2 py-0.5 text-[0.74rem] font-medium uppercase tracking-wide text-accent">
        Mocked — nothing is reserved or charged
      </p>
      <ul className="space-y-3">
        {trip.bookings.map((b) => (
          <li key={b.id} className="flex items-start gap-4 border-t border-paper-edge pt-3">
            <div className="min-w-0 flex-1">
              <div className="text-[0.98rem]">{b.label}</div>
              <div className="text-[0.85rem] text-ink-faint">{b.detail}</div>
              <div className="mt-1 text-[0.85rem] leading-relaxed text-ink-soft">{b.why}</div>
              <div className="mt-0.5 text-[0.78rem] text-ink-faint">{b.cancellation}</div>
            </div>
            <div className="shrink-0 text-right">
              <div className="tabular-nums text-[0.95rem]">{money(b.priceUsd)}</div>
              <button
                onClick={() => setAdded((a) => (a.includes(b.id) ? a.filter((x) => x !== b.id) : [...a, b.id]))}
                className={`mt-1.5 rounded-full border px-3 py-1 text-[0.78rem] transition
                  ${added.includes(b.id)
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-paper-edge hover:border-ink-faint"}`}
              >
                {added.includes(b.id) ? "✓ Added" : "Add to trip"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Sections 16–17: explicit and learned preferences, inspectable and editable. */
function Learned({ profile }: { profile: TravelerProfile }) {
  const leanings = Object.entries(profile.vibeLeanings)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 3)
    .map(([v]) => v);
  return (
    <section className="rounded-2xl border border-paper-edge bg-paper-card px-6 py-5">
      <h3 className="font-voice text-[1.15rem]">What I&apos;ve learned about you</h3>
      <ul className="mt-3 space-y-2">
        {profile.preferences.map((p) => (
          <li key={p.id} className="flex items-center gap-2.5 text-[0.92rem]">
            <span className={`rounded px-1.5 py-0.5 text-[0.68rem] uppercase tracking-wide
              ${p.source === "explicit" ? "bg-good text-good-ink" : "bg-accent-soft text-accent"}`}>
              {p.source}
            </span>
            <span className="text-ink-soft">{p.text}</span>
          </li>
        ))}
      </ul>
      {profile.avoidTags.length > 0 && (
        <p className="mt-3 text-[0.86rem] text-ink-faint">
          Avoiding: {profile.avoidTags.join(", ")}
        </p>
      )}
      {/* Carried between trips, not just within one. Shown rather than
          implied: a memory you can't inspect is indistinguishable from a bug. */}
      {leanings.length > 0 && (
        <p className="mt-3 text-[0.86rem] text-ink-faint">
          Across {profile.tripsPlanned} {profile.tripsPlanned === 1 ? "trip" : "trips"} you keep
          choosing {leanings.join(", ")}. I lean on that when you don&apos;t say.
        </p>
      )}
      {profile.seenDestinationIds.length > 0 && (
        <p className="mt-1.5 text-[0.86rem] text-ink-faint">
          Already offered you: {profile.seenDestinationIds.map((id) => destinationById(id).name).join(", ")}.
        </p>
      )}
    </section>
  );
}
