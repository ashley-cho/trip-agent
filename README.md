# Trip Agent — MVP v0.1

Tell it how you want to feel on vacation. It decides where you go, what you do, and why.

Not an itinerary generator, not a search engine. The whole product bet is **decision reduction**:
you should leave knowing what your trip is, not with 47 tabs open.

```bash
npm run sweep                   # destination distribution across every brief the chips allow
npm run textsweep               # the same, for phrasings people actually type
npm run coverage                # what is offered at 4 / 5 / 7 / 10 days
```

```bash
npm install
npm run build && npm start      # http://localhost:3000
npm run eval                    # scorecard against the committed baseline
npm test                        # LLM driver contract tests (no API key needed)

npm i -D playwright             # only if you want to run scripts/demo.mjs
node scripts/demo.mjs           # drives the whole §39 scenario, writes shots/

node standalone/build.mjs       # bundles the whole app into dist/trip-agent.html
```

`standalone/build.mjs` produces a single ~340KB HTML file with React, the CSS and
the entire planner inlined. It runs with no server: `lib/client.ts` falls back to
the in-browser rules driver when `/api/agent` isn't reachable, which is also what
makes the deployed app degrade gracefully rather than erroring. Open it from a
file path, host it anywhere static, or publish it as an artifact.

---

## The one architectural decision that matters

Judgment is swappable. Arithmetic is not.

| Layer | Owner | Why |
|---|---|---|
| Free text → structured brief | **Driver** (rules or LLM) | Needs language understanding |
| Which question to ask next | **Driver** | §5 judgment, not a rule |
| Destination pitch, edit replies | **Driver** | §12 voice |
| Sufficiency test, destination scoring | **Deterministic** | Must not drift; it's an eval metric |
| Scheduling, opening hours, travel time, budget | **Deterministic** | A model that invents opening hours fails §32 silently |
| Critic | **Deterministic** | The thing that catches the planner |

The seam is `AgentDriver` in `lib/agent/types.ts`. Two implementations:

- **`rules`** (default, zero config) — regex + scoring. Also the eval baseline.
- **`llm`** — Anthropic tool-use. Every response is schema-validated; anything that fails
  validation is dropped and the rules driver answers instead. A bad model response
  degrades, it doesn't break the app.

### Turning the LLM on

```bash
echo 'ANTHROPIC_API_KEY=sk-ant-...' > .env.local
npm run doctor        # one live call per driver method; tells you exactly what broke
npm start
```

`npm run doctor` is the preflight. It checks the key, probes the model id and
suggests a working one if the default is stale, then exercises `interpret`,
`nextQuestion`, `pitch` and `parseEdit` against the live API, reporting which
succeeded and which fell back to rules. Run it before `npm run eval:llm`.

The running app shows a badge in the top right reading **model** or **rules
only**, taken from the driver that actually answered the last call. There is no
way to be quietly on the wrong one.

That's the whole switch — `resolveDriver()` picks by env. Then:

```bash
npm run eval          # rules baseline
npm run eval:llm      # same scenarios, LLM driver, diffed against it
```

> **The LLM path has still never been run against the live API.** It was built without a key and
> verified by contract test (`npm test`, 13 cases) against a mock transport: valid responses
> accepted, out-of-range values dropped, slop rejected, invalid ops discarded, transport
> errors falling back. First real call is yours. If the model ID is stale, change
> `TRIP_AGENT_MODEL`.

### What the key can cost

The deployment is open to anyone, and every model call spends the key it is
configured with. Three things bound that, and only one of them is hard:

- `TRIP_AGENT_VISITOR_UNITS` (default 400/hour per visitor) and
  `TRIP_AGENT_DAILY_UNITS` (default 1500/day for the deployment), in the units
  `lib/guard.ts` prices actions in: a catalogue conversation is about eleven
  units, a research trip about fifteen and roughly $0.15. These counters live
  in one serverless instance's memory, so they are approximate and leak
  across instances; treat them as a speed limit, not a ceiling.
- A brief the catalogue can serve never reaches the model at all
  (`lib/shelf.ts`), and `npm run coverage:shelf` says how often that is.
- **The hard cap is the spend limit on the Anthropic console** (Plans &
  Billing → Limits), on the key's workspace. Nothing in this repo can enforce
  a monthly number; set it there before sharing the URL.

When the key is out of credit or rejected the app says so once, plans from
the catalogue, and shows the own-key box, so a visitor with their own key can
carry on paying Anthropic directly.

---

## Evals

`npm run eval` runs 6 scripted travellers end to end — discovery, recommendation, plan, edits —
and scores 11 metrics on the structured output. No judge model; almost all of it is
measurable on the itinerary object itself.

| Metric | What it catches |
|---|---|
| Schedule validity | Overlaps, closed venues, impossible hops (§32) |
| Pace adherence | Activities/day vs the pace they asked for |
| Downtime present | §10 — you can only pass by *not* filling the day |
| Geographic efficiency | Backtracking, km/day |
| Budget adherence | Estimate vs stated number |
| Question economy | Questions before recommending; ≤3 is a pass (§5) |
| One recommendation | Not a list (§6) |
| Reason coverage | % of items with a distinct non-empty reason (§13) |
| Anti-slop | Banned-phrase density + adjective stacking (§12) |
| Edit responsiveness | Did "too busy" actually reduce the count? (§14) |
| Preference respect | Never re-suggest what they turned down (§32) |
| **Matches what they asked** | Off-brief content — an art museum on a landscape trip |

Two metrics are deliberately **fairness-aware**: if the traveller asks for more nature and
there genuinely isn't any in those cities, declining *with a reason* scores 1 and silently
doing nothing scores 0. Scoring the refusal as a failure would train the agent to pad
itineraries, which is the exact behaviour §12 and §34 forbid.

```bash
npm run eval --  --only=surprise-me    # one scenario
npm run eval:baseline                  # re-baseline after an intentional change
```

Current baseline: **96% overall** across 8 scenarios and 8 destinations, schedule
validity 100%, budget adherence 100%, question economy 100%.

### The loop

1. Real sessions POST to `/api/feedback` → `evals/runs/sessions.jsonl`
   (the four §35 questions, plus every edit the user typed).
2. Edits that the parser scored `unknown`, and low "understood me" ratings, are the queue.
3. Each becomes a scenario in `evals/scenarios.ts`.
4. Change a prompt or a weight → `npm run eval` → see which metric moved.

Editing a prompt without re-running this is how the product silently regresses.

---

## What the eval found while building it

Kept here because it's the argument for having one at all.

- **A regex that could never match.** `\b(explor|…)\b` silently dropped "exploration" from
  every brief that used the word. The trip still looked fine — it was just the wrong trip.
- **Itineraries wrapping past midnight.** `toClock` wraps mod 1440, so a full day rendered
  activities at `00:00`. Fixed with a hard end-of-day guard.
- **Empty days.** Under-seeded destinations produced blank columns. Cities with no places
  are now excluded from trip shapes, and destinations are scored on whether the data can
  actually fill the requested length.
- **Re-adding what it just removed.** "Too busy" → cut By the Wine; "more wine" → put By the
  Wine straight back. Cut items are now deprioritised, used only after fresh options.
- **A $130 tasting menu on a $1,000 budget.** Cost pressure was a tie-break nudge, not a cap.
- **"Not a city trip" added *city* as a wanted vibe.** The parser read the sentence as a bag
  of words, so a stated negative became a stated positive and Korea won a trip that should
  have gone to Iceland. Now parsed clause by clause with negation scoped. This is the single
  clearest argument for the LLM driver — negation, sarcasm and hedging are exactly what a
  regex cannot do, and the harness is what will prove whether the model does it better.
- **Departure day never drove you back to the airport.** A two-base trip ended 180km from
  the plane, and nothing in the plan said so.
- **Day trips were rationed by trip length** rather than by whether a base could fill its own
  days — so Vík sat empty for two days while the South Coast went unvisited.
- **"I selected nature and it's showing me architectural museum stuff."** Two causes. The
  vibe→tag map was flat, so `viewpoint` and `coast` stood in for "nature" and a church tower
  and a concert hall both counted as nature content — the scoring reported a good match. And
  a trip built around landscape still spent four of seven nights in Reykjavík, because the
  night split ignored where the content actually was. Fixed by splitting tags into
  **core / support**, adding a **signature vs connective** distinction (a harbour walk sits
  fine on any trip; a concert hall does not), and letting the shape follow the brief — Vík
  now takes the nights when the ask is landscape. Also caught two places tagged for what was
  next to them rather than what they are.

  **No metric would have caught this.** Pace, downtime, geography, budget and reason coverage
  all passed on a trip full of the wrong content. `vibe_fidelity` is the twelfth metric and
  exists because of this report.
- **Korea won 10 of 15 typed phrasings while looking fine on the chips.** `npm run sweep`
  covers chip-space and reported a healthy 17% share; `npm run textsweep` covers what people
  actually type, and Korea took two thirds of it. The parser extracted no vibe at all from
  "take me somewhere beautiful", "lie on a beach", "somewhere warm", "romantic trip", or
  "somewhere I've never been" — and with nothing stated, `vibeScore` ranked by *average*
  strength, which picks whichever destination is blandly good at everything and picks the
  same one every time. Now half that weight goes to **character** (spread of the strength
  vector), because a place with an opinion is a better surprise than a safe all-rounder.
  Plus the missing vocabulary, and a `warmth` gate so "lie on a beach" stops proposing a
  black sand beach in Iceland. Korea 10/15 -> 5/15, with Portugal 5, Iceland 3, Mexico 2.

  Two input spaces, two distributions. Measuring only the one the UI makes easy hid this
  completely.
- **One destination won a third of every brief.** `npm run sweep` scores all 960 briefs the
  chips can produce and reports the distribution. Korea took 33% — not because the algorithm
  was broken but because its authored strength vector was flat-high (three 5s, no 2s), and
  `mean * 0.55 + worst * 0.45` rewards being decent at everything you asked for. Fixed in two
  places: Korea and Japan recalibrated to be spiky-true rather than uniformly good, and a
  **distinctiveness** term added — being a 5 for food when the field average is 4.5 says
  almost nothing, while a 5 for nature against an average of 3.4 is a real claim. Korea fell
  to 16% and the 7-day spread went to 30/25/23/20 across four destinations.
- **It recommended destinations it had already excluded.** At 3 days every option was ruled
  out, and it confidently proposed one anyway. Now says so and stays in the conversation.
- **You couldn't change your mind.** Duration and budget were only parsed when the field was
  empty, so "ok, make it $2,500 then" was silently ignored and there was no way out of a
  dead end.
- **"3–4 days" resolved to 3**, which excluded every destination with `minDays: 4` — so the
  shortest band recommended nothing at all.
- **"Eight days." parsed as seven.** The duration regex only matched digits, so a word numeral
  silently fell through to the default. Invisible, and it changed the whole trip — fixing it
  moved budget adherence 81 → 100% and question economy 89 → 100% in one commit, because
  every downstream estimate had been computed against the wrong length.
- **A literal `À-ÿ` range in a regex** threw at parse time in any bundle served without a
  charset declaration, taking the whole app down. Now written as `\u00C0-\u00FF`.
- **Free text wasn't available during the conversation** — only the chips were, which §28
  explicitly forbids. Nobody would have found this without typing instead of clicking.

---

## Known limitations

1. **Only three destinations are deep enough for a week.** `npm run coverage` prints the
   real picture — which destinations the recommender will actually offer at 4, 5, 7 and 10
   days, straight from `scoreDestinations` rather than a reimplementation of its gate:

   | | places | 4d | 5d | 7d | 10d |
   |---|---|---|---|---|---|
   | Portugal | 44 | — | ✓ | ✓ | ✓ |
   | Iceland | 35 | — | ✓ | ✓ | ✓ |
   | Korea | 33 | — | — | ✓ | ✓ |
   | Mexico | 12 | ✓ | ✓ | ~ | ~ |
   | Andalusia | 10 | — | ~ | ~ | — |
   | Denmark | 7 | ✓ | ~ | — | — |
   | Catalonia | 7 | — | ~ | — | — |
   | Japan | 10 | — | — | — | — |

   Japan is offered nowhere: it declares `minDays: 8` and has data for about three. It was
   previously sneaking through at 7 days because the duration gate had 20% slack in it — the
   one length its own caveat calls too short. The gate is now strict.

   A 3–4 day trip currently has two options, which is the thinnest part of the range.

 Portugal (49
   places), Iceland (36) and Korea (36) plan good 7–10 day trips. Andalusia, Mexico, Japan,
   Denmark and Catalonia have 7–13 each and honestly support 3–4 days. `dataDepth()` in the
   recommender declines to send you somewhere it can't fill. Adding places is still the
   highest-leverage change; copy the shape of `data/places-iceland.ts`.
2. **`more_tag` can't restructure a day, and this is now the top defect.** It tries free
   blocks, then a swap, then declines with a reason. Declining is correct behaviour, but it
   is the single thing holding the score down — it accounts for the entire edit-responsiveness
   gap across three of eight scenarios (`nature: 8 → 8`, `spa: 3 → 3`, `food: 6 → 6`). A
   day-level replan that rebuilds one day around a theme is the fix.
3. **Budget can't always be met** (4 days in Mexico under $1,000 including SFO airfare). The
   agent says so and names the lever rather than quietly cutting the trip. Levers pulled:
   cheaper activities → simpler rooms → honest disclosure.
4. **No database.** Trip state is React state; the traveller profile is `localStorage`. The
   entity shapes in `lib/types.ts` mirror the PRD's schema, so this is a persistence swap,
   not a rewrite.
5. **Every price is seeded**, and the UI labels it. No booking, no payment, no fake APIs
   pretending to transact.

---

## Layout

```
lib/
  types.ts        domain model
  discovery.ts    what to ask, when to stop, free-text parsing
  recommend.ts    destination scoring, confidence, data-depth
  planner.ts      trip shape → day-by-day, respecting hours/travel/pace/budget
  critic.ts       validates the plan; used by the app AND the evals
  edit.ts         conversational edits → typed ops → re-validated plan
  select.ts       place scoring, hard exclusions
  reasons.ts      hand-written reason bank with repeat suppression
  agent/          the swappable seam: types, rules, llm, prompts
data/             seeded destinations, cities, places (all notes hand-written)
evals/            metrics, scenarios, runner, baseline
app/, components/ Next.js UI; API routes keep the key server-side
```

**Nothing in `data/*.ts` is model-generated.** Every `note` is written by hand, which is what
makes §12 achievable — the agent's voice is authored, not sampled.
