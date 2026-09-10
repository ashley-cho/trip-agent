/**
 * Regression: raw API JSON in a chat bubble.
 *
 * `agent.researchStream` took `res.body`, decoded it, and pushed every chunk
 * into the open agent message. It did that for ANY 200, and the route does not
 * always answer with a stream: when the driver has no `researchStream` — no
 * key, so the rules driver — it answers `NextResponse.json(...)`. So the
 * traveller read this, on screen, in the conversation:
 *
 *   {"driver":"rules","problem":"no model is configured, so I can only plan
 *    what I already hold"}
 *
 * and the call reported itself as `driver: "llm"` with that JSON as its notes,
 * which is the part that makes it more than cosmetic — everything downstream
 * believed a model had answered.
 *
 * The class, not the instance: a response is read as prose only when the
 * server said it was sending prose. Anything else is a result to handle. So
 * this file checks the shape of the response rather than the wording of one
 * error, and one of the cases is a body nobody has written yet.
 */
import { agent } from "@/lib/client";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

/** The NUL that separates streamed prose from the trailing metadata line. */
const FENCE = String.fromCharCode(0);

/** Stand in for the route. Returns exactly what it is told to. */
const serving = (body: string, contentType: string, status = 200) => {
  globalThis.fetch = (async () =>
    new Response(body, { status, headers: { "content-type": contentType } })) as typeof fetch;
};

/** Run one research call and report what reached the screen. */
async function run() {
  const shown: string[] = [];
  const out = await agent.researchStream("Faroe Islands", 7, undefined, (t) => shown.push(t));
  return { shown: shown.join(""), out };
}

async function main() {
  console.log("\n\x1b[1mA JSON BODY IS NOT SOMETHING TO READ\x1b[0m\n");

  // 1. The exact body the route sends when no model is configured.
  {
    serving(
      JSON.stringify({ driver: "rules", problem: "no model is configured, so I can only plan what I already hold" }),
      "application/json",
    );
    const { shown, out } = await run();
    check("nothing from a JSON body reaches the conversation",
      shown === "", JSON.stringify(shown));
    check("no braces, no quoted keys, nothing machine-shaped on screen",
      !/[{}]|"driver"|"problem"/.test(shown), JSON.stringify(shown));
    check("it comes back as a handled problem instead",
      !out.text && typeof out.problem === "string" && out.problem.length > 0,
      JSON.stringify(out));
    check("and it does not claim a model answered",
      out.driver !== "llm", String(out.driver));
    check("the server's own explanation is the one carried through",
      out.problem === "no model is configured, so I can only plan what I already hold",
      String(out.problem));
  }

  // 2. The general case: any non-stream 200, including one nobody wrote yet.
  {
    serving(JSON.stringify({ driver: "rules", places: [], somethingNew: 1 }), "application/json");
    const { shown, out } = await run();
    check("a JSON body with no `problem` field is still never printed",
      shown === "", JSON.stringify(shown));
    check("and still becomes a problem the caller can act on",
      !out.text && !!out.problem, JSON.stringify(out));
  }
  {
    serving("<!doctype html><html><body>502 Bad Gateway</body></html>", "text/html");
    const { shown, out } = await run();
    check("an HTML error page is not streamed at her either",
      shown === "", JSON.stringify(shown));
    check("and it is a problem too", !out.text && !!out.problem, JSON.stringify(out));
  }

  // 3. The thing that must keep working: an actual stream.
  {
    const meta = { driver: "llm", sources: ["https://example.com"] };
    serving(`The Faroes in October are wet and empty.\n${FENCE}${JSON.stringify(meta)}`,
      "text/plain; charset=utf-8");
    const { shown, out } = await run();
    check("a real text stream still reaches the conversation",
      shown.includes("The Faroes in October are wet and empty."), JSON.stringify(shown));
    check("and its trailing metadata is still read, not printed",
      out.driver === "llm" && (out.sources ?? []).length === 1 && !shown.includes("sources"),
      JSON.stringify({ out, shown }));
    check("and the metadata line is not part of the notes",
      !(out.text ?? "").includes(FENCE) && !(out.text ?? "").includes("\"driver\""),
      JSON.stringify(out.text));
  }

  // 4. A transport failure is still a transport failure.
  {
    serving("nope", "text/plain", 500);
    const { shown, out } = await run();
    check("a 500 is a problem and prints nothing",
      shown === "" && !out.text && !!out.problem, JSON.stringify({ shown, out }));
  }

  console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
  process.exit(fails ? 1 : 0);
}

main();
