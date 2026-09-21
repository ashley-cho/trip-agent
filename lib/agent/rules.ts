import type { Brief, Trip } from "@/lib/types";
import { unknownHead } from "@/lib/types";
import type { AgentDriver, BriefPatch, EditOp, Phase, PlaceContext, Question, Recommendation, Turn } from "./types";
import { interpretRules, nextQuestionRules } from "@/lib/discovery";
import { parseEditRules } from "@/lib/edit";
import { destinationById } from "@/data/destinations";
import { tiebreakPrompt } from "@/lib/recommend";
import { activityStrength } from "@/lib/select";
import { CITIES } from "@/data/destinations";
import { PLACES } from "@/data";
import type { Place } from "@/lib/types";

/** Sentences about eating, which are only a reason if she gave one. */
const FOOD = /\b(food|foodie|eat|eating|eats|dining|dinner|lunch|cuisine|restaurants?|cooking|kitchen|market stools|barbecue|noodles?|ramen|wine|tapas|seafood)\b/i;
const WORD_NUMBER: Record<string, number> = {
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, fourteen: 14,
};

/** The usable places of a destination, from the catalogue or the context handed in. */
function placesFor(destinationId: string, place?: PlaceContext): Place[] {
  const cities = new Set([
    ...CITIES.filter((c) => c.destinationId === destinationId).map((c) => c.id),
    ...(place?.cities ?? []).map((c) => c.id),
  ]);
  return PLACES.filter((p) => !p.skip && cities.has(p.cityId));
}

/**
 * Zero-config driver. Also the eval baseline: every metric the LLM driver
 * reports is measured against these numbers, so "did the model help?" is a
 * question with an actual answer.
 */
const titleCase = (t: string) =>
  t.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

export const rulesDriver: AgentDriver = {
  name: "rules",

  async interpret(input: string, brief: Brief): Promise<BriefPatch> {
    return interpretRules(input, brief);
  },

  async nextQuestion(brief: Brief, _history?: Turn[], phase: Phase = "discovery"): Promise<Question | null> {
    return nextQuestionRules(brief, phase);
  },

  async pitch(rec: Recommendation, brief: Brief, place?: PlaceContext) {
    const d = place?.destination ?? destinationById(rec.destinationId);

    if (rec.noGoodFit) {
      return {
        headline: `Nothing I have really fits this.`,
        body: `The closest is ${d.name}, and even that ${rec.noGoodFit}. I'd rather tell you than talk you into a trip I don't believe in. Give me a few more days or a bit more budget and I'll find you something — or name a place you've been meaning to go and I'll work from there.`,
      };
    }

    const tie = tiebreakPrompt(rec);
    if (tie) return { headline: `I'm torn between two.`, body: tie };

    // Build the case out of the reasons they actually gave us.
    const clauses = brief.vibes
      .map((v) => d.because[v])
      .filter(Boolean)
      .slice(0, 3) as string[];
    /*
     * And out of what she said she wants to DO, named against what the
     * place holds for it.
     *
     * "hot springs and long walks" carried no vibe, so the body fell back to
     * the destination's generic pitch -- Korea's opens on eating -- with her
     * words glued in front as a fragment: "Hot springs, long walks. The most
     * interesting eating in Asia right now". She had not asked for food, and
     * it did not read as a sentence. The case for a place is the places in
     * it that hold what she asked for, so that is what this says.
     */
    const held = placesFor(d.id, place);
    const forHers = (brief.activities ?? [])
      .map((a) => ({
        a,
        // The places most directly about it first: name, then tag, then a
        // note that mentions it. Two at most, and never a note-only match
        // when a tagged one exists.
        at: held.map((p) => ({ p, s: activityStrength(p, a) })).filter((x) => x.s > 0)
          .sort((x, y) => y.s - x.s).filter((x, _, all) => x.s >= Math.min(2, all[0].s))
          .slice(0, 2).map((x) => x.p.name),
      }))
      .filter((x) => x.at.length);
    const askedFor = forHers.map(({ a, at }) =>
      `For ${a.replace(/[.!?]+$/, "")}: ${at.join(" and ")}.`);
    /*
     * The generic pitch is the last resort, and even then it is read against
     * her. "Eight days is exactly right for the Rio Grande corridor, because
     * ... the food is the best in the interior West" went to someone who had
     * asked for hot springs and long walks, for no stated length, and does
     * not care about food. A sentence about eating is dropped unless she
     * asked for food; a sentence that asserts a length is dropped unless it
     * is hers. What survives is about the place; what is cut was about a
     * traveller she is not.
     */
    const wantsFood = brief.vibes.includes("food")
      || (brief.activities ?? []).some((a) => FOOD.test(a));
    const generic = d.pitch.split(/(?<=[.!?])\s+/).filter((sentence) => {
      if (!wantsFood && FOOD.test(sentence)) return false;
      const days = sentence.match(/\b(\w+|\d+)\s+(?:days?|nights?)\b/i);
      if (days && (!brief.days || String(brief.days) !== days[1].toLowerCase() && WORD_NUMBER[days[1].toLowerCase()] !== brief.days)) return false;
      return true;
    }).join(" ");
    let body = clauses.length
      ? clauses.join(" ")
      : askedFor.length ? askedFor.join(" ") : generic || d.pitch.split(/(?<=[.!?])\s+/)[0];
    if (clauses.length && askedFor.length) body = `${askedFor.join(" ")} ${body}`;
    // Her words are still echoed when nothing above could use them, so the
    // pitch never pretends she said nothing -- but as a sentence, not a
    // fragment before someone else's.
    if (!askedFor.length && brief.activities?.length) {
      const echo = brief.activities.join(", ").trim().replace(/[.!?]+$/, "");
      if (echo) body = `You asked for ${echo}. ${body}`;
    }
    const missed = unknownHead(brief);
    if (missed && brief.namedDestination) {
      // Not "I don't cover it". What she'd have to fix by hand is a sentence
      // about our data in the middle of her holiday.
      body = `${titleCase(missed)} didn't come together, so this is somewhere else rather than a stand-in for it. ` + body;
    }
    if (rec.weakFor) {
      body = `Being straight with you: for ${rec.weakFor} at this length and budget, I don't have anywhere I'd genuinely send you. ${d.name} is what fits the number and the dates, and it's a good trip, but it isn't ${rec.weakFor.split(" and ")[0]}. Give me more days or more budget and the answer changes. ` + body;
    }
    if (brief.budgetInferred && brief.budgetUsd !== undefined) {
      body += ` I've read "${brief.budgetInferred}" as somewhere around $${brief.budgetUsd.toLocaleString()} all in; tell me if that's off and I'll recut it.`;
    }
    // Don't open with "I think you should go here" and then spend the next
    // sentence explaining why it isn't what they asked for.
    const headline = rec.weakFor
      ? `${d.name}, with one honest caveat.`
      : `I think you should go to ${d.name}.`;
    return { headline, body };
  },

  async parseEdit(input: string, trip: Trip): Promise<EditOp[]> {
    return parseEditRules(input, trip);
  },

  async describeEdit(ops: EditOp[], summary: string[]): Promise<string> {
    if (!summary.length) {
      return "I didn't change anything — tell me more specifically what's off and I'll fix it.";
    }
    const lead = ops.some((o) => o.kind === "reduce_pace") ? "Agreed. "
      : ops.some((o) => o.kind === "remove_tag") ? "Fair. "
      : "";
    return lead + summary.join(" ");
  },
};
