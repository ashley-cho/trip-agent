/**
 * The corpus: real sentences in, one answer out.
 *
 * Written after three failures in an hour, all the same shape and all found
 * by Ashley typing an ordinary sentence rather than by any test here:
 *
 *   "i want to go to hokkaido…"      -> "Go to Portugal instead."
 *   "i want to go to iceland to…"    -> New Zealand
 *   "i wanna go abroad" (on Utah)    -> Utah, again
 *
 * Every existing suite asserts on a case I already understood. This one
 * exists to be wide rather than deep: many sentences, one assertion each,
 * about the only thing that matters at this layer — where she ends up.
 *
 * Two rules it enforces that nothing else did:
 *
 *   1. Each sentence runs against SEVERAL model answers, including a silent
 *      one and a wrong one. The Hokkaido and Iceland bugs were both a
 *      deterministic backstop overruling a model that had it right, so a
 *      corpus that only tests the happy model answer cannot see them.
 *   2. Messages that say nothing about WHERE must not move her. That is the
 *      Utah failure, and it has no coverage anywhere else.
 *
 * No model calls, no network, runs in about a second.
 */
import { createLlmDriver, type Transport } from "@/lib/agent/llm";
import { applyPatch } from "@/lib/brief";
import { recommend } from "@/lib/recommend";
import { subjects, pinnedDestination } from "@/lib/subject";
import { SEEDED_ORIGIN } from "@/lib/origin";
import { emptyBrief, emptyProfile, type Brief } from "@/lib/types";
import { emptyUsage } from "@/lib/cost";

const fake = (a: Record<string, unknown>): Transport =>
  ({ call: async () => a, usage: () => emptyUsage() });

/** The model answers we replay every sentence against. */
type Voice = "silent" | "right" | "country" | "wrong";

interface Case {
  said: string;
  /**
   * "portugal", "portugal/lisbon", "research:hokkaido", or "open" when the
   * sentence names nowhere and the agent is free to choose.
   */
  want: string;
  /** What the model says under each voice. Omit for the obvious default. */
  right?: Record<string, unknown>;
  country?: Record<string, unknown>;
  /** Voices this sentence is not meaningful under. */
  skip?: Voice[];
  /** Prior state, for follow-ups. */
  from?: Partial<Brief>;
  /** A destination already pitched when she said this. */
  pitched?: string;
  /** Where the pin should be afterwards. Only checked when `pitched` is set. */
  wantPin?: string | null;
}

const NAMED: Case[] = [
  // --- a country we hold, said plainly -----------------------------------
  { said: "i want to go to portugal", want: "portugal" },
  { said: "ten days in mexico", want: "mexico" },
  { said: "i'm thinking japan", want: "japan", skip: ["silent"] },
  { said: "iceland please", want: "iceland", skip: ["silent"] },
  { said: "let's do italy", want: "italy", skip: ["silent"] },

  // --- the sentence keeps going after the name ---------------------------
  { said: "i want to go to iceland to see the northern lights", want: "iceland" },
  { said: "i want to go to iceland to see the northern lights. give me an itinerary", want: "iceland" },
  { said: "going to japan to eat", want: "japan" },
  { said: "i want to go to portugal for the food and the trams", want: "portugal" },
  { said: "i want to go to mexico with my sister for 6 days", want: "mexico" },
  { said: "trip to italy and eat my way through it", want: "italy" },
  { said: "i want to go to france in october", want: "france" },
  { said: "heading to denmark for a week of design museums", want: "denmark" },
  { said: "i want to go to korea to eat and shop", want: "korea" },
  { said: "flying to new zealand to hike", want: "newzealand" },

  // --- a city, which is the whole trip -----------------------------------
  { said: "i want to go to lisbon for 4 days", want: "portugal/lisbon" },
  { said: "i want to go to oaxaca for 6 days", want: "mexico/oaxaca" },
  { said: "i want to go to kyoto to see temples", want: "japan/kyoto" },
  { said: "i want to go to seville and eat well", want: "andalusia/seville" },
  { said: "a week in porto", want: "portugal/porto", skip: ["silent"] },
  { said: "i want to go to reykjavik for 5 days", want: "iceland/reykjavik" },

  // --- somewhere we do not hold: research, never substitute ---------------
  { said: "i want to go to hokkaido for 10 days. food, onsen and driving.", want: "research:hokkaido" },
  { said: "i want to go to hokkaido to eat", want: "research:hokkaido" },
  { said: "i want to go to the faroe islands for a week", want: "research:faroe islands" },
  { said: "i want to go to the faroe islands to see puffins", want: "research:faroe islands" },
  { said: "trip to patagonia to hike", want: "research:patagonia" },
  { said: "i want to go to namibia for two weeks", want: "research:namibia" },
  { said: "i want to go to yunnan for the trekking", want: "research:yunnan" },
  { said: "going to montenegro in june", want: "research:montenegro" },
  { said: "i want to go to sri lanka with my partner", want: "research:sri lanka" },
  { said: "i want to go to georgia for the wine", want: "research:georgia" },
];

/*
 * Messages that say NOTHING about where.
 *
 * She was pitched Utah, said "i wanna go abroad", and got Utah back. The pin
 * that holds a pitch steady through ordinary conversation is right; the pin
 * surviving a message that rules the pitch out is the bug. These separate the
 * two: everything here must LEAVE the pitch alone, and the constraints in the
 * next block must move it.
 */
const NOT_ABOUT_WHERE: Case[] = [
  { said: "make it five days", want: "portugal", from: { namedDestination: "portugal" }, pitched: "portugal", wantPin: "portugal" },
  { said: "sounds good", want: "portugal", from: { namedDestination: "portugal" }, pitched: "portugal", wantPin: "portugal" },
  { said: "what's the food like", want: "portugal", from: { namedDestination: "portugal" }, pitched: "portugal", wantPin: "portugal" },
  { said: "i'm flexible", want: "portugal", from: { namedDestination: "portugal" }, pitched: "portugal", wantPin: "portugal" },
  { said: "whatever makes sense", want: "portugal", from: { namedDestination: "portugal" }, pitched: "portugal", wantPin: "portugal" },
  { said: "show me the trip", want: "portugal", from: { namedDestination: "portugal" }, pitched: "portugal", wantPin: "portugal" },
  { said: "yeah i can drive with caution", want: "iceland", from: { namedDestination: "iceland" }, pitched: "iceland", wantPin: "iceland" },
  { said: "around $3000", want: "japan", from: { namedDestination: "japan" }, pitched: "japan", wantPin: "japan" },
];

/** Constraints stated after a pitch. These MUST move her. */
const CONSTRAINTS: Case[] = [
  { said: "i wanna go abroad", want: "!us", from: {}, pitched: "southwest", wantPin: null },
  { said: "somewhere overseas", want: "!us", from: {}, pitched: "pacificnw", wantPin: null },
  { said: "i want to leave the country", want: "!us", from: {}, pitched: "centralcoast", wantPin: null },
  // and must NOT move her off somewhere already abroad
  { said: "i wanna go abroad", want: "iceland", from: { namedDestination: "iceland" }, pitched: "iceland", wantPin: "iceland" },
];

const ALL = [...NAMED, ...NOT_ABOUT_WHERE, ...CONSTRAINTS];

/** What the model returns for a sentence under each voice. */
function answer(c: Case, voice: Voice): Record<string, unknown> | undefined {
  const target = c.want.split("/")[0];
  switch (voice) {
    case "silent":
      return {};
    case "right":
      if (c.right) return c.right;
      if (c.want.startsWith("research:")) {
        const name = c.want.slice("research:".length);
        return { destination_ids: [], place_named: name, unknown_places: [name] };
      }
      if (c.want === "open" || target.startsWith("!")) return {};
      return { destination_ids: [target], place_named: c.want.split("/")[1] ?? target };
    case "country":
      // The model resolves a region or city to the country it sits in. This is
      // what it actually did for Hokkaido ("japan") and it must not win.
      if (c.country) return c.country;
      if (c.want.startsWith("research:")) return { destination_ids: ["japan"] };
      return undefined;
    case "wrong":
      // A destination nobody asked for. Only meaningful when she named a
      // place: the backstop reading her own sentence has to beat it.
      if (c.want === "open" || target.startsWith("!")) return undefined;
      return { destination_ids: ["bali"] };
  }
}

let fails = 0;
const bad: string[] = [];

function outcome(b: Brief, pitched?: string) {
  const sub = subjects(b);
  if (sub.length) return { where: `research:${sub[0].toLowerCase()}`, pin: undefined };
  const pin = pinnedDestination(pitched, b, emptyProfile());
  const rec = recommend(
    pin ? { ...b, namedDestination: pin, candidates: undefined, regionIds: undefined } : b,
    emptyProfile(),
  );
  return {
    where: b.focusCityId ? `${rec.destinationId}/${b.focusCityId}` : rec.destinationId,
    pin,
  };
}

const US = new Set(["southwest", "pacificnw", "centralcoast"]);

async function main() {
  console.log("\n\x1b[1mCORPUS\x1b[0m  real sentences, one answer each\n");
  let run = 0;

  for (const c of ALL) {
    for (const voice of ["silent", "right", "country", "wrong"] as Voice[]) {
      if (c.skip?.includes(voice)) continue;
      const model = answer(c, voice);
      if (model === undefined) continue;
      run++;

      const start: Brief = {
        ...emptyBrief(), days: 8, origin: SEEDED_ORIGIN,
        vibes: ["nature", "adventure"], flexibleBudget: true, ...c.from,
      };
      const b = applyPatch(start,
        await createLlmDriver(fake(model)).interpret(c.said, start));
      const got = outcome(b, c.pitched);

      let ok: boolean;
      if (c.want === "!us") ok = !US.has(got.where.split("/")[0]);
      else if (c.want === "open") ok = !b.namedDestination && subjects(b).length === 0;
      else if (c.want.includes("/")) ok = got.where === c.want;
      else ok = got.where.split("/")[0] === c.want;

      if (c.wantPin !== undefined && ok) ok = (got.pin ?? null) === c.wantPin;

      if (!ok) {
        fails++;
        bad.push(`  \x1b[31m${voice.padEnd(7)}\x1b[0m ${got.where.padEnd(24)} want ${c.want.padEnd(22)} pin=${got.pin ?? "-"}\n          "${c.said}"`);
      }
    }
  }

  if (bad.length) console.log(bad.join("\n"));
  console.log(`\n  ${run} sentence/voice pairs, ` +
    (fails ? `\x1b[31m${fails} failing\x1b[0m` : "\x1b[32mall clear\x1b[0m") + "\n");
  process.exit(fails ? 1 : 0);
}
void main();
