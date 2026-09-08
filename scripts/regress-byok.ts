/**
 * Regression: the ceiling, and the way through it.
 *
 * Running out used to mean the app quietly became its offline self, with a
 * small badge reading "rules only" as the only clue. That reads as the product
 * being bad rather than the allowance being spent. Now it says so, and offers
 * a visitor their own key.
 *
 * The rules that matter: somebody's own key must not be charged against the
 * bill it isn't paying, and a key that doesn't look like a key must never
 * reach the SDK.
 */
import { charge } from "@/lib/guard";
import { looksLikeKey, maskKey } from "@/lib/byok";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n\x1b[1mYOUR KEY, YOUR SPEND\x1b[0m\n");

// A visitor on the shared key runs out, as before.
let shared = 0;
while (charge("interpret", "shared-1").ok) { shared++; if (shared > 400) break; }
check("the shared allowance still runs out", shared > 0 && shared <= 200, `${shared} turns`);

// Someone on their own key gets a much longer leash: the limit that remains is
// about not monopolising the server, not about money.
let own = 0;
while (charge("interpret", "byok:1", 4).ok) { own++; if (own > 900) break; }
check("their own key buys a far longer run", own > shared * 3, `${own} vs ${shared}`);

// And critically, it must not spend the deployment's daily budget.
// Drain the day on the shared key first...
let sprayed = 0;
for (let i = 0; i < 4000; i++) {
  const v = charge("researchStream", `drain-${i}`);
  if (!v.ok && v.reason === "daily") { sprayed = i; break; }
}
check("the deployment's daily ceiling can be reached", sprayed > 0, `after ${sprayed} visitors`);
check("but somebody on their own key still gets served",
  charge("researchStream", "byok:after-daily", 4).ok,
  "this is the whole point: their spend, not hers");

// Key shape. A typo should fail in the browser, not halfway through a trip.
for (const good of [
  "sk-ant-api03-" + "a".repeat(40),
  "sk-ant-" + "A1_-".repeat(8),
]) check(`a real-shaped key is accepted (${good.slice(0, 14)}…)`, looksLikeKey(good));

for (const bad of ["", "hello", "sk-ant-", "sk-ant-short", "sk-proj-" + "a".repeat(40), " "]) {
  check(`"${bad.slice(0, 18)}" is refused`, !looksLikeKey(bad));
}

// Never show a whole key back to anyone, including its owner.
const k = "sk-ant-api03-" + "x".repeat(60) + "ABCD";
check("a key is masked when shown", maskKey(k) === "sk-ant-api0…ABCD", maskKey(k));
check("and the middle is genuinely gone", !maskKey(k).includes("x".repeat(20)));

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
