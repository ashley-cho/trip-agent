"use client";

import { useEffect, useRef, useState } from "react";
import type { SavedTrip } from "@/lib/trips";
import { tripStatus } from "@/lib/trips";
import { downloadBackup, requestPersistence, restoreBackup } from "@/lib/backup";
import { Photo } from "./Photo";

/**
 * The trips you have going, under the search, as cards.
 *
 * A trip still in conversation is a butter card you pick back up; a trip with
 * a plan is a photo card with the place's name set on it. The ones in
 * conversation come first: they are the thing you were in the middle of.
 */
export function Trips({
  trips, onOpen, onDelete,
}: {
  trips: SavedTrip[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  useEffect(() => {
    // Chrome and Firefox will mark the store as persistent for a site the
    // person actually uses. Safari won't, which is what the banner is for.
    void requestPersistence();
  }, []);

  if (trips.length === 0) return null;

  const talking = trips.filter((t) => t.stage === "chat" || !t.trip);
  const planned = trips.filter((t) => !(t.stage === "chat" || !t.trip));

  return (
    <section aria-label="Your trips" className="w-full max-w-readable space-y-3 pt-10">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="font-voice text-[22px] tracking-[-0.01em]">Your trips</h2>
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-faint">
          {trips.length} trip{trips.length === 1 ? "" : "s"}
        </span>
      </div>

      {talking.map((t) => (
        <div key={t.id} className="group relative">
          <button
            onClick={() => onOpen(t.id)}
            className="flex w-full flex-col gap-1 rounded-2xl bg-butter py-4 pl-5 pr-14 text-[#111111] transition hover:opacity-90"
          >
            <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#4c4b4b]">In progress</span>
            <span className="flex w-full items-baseline justify-between gap-3">
              <span className="min-w-0 truncate font-voice text-[19px] leading-tight">{t.name.split(" · ")[0]}</span>
              <span className="shrink-0 text-[11px] font-medium uppercase tracking-[0.12em]">Continue →</span>
            </span>
          </button>
          <DeleteButton trip={t} onDelete={onDelete} dark />
        </div>
      ))}

      {planned.length > 0 && (
        <ul className="grid grid-cols-2 gap-3">
          {planned.map((t) => {
            const place = t.name.split(" · ")[0];
            const tail = [tripStatus(t), t.name.split(" · ")[1]].filter(Boolean).join(" · ");
            return (
              <li key={t.id} className="group relative">
                <button
                  onClick={() => onOpen(t.id)}
                  className="relative flex h-56 w-full flex-col justify-between overflow-hidden rounded-2xl bg-[#2d3a4a] p-3.5 text-white transition hover:opacity-95"
                >
                  <Photo
                    query={place}
                    alt={place}
                    ratio="auto"
                    className="!absolute inset-0 h-full w-full !bg-transparent"
                    rounded=""
                  />
                  <span aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.55)_0%,rgba(0,0,0,0)_55%)]" />
                  <span className="relative min-w-0 space-y-0.5 pr-8">
                    <span className="block font-voice text-[19px] leading-tight">{place}</span>
                    <span className="block text-[12px] text-white/85">{tail}</span>
                  </span>
                </button>
                <DeleteButton trip={t} onDelete={onDelete} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function DeleteButton({ trip, onDelete, dark }: { trip: SavedTrip; onDelete: (id: string) => void; dark?: boolean }) {
  // A small close mark in the corner: always there on a phone, where there is
  // no hover, and out of the way of the name and "Continue".
  return (
    <button
      onClick={() => onDelete(trip.id)}
      aria-label={`Delete ${trip.name}`}
      title="Delete"
      className={`absolute right-1.5 top-1.5 flex h-11 w-11 items-center justify-center rounded-full transition
        ${dark ? "text-[#4c4b4b] hover:text-[#111111]" : "text-white/75 hover:text-white"}`}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
        <path d="M2 2l8 8M10 2L2 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  );
}

/** Back up and restore, for the menu. They used to sit beside the list. */
export function Backup({ onRestored }: { onRestored?: () => void }) {
  const [note, setNote] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const r = restoreBackup(await f.text());
    if (!r.ok) { setNote(r.problem ?? "That didn't restore."); return; }
    setNote(
      r.added + r.updated === 0
        ? "Everything in that backup was already here."
        : `Restored ${[r.added && `${r.added} trip${r.added === 1 ? "" : "s"}`,
                      r.updated && `${r.updated} updated`].filter(Boolean).join(", ")}.`,
    );
    onRestored?.();
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3">
        <span>Your trips</span>
        <button
          onClick={() => { const n = downloadBackup(); setNote(`Saved ${n} trip${n === 1 ? "" : "s"} to a file.`); }}
          className="underline-offset-2 transition hover:text-ink hover:underline"
        >
          Back up
        </button>
        <button
          onClick={() => file.current?.click()}
          className="underline-offset-2 transition hover:text-ink hover:underline"
        >
          Restore
        </button>
        <input ref={file} type="file" accept="application/json,.json" onChange={onFile} className="hidden" />
      </div>
      {note && <p className="text-ink-soft">{note}</p>}
    </div>
  );
}
