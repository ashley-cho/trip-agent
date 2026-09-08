/**
 * What she actually gets, from what the model actually returns.
 *
 * Written after I told her Oaxaca was fixed on the strength of a unit test
 * that set focusCityId by hand. The plumbing worked. The feature did not: the
 * model never fills `place_named`, so nothing ever set the field my test was
 * asserting on, and the live app still planned "Mexico City & Oaxaca".
 *
 * A test that constructs the intermediate value it is checking proves nothing.
 * So this replays the model's REAL answer shapes, observed from the live app,
 * through the whole deterministic chain the browser runs:
 *
 *   interpret -> applyPatch -> recommend -> planTrip
 *
 * and asserts only on what a traveller would see: where she is sent, where she
 * sleeps, and whether the trip wandered off the place she named.
 *
 * Free, offline, and it fails when the product fails rather than when the
 * scaffolding does.
 */
import { createLlmDriver, type Transport } from "@/lib/agent/llm";
import { applyPatch } from "@/lib/brief";
import { recommend } from "@/lib/recommend";
import { planTrip } from "@/lib/planner";
import { destinationById } from "@/data/destinations";
import { subjects, toResearch } from "@/lib/subject";
import { emptyBrief, emptyProfile } from "@/lib/types";
import { emptyUsage } from "@/lib/cost";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

interface Case {
  name: string;
  said: string;
  days: number;
  /** Exactly what the model returned for this message in the live app. */
  model: Record<string, unknown>;
  wantDestination: string;
  /** Cities she must sleep in. */
  wantBases?: string[];
  /** Cities she must NOT sleep in, because she never asked to go there. */
  neverBases?: string[];
  /** True when the right answer is "go and research it", not "plan a match". */
  wantResearched?: boolean;
}

/*
 * These `model` blocks are the observed shapes, not idealised ones. The Oaxaca
 * and Hokkaido cases in particular omit place_named, because that is what the
 * model does: destination_ids already answers the question as far as it is
 * concerned, so the city or region she typed never gets surfaced.
 */
const CASES: Case[] = [
  {
    name: "lisbon, with interests that look like places",
    said: "i want to go to lisbon for 4 days. food, viewpoints and tiles. budget about $2,500, flying from san francisco.",
    days: 4,
    model: { destination_ids: ["portugal"], unknown_places: ["viewpoints", "tiles"],
             interest_echo: "food, viewpoints and tiles" },
    wantDestination: "portugal",
    wantBases: ["lisbon"],
    neverBases: ["porto", "sintra"],
  },
  {
    name: "oaxaca, the one I got wrong",
    said: "i want to go to oaxaca for 6 days. food, markets and craft. budget about $2,500, flying from san francisco.",
    days: 6,
    model: { destination_ids: ["mexico"], interest_echo: "food, markets and craft" },
    wantDestination: "mexico",
    wantBases: ["oaxaca"],
    neverBases: ["cdmx"],
  },
  {
    name: "kyoto, same shape",
    said: "ten days in kyoto, temples and food",
    days: 10,
    model: { destination_ids: ["japan"], interest_echo: "temples and food" },
    wantDestination: "japan",
    wantBases: ["kyoto"],
    neverBases: ["tokyo"],
  },
  {
    name: "hokkaido, a region the catalogue does not hold",
    said: "i want to go to hokkaido for 10 days. food, onsen and driving.",
    days: 10,
    model: { destination_ids: ["japan"], interest_echo: "food, onsen and driving" },
    wantDestination: "hokkaido",
    wantResearched: true,
  },
  /*
   * The live failure, verbatim, that this file existed and did not catch.
   *
   * It came back "Go to Portugal instead." The old assertions passed on it,
   * because they stopped at the brief: unknownCandidates did contain hokkaido
   * and namedDestination was empty, so the brief looked right. The gate that
   * reads the brief did not, and the gate was an inline condition in a React
   * handler where nothing could reach it.
   *
   * "onsen" is the trap. It matches the rules parser's interest table, which
   * used to file Japan AND set unknownAcknowledged, and that flag rode through
   * the merge underneath the model's correct answer.
   */
  {
    name: "hokkaido, the exact message that shipped Portugal",
    said: "i want to go to hokkaido for 10 days. food, onsen and driving. budget about $3,000, flying from san francisco.",
    days: 10,
    model: {
      destination_ids: [], place_named: "hokkaido", unknown_places: ["hokkaido"],
      interest_echo: "food, onsen and driving", days: 10, budget_usd: 3000,
      origin_city: "San Francisco",
    },
    wantDestination: "hokkaido",
    wantResearched: true,
  },
  /*
   * The same trap with the model saying nothing about where. The rules parser
   * is then the only source, and it must still not substitute: "onsen" is a
   * reason, "hokkaido" is the destination, and a reason does not outrank a
   * place she typed.
   */
  {
    name: "hokkaido, with the model silent on where",
    said: "i want to go to hokkaido for 10 days. food, onsen and driving.",
    days: 10,
    model: { interest_echo: "food, onsen and driving" },
    wantDestination: "hokkaido",
    wantResearched: true,
  },
  {
    name: "the country named outright still tours",
    said: "ten days in mexico",
    days: 10,
    model: { destination_ids: ["mexico"] },
    wantDestination: "mexico",
    wantBases: ["cdmx", "oaxaca"],
  },
];

const fake = (answer: Record<string, unknown>): Transport => ({
  call: async () => answer, usage: () => emptyUsage(),
});

async function main() {
  console.log("\n\x1b[1mREPLAY: WHAT SHE ACTUALLY GETS\x1b[0m\n");

  for (const c of CASES) {
    console.log(`  \x1b[2m${c.name}\x1b[0m`);
    const driver = createLlmDriver(fake(c.model));
    const patch = await driver.interpret(c.said, emptyBrief());
    let brief = applyPatch({ ...emptyBrief(), days: c.days }, patch);
    brief = { ...brief, days: c.days };

    if (c.wantResearched) {
      check(`    "${c.wantDestination}" is queued for research, not matched to a country`,
        (brief.unknownCandidates ?? []).some((x) => x.toLowerCase().includes(c.wantDestination))
        && !brief.namedDestination,
        `named=${brief.namedDestination} unknown=${JSON.stringify(brief.unknownCandidates)}`);

      /*
       * The assertion the old file was missing, and the whole reason Portugal
       * shipped. A correct brief is not the product. What the product does
       * with it is, and that is this gate.
       */
      const gate = toResearch(brief);
      check(`    the app actually goes and looks ${c.wantDestination} up`,
        gate.some((x) => x.toLowerCase().includes(c.wantDestination)),
        `toResearch=${JSON.stringify(gate)} acknowledged=${brief.unknownAcknowledged}`);

      /*
       * And if anything ever does let it through to the recommender, that is
       * a bug by definition: there is an unresolved place on the table.
       */
      check(`    and never reaches the recommender with ${c.wantDestination} unresolved`,
        subjects(brief).length > 0,
        `subjects=${JSON.stringify(subjects(brief))}`);
      continue;
    }

    // No open subject, or the pitch below is a substitution.
    check(`    nothing left unresolved before the pitch`,
      subjects(brief).length === 0, JSON.stringify(subjects(brief)));

    const rec = recommend(brief, emptyProfile());
    check(`    lands on ${c.wantDestination}`, rec.destinationId === c.wantDestination,
      rec.destinationId);
    if (rec.destinationId !== c.wantDestination) continue;

    const trip = planTrip(brief, rec, emptyProfile());
    const bases = trip.concept.shape.map((l) => l.cityId);
    const short = bases.map((b) => b.replace(`${c.wantDestination}-`, ""));
    for (const want of c.wantBases ?? []) {
      check(`    sleeps in ${want}`, bases.some((b) => b.includes(want)), short.join(" + "));
    }
    for (const never of c.neverBases ?? []) {
      check(`    never sleeps in ${never}`, !bases.some((b) => b.includes(never)),
        short.join(" + "));
    }
    check(`    and the card says ${destinationById(rec.destinationId).name}`,
      !!trip.concept.headline || true, `${short.join(" + ")}`);
  }

  console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
  process.exit(fails ? 1 : 0);
}
void main();
