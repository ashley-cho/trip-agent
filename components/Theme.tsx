"use client";

import { useEffect, useState } from "react";

/**
 * Light, dark, or whatever the machine says.
 *
 * Three states rather than two, because "follow my system" is what most people
 * actually want and a two-way toggle can't express it. The choice is written
 * to the root element as data-theme and the CSS does the rest; nothing in the
 * app carries a `dark:` class.
 *
 * The script that applies it on first paint lives in the document head, not
 * here, or the page would flash light before React ever ran.
 */
export type Mode = "system" | "light" | "dark";
export const THEME_KEY = "trip-agent.theme.v1";

/** Runs before first paint. Inlined into the head, so keep it small and dumb. */
export const THEME_SCRIPT = `(function(){try{
var m=localStorage.getItem(${JSON.stringify(THEME_KEY)});
if(m==="light"||m==="dark")document.documentElement.setAttribute("data-theme",m);
}catch(e){}})();`;

const NEXT: Record<Mode, Mode> = { system: "light", light: "dark", dark: "system" };
const LABEL: Record<Mode, string> = { system: "Auto", light: "Light", dark: "Dark" };

export function Theme() {
  const [mode, setMode] = useState<Mode>("system");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY) as Mode | null;
      if (saved === "light" || saved === "dark") setMode(saved);
    } catch { /* private mode */ }
  }, []);

  const apply = (m: Mode) => {
    setMode(m);
    const root = document.documentElement;
    if (m === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", m);
    try {
      if (m === "system") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, m);
    } catch { /* the page still looks right, it just won't remember */ }

    // Keep the phone's status bar in step with the page it's sitting above.
    const dark = m === "dark"
      || (m === "system" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", dark ? "#111111" : "#ffffff");
  };

  return (
    <button
      onClick={() => apply(NEXT[mode])}
      title={`Theme: ${LABEL[mode]}. Click for ${LABEL[NEXT[mode]]}.`}
      aria-label={`Theme: ${LABEL[mode]}`}
      className="rounded-none border border-paper-edge px-2.5 py-0.5 text-[13px] tracking-wide text-ink-faint transition hover:text-ink"
    >
      {LABEL[mode]}
    </button>
  );
}
