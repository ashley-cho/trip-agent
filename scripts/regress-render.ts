/**
 * Regression: what the phone actually shows.
 *
 * Every other check in this repo reads the model layer — briefs, concepts,
 * itineraries, the strings the planner produces. None of them opens a browser,
 * and for a long time nothing in this project rendered at all in test. That
 * gap has a price, and it was paid twice:
 *
 *   1. Four canned chips sat under the composer on the finished plan — "This
 *      feels too busy", "More wine", "Less touristy", "Add a free afternoon".
 *      They were hardcoded, so a fishing trip in the Newberry Caldera was
 *      offered more wine. Nothing could see it: the chips were literals in
 *      JSX, so no test that imports lib/ can reach them, and every score in
 *      the suite stayed at 100% while the screen said something absurd.
 *
 *   2. All of that was reported from a phone. Nothing in the suite has ever
 *      laid the page out at all, let alone at 390px, so a line that runs off
 *      the right edge of an iPhone, a day headline clipped to an ellipsis, or
 *      a theme that renders white-on-white is invisible here by construction.
 *
 * So this file does the one thing no other check does: it builds the app,
 * serves it, drives a real session at iPhone width, and looks at the pixels.
 *
 * Five things it asserts, one per defect class:
 *
 *   overflow    nothing extends past the right edge of a 390px screen
 *   provenance  every visible label that names a thing traces to THIS session
 *   clipping    nothing is cut off or collapsed to zero height
 *   themes      light and dark both produce a readable page
 *   console     the run produces no console errors
 *
 * The provenance check is the "More wine" check. It collects every button,
 * link and chip on screen, reduces each to its content words, and requires
 * each word to appear either in what the traveller typed, in the trip the app
 * built for her, or in a deliberately small list of generic UI words. A
 * hardcoded suggestion fails it the moment the trip it sits under is about
 * something else.
 *
 * DETERMINISM. The server is started with ANTHROPIC_API_KEY empty, which
 * pins the app to its rules driver: no network, no model, the same trip every
 * run. The rate limiter's budget is raised through its own env vars because
 * it is per-process and would otherwise make the second run of the hour
 * behave differently from the first. Every external request (map tiles,
 * photos) is stubbed at the browser, so the run is fully offline and the
 * console-error check is not measuring the network.
 *
 * COST. About 35 seconds from a cold .next, 15 with one already built —
 * dominated by `next build`, which no other check in this suite needs. See
 * the note at the foot of this file about `npm run regress`.
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright";

/** Everything here shells out to ./node_modules/.bin, so anchor on the repo. */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d.split("\n").join("\n        ")}` : ""}`);
  if (!ok) fails++;
};

const PORT = Number(process.env.RENDER_PORT ?? 3311);
const ORIGIN = `http://127.0.0.1:${PORT}`;
/** iPhone width. Everything in the bug report was seen at this size. */
const WIDTH = 390;
const HEIGHT = 844;

/**
 * The one message this whole file is built on.
 *
 * Chosen because the rules driver — the only driver available with no network
 * — takes it straight to a proposal in a single turn: a named destination it
 * already holds, a length, a month, and a vibe it can read. Anything vaguer
 * dead-ends on the refuse-to-rank line. (A message containing the
 * word "budget" used to be parsed as a place to go and research; that is
 * fixed, and held by scripts/regress-notaplace.ts.) It is also a hiking trip
 * in the Pacific
 * Northwest, which is the closest thing in the seeded catalogue to the fishing
 * trip that was offered more wine.
 */
const BRIEF = "8 days on the Olympic Peninsula in October, hiking and quiet";

/**
 * Injected on purpose by --mutate, to prove each check can actually go red.
 * A check that cannot fail is worse than no check.
 */
type Mutation = "chip" | "wide" | "clip" | "theme" | "console" | null;
const MUTATE = ((): Mutation => {
  const i = process.argv.indexOf("--mutate");
  return i === -1 ? null : (process.argv[i + 1] as Mutation);
})();

// --- the app under test ------------------------------------------------------

function build(): void {
  if (process.env.RENDER_SKIP_BUILD === "1" && existsSync(resolve(ROOT, ".next/BUILD_ID"))) {
    console.log("  (skipping build, RENDER_SKIP_BUILD=1)");
    return;
  }
  // `npx next build` resolves a different next than the one installed here and
  // silently produces nothing. Always the local binary.
  const r = spawnSync("./node_modules/.bin/next", ["build"], { stdio: "inherit", cwd: ROOT });
  if (r.status !== 0) { console.error("next build failed"); process.exit(1); }
}

async function serve(): Promise<ChildProcess> {
  const proc = spawn("./node_modules/.bin/next", ["start", "-p", String(PORT)], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      // Rules driver, by design. See DETERMINISM above.
      ANTHROPIC_API_KEY: "",
      /*
       * The allowance is deliberately NOT raised here.
       *
       * It used to be, to a million, because the limiter charged rules-driver
       * calls too and the second run of the hour got the "that's my limit"
       * screen instead of a trip. That was the bug, not the test setup: with
       * no key nothing reaches Anthropic and there is no bill to protect. The
       * route now charges when a model call is actually made, so this run
       * costs nothing and can repeat all day — and if that ever regresses,
       * this file goes red on the second run, which is where it was noticed
       * in the first place. See scripts/regress-charge.ts.
       */
    },
  });
  proc.stdout?.resume(); proc.stderr?.resume();
  const deadline = Date.now() + 60_000;
  for (;;) {
    if (Date.now() > deadline) { proc.kill("SIGKILL"); throw new Error(`server did not come up on ${ORIGIN}`); }
    try {
      const res = await fetch(ORIGIN, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return proc;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 400));
  }
}

async function launch(): Promise<Browser> {
  const args = ["--no-sandbox", "--disable-dev-shm-usage"];
  try {
    return await chromium.launch({ args });
  } catch {
    // The pinned playwright wants a build number the preinstalled browser
    // isn't. Point it at the binary that is actually there.
    return await chromium.launch({ args, executablePath: "/opt/pw-browsers/chromium" });
  }
}

// --- words -------------------------------------------------------------------

/**
 * Grammar and counting. Words that carry no claim about the world, so a label
 * made only of these ("That's it", "Not this one", "1") names nothing and has
 * nothing to trace.
 */
const STOP = new Set(`a an and or the to in on of for with at by from into about over under
  it its me my mine you your yours i we our is are was were be been being am do does did done
  this that these those there here then than so but if not no yes all any some more less most
  least one two three four five six seven eight nine ten up down out off again just already
  actually what when where which who whom why how can could will would should have has had
  get got go goes going take takes want wants like as too very much many other another each
  per and/or s t re ll ve don t won isn aren didn couldn shouldn wouldn`.split(/\s+/).filter(Boolean));

/**
 * Generic UI words: the vocabulary of the chrome rather than of the trip.
 *
 * Kept deliberately short and reviewed by hand. Every word added here is a
 * word a hardcoded suggestion could hide behind, which is exactly how "More
 * wine" would survive a lazier version of this check. Nothing that names a
 * place, an activity, a food, a season or a mood belongs in this list.
 */
const UI = new Set(`save saved back trips trip trip's map maps remove delete add edit change
  send stop cancel close open show hide new start restart next prev previous submit skip
  day days night nights thing things free left why honest feedback rate
  theme auto light dark colour color
  key own anthropic instead use forget install app home account sign sync
  /* Device and account vocabulary. "Sign in to use these trips on your phone"
     is a fact about her devices, not a claim about her trip, and this check
     is about labels that name a PLACE or a THING TO DO the session never
     mentioned. It surfaced the moment Supabase was configured and the sync
     copy started rendering. Nothing here may name somewhere to go. */
  phone phones browser device devices computer laptop desktop email password
  in out up down here there these those your you
  leaflet openstreetmap google flights flight search dates date
  somewhere sleep stay stays hotel hotels booking book
  walking directions whole every train bus ferry drive driving flight leg legs transit
  loading thinking retry try error sorry restore restored planned draft
  now ago yesterday today week weeks
  am pm hrs hr min mins hour hours
  mon tue tues wed thu thur thurs fri sat sun
  jan feb mar apr jun jul aug sep sept oct nov dec`.split(/\s+/).filter(Boolean));

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Content words: what is left of a label once grammar and chrome are removed. */
const contentWords = (s: string): string[] =>
  Array.from(new Set(
    norm(s).split(/[^a-z]+/)
      .filter((w) => w.length >= 3 && !STOP.has(w) && !UI.has(w)),
  ));

/**
 * Everything the session itself said, as one bag of words.
 *
 * The traveller's own messages, plus every human-facing string on the trip the
 * app built. `tags` and id fields are excluded on purpose: they are machine
 * metadata the traveller never sees, and they are how a bad chip sneaks
 * through — the seeded Seattle restaurant carries the tag "wine", so a corpus
 * built from raw JSON would have quietly cleared "More wine" on a hiking trip.
 */
function corpusOf(typed: string[], tripJson: unknown): Set<string> {
  const bag = new Set<string>();
  const eat = (s: string) => { for (const w of norm(s).split(/[^a-z]+/)) if (w.length >= 3) bag.add(w); };
  typed.forEach(eat);
  const walk = (v: unknown, key = "") => {
    if (typeof v === "string") { if (!/^(tags|avoidTags|id|.*Ids?)$/.test(key)) eat(v); return; }
    if (Array.isArray(v)) { v.forEach((x) => walk(x, key)); return; }
    if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
        if (/^(tags|avoidTags|id|.*Ids?)$/.test(k)) continue;
        walk(x, k);
      }
    }
  };
  walk(tripJson);
  return bag;
}

// --- what the browser measures ----------------------------------------------

interface Shot {
  screen: string;
  docScrollWidth: number;
  innerWidth: number;
  overflowing: { tag: string; cls: string; right: number; text: string }[];
  clipped: { tag: string; cls: string; sw: number; cw: number; overflowX: string; ellipsis: boolean; text: string }[];
  zeroHeight: { tag: string; cls: string; text: string }[];
  labels: string[];
}

/**
 * One pass over the laid-out DOM.
 *
 * Runs in the page because every one of these numbers only exists after
 * layout. Three exclusions, each earned:
 *
 *  - an element clipped by an ancestor that hides overflow is not visible
 *    overflow, it is a design. Map tiles are 256px squares deliberately hung
 *    off the side of a 290px map window.
 *  - anything inside or wrapping a Leaflet map is intrinsically wider than its
 *    frame; that is what a map is.
 *  - overflow-x auto/scroll is an element opting in to being scrolled
 *    sideways, which is the allowed way to be wider than the screen.
 */
const COLLECT = (vw: number) => `(() => {
  /*
   * The screen width is passed in rather than read from window.innerWidth.
   * Under mobile emulation the layout viewport GROWS to fit an overflowing
   * page — innerWidth went from 390 to 972 the moment a 900px element was
   * added — so a check written against innerWidth can never fail, which is
   * exactly what the mutation run caught.
   */
  const VW = ${vw};
  const vis = (el) => {
    const cs = getComputedStyle(el);
    return cs.display !== "none" && cs.visibility !== "hidden" && cs.opacity !== "0";
  };
  const clippedByAncestor = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.overflowX !== "visible" || cs.overflowY !== "visible") return true;
    }
    return false;
  };
  const isMap = (el) =>
    !!el.closest(".leaflet-container") || !!el.querySelector(".leaflet-container");
  const desc = (el) => ({
    tag: el.tagName.toLowerCase(),
    cls: String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className || "").slice(0, 70),
    text: (el.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 60),
  });

  const overflowing = [], clipped = [], zeroHeight = [];
  for (const el of document.querySelectorAll("body *")) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;

    if (r.right > VW + 1 && !clippedByAncestor(el) && !isMap(el)) {
      overflowing.push({ ...desc(el), right: Math.round(r.right) });
    }

    const cs = getComputedStyle(el);
    const optsIn = cs.overflowX === "auto" || cs.overflowX === "scroll";
    // clientWidth >= 8 skips the sr-only pattern: a 1px box holding a whole
    // sentence for a screen reader is not a clipped element, it is the point.
    if (!optsIn && !isMap(el) && el.clientWidth >= 8 && el.scrollWidth > el.clientWidth + 2) {
      clipped.push({ ...desc(el), sw: el.scrollWidth, cw: el.clientWidth, overflowX: cs.overflowX, ellipsis: cs.textOverflow === "ellipsis" });
    }

    const ownText = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(" ").trim();
    if (ownText && r.height === 0 && !clippedByAncestor(el)) zeroHeight.push(desc(el));
  }

  const labels = [];
  for (const el of document.querySelectorAll("button, a, [role=button], summary")) {
    if (!vis(el)) continue;
    const t = (el.innerText || el.textContent || "").trim().replace(/\\s+/g, " ");
    if (t) labels.push(t);
  }

  return {
    docScrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    innerWidth: VW,
    overflowing, clipped, zeroHeight, labels,
  };
})()`;

const shoot = async (page: Page, screen: string): Promise<Shot> =>
  ({ screen, ...(await page.evaluate(COLLECT(WIDTH))) as Omit<Shot, "screen"> });

// --- colour ------------------------------------------------------------------

const rgba = (s: string): [number, number, number, number] => {
  const m = s.match(/-?[\d.]+/g)?.map(Number) ?? [];
  return [m[0] ?? 0, m[1] ?? 0, m[2] ?? 0, m[3] ?? 1];
};
const lum = (c: [number, number, number, number]) => {
  const f = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(rgba(a)), lum(rgba(b))];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

// --- the run -----------------------------------------------------------------

async function main() {
  console.log(`\n\x1b[1mTHE PAGE, ON A PHONE\x1b[0m  (${WIDTH}px${MUTATE ? `, mutation: ${MUTATE}` : ""})\n`);

  build();
  const server = await serve();
  const browser = await launch();
  const consoleErrors: string[] = [];
  let shots: Shot[] = [];
  let themes: Record<string, { bg: string; fg: string }> = {};
  let corpus = new Set<string>();

  try {
    const ctx = await browser.newContext({
      viewport: { width: WIDTH, height: HEIGHT },
      deviceScaleFactor: 2, isMobile: true, hasTouch: true,
      // Fixed, so "October" always dates to the same Saturday and the same
      // opening hours. The app reads the client clock to date a trip.
      locale: "en-US", timezoneId: "UTC",
      /*
       * Every message and every chip enters through `.rise`, which animates
       * opacity from 0 over 380ms. Measure during that and an element is
       * either invisible to the visibility filter or half a transform away
       * from where it lands. globals.css turns the animation off entirely
       * under this media query, which is the only way to be sure the layout
       * being measured is the settled one.
       */
      reducedMotion: "reduce",
    });
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
    page.on("pageerror", (e) => consoleErrors.push(`uncaught: ${e.message.slice(0, 200)}`));

    /*
     * Offline for real. Map tiles and photos come from the open internet, and
     * a container without it turns every one of them into a console error that
     * has nothing to do with this app. Stub them and the console check is
     * measuring the app instead of the network.
     */
    await page.route("**/*", async (route) => {
      const url = route.request().url();
      if (url.startsWith(ORIGIN)) return route.continue();
      return route.fulfill({
        status: 200, contentType: "image/gif",
        body: Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"),
      });
    });

    await page.goto(ORIGIN, { waitUntil: "networkidle" });
    await page.waitForSelector("textarea");
    await page.waitForTimeout(600); // hydration; the composer is a client component
    shots.push(await shoot(page, "home"));

    await page.fill("textarea", BRIEF);
    await page.keyboard.press("Enter");
    await page.waitForSelector('button:has-text("Show me the trip")', { timeout: 60_000 });
    await page.waitForTimeout(400);
    shots.push(await shoot(page, "proposal"));

    await page.click('button:has-text("Show me the trip")');
    // The feedback block is the last thing the itinerary renders, so its
    // arrival means the whole screen is there.
    await page.waitForSelector("text=Be honest with me", { timeout: 60_000 });
    await page.waitForTimeout(800);

    if (MUTATE) await mutate(page, MUTATE);

    shots.push(await shoot(page, "itinerary"));
    // Injected nodes are appended outside React's tree, so they survive the
    // move back to the home screen and would show up twice in the mutation
    // table. Take them out once they have been measured where they belong.
    if (MUTATE) await page.evaluate(() => document.querySelectorAll("[data-render-mutation]").forEach((el) => el.remove()));

    /*
     * Back to the home screen, which is a different screen once a trip has
     * been saved: it grows a trips list, a memory note and a spend total, and
     * every one of those is rendered from the session rather than from a
     * literal. Nothing had ever laid it out in that state.
     */
    await page.click('button:has-text("All trips")');
    await page.waitForSelector("textarea");
    await page.waitForTimeout(500);
    shots.push(await shoot(page, "home (trip saved)"));

    corpus = corpusOf([BRIEF], JSON.parse(
      (await page.evaluate(() => localStorage.getItem("trip-agent.trips.v1"))) ?? "[]",
    ));

    // Both themes. The control cycles Auto -> Light -> Dark, and the label
    // says where it is, so click until it reads what we want.
    for (const want of ["Light", "Dark"] as const) {
      for (let i = 0; i < 4; i++) {
        if ((await page.locator("button[aria-label^='Theme']").innerText()).trim() === want) break;
        await page.click("button[aria-label^='Theme']");
        await page.waitForTimeout(120);
      }
      themes[want] = await page.evaluate(() => {
        const cs = getComputedStyle(document.body);
        return { bg: cs.backgroundColor, fg: cs.color };
      });
    }
  } finally {
    await browser.close().catch(() => {});
    server.kill("SIGTERM");
    await new Promise((r) => setTimeout(r, 700));
    if (server.exitCode === null) server.kill("SIGKILL");
  }

  // --- 1. nothing runs off the right edge ------------------------------------
  /*
   * The whole report came from a phone. A page 12px too wide reads as "the
   * app is broken" long before anyone works out which element did it, and
   * document.scrollWidth is the number the browser itself uses to decide
   * whether to offer a sideways scroll.
   */
  console.log("\n\x1b[1mNOTHING RUNS OFF THE RIGHT EDGE\x1b[0m\n");
  for (const s of shots) {
    check(`${s.screen}: the document is no wider than the screen`,
      s.docScrollWidth <= s.innerWidth + 1,
      s.docScrollWidth > s.innerWidth + 1 ? `scrollWidth ${s.docScrollWidth} > viewport ${s.innerWidth}` : "");
    check(`${s.screen}: no element reaches past the right edge`,
      s.overflowing.length === 0,
      s.overflowing.slice(0, 5).map((o) => `${o.tag}.${o.cls} right=${o.right} "${o.text}"`).join("\n"));
  }

  // --- 2. every label traces to this session ---------------------------------
  /*
   * The "More wine" check. A label that names a thing — a place, an activity,
   * a drink, a mood — has to have got that name from somewhere: from what she
   * typed, or from the trip on the screen underneath it. A word that appears
   * in neither is a literal somebody typed into JSX, and it will be wrong for
   * every trip but the one they were picturing.
   */
  console.log("\n\x1b[1mEVERY LABEL TRACES TO THE SESSION\x1b[0m\n");
  check("the session produced a corpus to check against", corpus.size > 50, `${corpus.size} words`);
  for (const s of shots) {
    const orphans: string[] = [];
    for (const label of new Set(s.labels)) {
      const stray = contentWords(label).filter((w) => !corpus.has(w));
      if (stray.length) orphans.push(`"${label.slice(0, 60)}" → ${stray.join(", ")}`);
    }
    check(`${s.screen}: no label names something the session never mentioned`,
      orphans.length === 0, orphans.slice(0, 8).join("\n"));
  }

  // --- 3. nothing is clipped or collapsed ------------------------------------
  /*
   * Two ways a phone eats content silently. A box narrower than its own text
   * cuts the text off — with an ellipsis if it is `truncate`, without one if
   * it is not — and neither the layout nor any lib/ test notices. And an
   * element with text in it and no height at all renders as nothing, which is
   * the worst kind of missing: the string is right there in the DOM.
   */
  console.log("\n\x1b[1mNOTHING IS CLIPPED OR COLLAPSED\x1b[0m\n");
  for (const s of shots) {
    check(`${s.screen}: no element is wider than the box that holds it`,
      s.clipped.length === 0,
      s.clipped.slice(0, 8).map((c) => `${c.tag}.${c.cls} ${c.sw}px of text in ${c.cw}px${c.ellipsis ? ", ellipsised" : ", cut with no ellipsis"}: "${c.text}"`).join("\n"));
    check(`${s.screen}: no text renders at zero height`,
      s.zeroHeight.length === 0,
      s.zeroHeight.slice(0, 5).map((z) => `${z.tag}.${z.cls} "${z.text}"`).join("\n"));
  }

  // --- 4. both themes render -------------------------------------------------
  /*
   * Every colour in globals.css is defined three times — bare :root, the
   * system dark preference, an explicit dark choice — and a colour defined in
   * only one of those blocks is the classic unreadable page. Nothing here has
   * ever looked at a rendered colour.
   */
  console.log("\n\x1b[1mBOTH THEMES RENDER\x1b[0m\n");
  for (const [name, t] of Object.entries(themes)) {
    check(`${name}: the page has an opaque background`, rgba(t.bg)[3] > 0.99, t.bg);
    check(`${name}: the text has an opaque colour`, rgba(t.fg)[3] > 0.99, t.fg);
    check(`${name}: text and background are readable against each other`,
      contrast(t.bg, t.fg) >= 4.5, `contrast ${contrast(t.bg, t.fg).toFixed(1)}:1 (${t.fg} on ${t.bg})`);
  }
  check("light and dark are not the same page",
    themes.Light?.bg !== themes.Dark?.bg && themes.Light?.fg !== themes.Dark?.fg,
    `light ${themes.Light?.fg} on ${themes.Light?.bg} / dark ${themes.Dark?.fg} on ${themes.Dark?.bg}`);

  // --- 5. a clean console ----------------------------------------------------
  console.log("\n\x1b[1mA CLEAN CONSOLE\x1b[0m\n");
  check("no console errors during the session", consoleErrors.length === 0,
    consoleErrors.slice(0, 6).join("\n"));

  console.log(fails === 0
    ? "\n\x1b[32mThe screen holds up at 390px.\x1b[0m\n"
    : `\n\x1b[31m${fails} failed.\x1b[0m\n`);
  process.exit(fails === 0 ? 0 : 1);
}

/**
 * Break one thing on purpose.
 *
 * Each of these is a real defect this repo either shipped or could ship
 * tomorrow, reproduced in the live DOM after the itinerary has rendered. The
 * point is not that the mutation is realistic JSX; it is that exactly one
 * check goes red for each, which is the only evidence that any of them work.
 */
async function mutate(page: Page, kind: Mutation) {
  if (kind === "chip") {
    // The original defect, verbatim: four canned suggestions under the plan.
    await page.evaluate(() => {
      const row = document.createElement("div");
      row.className = "flex flex-wrap gap-2";
      row.dataset.renderMutation = "1";
      for (const t of ["This feels too busy", "More wine", "Less touristy", "Add a free afternoon"]) {
        const b = document.createElement("button");
        b.className = "rounded-full border px-3 py-1 text-[0.85rem]";
        b.textContent = t;
        row.appendChild(b);
      }
      document.querySelector("main")?.appendChild(row);
    });
  }
  if (kind === "wide") {
    // What a stray `min-w-[900px]`, or a table nobody resized, does to a
    // phone. Set as a min-width with shrink off, because a plain width on a
    // flex child is negotiable and the browser just shrinks it back.
    await page.evaluate(() => {
      const el = (document.querySelector("main h2") ?? document.querySelector("main")) as HTMLElement;
      el.style.minWidth = "900px";
      el.style.flexShrink = "0";
      el.style.maxWidth = "none";
    });
  }
  if (kind === "clip") {
    // A caption box one third the width of its own single line of text, with
    // no ellipsis and no scrollbar: the string is there, the reader isn't.
    await page.evaluate(() => {
      const d = document.createElement("div");
      d.dataset.renderMutation = "1";
      d.style.cssText = "width:90px;overflow:hidden;white-space:nowrap";
      d.textContent = "Ferry to Bainbridge leaves at 10:40 and it is the only one before evening";
      document.querySelector("main")?.appendChild(d);
    });
  }
  if (kind === "theme") {
    await page.addStyleTag({ content: "body{background-color:transparent !important}" });
  }
  if (kind === "console") {
    await page.evaluate(() => { console.error("Warning: Each child in a list should have a unique \"key\" prop."); });
  }
}

/*
 * WHERE THIS BELONGS.
 *
 * Not in `npm run regress`. That script runs seventy-odd files with `npx tsx`
 * and no build; this one needs `next build` and a server, which turns a suite
 * that costs seconds into one that costs a minute and can fail for reasons —
 * a busy port, a missing browser — that have nothing to do with the code
 * under review. Keep it as its own entry (`npm run regress:render`) and run it
 * on anything that touches app/, components/ or globals.css, which is exactly
 * the set of changes the rest of the suite cannot see at all.
 */
main().catch((e) => { console.error(e); process.exit(1); });
