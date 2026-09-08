import type { City, Destination, Vibe } from "@/lib/types";
import { ALL_VIBES } from "@/lib/types";

// Seeded for a traveler departing San Francisco. Flight/lodging figures are
// realistic mid-range estimates, not live pricing — the UI labels them as such.

export const DESTINATIONS: Destination[] = [
  {
    id: "portugal",
    name: "Portugal",
    hubCityId: "lisbon",
    pitch: "Historic cities you can walk, food and wine well above what you pay for it, and short train rides between everything.",
    strengths: { nature: 3, exploration: 5, food: 4, relaxation: 4, culture: 4, adventure: 2, city: 3 },
    paceFit: ["relaxed", "light", "mixed"],
    flightUsd: 780,
    floorPerDayUsd: 130,
    minDays: 5,
    because: {
      exploration: "Lisbon and Porto are both dense enough to explore on foot for days without repeating yourself.",
      relaxation: "Nothing here demands an early start, and the country is small enough that travel days stay short.",
      food: "Tinned fish, grilled seafood, and Douro wine — the good version of all three is cheap and unpretentious.",
      culture: "Azulejo-covered streets, a serious modern art collection, and fado that isn't staged for tourists if you pick the right room.",
      nature: "The Sintra coast and the Douro valley are both under two hours from a city.",
      city: "Lisbon has late nights, but it's a low-rise, neighborhood kind of city rather than a metropolis.",
    },
    warmth: 4,
    arrival: "fly",
    caveat: "Lisbon is built on hills and cobblestones. If your knees have opinions, this is the trip they'll have them about.",
  },
  {
    id: "andalusia",
    name: "Southern Spain",
    hubCityId: "seville",
    pitch: "Denser food, later nights, and the best Islamic architecture in Europe — but you'll move at Spain's pace, not your own.",
    strengths: { nature: 3, exploration: 4, food: 5, relaxation: 3, culture: 5, adventure: 2, city: 4 },
    paceFit: ["light", "mixed", "busy"],
    flightUsd: 820,
    floorPerDayUsd: 125,
    minDays: 5,
    because: {
      food: "Seville and Granada are tapas cities where standing at a bar eating four small things beats any sit-down dinner.",
      culture: "The Alhambra and the Alcázar are two of the few buildings genuinely worth planning a trip around.",
      exploration: "Seville's old center is a proper maze and rewards getting lost in it.",
      city: "Dinner starts at 10pm and the streets stay busy after. That's either the appeal or the problem.",
    },
    warmth: 5,
    arrival: "fly",
    caveat: "Andalusia in high summer is genuinely punishing — 100°F by noon. Outside spring and autumn I'd send you elsewhere.",
  },
  {
    id: "mexico",
    name: "Mexico",
    hubCityId: "cdmx",
    pitch: "The most interesting food city in North America, plus a slower colonial counterweight a short flight south.",
    strengths: { nature: 3, exploration: 4, food: 5, relaxation: 2, culture: 5, adventure: 3, city: 5 },
    paceFit: ["mixed", "busy"],
    flightUsd: 420,
    floorPerDayUsd: 90,
    minDays: 4,
    because: {
      food: "Street stalls, market counters, and a handful of restaurants doing things nobody else is. Both ends are excellent.",
      culture: "Anthropology museum, Barragán houses, Kahlo — the density of things worth seeing is unusually high.",
      city: "Roma and Condesa are leafy and walkable in a way most big cities aren't.",
      exploration: "Neighborhoods here have genuinely different characters, and they're close enough to string together.",
    },
    warmth: 5,
    arrival: "fly",
    caveat: "CDMX sits at 7,350 feet. Your first day will feel worse than you expect, and I'd plan it light on purpose.",
  },
  {
    id: "japan",
    name: "Japan",
    hubCityId: "tokyo",
    pitch: "The highest ceiling on this list for food and craft — and the one that rewards a packed schedule instead of punishing it.",
    strengths: { nature: 4, exploration: 5, food: 5, relaxation: 2, culture: 5, adventure: 3, city: 5 },
    paceFit: ["mixed", "busy"],
    flightUsd: 950,
    floorPerDayUsd: 160,
    minDays: 8,
    because: {
      food: "The floor is extraordinarily high. A basement noodle counter will beat most restaurants you've been to.",
      exploration: "Tokyo is really a dozen cities. You could spend a week and only see the edges.",
      culture: "Kyoto's temples plus Tokyo's contemporary galleries cover a very wide range.",
      city: "Nothing else operates at this scale while still being quiet and orderly.",
    },
    warmth: 3,
    arrival: "fly",
    caveat: "Under eight days you'll lose two to jet lag and transit, and spend the rest feeling behind. I'd wait for a longer window.",
  },
  {
    id: "denmark",
    name: "Copenhagen",
    hubCityId: "copenhagen",
    pitch: "A small, calm, extremely well-designed city where doing very little is the intended use.",
    strengths: { nature: 3, exploration: 3, food: 4, relaxation: 4, culture: 4, adventure: 2, city: 4 },
    paceFit: ["relaxed", "light", "mixed"],
    flightUsd: 850,
    floorPerDayUsd: 210,
    minDays: 4,
    because: {
      relaxation: "The whole city is bikeable and low-key. There's no monument you'll feel guilty skipping.",
      culture: "Design, architecture, and two art museums that are worth the trip on their own.",
      food: "Beyond the famous restaurants there's a strong mid-tier — bakeries, wine bars, smørrebrød counters.",
    },
    warmth: 2,
    arrival: "fly",
    caveat: "It's expensive in a way that's hard to design around — roughly double Portugal for the same day.",
  },
  {
    id: "catalonia",
    name: "Barcelona & the Costa Brava",
    hubCityId: "barcelona",
    pitch: "City and coast in one trip, with an architecture story you can follow street by street.",
    strengths: { nature: 3, exploration: 4, food: 5, relaxation: 4, culture: 4, adventure: 3, city: 5 },
    paceFit: ["light", "mixed", "busy"],
    flightUsd: 800,
    floorPerDayUsd: 150,
    minDays: 5,
    because: {
      food: "Market cooking and a bar culture that's more relaxed than its reputation suggests.",
      city: "Dense, flat, walkable, and on the sea — an unusual combination.",
      relaxation: "The Costa Brava is 90 minutes out and empties the city out of your system.",
      culture: "Gaudí is the headline, but the Gothic quarter and the modernista side streets are the better story.",
    },
    warmth: 5,
    arrival: "fly",
    caveat: "The center is as crowded as anywhere in Europe. If crowds ruin things for you, I'd steer you to Portugal instead.",
  },
  {
    id: "iceland",
    name: "Iceland",
    hubCityId: "reykjavik",
    pitch: "Landscape at a scale that resets your sense of it, with a very small city attached.",
    strengths: { nature: 5, exploration: 3, food: 3, relaxation: 4, culture: 2, adventure: 5, city: 2 },
    paceFit: ["light", "mixed", "busy"],
    flightUsd: 620,
    floorPerDayUsd: 195,
    minDays: 5,
    because: {
      nature: "Waterfalls, glaciers and black beaches within two hours of the capital, and they get better the further you drive.",
      adventure: "Walking on a glacier, swimming outdoors in February, standing in a rift between two continental plates — all ordinary here.",
      relaxation: "Hot water comes out of the ground, so soaking in it is the national pastime rather than a spa treatment.",
      exploration: "Reykjavík is small enough to finish in two days, which is the point — the rest of the trip is outside it.",
      food: "Narrow but serious: lamb, cod, dairy, and bread baked in the ground.",
      culture: "Thin on museums, strong on the sagas and the landscape they were written about.",
      city: "Reykjavík is a town, not a city, and the nights start very late.",
    },
    warmth: 1,
    arrival: "fly",
    caveat: "The weather decides your itinerary, not you — plan on a day being cancelled. And this is the most expensive country on my list: a sandwich is fifteen dollars and I can't design that away.",
  },
  {
    id: "korea",
    name: "South Korea",
    hubCityId: "seoul",
    pitch: "The most interesting eating in Asia right now, and a city that rewards curiosity at every scale from an alley to a mountain.",
    strengths: { nature: 2, exploration: 5, food: 5, relaxation: 2, culture: 5, adventure: 2, city: 5 },
    paceFit: ["mixed", "busy"],
    flightUsd: 890,
    floorPerDayUsd: 120,
    minDays: 6,
    because: {
      food: "Market stools, barbecue, cold noodles, and rice wine that tastes nothing like the exported version. Cheap at every level.",
      exploration: "Seoul is a dozen distinct districts and each one rewards an afternoon. You will not run out.",
      culture: "Palaces and mountain temples on one side, some of the best contemporary museums in Asia on the other.",
      city: "Trains run late, the food streets run later, and none of it feels staged for visitors.",
      nature: "There's a granite national park inside the city limits, reachable by subway.",
      relaxation: "The bathhouses are cheap, everywhere, and the correct answer to a day of walking.",
      adventure: "Ridge hikes above the city and a coastal cliff path in Busan, both easy to reach.",
    },
    warmth: 3,
    arrival: "fly",
    caveat: "Seoul is enormous and the subway is the trip — you will spend real time underground. If you want a city you can learn on foot in three days, this isn't it.",
  },
  {
    id: "southwest",
    name: "the Utah canyon country",
    hubCityId: "zion",
    pitch: "Two of the best national parks in the country, four hours apart, on a budget flight and a rental car.",
    strengths: { nature: 5, exploration: 2, food: 2, relaxation: 3, culture: 1, adventure: 5, city: 1 },
    paceFit: ["light", "mixed", "busy"],
    flightUsd: 190,
    floorPerDayUsd: 130,
    minDays: 4,
    warmth: 4,
    arrival: "fly",
    because: {
      nature: "Red rock at a scale photographs consistently fail at. Zion is a slot canyon you walk up; Arches is a plateau covered in them.",
      adventure: "Wading the Narrows, the chains on Angels Landing, slickrock scrambles that need hands. Real effort, and none of it technical.",
      relaxation: "Long empty evenings, dark skies, and towns small enough that nothing is demanded of you after six.",
      exploration: "Thin on towns; the interest here is geological rather than cultural, and that's the trip.",
      food: "Honest and limited. You are eating to get back out, not the other way round.",
    },
    caveat: "Summer here is 100°F on exposed rock with no shade, and Angels Landing needs a permit by lottery. Spring and autumn are the whole answer.",
  },
  {
    id: "pacificnw",
    name: "the Olympic Peninsula",
    hubCityId: "seattle",
    pitch: "Rainforest, a wild coast and a glaciated mountain range, all inside two hours of a city worth two days of its own.",
    strengths: { nature: 5, exploration: 3, food: 4, relaxation: 4, culture: 3, adventure: 4, city: 3 },
    paceFit: ["relaxed", "light", "mixed"],
    flightUsd: 170,
    floorPerDayUsd: 150,
    minDays: 4,
    warmth: 2,
    arrival: "fly",
    because: {
      nature: "Three ecosystems in one park: temperate rainforest, alpine ridge and seventy miles of undeveloped coast.",
      relaxation: "Hot springs in the forest, a lake you can swim in, and weather that gives you permission to do nothing.",
      adventure: "Tide-dependent beach scrambles and ridge walks, without needing a guide or a permit lottery.",
      food: "Seattle punches well above its size on seafood and coffee, and the peninsula runs on crab.",
      exploration: "Ferries, logging towns and tribal land — a stranger country than most people expect two hours from a tech capital.",
    },
    caveat: "It rains. Twelve feet a year in the Hoh, and Hurricane Ridge sits in cloud about half the time. Bring the shell and plan an indoor alternative for every outdoor day.",
  },
  {
    id: "centralcoast",
    name: "the Big Sur coast",
    hubCityId: "bigsur",
    pitch: "No airport, no time zone, no jet lag: the best coastline in the country is a three-hour drive from your door.",
    strengths: { nature: 5, exploration: 2, food: 4, relaxation: 5, culture: 2, adventure: 3, city: 1 },
    paceFit: ["relaxed", "light", "mixed"],
    flightUsd: 90,
    floorPerDayUsd: 170,
    minDays: 3,
    warmth: 3,
    arrival: "drive",
    because: {
      relaxation: "You can leave after breakfast and be looking at the ocean by lunch. Nothing about this trip costs you a day at either end.",
      nature: "Redwoods running down to the sea, condors overhead, and thirty miles of road with no development on it.",
      food: "Carmel and Monterey do the seafood, Paso Robles does the wine, and both are on the way.",
      adventure: "Bluff trails, a river crossing, and beaches you climb down to rather than park at.",
    },
    caveat: "Big Sur lodging is genuinely expensive for what it is, the fog can sit on the coast all day in summer, and Highway 1 closes after slides — check it before you commit.",
  },
  {
    id: "newzealand",
    name: "New Zealand's South Island",
    hubCityId: "queenstown",
    pitch: "Alps, fjords and beech forest packed into an area you can drive across in a day, with almost nobody in it.",
    strengths: { nature: 5, exploration: 3, food: 3, relaxation: 3, culture: 2, adventure: 5, city: 1 },
    paceFit: ["light", "mixed", "busy"],
    flightUsd: 1450,
    floorPerDayUsd: 175,
    minDays: 7,
    warmth: 3,
    arrival: "fly",
    because: {
      nature: "Glaciers, fjords and braided rivers within two hours of each other, and a population density that means you'll often have them to yourself.",
      adventure: "This is where commercial bungy was invented and the attitude never left. Jet boats, ridge walks, kayaking under cliffs.",
      exploration: "Small towns, long empty roads, and the interest is entirely in what's between them rather than in them.",
      food: "Narrow but very good: lamb, venison, green-lipped mussels, and Central Otago pinot noir.",
      relaxation: "Nothing here is urgent, and the evenings are long and quiet.",
    },
    caveat: "It is roughly seventeen hours in the air and the seasons are upside down, so December is high summer. Under a week you'll spend most of it recovering from the flight.",
  },
  {
    id: "italy",
    name: "Rome and Tuscany",
    hubCityId: "rome",
    pitch: "Two and a half thousand years stacked on one street, and the best simple cooking in Europe underneath it.",
    strengths: { nature: 2, exploration: 5, food: 5, relaxation: 3, culture: 5, adventure: 1, city: 4 },
    paceFit: ["light", "mixed", "busy"],
    flightUsd: 820,
    floorPerDayUsd: 165,
    minDays: 5,
    warmth: 4,
    arrival: "fly",
    because: {
      culture: "The Renaissance is in the buildings it was made for rather than in a museum, and Rome has layers under that going back another millennium.",
      food: "Four pastas, done properly, in rooms that have done nothing else for fifty years. Simplicity is the whole technique.",
      exploration: "Rome rewards wandering more than planning: you will walk past things other cities would build a museum around.",
      city: "Loud, chaotic, alive at eleven at night, and entirely unbothered about it.",
      relaxation: "Chianti is ninety minutes from Florence and immediately slows everything down.",
    },
    caveat: "Rome in July is thirty-five degrees and the queues are at their worst. The Vatican and the Uffizi both need booking weeks ahead or skipping entirely.",
  },
  {
    id: "bali",
    name: "Bali",
    hubCityId: "ubud",
    pitch: "Rice terraces, temples and a living Hindu culture, at a price that makes a long trip possible.",
    strengths: { nature: 4, exploration: 3, food: 4, relaxation: 5, culture: 4, adventure: 3, city: 1 },
    paceFit: ["relaxed", "light", "mixed"],
    flightUsd: 1050,
    floorPerDayUsd: 95,
    minDays: 7,
    warmth: 5,
    arrival: "fly",
    because: {
      relaxation: "Everything on the ground costs a fraction of what it does at home, so the trip can be as slow as you want it to be.",
      nature: "Terraced rice, volcanic lakes and a crater you can climb before dawn, all within an hour of Ubud.",
      culture: "Offerings on every doorstep every morning. This is a working religious culture, not a preserved one.",
      food: "Warungs for a few dollars, and the spice pastes are ground by hand rather than bought.",
      adventure: "Volcano at sunrise, waterfalls, and reefs a short drive east.",
    },
    caveat: "It is about twenty-four hours of travel each way and the traffic around Ubud has become genuinely bad. Go for two weeks or don't go.",
  },
  {
    id: "france",
    name: "Paris and Provence",
    hubCityId: "paris",
    pitch: "The most walkable big city in Europe, and a two-hour train to somewhere that stops for three-hour lunches.",
    strengths: { nature: 2, exploration: 5, food: 5, relaxation: 3, culture: 5, adventure: 1, city: 5 },
    paceFit: ["light", "mixed", "busy"],
    flightUsd: 780,
    floorPerDayUsd: 190,
    minDays: 5,
    warmth: 3,
    arrival: "fly",
    because: {
      culture: "Orsay, Rodin, Sainte-Chapelle. The density is absurd and you could spend the week indoors without repeating yourself.",
      food: "The lunch formule is the best value meal in Europe, and the neighbourhood bistro is a genuinely refined format.",
      city: "Designed to be walked and sat in. The terrace facing the street is a piece of urban design, not an accident.",
      exploration: "Twenty arrondissements that feel like different towns, and the Marais still has its medieval street plan.",
      relaxation: "Provence exists to slow you down, and the train there takes less time than a domestic flight.",
    },
    caveat: "Paris is expensive and August is the month the city closes: shutters down, owners away. Go outside it.",
  },
];

/**
 * Haversine plus a constant is a decent guess for ordinary rail and a bad one
 * for high-speed rail or mountain roads. Known pairs are stated outright.
 */
export const INTERCITY: Record<string, { minutes: number; usd: number; mode: "train" | "car" }> = {
  "seoul>busan": { minutes: 150, usd: 45, mode: "train" },     // KTX
  "reykjavik>vik": { minutes: 180, usd: 65, mode: "car" },     // Ring Road, one way
  "lisbon>porto": { minutes: 170, usd: 32, mode: "train" },    // Alfa Pendular
  "zion>moab": { minutes: 380, usd: 55, mode: "car" },         // long day on I-70
  "seattle>olympic": { minutes: 150, usd: 35, mode: "car" },   // around Puget Sound
  "rome>florence": { minutes: 95, usd: 45, mode: "train" },    // Frecciarossa
  "paris>provence": { minutes: 165, usd: 75, mode: "train" },  // TGV to Avignon
  "queenstown>teanau": { minutes: 160, usd: 40, mode: "car" },
};

export const CITIES: City[] = [
  // --- Portugal ---
  { id: "lisbon", name: "Lisbon", destinationId: "portugal", lat: 38.7223, lng: -9.1393,
    nightlyUsd: 125, minNights: 2, maxNights: 4, base: "Príncipe Real — quiet at night, walkable downhill to everything." },
  { id: "sintra", name: "Sintra", destinationId: "portugal", lat: 38.7975, lng: -9.3906,
    nightlyUsd: 0, minNights: 0, maxNights: 0, base: "Day trip from Lisbon.", dayTripOnly: true, dayTripFrom: "lisbon",
    transitFromHubMin: 45, transitFromHubUsd: 6, transitMode: "train" },
  { id: "porto", name: "Porto", destinationId: "portugal", lat: 41.1496, lng: -8.6109,
    nightlyUsd: 105, minNights: 2, maxNights: 4, base: "Cedofeita or Baixa — walkable to the river without being in the crush." },
  { id: "douro", name: "the Douro Valley", destinationId: "portugal", lat: 41.1900, lng: -7.5400,
    nightlyUsd: 0, minNights: 0, maxNights: 0, scale: "driving", base: "Day trip from Porto by train along the river.", dayTripOnly: true, dayTripFrom: "porto",
    transitFromHubMin: 120, transitFromHubUsd: 32, transitMode: "train" },

  // --- Southern Spain ---
  { id: "seville", name: "Seville", destinationId: "andalusia", lat: 37.3891, lng: -5.9845,
    nightlyUsd: 130, minNights: 2, maxNights: 4, base: "Santa Cruz edge or Alameda — close in, without the tour groups." },
  { id: "granada", name: "Granada", destinationId: "andalusia", lat: 37.1773, lng: -3.5986,
    nightlyUsd: 115, minNights: 2, maxNights: 3, base: "Realejo — uphill, quiet, ten minutes from everything." },
  { id: "cordoba", name: "Córdoba", destinationId: "andalusia", lat: 37.8882, lng: -4.7794,
    nightlyUsd: 0, minNights: 0, maxNights: 0, base: "Day trip from Seville.", dayTripOnly: true, dayTripFrom: "seville",
    transitFromHubMin: 45, transitFromHubUsd: 28, transitMode: "train" },

  // --- Mexico ---
  { id: "cdmx", name: "Mexico City", destinationId: "mexico", lat: 19.4326, lng: -99.1332,
    nightlyUsd: 120, minNights: 3, maxNights: 5, base: "Roma Norte — tree-lined, walkable, good at all hours." },
  { id: "oaxaca", name: "Oaxaca", destinationId: "mexico", lat: 17.0732, lng: -96.7266,
    nightlyUsd: 100, minNights: 2, maxNights: 4, base: "Centro — small enough that everything is a walk." },

  // --- Japan ---
  { id: "tokyo", name: "Tokyo", destinationId: "japan", lat: 35.6762, lng: 139.6503,
    nightlyUsd: 185, minNights: 3, maxNights: 6, base: "Around Yoyogi-Uehara — residential, on good train lines." },
  { id: "kyoto", name: "Kyoto", destinationId: "japan", lat: 35.0116, lng: 135.7681,
    nightlyUsd: 165, minNights: 2, maxNights: 4, base: "North of Gion — near the walking routes, away from the crowd." },

  // --- Denmark ---
  { id: "copenhagen", name: "Copenhagen", destinationId: "denmark", lat: 55.6761, lng: 12.5683,
    nightlyUsd: 225, minNights: 3, maxNights: 5, base: "Nørrebro or Vesterbro — where the city actually lives." },

  // --- Catalonia ---
  { id: "barcelona", name: "Barcelona", destinationId: "catalonia", lat: 41.3874, lng: 2.1686,
    nightlyUsd: 160, minNights: 3, maxNights: 5, base: "Gràcia — village-scale, above the tourist center." },
  { id: "costabrava", name: "the Costa Brava", destinationId: "catalonia", lat: 41.9800, lng: 3.2200,
    nightlyUsd: 0, minNights: 0, maxNights: 0, base: "Day trip from Barcelona.", dayTripOnly: true, dayTripFrom: "barcelona",
    transitFromHubMin: 90, transitFromHubUsd: 22, transitMode: "train" },

  // --- Iceland ---
  { id: "reykjavik", name: "Reykjavík", destinationId: "iceland", lat: 64.1466, lng: -21.9426,
    nightlyUsd: 205, minNights: 2, maxNights: 4, base: "Þingholt — uphill from the centre, quiet, everything within fifteen minutes." },
  { id: "goldencircle", name: "the Golden Circle", destinationId: "iceland", lat: 64.2559, lng: -21.1300,
    nightlyUsd: 0, minNights: 0, maxNights: 0, scale: "driving", base: "Day trip from Reykjavík by car.", dayTripOnly: true,
    dayTripFrom: "reykjavik", transitFromHubMin: 50, transitFromHubUsd: 45, transitMode: "car" },
  { id: "snaefellsnes", name: "Snæfellsnes", destinationId: "iceland", lat: 64.8500, lng: -23.5000,
    nightlyUsd: 0, minNights: 0, maxNights: 0, scale: "driving", base: "Day trip from Reykjavík by car.", dayTripOnly: true,
    dayTripFrom: "reykjavik", transitFromHubMin: 130, transitFromHubUsd: 50, transitMode: "car" },
  { id: "vik", name: "Vík", destinationId: "iceland", lat: 63.4187, lng: -19.0060,
    nightlyUsd: 170, minNights: 1, maxNights: 3, scale: "driving", base: "Vík itself — the only real base on the south coast, and small enough to walk in ten minutes." },
  { id: "southcoast", name: "the South Coast", destinationId: "iceland", lat: 63.5300, lng: -19.5100,
    nightlyUsd: 0, minNights: 0, maxNights: 0, scale: "driving", base: "Day out along the Ring Road.", dayTripOnly: true,
    dayTripFrom: "vik", transitFromHubMin: 45, transitFromHubUsd: 20, transitMode: "car" },

  // --- South Korea ---
  { id: "seoul", name: "Seoul", destinationId: "korea", lat: 37.5665, lng: 126.9780,
    nightlyUsd: 125, minNights: 3, maxNights: 6, base: "Seochon or Ikseon — old low-rise streets, central, on good subway lines." },
  { id: "busan", name: "Busan", destinationId: "korea", lat: 35.1796, lng: 129.0756,
    nightlyUsd: 100, minNights: 2, maxNights: 4, base: "Jeonpo or Nampo — walkable, near the water, away from the resort strip." },
  { id: "jeonju", name: "Jeonju", destinationId: "korea", lat: 35.8242, lng: 127.1480,
    nightlyUsd: 0, minNights: 0, maxNights: 0, base: "Day trip from Seoul by KTX.", dayTripOnly: true,
    dayTripFrom: "seoul", transitFromHubMin: 105, transitFromHubUsd: 28, transitMode: "train" },
  { id: "gyeongju", name: "Gyeongju", destinationId: "korea", lat: 35.8562, lng: 129.2247,
    nightlyUsd: 0, minNights: 0, maxNights: 0, base: "Day trip from Busan.", dayTripOnly: true,
    dayTripFrom: "busan", transitFromHubMin: 55, transitFromHubUsd: 12, transitMode: "train" },

  { id: "teotihuacan", name: "Teotihuacán", destinationId: "mexico", lat: 19.6925, lng: -98.8438,
    nightlyUsd: 0, minNights: 0, maxNights: 0, base: "Day trip from Mexico City.", dayTripOnly: true,
    dayTripFrom: "cdmx", transitFromHubMin: 55, transitFromHubUsd: 25, transitMode: "bus" },
  { id: "hierve", name: "Hierve el Agua", destinationId: "mexico", lat: 16.8660, lng: -96.2760,
    nightlyUsd: 0, minNights: 0, maxNights: 0, base: "Day trip from Oaxaca.", dayTripOnly: true,
    dayTripFrom: "oaxaca", scale: "driving", transitFromHubMin: 90, transitFromHubUsd: 30, transitMode: "car" },

  // --- Utah canyon country ---
  { id: "zion", name: "Zion", destinationId: "southwest", lat: 37.2000, lng: -112.9800,
    nightlyUsd: 155, minNights: 2, maxNights: 4, scale: "driving", base: "Springdale, at the park gate, so you can walk onto the shuttle instead of fighting for parking." },
  { id: "moab", name: "Moab", destinationId: "southwest", lat: 38.5733, lng: -109.5498,
    nightlyUsd: 140, minNights: 2, maxNights: 4, scale: "driving", base: "Moab itself, five minutes from the Arches entrance and walkable for dinner." },

  // --- Olympic Peninsula ---
  { id: "seattle", name: "Seattle", destinationId: "pacificnw", lat: 47.6062, lng: -122.3321,
    nightlyUsd: 175, minNights: 1, maxNights: 3, base: "Capitol Hill or Ballard, walkable and away from the convention hotels." },
  { id: "olympic", name: "the Olympic Peninsula", destinationId: "pacificnw", lat: 47.9500, lng: -123.5000,
    nightlyUsd: 145, minNights: 2, maxNights: 5, scale: "driving", base: "Port Angeles or Lake Crescent, so the park is on your doorstep in the morning." },

  // --- Big Sur coast ---
  { id: "bigsur", name: "Big Sur", destinationId: "centralcoast", lat: 36.2704, lng: -121.8081,
    nightlyUsd: 240, minNights: 2, maxNights: 5, scale: "driving", base: "Big Sur itself if the budget allows; Carmel if not, and drive in each morning." },

  // --- New Zealand ---
  { id: "queenstown", name: "Queenstown", destinationId: "newzealand", lat: -45.0312, lng: 168.6626,
    nightlyUsd: 190, minNights: 2, maxNights: 7, base: "Above the town on the Fernhill side, so you get the lake without the stag parties." },
  { id: "teanau", name: "Te Anau", destinationId: "newzealand", lat: -45.4144, lng: 167.7180,
    nightlyUsd: 150, minNights: 1, maxNights: 3, base: "On the lakefront. It is a small town and everything is a walk." },
  { id: "glenorchy", name: "Glenorchy", destinationId: "newzealand", lat: -44.8480, lng: 168.3830,
    nightlyUsd: 0, minNights: 0, maxNights: 0, base: "Day out from Queenstown by car.", dayTripOnly: true,
    dayTripFrom: "queenstown", scale: "driving", transitFromHubMin: 50, transitFromHubUsd: 30, transitMode: "car" },
  { id: "wanaka", name: "Wanaka", destinationId: "newzealand", lat: -44.7000, lng: 169.1400,
    nightlyUsd: 0, minNights: 0, maxNights: 0, base: "Day out from Queenstown over the Crown Range.", dayTripOnly: true,
    dayTripFrom: "queenstown", scale: "driving", transitFromHubMin: 75, transitFromHubUsd: 35, transitMode: "car" },
  { id: "milford", name: "Milford Sound", destinationId: "newzealand", lat: -44.6700, lng: 167.9250,
    nightlyUsd: 0, minNights: 0, maxNights: 0, base: "Long day out from Te Anau.", dayTripOnly: true,
    dayTripFrom: "teanau", scale: "driving", transitFromHubMin: 125, transitFromHubUsd: 45, transitMode: "car" },

  // --- Italy ---
  { id: "rome", name: "Rome", destinationId: "italy", lat: 41.9028, lng: 12.4964,
    nightlyUsd: 175, minNights: 2, maxNights: 5, base: "Monti or Trastevere, both walkable in and quiet at night." },
  { id: "florence", name: "Florence", destinationId: "italy", lat: 43.7696, lng: 11.2558,
    nightlyUsd: 165, minNights: 2, maxNights: 4, base: "Oltrarno, across the river, where people still live." },
  { id: "chianti", name: "Chianti", destinationId: "italy", lat: 43.5300, lng: 11.3100,
    nightlyUsd: 0, minNights: 0, maxNights: 0, base: "Day out from Florence by car.", dayTripOnly: true,
    dayTripFrom: "florence", scale: "driving", transitFromHubMin: 60, transitFromHubUsd: 35, transitMode: "car" },

  // --- Bali ---
  { id: "ubud", name: "Ubud", destinationId: "bali", lat: -8.5069, lng: 115.2625,
    nightlyUsd: 110, minNights: 3, maxNights: 7, base: "North of the centre toward Sanggingan, so you get the valley and not the scooter noise." },
  { id: "batur", name: "Mount Batur", destinationId: "bali", lat: -8.2420, lng: 115.3750,
    nightlyUsd: 0, minNights: 0, maxNights: 0, base: "Very early start from Ubud.", dayTripOnly: true,
    dayTripFrom: "ubud", scale: "driving", transitFromHubMin: 90, transitFromHubUsd: 30, transitMode: "car" },

  // --- France ---
  { id: "paris", name: "Paris", destinationId: "france", lat: 48.8566, lng: 2.3522,
    nightlyUsd: 210, minNights: 3, maxNights: 6, base: "The 11th or the Marais: central enough to walk home, cheap enough to eat well." },
  { id: "provence", name: "Provence", destinationId: "france", lat: 43.9500, lng: 4.8100,
    nightlyUsd: 165, minNights: 2, maxNights: 4, base: "Inside the Avignon walls, or a village in the Luberon if you have the car." },
];



/**
 * A destination or city that isn't in the catalogue used to be `undefined!` —
 * a non-null assertion that was simply untrue, and the whole app died on it.
 *
 * Researched destinations live only in memory. Complete a trip to the Faroe
 * Islands, reload the tab, and the saved trip points at an id that no longer
 * exists: `.name` on undefined, thrown during render, and every trip in the
 * browser goes down with it. "This page couldn't load", with no way back in.
 *
 * Trips now carry their own pack and re-register it on open, so this should
 * not happen again. But a saved trip from before that, or one whose pack
 * didn't survive, must degrade to a readable placeholder rather than take the
 * application with it. The id is a slug of the real name, so even the
 * placeholder reads correctly.
 */
const unslug = (id: string) =>
  id.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

/*
 * Only in the browser.
 *
 * On the server a destination we don't hold is a real error and must stay one:
 * planning a trip to a place the server knows nothing about is exactly how the
 * agent ends up confidently describing the wrong country, and there is a
 * regression test standing guard over that. Every request carries its own
 * PlaceContext for researched destinations precisely so the server never has
 * to guess.
 *
 * In the browser the calculus is the opposite. Nobody is served by a white
 * screen; a saved trip whose data has expired should say so and let her plan it
 * again.
 */
let warned = false;
function missing(id: string): Destination {
  if (typeof window === "undefined") return undefined as unknown as Destination;
  if (!warned) {
    warned = true;
    console.warn(`[catalogue] "${id}" isn't loaded; showing a placeholder rather than crashing`);
  }
  return {
    id,
    name: unslug(id),
    pitch: `${unslug(id)}.`,
    strengths: Object.fromEntries(ALL_VIBES.map((v) => [v, 2])) as Record<Vibe, number>,
    paceFit: ["light", "mixed"],
    flightUsd: 0,
    floorPerDayUsd: 0,
    minDays: 2,
    because: {},
    warmth: 3,
    arrival: "fly",
    caveat: "The detail behind this trip isn't loaded any more. Ask me to plan it again for current information.",
    hubCityId: `${id}-hub`,
  };
}

export const cityById = (id: string) => {
  const found = CITIES.find((c) => c.id === id);
  if (found || typeof window === "undefined") return found as City;
  return {
    id,
    name: unslug(id.split("-").slice(1).join("-") || id),
    destinationId: id.split("-")[0],
    lat: 0, lng: 0,
    nightlyUsd: 0, minNights: 1, maxNights: 4,
    base: "",
    scale: undefined,
  } as City;
};
export const destinationById = (id: string) =>
  DESTINATIONS.find((d) => d.id === id) ?? missing(id);

/** Whether the catalogue actually holds this, as opposed to a placeholder. */
export const isKnownDestination = (id: string) => DESTINATIONS.some((d) => d.id === id);
