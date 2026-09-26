# Writing a destination pack

A pack is everything the app knows about one destination. It is used by a
planner that runs with no model at all, so what is in the pack is the whole
trip: if a place is missing, it is not on the itinerary; if an opening time
is wrong, the day is wrong where it touches. Write for the planner, in the
house voice, and only what you have checked.

## Files

One JSON file per pack, the FLAT shape (not the row shape in
`data/catalogue/`, which nests everything under `pack`). Save to the
directory you were given, as `<id>.json`. Then run:

    npx tsx scripts/pack-check.ts <that dir> --min 15

and fix everything it lists until it prints OK for your file.

## The bar

- 4 to 6 bases (`cities` without `dayTripOnly`), each a real place to sleep
  for 2 to 4 nights. Day-trip-only towns are fine as extras.
- Every base holds at least 15 places (aim 18), of which at least 4 are
  meals (`kind: "meal"`, tag `food`), NAMED restaurants, cafés, stands or
  markets with hours, not "dinner in the old quarter", and at least 1 is a
  drink or an evening. A base with 12 places is a base that runs out on
  day four; a base with two meals eats the same frites all week.
- Every place has real coordinates (4 decimals) inside its base's area,
  within 80 km of the base. Look them up; do not estimate from the town.
- `opens`/`closes` as `"HH:MM"` on every place that has hours (museums,
  restaurants, shops, markets, sights with gates). Leave both out for a
  street, a beach, a viewpoint. At least half the places should carry them.
- `closedDays` as numbers, 0 = Sunday … 6 = Saturday. A restaurant closed
  Monday is `[1]`. If the note says "closed Tuesdays" the field must agree.
- `costUsd` per person, today's price in USD, `0` when free. `durationMin`
  realistic door to door for the thing itself (a museum 90 to 150, a meal
  75 to 120, a viewpoint 30, a hike its real length).
- `touristy` 1 (locals only) to 5 (on every list). `bestTime` one of
  morning, midday, afternoon, evening, any.
- `kind` one of: sight, meal, drink, walk, outdoor, museum, market,
  experience. `tags` from: history, art, architecture, food, wine, coffee,
  market, nature, coast, viewpoint, walk, nightlife, music, museum,
  shopping, beach, hike, garden, contemporary, local, iconic, castle,
  church, boat, spa, earlystart, adventure, film.
- `outings` when the point of the trip is outside the towns (a trek, a
  safari, a drive, a boat): name, door-to-door `hours`, `startsFrom` (the
  beds you can sleep in the night before, with coordinates), `why`, and
  `km`, `gainM`, `costUsd`, `season`, `fallback` where they apply. A city
  pack may have none.
- `sources`: 8 to 20 URLs you actually read for the facts (official sites,
  transport operators, the venues themselves). Not blogs you did not open.
- Nothing you could not confirm. A place you are sure exists but whose
  hours you could not find: include it, leave `opens`/`closes` out, and say
  "hours vary, check" in the note. A place you are not sure exists: leave
  it out. Never invent a price or a closing day.

## Where meals come from

Restaurants go stale fastest, so the order of sources is fixed, and newer
beats older at every step:

1. Reddit first: the city's subreddit and r/travel threads from the last
   18 months ("where do locals eat in Antwerp", "best frituur"). A place
   named by several locals in a 2025 or 2026 thread outranks anything else.
2. Yelp, for hours, price band and whether it is still open.
3. The New York Times (36 Hours, the food desk's city pieces).
4. Zagat.
5. The Michelin Bib Gourmand list for the city (good food at a fair price;
   not the starred list, which is a different trip).

A restaurant that appears in none of these is fine if its own site
confirms it is open and you can say why it is there. Record which source
put it on the list. Always confirm it is open in 2026 before it goes in.

## The voice

Twenty years a travel agent, talking to one person. Specific, opinionated,
short sentences. Every `note` is one or two sentences that tell them
something they could not get from the name: what it actually is, the one
thing that goes wrong (queue, closing day, the cash-only bit), and when to
go. Meals say what to order. Numbers over adjectives.

Banned everywhere: hidden gem, vibrant, nestled, bustling, must-see,
gateway to, something for everyone, immerse yourself, picturesque,
charming, stunning, breathtaking, world-class, boasts, iconic landmark.
No stacked adjectives. No exclamation marks. No em dashes.

- `pitch` (≤240 chars): what you actually think of the place for a week,
  and the shape you would give it. One or two sentences.
- `because.<vibe>` (≤240 chars each, for the vibes the place is good for):
  the concrete case. Name places.
- `caveat` (≤300): the real downside. Season, crowds, cost, distances.
- `base` (≤200) per city: which neighbourhood to sleep in and why, in one
  or two sentences.
- `name` (≤60) for the pack: the country or region, then a colon and the
  bases, like "Montenegro: Kotor and the Bay, Budva and the coast, Durmitor".
- `aliases`: up to 12 other names people type for it (the country, the
  cities, the region, common misspellings, the local-language names).

## The numbers on the destination

- `strengths`: 0 to 5 for nature, exploration, food, relaxation, culture,
  adventure, city. Honest: a beach island is not a 5 for culture.
- `paceFit`: which of relaxed, light, mixed, busy the place suits.
- `flightUsd`: round-trip economy from San Francisco in shoulder season.
- `floorPerDayUsd`: the cheapest credible day per person (bed, food,
  transit, one paid thing), not a backpacker fantasy.
- `minDays`: below this it is not worth the flight.
- `warmth`: 1 (cold) to 5 (hot) in the season you would send people.
- `arrival`: "fly", or "drive" only for somewhere within a day's drive of
  San Francisco.
- `nightlyUsd` per base: a decent double in the neighbourhood you named.
- `transitFromHubMin`, `transitFromHubUsd`, `transitMode` (train, bus, car,
  ferry) per base: from the hub (the first base) to this one.

## The shape, by example

```json
{
  "id": "montenegro",
  "name": "Montenegro: Kotor and the Bay, Budva and the coast, Durmitor",
  "pitch": "A country the size of Connecticut that fits a fjord-shaped bay, a 2,500m karst massif, a canyon you raft and a lake full of carp inside eight days, provided you rent a car and come in June or September rather than August.",
  "strengths": { "nature": 5, "exploration": 4, "food": 4, "relaxation": 3, "culture": 3, "adventure": 4, "city": 2 },
  "paceFit": ["mixed", "busy"],
  "flightUsd": 1450,
  "floorPerDayUsd": 55,
  "minDays": 7,
  "because": {
    "nature": "The Bay of Kotor is a drowned river valley with 1,000m walls, Durmitor has 18 glacial lakes and a 1,300m deep canyon, and Skadar is the biggest lake in the Balkans with pelicans in it.",
    "food": "Njeguški pršut and cheese from the smokehouses that make it, mussels and grilled fish in the bay konobas, lake carp and eel under a stone bridge, and kačamak with kajmak at 1,450m in Zabljak."
  },
  "warmth": 4,
  "arrival": "fly",
  "caveat": "The coast road is one lane each way and stops dead in August, Kotor to Zabljak is three and a half hours of hairpins each way, and the Tara rafting season only runs from late May to October.",
  "aliases": ["Montenegro", "Crna Gora", "Kotor", "Bay of Kotor", "Budva", "Durmitor", "Zabljak"],
  "cities": [
    {
      "id": "kotor", "name": "Kotor", "lat": 42.4247, "lng": 18.7712,
      "nightlyUsd": 110, "minNights": 2, "maxNights": 3,
      "base": "Dobrota, the 4km of waterfront north of the walls: a quay to walk and swim from, parking, and a 15 minute walk to the Sea Gate, outside the Old Town when three cruise ships are in.",
      "scale": "walkable", "transitFromHubMin": 20, "transitFromHubUsd": 22, "transitMode": "car"
    },
    {
      "id": "perast", "name": "Perast and Our Lady of the Rocks", "lat": 42.4866, "lng": 18.698,
      "dayTripOnly": true, "dayTripFrom": "kotor",
      "base": "Nobody needs a night here; 14km and 25 minutes from Kotor by the bay road, the Blue Line bus is 2 euros.",
      "scale": "walkable", "transitFromHubMin": 25, "transitFromHubUsd": 2, "transitMode": "bus"
    }
  ],
  "places": [
    {
      "id": "kot-st-tryphon", "cityId": "kotor", "name": "Cathedral of St Tryphon",
      "kind": "sight", "tags": ["church", "history", "architecture"], "neighborhood": "Stari Grad",
      "lat": 42.424, "lng": 18.7716, "durationMin": 45, "costUsd": 5,
      "opens": "09:00", "closes": "18:00", "closedDays": [], "bestTime": "morning", "touristy": 4,
      "note": "Consecrated in 1166, with a reliquary chapel upstairs holding the saint's skull in a silver casket; the 4 euro ticket is fair, shoulders and knees must be covered, and the hours shorten in winter."
    },
    {
      "id": "kot-galion", "cityId": "kotor", "name": "Galion",
      "kind": "meal", "tags": ["food", "coast"], "neighborhood": "Muo, across the bay from the marina",
      "lat": 42.4215, "lng": 18.7665, "durationMin": 100, "costUsd": 45,
      "opens": "12:00", "closes": "23:00", "closedDays": [], "bestTime": "evening", "touristy": 3,
      "note": "The fish restaurant with the Old Town across the water; order the grilled catch by weight and the black risotto, book a terrace table for 20:00 in summer, and expect 40 to 50 euros a head with wine."
    }
  ],
  "outings": [
    {
      "name": "Bobotov Kuk from Sedlo pass", "hours": 7,
      "startsFrom": [{ "name": "Zabljak", "lat": 43.1547, "lng": 19.1225 }],
      "why": "Durmitor's highest summit at 2,523m, 1,000m of gain with cables on the last scramble; a clear-weather day only, and the pass road can be closed until June.",
      "km": 14, "gainM": 1000, "costUsd": 0, "season": "June to October",
      "fallback": "The Black Lake circuit, 3.5km flat, from the park gate."
    }
  ],
  "sources": [
    "https://www.kotor.travel/",
    "https://nparkovi.me/"
  ]
}
```

Ids: short slugs, lowercase, hyphens. City ids are just the town
(`kotor`); place ids are `<3-letter city>-<thing>` (`kot-st-tryphon`); the
validator prefixes the pack id itself. `cityId` on a place is the city's
short id. The example above is a fragment: a real pack has 15+ places in
every base.
