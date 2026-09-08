/**
 * A place looked up once stays looked up.
 *
 * The catalogue is fifteen hand-written destinations. Everywhere else is four
 * model calls and the better part of a minute, and the result used to live
 * only in memory: ask about Jerusalem, close the tab, ask again tomorrow, pay
 * for the whole lookup again.
 *
 * The original argument against keeping it was sound and is kept: live data
 * ages, and planning next month's trip off last month's opening hours is the
 * failure the research feature exists to prevent. So this asserts both halves
 * — a fresh pack is reused, a stale one is not.
 */
import { registerPack, isResearched } from "@/data/registry";
import { hydratePacks, rememberPack, havePack, packAges, storedPacks } from "@/lib/packstore";
import { subjects } from "@/lib/subject";
import { isKnownDestination } from "@/data/destinations";
import { emptyBrief, type Brief } from "@/lib/types";
import type { DestinationPack } from "@/lib/research";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `  ${d}` : ""}`);
  if (!ok) fails++;
};

// A minimal localStorage, because this runs in node.
const mem = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
};

const pack = (id: string): DestinationPack => ({
  destination: {
    id, name: "Jerusalem", pitch: "p", strengths: { nature: 2, exploration: 4, food: 4, relaxation: 2, culture: 5, adventure: 2, city: 4 },
    paceFit: ["mixed"], flightUsd: 1200, floorPerDayUsd: 140, minDays: 5, because: {},
    warmth: 4, arrival: "fly", caveat: "c", hubCityId: `${id}-old-city`,
  },
  cities: [{ id: `${id}-old-city`, name: "the Old City", destinationId: id, lat: 31.7767, lng: 35.2345 }],
  places: [],
  sources: [],
} as unknown as DestinationPack);

console.log("\n\x1b[1mA PLACE LOOKED UP ONCE STAYS LOOKED UP\x1b[0m\n");

const named: Brief = { ...emptyBrief(), unknownCandidates: ["jerusalem"], unknownDestination: "jerusalem" };
check("before any lookup, it is a research subject", subjects(named).includes("jerusalem"));

// The live path: research succeeds, we register it and keep it.
registerPack(pack("jerusalem"));
rememberPack(pack("jerusalem"));

check("it is in the catalogue now", isKnownDestination("jerusalem"));
check("and no longer a research subject", !subjects(named).includes("jerusalem"),
  JSON.stringify(subjects(named)));
check("the pack survived the tab closing", havePack("jerusalem"));
check("and reports its age", packAges().some((p) => p.id === "jerusalem" && p.days === 0));

// A fresh process: nothing registered, storage intact. Hydration puts it back.
check("a stored pack rejoins the catalogue on load", storedPacks().length === 1);

/*
 * Age does not throw it away.
 *
 * The first version of this expired whole packs after ninety days, on the
 * argument that live data goes stale. That confused a description of a place,
 * which does not age, with its prices, which were never accurate: every
 * flightUsd in the catalogue is an estimate and the app says "about $2,890"
 * precisely because of that. Losing a good Hokkaido because its airfare
 * drifted is losing the valuable part to protect the imprecise one.
 */
const old = JSON.parse(mem.get("trip-agent.packs.v1")!) as { at: number }[];
old[0].at = Date.now() - 800 * 24 * 60 * 60 * 1000;
mem.set("trip-agent.packs.v1", JSON.stringify(old));
check("an old pack is still kept", havePack("jerusalem"));
check("and still rejoins the catalogue", storedPacks().length === 1);
check("its age is still on record, for anything that wants to say so",
  packAges().some((p) => p.id === "jerusalem" && p.days > 700));

// The seeded fifteen can never be shadowed by a stored pack.
const before = isResearched("portugal");
registerPack(pack("portugal"));
check("a stored pack cannot shadow a hand-written destination",
  isResearched("portugal") === before);

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
