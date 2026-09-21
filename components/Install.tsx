"use client";

import { useEffect, useState } from "react";
import { shouldSuggestInstall } from "@/lib/backup";

/**
 * Installing it, on whichever thing you're holding.
 *
 * Not decoration. On iOS, Safari clears what a website has stored after about
 * a week of not opening it, and a home-screen app gets its own container that
 * the sweep leaves alone. So on a phone this is the difference between saved
 * trips and saved-until-you-forget-about-it trips.
 *
 * Chrome and Edge give a real install prompt, which is one tap. Safari gives
 * nothing to hook, so iOS gets the two words of instruction instead. Both
 * disappear once it's installed.
 */
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function Install() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia?.("(display-mode: standalone)").matches
      || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) { setDone(true); return; }

    setIos(shouldSuggestInstall());

    const onPrompt = (e: Event) => {
      // Chrome fires this and expects you to hold onto it. Not calling
      // preventDefault leaves the browser's own mini-infobar to it, which is
      // less clear and easier to miss.
      e.preventDefault();
      setPrompt(e as InstallEvent);
    };
    const onInstalled = () => { setDone(true); setPrompt(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (done || (!prompt && !ios)) return null;

  const why = "Not for the icon: a browser clears what a site has saved after a "
    + "while, and an installed app keeps its own store.";

  return (
    <div className="rounded-none border border-paper-edge bg-paper-card px-5 py-4">
      {prompt ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-[16rem] flex-1 text-[14px] leading-relaxed text-ink-soft">
            <span className="text-ink">Install it.</span> {why}
          </p>
          <button
            onClick={async () => {
              const p = prompt;
              setPrompt(null);
              await p.prompt();
              const { outcome } = await p.userChoice;
              if (outcome === "accepted") setDone(true);
            }}
            className="rounded-none bg-ink px-5 py-2 text-[14px] text-paper transition hover:bg-black"
          >
            Install
          </button>
        </div>
      ) : (
        <p className="text-[14px] leading-relaxed text-ink-soft">
          <span className="text-ink">Add this to your Home Screen.</span> Share, then
          &ldquo;Add to Home Screen&rdquo;. {why}
        </p>
      )}
    </div>
  );
}
