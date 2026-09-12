/**
 * Nothing tells her it gave up without leaving a reason behind.
 *
 * Two different failures produced the same sentence and only one of them
 * logged anything: a research call that errored logged its problem, a pack
 * that came back too thin logged nothing at all. So "I couldn't work up The
 * Italian Coast" could mean the model timed out, or it could mean the model
 * succeeded and returned nine places where ten were needed, and from the
 * outside there was no way to tell which.
 *
 * That silence had a price. A timeout was diagnosed twice for a failure that
 * was never a timeout; a function ceiling was raised that did not need
 * raising; and a retry loop was added around a call that returns the same
 * answer every time it is asked. All three were guesses standing in for a log
 * line that was not there.
 *
 * This is a SOURCE check on purpose. The behavioural tests cover what each
 * sentence says; this covers the rule itself, so a give-up added next month
 * cannot be silent by accident.
 */
import { readFileSync } from "node:fs";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n\x1b[1mEVERY GIVING-UP LEAVES A REASON BEHIND\x1b[0m\n");

const flow = readFileSync("lib/flow.ts", "utf8");

/*
 * What counts as giving up: a sentence that tells her a thing she asked for
 * is not going to happen. Matched on the phrasings this file actually uses,
 * so a new one in a new voice needs adding here deliberately.
 */
const GIVE_UP_PHRASES = [
  "couldn't", "could not", "isn't coming together", "is not coming together",
  "not going to send you", "not going to pitch", "haven't actually looked",
  "I tried", "only enough of it",
];

// Every io.say(...) in the file, with its surrounding call for context.
const says = [...flow.matchAll(/io\.say\("agent",([\s\S]*?)\);\n/g)].map((m) => m[1]);
check("there are agent sentences to check at all", says.length >= 5, `${says.length} found`);

const giveUps = says.filter((s) => GIVE_UP_PHRASES.some((p) => s.includes(p)));

/*
 * The phrase list has to still match something, or every check below passes
 * by matching nothing. It is checked against the giveUp() calls rather than
 * the bare io.say ones, because the whole point is that the bare ones are
 * empty: an assertion that "some io.say is a give-up" goes green the moment
 * the last one is correctly routed, which is backwards.
 */
const routed = [...flow.matchAll(/giveUp\(io,[\s\S]*?\);\n/g)].map((m) => m[0]);
check("the phrase list still matches real sentences",
  routed.filter((r) => GIVE_UP_PHRASES.some((p) => r.includes(p))).length >= 3,
  `${routed.length} giveUp call(s), `
  + `${routed.filter((r) => GIVE_UP_PHRASES.some((p) => r.includes(p))).length} matching the list`);

/*
 * The rule: a giving-up sentence goes through `giveUp`, which logs. A bare
 * `io.say` carrying one is the thing that cost the time.
 */
const bare = giveUps.map((s) => s.replace(/\s+/g, " ").trim().slice(0, 90));
check("no giving-up sentence is spoken through a bare io.say",
  giveUps.length === 0,
  bare.length ? `these bypass giveUp():\n        - ${bare.join("\n        - ")}` : "");

check("giveUp() logs before it speaks",
  /function giveUp\([^)]*\)[^{]*\{\s*console\.warn/.test(flow),
  "the log must not be skippable by an early return");

/*
 * And the reason is for us, not her. A log line pasted into the bubble is
 * how "Only 7 usable places came back" ended up on someone's phone.
 */
// The whole function body, not a fixed window: the comment inside it grew
// when giving up started being recorded, and a 400-character slice stopped
// reaching io.say - the assertion failing on a comment rather than on the code
// it is about.
const call = flow.slice(flow.indexOf("function giveUp("),
  flow.indexOf("\n}", flow.indexOf("function giveUp(")));
check("and the reason it logs is not the sentence she reads",
  /console\.warn\(`\[gave up\] \$\{why\}`\)/.test(call) && /io\.say\("agent", said\)/.test(call),
  call.replace(/\s+/g, " ").slice(0, 160));

// Every call site passes a real reason, not an empty string or the sentence.
const sites = [...flow.matchAll(/giveUp\(io,\s*([\s\S]*?),\s*\n/g)].map((m) => m[1].replace(/\s+/g, " ").trim());
check("every giveUp call passes a reason", sites.length >= 2 && sites.every((w) => w.length > 8),
  sites.map((w) => w.slice(0, 70)).join("\n        "));


/*
 * And every give-up is counted, not just logged.
 *
 * The catalogue went from fifteen destinations to ninety-six in a day, and
 * every choice of WHICH to add was a guess about what somebody would ask for.
 * The data that would have settled it was being produced and thrown away at
 * the same moment: giveUp console.warned, which reaches the devtools of one
 * browser and therefore nobody.
 *
 * A give-up without a subject is the half that does not help. "Research
 * failed" tells you nothing; "research failed on Indian Wells" is the next
 * destination.
 */
{
  const misses = readFileSync("lib/misses.ts", "utf8");
  check("giving up is recorded, not only warned",
    /recordMiss\(\{ why, subject: about\?\.subject, days: about\?\.days \}\)/.test(flow),
    "the one place every give-up already funnels through");
  check("and the record says what it gave up ON",
    (flow.match(/\{ subject: /g) ?? []).length >= 5,
    `${(flow.match(/\{ subject: /g) ?? []).length} of the give-ups name their subject`);
  check("it stores the subject, not her whole message",
    /subject: m\.subject\?\.slice\(0, 120\)/.test(misses));
  check("and failing to record never becomes a second failure",
    /catch\(\(\) => \{ \/\* best effort, always \*\/ \}\)/.test(misses)
    && /try \{/.test(misses),
    "a database that is down must not turn one give-up into two");
}

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
