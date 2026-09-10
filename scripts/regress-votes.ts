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
