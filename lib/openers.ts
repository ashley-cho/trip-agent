/**
 * The twelve example prompts printed in the box she types into.
 *
 * Here rather than in app/page.tsx because they are a promise the app makes
 * on its own front page, and scripts/coverage-shelf.ts measures whether the
 * catalogue can keep it with no model behind it.
 */
export const OPENERS: string[] = [
  "I need a vacation. Surprise me.",
  "I want to get away somewhere warm.",
  "Somewhere I can eat well and walk a lot.",
  "Ten days, nothing planned, nowhere decided.",
  "I want to go to Oaxaca for the markets.",
  "Northern lights, and I can drive.",
  "Somewhere I've never heard of.",
  "A week off and I'm tired of cities.",
  "I want mountains and a long dinner.",
  "Take me somewhere for the food.",
  "Nothing touristy. Nowhere I have to queue.",
  "I want to go abroad and not think about it.",
];
