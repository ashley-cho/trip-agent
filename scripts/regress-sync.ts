/**
 * Regression: the rules that decide whose copy of a trip survives.
 *
 * This is the function that quietly loses someone's work if it's wrong, and
 * the failure is invisible: no error, no crash, just a trip that reverted to
 * how it looked yesterday, or one you deleted on your phone sitting there
 * again when you open the laptop.
 */
import { planSync } from "@/lib/sync";
import type { SavedTrip } from "@/lib/trips";
import { emptyBrief } from "@/lib/types";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

const trip = (id: string, updatedAt: number, name = id): SavedTrip => ({
  id, name, stage: "chat", createdAt: 1, updatedAt,
  brief: emptyBrief(), msgs: [], history: [], trip: null,
});

const ids = (xs: { id: string }[]) => xs.map((x) => x.id).sort().join(",");

console.log("\n\x1b[1mWHOSE COPY WINS\x1b[0m\n");

// The plain case: a trip made on the laptop appears on the phone.
{
  const p = planSync([], [trip("a", 100)], []);
  check("a trip that exists only on the server comes down", ids(p.pull) === "a");
  check("and nothing goes up", p.push.length === 0);
}

// And the reverse.
{
  const p = planSync([trip("a", 100)], [], []);
  check("a trip made offline goes up on the next sync", ids(p.push) === "a");
  check("and nothing comes down", p.pull.length === 0);
}

// The conflict. Newer wins, in both directions.
{
  const newer = planSync([trip("a", 200)], [trip("a", 100)], []);
  check("the version edited more recently wins going up",
    ids(newer.push) === "a" && newer.pull.length === 0);
  const older = planSync([trip("a", 100)], [trip("a", 200)], []);
  check("and going down", ids(older.pull) === "a" && older.push.length === 0);
}

// Equal timestamps must not ping-pong between devices forever.
{
  const p = planSync([trip("a", 100)], [trip("a", 100)], []);
  check("an unchanged trip moves in neither direction",
    p.pull.length === 0 && p.push.length === 0);
}

// Deletion. The whole reason tombstones exist.
{
  const p = planSync([], [trip("a", 100)], [{ id: "a", at: 150 }]);
  check("a trip deleted here is deleted on the server", p.remove.join() === "a");
  check("and is never pulled back down", p.pull.length === 0,
    `pull: ${ids(p.pull)}`);
}

// A deletion must beat a newer remote edit, or deleting is unreliable.
{
  const p = planSync([], [trip("a", 999)], [{ id: "a", at: 1 }]);
  check("deleting beats a newer copy on the server",
    p.pull.length === 0 && p.remove.join() === "a");
}

// A trip deleted here must not be pushed back up from a stale local copy.
{
  const p = planSync([trip("a", 100)], [], [{ id: "a", at: 150 }]);
  check("a deleted trip is never pushed", p.push.length === 0);
}

// A realistic mix, because the single cases passing proves less than this.
{
  const p = planSync(
    [trip("keep", 100), trip("mine-newer", 300), trip("theirs-newer", 100), trip("local-only", 50)],
    [trip("keep", 100), trip("mine-newer", 200), trip("theirs-newer", 400), trip("remote-only", 70), trip("dead", 10)],
    [{ id: "dead", at: 20 }],
  );
  check("a mixed sync moves exactly what it should",
    ids(p.pull) === "remote-only,theirs-newer"
    && ids(p.push) === "local-only,mine-newer"
    && p.remove.join() === "dead",
    `pull=${ids(p.pull)} push=${ids(p.push)} remove=${p.remove.join()}`);
  check("and leaves the identical one alone",
    !p.pull.some((t) => t.id === "keep") && !p.push.some((t) => t.id === "keep"));
}

// Syncing twice must be a no-op the second time, or every open re-uploads
// everything.
{
  const local = [trip("a", 100), trip("b", 200)];
  const first = planSync(local, [], []);
  const settled = [...local];
  const second = planSync(settled, first.push, []);
  check("a second sync with nothing changed does nothing",
    second.pull.length === 0 && second.push.length === 0);
}

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
