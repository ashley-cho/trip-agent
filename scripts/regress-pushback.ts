/**
 * A message typed at a finished plan is usually about that plan.
 *
 * An LA itinerary built for the 2028 Olympics, followed by:
 *
 *   "has the la olympics schedule come out yet? i'm just interested in
 *    tennis matches"
 *
 * came back "I think you should go to South Korea." She asked a question
 * about the trip she had. The app read it as rejection, cleared the
 * destination, threw the itinerary away and re-scored the whole catalogue
 * with tennis and food as the brief.
 *
 * The assumption was that anything typed at a proposal is pushback. Most of
 * what people say to a finished plan is a question about it, a request to
 * change one thing, or thinking out loud. Only two of those mean "somewhere
 * else", and this file is the line between them.
 */
import { readPushback } from "@/lib/pushback";
import { SEEDED_ORIGIN } from "@/lib/origin";
import { recommend } from "@/lib/recommend";
import { emptyBrief, emptyProfile, type Brief } from "@/lib/types";
import type { BriefPatch } from "@/lib/agent/types";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `  ${d}` : ""}`);
  if (!ok) fails++;
};
const b: Brief = { ...emptyBrief(), origin: SEEDED_ORIGIN, days: 7 };
const at = (text: string, patch: BriefPatch = {}, current = "southwest") =>
  readPushback(text, patch, b, current);

console.log("\n\x1b[1mDOES THIS MESSAGE MEAN 'SOMEWHERE ELSE'\x1b[0m\n");

// --- stays put ----------------------------------------------------------
for (const t of [
  "has the la olympics schedule come out yet? i'm just interested in tennis matches",
  "when do tickets go on sale?",
  "what's the food like there",
  "is it hot in august",
  "how far is the drive between them",
  "can i do this in five days",
  "add a night in the first city",
  "more hiking please",
  "i love this",
  "ok",
  "what about parking",
]) {
  check(`stays: "${t.slice(0, 46)}"`, !at(t).moveOn, at(t).reason);
}

// --- moves on -----------------------------------------------------------
for (const t of [
  "not this one",
  "somewhere else please",
  "i'd rather go somewhere warm",
  "this is too far",
  "i don't want this",
  "pick something else",
]) {
  check(`moves: "${t.slice(0, 46)}"`, at(t).moveOn, at(t).reason);
}
check("naming a different place moves her",
  at("actually let's do portugal", { namedDestination: "portugal" }).moveOn);
check("naming the SAME place does not",
  !at("yeah utah sounds right", { namedDestination: "southwest" }).moveOn);
check("a constraint the destination fails moves her",
  at("i wanna go abroad", { wantsInternational: true }).moveOn, at("i wanna go abroad", { wantsInternational: true }).reason);
check("the same constraint on a destination that passes does not",
  !at("i wanna go abroad", { wantsInternational: true }, "japan").moveOn);

/*
 * A question that happens to contain a rejection word is still a question.
 * "is this boring?" is asking, not refusing.
 */
check("a question containing a rejection word is still a question",
  !at("is this too touristy?").moveOn);
check("but the same words as a statement are not",
  at("this is too touristy").moveOn);

/*
 * Nothing is ever taken away.
 *
 *   "it shouldn't remove any context that was given. If the person wants to
 *    start fresh, they'll just start a new session."
 *
 * Saying no used to be implemented by deleting `namedDestination`: throwing
 * away one thing she told us in order to record another. Both are facts. The
 * newer one wins, and the older one stays on the brief.
 */
{
  const named: Brief = { ...emptyBrief(), days: 7, namedDestination: "southwest", origin: SEEDED_ORIGIN };
  const kept = recommend(named, emptyProfile());
  check("a named destination is planned as named", kept.destinationId === "southwest", kept.destinationId);

  const afterNo = recommend(named, {
    ...emptyProfile(), rejectedDestinationIds: ["southwest"],
  });
  check("after she turns it down, it is not handed back",
    afterNo.destinationId !== "southwest", afterNo.destinationId);
  check("and the brief still remembers she asked for it",
    named.namedDestination === "southwest");
}

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
