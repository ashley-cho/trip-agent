/**
 * A thumbs-down has to arrive with enough to act on.
 *
 * The first real vote from the deployment came back with `driver: null`. The
 * write worked, the row landed, and it was half useless: a model fabrication
 * and a regex fabrication are different bugs with different fixes, and a
 * queue that cannot tell them apart makes you replay every row by hand.
 *
 * The cause was a fix from earlier the same day. The driver badge in the
 * header was build diagnostics on the one screen that should be the plan, so
 * it went — and the VALUE went with it, which nothing noticed, because
 * nothing tested what a vote carries. This is that test.
 */
import { readFileSync } from "node:fs";
import { accountStopped, accountStopSays } from "@/lib/account";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n\x1b[1mA VOTE CARRIES ENOUGH TO ACT ON\x1b[0m\n");

const page = readFileSync("app/page.tsx", "utf8");
const votes = readFileSync("lib/votes.ts", "utf8");

/*
 * Read at the call site rather than by running the component: the failure was
 * a field never passed, which is a property of the call, and a React harness
 * here would test the harness. The fields are asserted individually so the
 * message names the one that is missing.
 */
const callStart = page.search(/(?:void |return )sendVote\(\{/);
const call = page.slice(callStart, page.indexOf("};", callStart));
for (const field of ["sessionId", "verdict", "said", "turnIndex", "brief", "trip", "destinationId", "driver"]) {
  check(`a vote carries ${field}`, new RegExp(`\\b${field}\\b`).test(call),
    call.replace(/\s+/g, " ").slice(0, 140));
}

// The driver has to be LIVE, not a constant: noteDriver is the only thing that
// knows, so it has to write somewhere the vote can read.
check("and the driver is recorded when a call reports one",
  /noteDriver = \([^)]*\) => \{[^}]*driverRef\.current = /s.test(page),
  "noteDriver must store the driver, not only log a fallback");
check("and the vote reads that, not a literal",
  /driver:\s*driverRef\.current/.test(call), call.replace(/\s+/g, " ").slice(0, 140));

/*
 * The row has to survive the network being gone. Half the sessions this app
 * is built for happen on a train.
 */
check("a vote is kept locally before it is sent",
  votes.indexOf("localStorage.setItem") < votes.indexOf("const db = supabase()"),
  "the local write must come first, and must not depend on the insert");
check("and a failed insert is reported rather than swallowed",
  /return error \? \{ ok: false/.test(votes));

/*
 * The point of the brief and the plan is replay. A row without them is a
 * complaint; with them it is a scenario.
 */
check("the plan is stored as a signature, not the whole trip",
  /trip_signature: signature\(v\.trip\)/.test(votes));

/*
 * And the screen has to tell the truth about where it went.
 *
 * It said "Noted, and it becomes a test." the instant it was clicked, and
 * kept saying it while every insert failed in production, because the
 * deployment had no database. Telling her feedback landed when it did not is
 * the same lie as telling her the trip covers something it does not, and it
 * is worse, because she has no way to find out.
 */
const chat = readFileSync("components/Chat.tsx", "utf8");
check("the vote's result is awaited, not fired and forgotten",
  /\.then\(\(x\) => setLanded\(x\.ok\)\)/.test(chat), "Bubble must read what sendVote returns");
check("and the page hands that result back rather than voiding it",
  /const vote = \([^)]*\) => \{\s*return sendVote\(/s.test(page),
  "page.tsx must return the promise, not `void sendVote(...)`");
check("a failed send says so instead of claiming it landed",
  /Saved on this device/.test(chat) && /couldn/.test(chat), chat.slice(chat.indexOf("landed === null"), chat.indexOf("landed === null") + 200));

/*
 * A rejected key is said out loud, once.
 *
 * A deployment went out with an invalid ANTHROPIC_API_KEY: every call 401'd,
 * fell back to the rules floor, and the app said nothing. It looked like it
 * was working. Someone dogfooding it would have spent an hour testing regexes
 * while believing they were testing the model, and every vote they left would
 * have been filed against the wrong half of the product.
 */
/*
 * These used to grep the component for a variable name, and that is exactly
 * how the billing case shipped broken: the source line the test looked for
 * was present, and the app still fell back silently for an entire day of
 * seeding because the pattern behind that line only matched 401.
 *
 * So the classifier is real code now, and these are the strings the API
 * actually returned, pasted from the failures rather than imagined.
 */
const REJECTED_KEY = '401 {"type":"error","error":{"type":"authentication_error",'
  + '"message":"invalid x-api-key"}}';
const OUT_OF_CREDIT = '400 {"type":"error","error":{"type":"invalid_request_error",'
  + '"message":"Your credit balance is too low to access the Anthropic API. Please go to '
  + "Plans & Billing to upgrade or purchase credits.\"}}";

check("a rejected key is recognised", accountStopped(REJECTED_KEY) === "auth");
check("an empty balance is recognised, though it arrives as a 400",
  accountStopped(OUT_OF_CREDIT) === "billing",
  "this is the one that shipped broken: 400 invalid_request_error matches no 401 pattern");
check("and the two are not confused for one another",
  accountStopped(OUT_OF_CREDIT) !== "auth" && accountStopped(REJECTED_KEY) !== "billing",
  "sending her to rotate a key that is fine wastes the one action she can take");
check("a dropped connection is neither",
  accountStopped("fetch failed") === undefined
  && accountStopped("529 overloaded_error") === undefined
  && accountStopped(undefined) === undefined);
check("what she reads names the actual cause",
  /out of credit/.test(accountStopSays("billing"))
  && /being rejected/.test(accountStopSays("auth"))
  && !/out of credit/.test(accountStopSays("auth")));
check("an account failure is told to the person using it",
  /say\("agent", accountStopSays\(stop\)\)/.test(page),
  "noteDriver must speak, not only console.warn");
check("and only once, not on every call",
  /if \(!stop \|\| accountToldRef\.current\) return;/.test(page)
  && /accountToldRef\.current = true;/.test(page));
check("while a transient fallback stays quiet",
  /if \(d !== "fallback"\) return;/.test(page)
  && !/say\("agent"[\s\S]{0,120}fell back to rules/.test(page),
  "a dropped connection is what the floor is for and must not produce a paragraph");

/*
 * And the database has a home even when nobody set an environment variable.
 * The publishable pair is designed to be public; the service-role key is not
 * and must never appear in a tracked file.
 */
const cfg = readFileSync("lib/supabase-config.ts", "utf8");
check("the publishable pair has a committed fallback",
  /supabase\.co/.test(cfg) && /sb_publishable_/.test(cfg));
check("and no service-role key is anywhere in it",
  !/sb_secret|service_role_key\s*=\s*["'][A-Za-z0-9]/i.test(cfg));

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
