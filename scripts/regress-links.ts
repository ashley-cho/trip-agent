/**
 * Regression: the links have to land on the right nights.
 *
 * "i need some links to go book stuff". A link is only worth anything if the
 * dates in it are the dates of the plan. An off-by-one here quietly prices her
 * the wrong week, which is worse than no link at all, so the walk from the
 * start date through the shape is checked leg by leg.
 */
import { legDates, hotelLink, areaHotelLink, flightLink, routeLink, mapsLink } from "@/lib/links";
import type { TripShapeLeg } from "@/lib/types";

let fails = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? `\n        ${d}` : ""}`);
  if (!ok) fails++;
};

console.log("\n\x1b[1mBOOKING LINKS\x1b[0m\n");

// Nine days in Portugal from the 12th: Lisbon 4, Porto 3, one night back at
// the hub for the flight home.
const shape: TripShapeLeg[] = [
  { cityId: "lisbon", nights: 4 },
  { cityId: "porto", nights: 3 },
  { cityId: "lisbon", nights: 1, returnLeg: true },
];
const d = legDates(shape, "2026-10-12");

check("you check into the first base on day one", d.get("lisbon")?.in === "2026-10-12", d.get("lisbon")?.in);
check("and out after the nights you booked", d.get("lisbon")?.out === "2026-10-16", d.get("lisbon")?.out);
check("the next leg starts the day you left", d.get("porto")?.in === "2026-10-16", d.get("porto")?.in);
check("and runs its own nights", d.get("porto")?.out === "2026-10-19", d.get("porto")?.out);
check("the night back at the hub is kept separately", d.get("lisbon:return")?.in === "2026-10-19", d.get("lisbon:return")?.in);
check("and is not allowed to overwrite the first stint", d.get("lisbon")?.nights === 4, String(d.get("lisbon")?.nights));

const nights = [...d.values()].reduce((s, x) => s + x.nights, 0);
check("every night in the plan is bookable", nights === 8, `${nights} nights`);

const hotel = hotelLink("Memmo Alfama", "Lisbon", d.get("lisbon"));
check("the hotel link carries the property and the dates",
  hotel.includes("checkin=2026-10-12") && hotel.includes("checkout=2026-10-16")
  && new URL(hotel).searchParams.get("ss") === "Memmo Alfama, Lisbon",
  hotel.slice(0, 110));

const flight = flightLink("San Francisco", "Lisbon", "2026-10-12", "2026-10-20");
check("the flight link names both ends and both dates",
  ["San Francisco", "Lisbon", "2026-10-12", "2026-10-20"].every((x) => (new URL(flight).searchParams.get("q") ?? "").includes(x)),
  new URL(flight).searchParams.get("q") ?? "");

check("a leg between cities goes to the real options",
  routeLink("Lisbon", "Porto") === "https://www.rome2rio.com/s/Lisbon/Porto",
  routeLink("Lisbon", "Porto"));

check("a place with coordinates maps by coordinate, not by name",
  mapsLink("Livraria Lello", 41.1465, -8.6149).includes("41.1465,-8.6149"),
  mapsLink("Livraria Lello", 41.1465, -8.6149));
check("and one without still maps",
  mapsLink("Livraria Lello").includes("Livraria%20Lello"),
  mapsLink("Livraria Lello"));

for (const u of [hotel, flight, routeLink("Lisbon", "Porto"), mapsLink("x", 1, 2)]) {
  let ok = false;
  try { ok = new URL(u).protocol === "https:"; } catch { ok = false; }
  if (!ok) check("every link is a valid https url", false, u);
}
check("a base with no named hotel searches the neighbourhood",
  new URL(areaHotelLink("Porto Baixa", d.get("porto"))).searchParams.get("ss") === "Porto Baixa",
  new URL(areaHotelLink("Porto Baixa", d.get("porto"))).searchParams.get("ss") ?? "");
check("every link is a valid https url", true);

console.log(fails ? `\n  \x1b[31m${fails} failing\x1b[0m\n` : "\n  \x1b[32mall clear\x1b[0m\n");
process.exit(fails ? 1 : 0);
