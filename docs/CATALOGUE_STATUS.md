# Vamos catalogue build: status and how to continue

Updated 2026-09-26.

## The bar

Every base a trip can be pinned to holds 15+ places and 3+ named meals, coordinates
within 80 km, hours on 40%+ of places, no banned words, sources listed.
Checker: `npx tsx scripts/pack-check.ts <file or dir> --min 15`. Brief for
writers: `docs/PACK_BRIEF.md`. Ratchet: `scripts/regress-coverage.ts` (the
AT_THE_BAR list).

## Pipeline (per pack)

1. Research (Sonnet, web search + fetch) → `/home/claude/packs/notes/<id>.md`.
   Prompt: `packs/prompts/research.md` via `python3 mkprompt.py research <id>`.
2. Write (Opus) → `/home/claude/packs/out/<id>.json` (flat shape), runs the checker.
   Prompt: `packs/prompts/write.md`.
3. Top-up / fix-up (Sonnet) when the checker fails: `prompts/topup.md`, `prompts/fixup.md`.
4. Adopt: `npx tsx scripts/adopt.ts <dir>` writes the row shape to `data/catalogue/`.
5. Load: build one `insert ... on conflict do update` per pack (see the python in
   the session), then a Sonnet agent runs them through `mcp__Supabase__execute_sql`
   (project bzhlpvcoldcqcyctkpsw, table `packs`). The app reads packs from the
   table at runtime, so a loaded pack is live without a deploy.
6. Commit `data/catalogue/*.json`; ship to her Mac via patch + `git am`; she pushes.

Cost: ~13 minutes and ~350k tokens per pack. Web search: 200 calls per session
per day, shared by every agent; fetch-only works for cities Michelin/Wikipedia
cover and fails for small towns and islands. reddit.com is blocked and not
indexed; "Reddit first" for meals cannot be done from here.

## Done (at the bar, loaded, committed)

belgium, netherlands, london (Bath/Oxford/Brighton), singapore, hongkong,
thailand (Bangkok, Chiang Mai, Krabi, Railay, Koh Lanta, Koh Samui),
czechia, austria, spain-madrid. Rio and Riviera alias fixes loaded.

## Drafted, below the bar (in packs/out, notes in packs/notes)

- hungary: Eger, Pécs, Balaton lack coordinates/meals; Budapest fine.
- italy-north: Venice at 14, hours thin on Verona/Como/Bologna; Como and Bologna
  as day trips.

## Wanted (packs/wanted.tsv, status column)

Event hosts: Monaco, Madrid (done), Montreal, Shanghai, Turin, Augusta, Miami,
Las Vegas, Austin, Silverstone/London (done), Abu Dhabi, Bahrain, Jeddah, Suzuka
(Japan), Spa, Zandvoort, Baku, Mexico City (in Mexico), Interlagos/São Paulo.
Her list: Dubai, Venice/Milan/Como, Hong Kong (done), South Africa, Malaysia,
Namibia, Romania, Hungary, Bulgaria, Argentina, Colombia, Uruguay, India
(Rajasthan; Mumbai+Goa), Sri Lanka, Bangladesh, Laos, Myanmar, Caribbean/
St Vincent, Oslo/Stockholm/Copenhagen, Bath (done), Jeju, Banff, Georgia,
Alps landscapes (Zermatt, Zugspitze, Dolomites), Sardinia, Naples/Amalfi/Puglia,
Strasbourg/Basel, Hawaii Oahu+Maui, Philippines (held, deepen), Ecuador, Chile
(held, deepen), Scotland, Ireland, Egypt, Morocco (held, deepen), Mongolia
(held, deepen), ~40 US NFL/NBA/MLB cities.
Deepen existing bases to 15+: 367 of 422 bases are under.

## Events

`data/events.json` (148 rows) + `lib/events.ts`: F1 2026/2027, Grand Slams,
Masters 1000, ATP Finals, UCL/UEL finals, golf majors, Olympics, NFL/NBA/MLB
teams. `scripts/regress-events.ts`. 2027 dates not yet published for most tennis
and the Masters: provisional (last year +52 weeks), said on the card.
