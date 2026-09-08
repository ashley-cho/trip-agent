"use client";

import { useEffect, useRef, useState } from "react";
import type { SavedTrip } from "@/lib/trips";
import { tripStatus, whenLabel } from "@/lib/trips";
import { downloadBackup, requestPersistence, restoreBackup } from "@/lib/backup";

/**
 * The trips you have going. Shown under the opening question, so a returning
 * traveller lands on their own work rather than on a blank prompt.
 */
export function Trips({
  trips, onOpen, onDelete, onRestored,
}: {
  trips: SavedTrip[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onRestored?: () => void;
}) {
  const [note, setNote] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Chrome and Firefox will mark the store as persistent for a site the
    // person actually uses. Safari won't, which is what the banner is for.
    void requestPersistence();
  }, []);

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

  if (trips.length === 0) return null;

  return (
    <section className="mt-14 w-full max-w-readable">
      {trips.length > 0 && (
        <>
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-[0.72rem] font-semibold uppercase tracking-[0.13em] text-ink-faint">
              Your trips
            </h2>
            <div className="flex items-center gap-3 text-[0.8rem]">
              <button
                onClick={() => { const n = downloadBackup(); setNote(`Saved ${n} trip${n === 1 ? "" : "s"} to a file.`); }}
                className="text-ink-faint underline-offset-2 transition hover:text-ink hover:underline"
              >
                Back up
              </button>
              <button
                onClick={() => file.current?.click()}
                className="text-ink-faint underline-offset-2 transition hover:text-ink hover:underline"
              >
                Restore
              </button>
              <input
                ref={file}
                type="file"
                accept="application/json,.json"
                onChange={onFile}
                className="hidden"
              />
            </div>
          </div>

          {note && <p className="mt-2 text-[0.84rem] text-ink-soft">{note}</p>}

          <ul className="mt-3 divide-y divide-paper-edge border-y border-paper-edge">
            {trips.map((t) => (
              <li key={t.id} className="group flex items-center gap-3 py-3">
                <button
                  onClick={() => onOpen(t.id)}
                  className="flex-1 text-left transition hover:opacity-70"
                >
                  <span className="font-voice text-[1.05rem]">{t.name}</span>
                  <span className="mt-0.5 block text-[0.82rem] text-ink-faint">
                    {tripStatus(t)} · {whenLabel(t.updatedAt)}
                  </span>
                </button>
                <button
                  onClick={() => onDelete(t.id)}
                  aria-label={`Delete ${t.name}`}
                  title="Delete"
                  className="shrink-0 rounded-full px-2 py-1 text-[0.78rem] text-ink-faint transition hover:text-ink sm:opacity-0 sm:focus:opacity-100 sm:group-hover:opacity-100"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-[0.78rem] leading-relaxed text-ink-faint">
            Trips live in this browser, not on a server. Back up before you clear site data or
            switch phones.
          </p>
        </>
      )}
    </section>
  );
}
