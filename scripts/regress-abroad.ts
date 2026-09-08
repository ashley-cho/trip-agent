/**
 * "i wanna go abroad" is a hard constraint.
 *
 * She was pitched the Utah canyon country, said she wanted to go abroad, and
 * got back "Understood, that just doesn't settle it on its own." Then Utah
 * again, as a finished 10-day itinerary.
 *
 * Two failures in one exchange, and they are the two shapes this whole
 * evening has been about:
 *
 *   1. Nothing in the app had a notion of a country, so the phrase parsed to
 *      nothing at all and the reply was literally true from the code's point
 *      of view and insulting from hers.
 *   2. The pitch was pinned, and the pin is read before anything looks at
 *      what she just said. A constraint stated AFTER a pitch has to outrank
 *      the pitch, or the app is arguing with her.
 */
import { createLlmDriver, type Transport } from "@/lib/agent/llm";
import { applyPatch } from "@/lib/brief";
import { interpretRules } from "@/lib/discovery";
import { recommend } from "@/lib/recommend";
import { pinnedDestination } from "@/lib/subject";
import { isDomestic, wantsAbroad } from "@/lib/abroad";
import { SEEDED_ORIGIN } from "@/lib/origin";
import { emptyBrief, emptyProfile, type Brief } from "@/lib/types";
import { emptyUsage } from "@/lib/cost";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};
const fake = (a: Record<string, unknown>): Transport => ({ call: async () => a, usage: () => emptyUsage() });

async function main() {
  console.log("\n\x1b[1mABROAD MEANS ABROAD\x1b[0m\n");

  for (const said of [
    "i wanna go abroad", "somewhere overseas", "i want to leave the country",
    "not in the US", "somewhere international", "another country please",
  ]) {
    check(`"${said}" reads as a constraint`, wantsAbroad(said));
  }
  for (const said of ["i want to go to broadstairs", "abroadly speaking"]) {
    check(`"${said}" does not`, !wantsAbroad(said));
  }

  const base: Brief = {
    ...emptyBrief(), days: 10, origin: SEEDED_ORIGIN,
    vibes: ["nature", "adventure"], flexibleBudget: true,
  };

  // Without it, Utah is a perfectly good answer.
  const domestic = recommend(base, emptyProfile());
  check("nature + adventure from SF can land in the US", true, domestic.destinationId);

  // With it, never.
  const abroad = applyPatch(base, { wantsInternational: true });
  const rec = recommend(abroad, emptyProfile());
  check("asking to go abroad never returns a US destination",
    !isDomestic(rec.destinationId, SEEDED_ORIGIN), rec.destinationId);

  // Said in a sentence, through the real parser, with the model silent.
  const parsed = applyPatch(base,
    await createLlmDriver(fake({})).interpret("i wanna go abroad", base));
  check("the sentence itself sets the constraint", parsed.wantsInternational === true,
    String(parsed.wantsInternational));
  check("and the recommendation leaves the country",
    !isDomestic(recommend(parsed, emptyProfile()).destinationId, SEEDED_ORIGIN),
    recommend(parsed, emptyProfile()).destinationId);

  // The rules layer alone must get it too, since it owns literal phrases.
  check("the rules layer reads it without the model",
    interpretRules("i wanna go abroad", base).wantsInternational === true);

  // And the pin has to let go.
  check("a Utah pitch does not survive being told to go abroad",
    pinnedDestination("southwest", abroad, emptyProfile()) === undefined,
    String(pinnedDestination("southwest", abroad, emptyProfile())));
  check("but an abroad pitch is untouched by it",
    pinnedDestination("iceland", abroad, emptyProfile()) === "iceland");

  console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
  process.exit(fails ? 1 : 0);
}
void main();
