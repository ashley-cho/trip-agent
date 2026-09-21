/**
 * Is there a model behind the app right now?
 *
 * One fact, three sources: the last call that answered (llm, or a fallback
 * to rules), an account stop reported through lib/byok.ts, and her own key
 * being in play. The header shows it as "Model: on" or "Model: off", which
 * replaced a theme pill reading "Auto" that nobody could tell was a theme
 * pill. The paragraph about the account being out of credit could then get
 * shorter, because the badge is now saying the durable part.
 */
export type ModelState = "on" | "off" | "unknown";

let state: ModelState = "unknown";
const listeners = new Set<(s: ModelState) => void>();

export function modelState(): ModelState { return state; }

export function onModel(fn: (s: ModelState) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function noteModel(next: ModelState): void {
  if (next === state) return;
  state = next;
  for (const fn of listeners) fn(state);
}

/** What a driver name on a response says about the model. */
export function modelFromDriver(driver: string | undefined): ModelState {
  if (driver === "llm") return "on";
  if (driver === "fallback" || driver === "rules") return "off";
  return "unknown"; // "catalogue": the shelf answered; says nothing about the model
}
