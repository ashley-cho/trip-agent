/**
 * Regression: regexes do not get to say what she meant.
 *
 * The rules driver stays. It does arithmetic, it schedules, it prices, and
 * none of that needs a model. What it must not do is READ, and it was
 * reading — which is the whole shape of one day's bugs:
 *
 *   "Don't want south east asia"   became a shortlist of Southeast Asia.
 *   "too hot or cold or humid"     became nothing.
 *   "just not overwhelmingly"      became a place called "overwhelmingly not".
 *   "Not my kind of place"         became "you like food and culture less".
 *
 * Every one of those got a patch, and every patch was a filter that DELETED
 * what the parser could not read, because deleting is the only move a regex
 * has. Her verdict, and it is correct: worse than just talking to an llm.
 *
 * It was also the degraded mode she ruled out on the first day, arriving by a
 * side door — a rules answer is indistinguishable from a real one from the
 * outside, so the app looked like it was working while every sentence in it
 * was written by pattern matching.
 *
 * So the four actions that turn her words into meaning have no floor. And
 * because stopping is a real cost, her ceiling on it is five percent of
 * turns: transient failures are retried and only an account problem — which
 * will not fix itself and which only she can act on — stops immediately.
 */
import { readFileSync } from "node:fs";
import { accountStopped } from "@/lib/account";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n\x1b[1mNO FLOOR UNDER UNDERSTANDING\x1b[0m\n");

const client = readFileSync("lib/client.ts", "utf8");
const page = readFileSync("app/page.tsx", "utf8");

check("the four reading actions are named",
  /const COMPREHENSION = new Set\(\["interpret", "question", "pitch", "parseEdit"\]\)/.test(client),
  "these are the ones that turn her words into meaning");

check("a rules answer from the server is refused, not shown",
  /json\.driver === "rules" \|\| json\.driver === "fallback"[\s\S]{0,80}throw new NoModel/.test(client),
  "no key and a failed key arrive looking the same, so both are caught in one place");

check("and the client's own fallback is refused too",
  /if \(COMPREHENSION\.has\(String\(body\.action\)\)\) throw new NoModel/.test(client),
  "a transport failure must not become a regex answer either");

check("the standalone bundle has no floor either",
  /no server in this build/.test(client));

check("everything else keeps its fallback",
  /return local<T>\(body, "fallback"\);/.test(client),
  "describing an edit we made, or an empty hotel list, cannot be wrong about what she meant");

// --- stopping is last, not first -----------------------------------------
check("a transient failure is retried before anything stops",
  /COMPREHENSION_ATTEMPTS = 3/.test(client)
  && /for \(let i = 1; i <= COMPREHENSION_ATTEMPTS; i\+\+\)/.test(client),
  "her ceiling is five percent of turns; a dropped connection must not spend it");

check("but an account problem stops at once",
  /if \(noModel\(e\) && accountStopped\(\(e as NoModel\)\.why\)\) break;/.test(client),
  "three times the wait for the same answer helps nobody");

check("and the rate is measured, not hoped for",
  /export const stopRate = /.test(client) && /turns\.stopped\+\+/.test(client));

// --- and she is told which one it is --------------------------------------
check("out of credit says out of credit",
  /out of credit/.test(page) && /stoppedLine/.test(page));
check("a rejected key says the key",
  /being rejected/.test(page));
check("and neither tells her to just say it again",
  !/out of credit[\s\S]{0,200}[Ss]ay that again/.test(page));
check("while a genuine blip still does",
  /tried three times/.test(page));

check("every catch that could see it handles it",
  (page.match(/if \(noModel\(e\)\) \{ say\("agent", stoppedLine\(e\)\); return; \}/g) ?? []).length
  === (page.match(/say\("agent", "Something went wrong on my end/g) ?? []).length,
  "a stop reaching the generic sentence would read as a bug in the app rather than an empty account");

// The classifier that decides which, on the real strings.
check("an empty balance is an account problem, not a blip",
  accountStopped('400 {"type":"invalid_request_error","message":"Your credit balance is too low"}') === "billing");
check("a 529 is a blip and gets retried",
  accountStopped("529 overloaded_error") === undefined);

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
