# Trip Agent

## Putting it on the web

Double-click **`Deploy to Vercel.command`** once. It signs you in, pushes your
API key from `.env.local` into Vercel's encrypted environment, builds, and opens
the live URL.

That URL is the real thing: the model, live web research for destinations the
catalogue doesn't hold, no terminal, and it works on your phone. The deploy runs
from this machine so the lockfile here is the one used, and your key goes
straight to Vercel rather than through anything else.

Re-run the same file any time you want to ship changes.

The shareable static link cannot do any of this. It has no server, so no key and
no web access. Treat it as a demo of the planner, not as the product.

## Running it locally

Open `~/code/trip-agent` in Finder and **double-click `Trip Agent.command`**.

A Terminal window opens, tells you whether the model is live, starts the server
and opens your browser. Leave that window open while you use the app. Close it
to stop. That is the whole thing — no commands to type.

The first line it prints is the one that matters:

| It says | It means |
| --- | --- |
| `Model: Claude — key verified, live` | Real model calls. This is the thing to dogfood. |
| `Model: key present but the API said 401` | The key in `.env.local` is revoked or wrong. |
| `Model: no key in .env.local` | Rules only. Still fully usable, just not the real product. |

Inside the app, the pill in the top right says the same thing per call:

- **model** — the model answered that call
- **model failed — rules** — a model is configured, that call failed, rules
  covered for it. Hover it for the reason.
- **rules only** — no key, by design

That pill exists because the driver falls back silently on error. A thing
labelled "llm" that fell back on every call was a real bug here, twice.

## What is real and what is mocked

Real: the destination scoring, the day scheduling, opening hours, travel time
between places, the budget arithmetic, the critic that rejects bad plans, and
the 394 hand-written places across 15 destinations.

Mocked: bookings. Nothing is charged, nothing is reserved.

Rules vs model: only the *language understanding* changes between the two.
Scheduling, hours and money are deterministic either way, on purpose — you
don't want a model doing arithmetic about your money.

## Things worth trying when you dogfood

- Type instead of tapping the chips. The chips are the easy path; the typed
  path is where it breaks.
- Contradict yourself mid-conversation: "actually make it $2,500", "no, eight days".
- Name a place it may not cover, then something adjacent to it.
- Say what you *don't* want. Negation is the hardest part of the parser.
- On the itinerary, edit conversationally: "too busy", "more wine", "drop the
  museum", "swap day 3".

## If something looks wrong

Take a screenshot and send it. The screenshots you sent before are what caught
Korea dominating every result, museums landing on a nature trip, and named
places being silently dropped.

## The measurement side, if you want it

Type these in Terminal from this folder. None are needed to use the app.

    npm run doctor          preflight: is the key good, does the model answer
    npm run regress         the five real sessions that caught real bugs
    npm run research -- patagonia 9   live web research for a new destination
    npm run eval:parsing    15 phrasings a person would type, rules vs model
    npm run eval            13 metrics over full scenarios
    npm run sweep           distribution across the chip space
    npm run textsweep       distribution across typed input
    npm run coverage        which destinations can actually be offered
