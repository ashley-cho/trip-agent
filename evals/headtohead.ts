/**
 * Vamos against the thing it has to beat: Claude in a chat window.
 *
 * The whole product claim is "no more planning, just leave". That claim is
 * only true if asking Claude directly is worse, or slower, or both. Nothing
 * in this repo tested it, so the eval could sit at 95% while the honest
 * answer to "should I just use the chat?" was yes.
 *
 * Both sides get the same opening sentence and the same answers in the same
 * order. The chat side gets web search, because that is what a person
 * actually has in front of them; competing against a weaker opponent would
 * flatter us.
 *
 * Two questions, decided in advance:
 *
 *   done  = the first full day-by-day it produces
 *   time  = user turns to get there, not seconds
 *
 * Turns is the fair unit. Vamos is slower per turn because it goes and reads
 * things; the claim is that you have to say less, not that each reply is
 * quicker.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { Scenario } from "./scenarios";
import type { Trip } from "@/lib/types";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5-20250929";
const MAX_TURNS = 8;

/**
 * Both sides get told the same thing about the traveller.
 *
 * Vamos knows the origin without being told, because the app seeds it. If the
 * chat side has to guess, it spends a turn asking and the turn count is
 * measuring our seeding rather than our questions.
 */
const SEEDED_FACTS = "They live in San Francisco and would fly from there.";

/**
 * A person, not a script.
 *
 * The first version fed each side the scenario's answers in order, whatever
 * it had asked. So a chat that asked "where are you flying from?" was
 * answered "About a week." and never got to an itinerary, and the comparison
 * said we had won. That is not a win, that is a broken opponent.
 *
 * This answers whatever was actually asked, from the same facts, in one line,
 * the way a person types. It volunteers nothing: a traveller who pre-empts
 * every question makes both sides look fast.
 */
export async function traveller(
  client: Anthropic, sc: Scenario, asked: string,
): Promise<string> {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 200,
    system:
      "You are a traveller planning a holiday, replying to a travel agent. Answer ONLY what "
      + "was just asked, in one short line, the way someone types into a chat box. Never "
      + "volunteer anything you were not asked. If the question is about something your notes "
      + "do not cover, answer however an ordinary person would and keep it consistent with "
      + "your notes. If you are asked nothing and simply shown a plan, say \"looks good\".",
    messages: [{
      role: "user",
      content: [
        "Your notes on the trip you want:",
        sc.opening,
        ...sc.answers,
        SEEDED_FACTS,
        "",
        "The travel agent just said:",
        asked,
      ].join("\n"),
    }],
  });
  const text = (res.content as unknown as Record<string, unknown>[])
    .filter((c) => c.type === "text").map((c) => String(c.text ?? "")).join(" ").trim();
  return text || "Whatever you think.";
}

/**
 * Has it produced an actual day-by-day yet?
 *
 * Deliberately generous about formatting and strict about completeness: a
 * paragraph promising to plan the trip is not a plan, and neither is "Day 1"
 * on its own. Every day of the trip has to be there.
 */
export function hasFullDayByDay(text: string, days: number): boolean {
  const found = new Set<number>();
  const words: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
    eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  };
  for (const m of text.matchAll(/(?:^|\n)[\s#*_>-]*day\s*(\d{1,2}|[a-z]+)\b/gi)) {
    const raw = m[1].toLowerCase();
    const n = /^\d+$/.test(raw) ? Number(raw) : words[raw];
    if (n && n <= days) found.add(n);
  }
  for (let d = 1; d <= days; d++) if (!found.has(d)) return false;
  return days > 0;
}

export interface ChatRun {
  turns: number;
  reachedPlan: boolean;
  searches: number;
  transcript: { role: "user" | "assistant"; text: string }[];
  final: string;
}

/**
 * The chat side. No tools of ours, no catalogue, no planner: a person and a
 * text box, which is the actual competition.
 */
export async function chatSide(
  client: Anthropic, sc: Scenario, days: number,
): Promise<ChatRun> {
  const messages: Anthropic.MessageParam[] = [];
  const transcript: ChatRun["transcript"] = [];
  let searches = 0;
  let turns = 0;

  let next = `${sc.opening} ${SEEDED_FACTS}`;
  for (let i = 0; i < MAX_TURNS; i++) {
    messages.push({ role: "user", content: next });
    transcript.push({ role: "user", text: next });
    turns++;

    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 } as never],
      messages,
    });
    searches += Number((res.usage as unknown as Record<string, Record<string, number>>)
      ?.server_tool_use?.web_search_requests ?? 0);

    const text = (res.content as unknown as Record<string, unknown>[])
      .filter((c) => c.type === "text").map((c) => String(c.text ?? "")).join("\n");
    messages.push({ role: "assistant", content: res.content as never });
    transcript.push({ role: "assistant", text });

    if (hasFullDayByDay(text, days)) {
      return { turns, reachedPlan: true, searches, transcript, final: text };
    }
    // Answer whatever it actually asked, rather than reading the next line of
    // a script at it.
    next = await traveller(client, sc, text);
  }
  const final = transcript.filter((t) => t.role === "assistant").pop()?.text ?? "";
  return { turns, reachedPlan: false, searches, transcript, final };
}

/** The trip, written out the way the chat side writes one, so the judge cannot tell them apart. */
export function tripAsProse(trip: Trip, headline: string, why: string): string {
  const lines = [headline, "", why, ""];
  for (const d of trip.days) {
    lines.push(`Day ${d.index}: ${d.theme}`);
    for (const it of d.items) {
      if (it.type === "downtime") { lines.push(`  ${it.start} — free time`); continue; }
      lines.push(`  ${it.start} — ${it.name}${it.reason ? `. ${it.reason}` : ""}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export interface Verdict {
  winner: "A" | "B" | "tie";
  axes: Record<string, { winner: "A" | "B" | "tie"; why: string }>;
  note: string;
}

/**
 * Blind. A and B are shuffled by the caller and the judge is never told which
 * is which, because "one of these is the product we are building" is exactly
 * the sentence that decides the answer.
 */
export async function judge(
  client: Anthropic, brief: string, a: string, b: string,
): Promise<Verdict | undefined> {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system:
      "You are grading two travel itineraries written for the same traveller. "
      + "You do not know or care where either came from. Be specific and be hard to please: "
      + "say which is better on each axis and why, in one sentence each, naming the thing in "
      + "the itinerary that decided it. A tie is allowed and should be used when the two are "
      + "genuinely close, not to avoid a call.",
    tools: [{
      name: "verdict",
      description: "Grade the two itineraries.",
      input_schema: {
        type: "object" as const,
        required: ["overall", "axes"],
        properties: {
          overall: { type: "string", enum: ["A", "B", "tie"] },
          axes: {
            type: "object",
            description: "One entry per axis.",
            properties: Object.fromEntries([
              ["specificity", "Real named places with real detail, versus generic advice that could be about anywhere."],
              ["decisiveness", "Does it decide, or does it hand back options and leave the choosing to the traveller?"],
              ["fit", "Does it answer what this particular traveller asked for, including anything they said in passing?"],
              ["realism", "Could you actually do this? Distances, opening times, how much is in a day."],
              ["honesty", "Does it admit what it does not know, or is everything asserted with equal confidence?"],
            ].map(([k, d]) => [k, {
              type: "object",
              description: d,
              required: ["winner", "why"],
              properties: {
                winner: { type: "string", enum: ["A", "B", "tie"] },
                why: { type: "string", description: "One sentence, naming what decided it." },
              },
            }])),
          },
          note: { type: "string", description: "One sentence on the difference that mattered most." },
        },
      },
    }],
    tool_choice: { type: "tool", name: "verdict" },
    messages: [{
      role: "user",
      content: `The traveller said:\n${brief}\n\n--- ITINERARY A ---\n${a}\n\n--- ITINERARY B ---\n${b}`,
    }],
  });
  const block = res.content.find((c) => c.type === "tool_use");
  if (!block || block.type !== "tool_use") return undefined;
  const raw = block.input as Record<string, unknown>;
  const axes = (raw.axes ?? {}) as Verdict["axes"];
  const winner = raw.overall === "A" || raw.overall === "B" ? raw.overall : "tie";
  return { winner, axes, note: String(raw.note ?? "") };
}
