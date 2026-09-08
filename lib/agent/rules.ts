import type { Brief, Trip } from "@/lib/types";
import { unknownHead } from "@/lib/types";
import type { AgentDriver, BriefPatch, EditOp, Phase, PlaceContext, Question, Recommendation, Turn } from "./types";
import { interpretRules, nextQuestionRules } from "@/lib/discovery";
import { parseEditRules } from "@/lib/edit";
import { destinationById } from "@/data/destinations";
import { tiebreakPrompt } from "@/lib/recommend";

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
    let body = clauses.length ? clauses.join(" ") : d.pitch;
    // "Something that feels different The canyon delivers scale" — her own
    // answer glued to the next sentence with nothing between them. Echoing
    // someone's words back only works if it reads as a sentence.
    if (brief.interestEcho) {
      const echo = brief.interestEcho.trim().replace(/[.!?]+$/, "");
      if (echo) body = `${echo.charAt(0).toUpperCase()}${echo.slice(1)}. ${body}`;
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
