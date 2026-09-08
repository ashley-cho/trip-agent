"use client";

import { useEffect, useRef, useState } from "react";
import {
  currentAccount, onAccountChange, requestSignIn, signOut, syncAvailable, syncNow,
  type Account as Who,
} from "@/lib/sync";
import { verifyCode } from "@/lib/sync";

/**
 * Signing in, kept as small as the feature deserves.
 *
 * No password, because a password is a thing to lose and this app holds
 * holiday plans, not money. An email arrives with a link and a code; either
 * works. The code matters more than it looks: people open the app on a phone
 * and read email on a laptop, and a link only helps on the device that opens
 * it.
 *
 * Signing out never deletes anything locally. The trips were here before the
 * account existed and they stay.
 */
export function Account({ onSynced }: { onSynced: () => void }) {
  const [who, setWho] = useState<Who | null>(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const live = useRef(true);

  useEffect(() => {
    live.current = true;
    if (!syncAvailable()) return;
    currentAccount().then((a) => {
      if (!live.current) return;
      setWho(a);
      if (a) void run();
    });
    const off = onAccountChange((a) => {
      if (!live.current) return;
      setWho(a);
      if (a) { setOpen(false); setSent(false); setCode(""); void run(); }
    });
    return () => { live.current = false; off(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run() {
    const r = await syncNow();
    if (!live.current) return;
    if (!r.ok) { setNote(r.problem === "not signed in" ? null : "Couldn't sync just now."); return; }
    setNote(r.pulled || r.pushed
      ? `Synced. ${[r.pulled && `${r.pulled} in`, r.pushed && `${r.pushed} out`].filter(Boolean).join(", ")}.`
      : null);
    onSynced();
  }

  if (!syncAvailable()) return null;

  if (who) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8rem] text-ink-faint">
        <span>Synced to {who.email ?? "your account"}.</span>
        <button onClick={() => void run()}
                className="underline-offset-2 transition hover:text-ink hover:underline">
          Sync now
        </button>
        <button onClick={() => void signOut()}
                title="Your trips stay on this device."
                className="underline-offset-2 transition hover:text-ink hover:underline">
          Sign out
        </button>
        {note && <span>{note}</span>}
      </div>
    );
  }

  if (!open) {
    return (
      <div className="text-[0.8rem] text-ink-faint">
        <button onClick={() => setOpen(true)}
                className="underline-offset-2 transition hover:text-ink hover:underline">
          Sign in to use these trips on your phone
        </button>
      </div>
    );
  }

  const send = async () => {
    if (!email.includes("@")) { setNote("That doesn't look like an email address."); return; }
    setBusy(true); setNote(null);
    const r = await requestSignIn(email);
    setBusy(false);
    if (!r.ok) { setNote(r.problem ?? "Couldn't send that."); return; }
    setSent(true);
    setNote("Check your email. Click the link, or paste the code below.");
  };

  const verify = async () => {
    setBusy(true); setNote(null);
    const r = await verifyCode(email, code);
    setBusy(false);
    if (!r.ok) setNote(r.problem ?? "That code didn't work.");
  };

  return (
    <div className="rounded-2xl border border-paper-edge bg-paper-card px-5 py-4">
      <p className="text-[0.92rem] leading-relaxed text-ink-soft">
        <span className="text-ink">Same trips on every device.</span> No password. An email
        arrives with a link and a code, and either one signs you in.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          type="email"
          autoComplete="email"
          value={email}
          disabled={busy || sent}
          placeholder="you@example.com"
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void send(); }}
          className="min-w-[15rem] flex-1 rounded-full border border-paper-edge bg-paper px-4 py-2 text-[0.92rem] outline-none transition focus:border-ink-faint disabled:opacity-50"
        />
        {!sent && (
          <button onClick={() => void send()} disabled={busy}
                  className="rounded-full bg-ink px-5 py-2 text-[0.9rem] text-paper transition hover:bg-black disabled:opacity-30">
            {busy ? "Sending…" : "Email me"}
          </button>
        )}
      </div>

      {sent && (
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            disabled={busy}
            placeholder="6-digit code"
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void verify(); }}
            className="w-40 rounded-full border border-paper-edge bg-paper px-4 py-2 text-[0.92rem] tabular-nums outline-none transition focus:border-ink-faint disabled:opacity-50"
          />
          <button onClick={() => void verify()} disabled={busy || code.trim().length < 6}
                  className="rounded-full bg-ink px-5 py-2 text-[0.9rem] text-paper transition hover:bg-black disabled:opacity-30">
            Sign in
          </button>
          <button onClick={() => { setSent(false); setCode(""); setNote(null); }}
                  className="rounded-full px-3 py-2 text-[0.86rem] text-ink-faint transition hover:text-ink">
            Different email
          </button>
        </div>
      )}

      {note && <p className="mt-2 text-[0.84rem] text-ink-soft">{note}</p>}

      <p className="mt-3 text-[0.78rem] leading-relaxed text-ink-faint">
        Signing out leaves your trips on this device. It doesn&apos;t delete them.
      </p>
    </div>
  );
}
