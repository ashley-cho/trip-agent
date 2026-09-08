import type { Place } from "@/lib/types";

// Two more that need no long-haul flight: the Olympic Peninsula (fly Seattle)
// and the California coast (drive from SF). Both work at three or four days,
// which nothing else in the catalogue did.

export const WESTCOAST_PLACES: Place[] = [
  // --------------------------------------------------------------- Seattle --
  { id: "sea-market", cityId: "seattle", name: "Pike Place at opening", kind: "market",
    tags: ["market", "food", "local", "earlystart"], neighborhood: "Downtown", lat: 47.6097, lng: -122.3422,
    durationMin: 75, costUsd: 16, opens: "07:00", closes: "17:00", bestTime: "morning", touristy: 5,
    note: "Before nine it is a working market and the fish throwing has not started. After eleven it is a crush. The lower floors are where the actual shops are." },

  { id: "sea-ballard", cityId: "seattle", name: "Ballard and the locks", kind: "walk",
    tags: ["walk", "local", "coast", "history"], neighborhood: "Ballard", lat: 47.6650, lng: -122.3970,
    durationMin: 120, costUsd: 0, bestTime: "morning", touristy: 2,
    note: "Boats being lifted between salt and fresh water, and a fish ladder with a window into it. Then a Nordic neighborhood that still has the bakeries to prove it." },

  { id: "sea-coffee", cityId: "seattle", name: "Coffee in Capitol Hill", kind: "meal",
    tags: ["coffee", "local"], neighborhood: "Capitol Hill", lat: 47.6210, lng: -122.3210,
    durationMin: 40, costUsd: 6, opens: "07:00", closes: "18:00", bestTime: "morning", touristy: 2,
    note: "Not the original Starbucks, which is a queue for a photograph. The roasters two streets over are why this city has a coffee reputation at all." },

  { id: "sea-sam", cityId: "seattle", name: "Seattle Art Museum", kind: "museum",
    tags: ["museum", "art", "contemporary"], neighborhood: "Downtown", lat: 47.6070, lng: -122.3380,
    durationMin: 105, costUsd: 30, opens: "10:00", closes: "17:00", closedDays: [1, 2], bestTime: "afternoon", touristy: 3,
    note: "Strong Northwest Coast Native collection, which is the part you cannot see elsewhere. Two hours, not four." },

  { id: "sea-discovery", cityId: "seattle", name: "Discovery Park bluffs", kind: "outdoor",
    tags: ["nature", "walk", "coast", "viewpoint"], neighborhood: "Magnolia", lat: 47.6580, lng: -122.4060,
    durationMin: 135, costUsd: 0, bestTime: "afternoon", touristy: 2,
    note: "Five hundred acres inside the city, with a beach at the bottom of a cliff and the Olympics across the water on a clear day. Which is not every day." },

  { id: "sea-ferry", cityId: "seattle", name: "Ferry to Bainbridge", kind: "experience",
    tags: ["boat", "coast", "viewpoint", "local"], neighborhood: "Colman Dock", lat: 47.6020, lng: -122.3390,
    durationMin: 150, costUsd: 20, opens: "06:00", closes: "23:00", bestTime: "afternoon", touristy: 3,
    note: "Thirty-five minutes each way for the price of a sandwich, and the best view of the city is from the deck coming back. Walk on; do not take the car." },

  { id: "sea-dinner", cityId: "seattle", name: "Dinner in Capitol Hill", kind: "meal",
    tags: ["food", "local", "wine"], neighborhood: "Capitol Hill", lat: 47.6180, lng: -122.3200,
    durationMin: 100, costUsd: 42, opens: "17:00", closes: "22:00", bestTime: "evening", touristy: 2,
    note: "Oysters, and something that was swimming this week. The city eats early; a nine o'clock table is a late one here." },

  { id: "sea-lunch", cityId: "seattle", name: "Lunch at the market counters", kind: "meal",
    tags: ["food", "market", "local"], neighborhood: "Downtown", lat: 47.6090, lng: -122.3410,
    durationMin: 55, costUsd: 20, opens: "10:00", closes: "17:00", bestTime: "midday", touristy: 4,
    note: "Chowder, or a crab roll standing up at the counter. Cheaper and better than anything with a view of the water." },

  { id: "sea-needle", cityId: "seattle", name: "Space Needle", kind: "sight",
    tags: ["viewpoint", "iconic"], neighborhood: "Seattle Center", lat: 47.6205, lng: -122.3493,
    durationMin: 90, costUsd: 39, opens: "09:00", closes: "22:00", bestTime: "afternoon", touristy: 5,
    note: "Forty dollars to go up the thing you came to look at, and the view is better from the ferry for twenty. I'd skip it.", skip: true },

  // ----------------------------------------------------- Olympic Peninsula --
  { id: "oly-hohrainforest", cityId: "olympic", name: "Hoh Rain Forest", kind: "outdoor",
    tags: ["nature", "hike", "walk"], neighborhood: "Hoh", lat: 47.8606, lng: -123.9350,
    durationMin: 210, costUsd: 30, opens: "08:00", closes: "18:00", bestTime: "morning", touristy: 3,
    note: "Twelve feet of rain a year and every surface furred with moss. The Hall of Mosses loop is a mile; walk further up the river trail and the sound drops away entirely." },

  { id: "oly-hurricane", cityId: "olympic", name: "Hurricane Ridge", kind: "outdoor",
    tags: ["nature", "viewpoint", "hike"], neighborhood: "Port Angeles", lat: 47.9690, lng: -123.4980,
    durationMin: 180, costUsd: 0, opens: "09:00", closes: "17:00", bestTime: "morning", touristy: 3,
    note: "An hour of switchbacks to a ridge facing a wall of glaciated peaks. Cloud sits on it half the time; go early and check the webcam before you drive up." },

  { id: "oly-rialto", cityId: "olympic", name: "Rialto Beach and Hole in the Wall", kind: "outdoor",
    tags: ["beach", "coast", "nature", "hike"], neighborhood: "La Push", lat: 47.9210, lng: -124.6400,
    durationMin: 150, costUsd: 0, bestTime: "afternoon", touristy: 2,
    note: "Sea stacks, driftwood the size of telegraph poles, and a rock arch you can walk through at low tide. Check the tide table or you will not get through, or back." },

  { id: "oly-ruby", cityId: "olympic", name: "Ruby Beach at sunset", kind: "outdoor",
    tags: ["beach", "coast", "nature", "viewpoint"], neighborhood: "Kalaloch", lat: 47.7100, lng: -124.4160,
    durationMin: 90, costUsd: 0, bestTime: "evening", touristy: 3,
    note: "Short scramble down through driftwood onto a beach facing straight west. The most reliable sunset on this coast." },

  { id: "oly-sollucdc", cityId: "olympic", name: "Sol Duc hot springs", kind: "experience",
    tags: ["spa", "nature", "local"], neighborhood: "Sol Duc", lat: 47.9680, lng: -123.8650,
    durationMin: 120, costUsd: 18, opens: "09:00", closes: "20:00", bestTime: "afternoon", touristy: 3,
    note: "Mineral pools in the middle of the forest, plainly built and not remotely luxurious. Exactly right after a day of walking in the wet." },

  { id: "oly-crescent", cityId: "olympic", name: "Lake Crescent", kind: "outdoor",
    tags: ["nature", "coast", "walk", "boat"], neighborhood: "Lake Crescent", lat: 48.0590, lng: -123.8080,
    durationMin: 120, costUsd: 0, bestTime: "midday", touristy: 2,
    note: "Six hundred feet deep, glacially clear, and the lodge lawn runs to the water. Rent a kayak for an hour or walk the Marymere Falls trail off the same car park." },

  { id: "oly-quinault", cityId: "olympic", name: "Quinault rainforest loop", kind: "outdoor",
    tags: ["nature", "hike", "walk"], neighborhood: "Quinault", lat: 47.4700, lng: -123.8400,
    durationMin: 150, costUsd: 0, bestTime: "morning", touristy: 1,
    note: "The other rainforest, on the south side, with a fraction of the traffic the Hoh gets. Some of the largest trees of their species anywhere stand on this loop." },

  { id: "oly-coffee", cityId: "olympic", name: "Coffee in Port Angeles", kind: "meal",
    tags: ["coffee", "local"], neighborhood: "Port Angeles", lat: 48.1170, lng: -123.4320,
    durationMin: 35, costUsd: 6, opens: "06:30", closes: "15:00", bestTime: "morning", touristy: 1,
    note: "Open early for the ferry crowd, which is what you want if Hurricane Ridge is the plan." },

  { id: "oly-dinner", cityId: "olympic", name: "Dinner in Port Angeles", kind: "meal",
    tags: ["food", "coast", "local"], neighborhood: "Port Angeles", lat: 48.1180, lng: -123.4300,
    durationMin: 90, costUsd: 34, opens: "16:30", closes: "21:00", bestTime: "evening", touristy: 2,
    note: "A working port, not a resort. Crab and halibut, and everything shuts by nine." },

  { id: "oly-crabshack", cityId: "olympic", name: "Crab on the dock", kind: "meal",
    tags: ["food", "coast", "local"], neighborhood: "Sequim", lat: 48.0850, lng: -123.0400,
    durationMin: 75, costUsd: 30, opens: "16:00", closes: "20:30", closedDays: [1], bestTime: "evening", touristy: 2,
    note: "Paper plates, plastic forks, and Dungeness pulled out of the water this morning. Cash is easier." },

  { id: "oly-lunch", cityId: "olympic", name: "Lunch in Forks", kind: "meal",
    tags: ["food", "local"], neighborhood: "Forks", lat: 47.9500, lng: -124.3860,
    durationMin: 60, costUsd: 18, opens: "11:00", closes: "20:00", bestTime: "midday", touristy: 2,
    note: "A logging town that briefly became a vampire pilgrimage site and has mostly recovered. Eat, fill the tank, keep going." },

  // ------------------------------------------------- California coast --
  { id: "cc-bixby", cityId: "bigsur", name: "Bixby Creek and the drive south", kind: "outdoor",
    tags: ["coast", "viewpoint", "nature", "iconic"], neighborhood: "Big Sur", lat: 36.3714, lng: -121.9016,
    durationMin: 120, costUsd: 0, bestTime: "morning", touristy: 4,
    note: "The drive is the activity. Go south in the morning so the ocean is on your right and you can pull over without crossing traffic." },

  { id: "cc-mcway", cityId: "bigsur", name: "McWay Falls", kind: "outdoor",
    tags: ["coast", "viewpoint", "nature", "walk"], neighborhood: "Big Sur", lat: 36.1580, lng: -121.6700,
    durationMin: 60, costUsd: 10, opens: "08:00", closes: "19:00", bestTime: "afternoon", touristy: 4,
    note: "A waterfall onto a beach you are not allowed to stand on, which is why it still looks like that. Ten minutes of walking, and worth the parking fee." },

  { id: "cc-pfeiffer", cityId: "bigsur", name: "Pfeiffer Beach", kind: "outdoor",
    tags: ["beach", "coast", "nature"], neighborhood: "Big Sur", lat: 36.2380, lng: -121.8150,
    durationMin: 120, costUsd: 15, opens: "09:00", closes: "20:00", bestTime: "evening", touristy: 3,
    note: "Purple sand, a keyhole rock the light comes through in midwinter, and an unmarked turning that fills by ten. Go late in the day instead." },

  { id: "cc-andrewmolera", cityId: "bigsur", name: "Andrew Molera bluff trail", kind: "outdoor",
    tags: ["hike", "coast", "nature", "viewpoint"], neighborhood: "Big Sur", lat: 36.2870, lng: -121.8460,
    durationMin: 180, costUsd: 10, opens: "08:00", closes: "18:00", bestTime: "morning", touristy: 2,
    note: "Eight miles of headland with the ocean below the whole way, and a river crossing that is knee deep or impassable depending on the month." },

  { id: "cc-pointlobos", cityId: "bigsur", name: "Point Lobos", kind: "outdoor",
    tags: ["nature", "coast", "walk", "viewpoint"], neighborhood: "Carmel", lat: 36.5160, lng: -121.9430,
    durationMin: 165, costUsd: 12, opens: "08:00", closes: "19:00", bestTime: "morning", touristy: 3,
    note: "Sea lions, otters, and cypress growing out of rock. Reserve parking or arrive before nine; they close the gate when it fills and turn everyone away." },

  { id: "cc-carmel", cityId: "bigsur", name: "Carmel village", kind: "walk",
    tags: ["walk", "shopping", "local", "art"], neighborhood: "Carmel", lat: 36.5550, lng: -121.9230,
    durationMin: 90, costUsd: 0, bestTime: "afternoon", touristy: 4,
    note: "Twee, expensive, and genuinely pretty. An hour, mostly for the beach at the bottom of the hill where the dogs run off lead." },

  { id: "cc-paso", cityId: "bigsur", name: "Tasting in Paso Robles", kind: "experience",
    tags: ["wine", "food", "local"], neighborhood: "Paso Robles", lat: 35.6270, lng: -120.6910,
    durationMin: 210, costUsd: 45, opens: "11:00", closes: "17:00", bestTime: "midday", touristy: 2,
    note: "Rhône varieties on limestone, an hour and a half inland from the coast. Pick two small producers and stay at each; the tasting-room loop of six is a waste of a day." },

  { id: "cc-monterey", cityId: "bigsur", name: "Monterey Bay Aquarium", kind: "museum",
    tags: ["nature", "museum", "coast"], neighborhood: "Monterey", lat: 36.6180, lng: -121.9020,
    durationMin: 180, costUsd: 60, opens: "10:00", closes: "17:00", bestTime: "morning", touristy: 4,
    note: "A research institution that happens to admit the public, sitting on the bay it studies. The kelp forest tank is three storeys and worth the ticket by itself." },

  { id: "cc-lunch", cityId: "bigsur", name: "Lunch at a roadhouse", kind: "meal",
    tags: ["food", "local"], neighborhood: "Big Sur", lat: 36.2500, lng: -121.7800,
    durationMin: 70, costUsd: 26, opens: "11:30", closes: "16:00", bestTime: "midday", touristy: 3,
    note: "There are three of these along the whole stretch and they all have a deck over the creek. Any of them, whichever you reach at one o'clock." },

  { id: "cc-dinner", cityId: "bigsur", name: "Dinner on the coast", kind: "meal",
    tags: ["food", "coast", "local"], neighborhood: "Big Sur", lat: 36.2450, lng: -121.7740,
    durationMin: 105, costUsd: 55, opens: "17:00", closes: "21:00", bestTime: "evening", touristy: 3,
    note: "There are about six places to eat along thirty miles of coast and they know it. Book, and expect the bill to reflect the geography." },

  { id: "cc-carmeldinner", cityId: "bigsur", name: "Dinner in Carmel", kind: "meal",
    tags: ["food", "local", "wine"], neighborhood: "Carmel", lat: 36.5560, lng: -121.9210,
    durationMin: 95, costUsd: 46, opens: "17:00", closes: "21:30", bestTime: "evening", touristy: 3,
    note: "Half the price of eating on the coast road and twice the choice. Worth driving back north for." },

  { id: "cc-coffee", cityId: "bigsur", name: "Coffee before the drive", kind: "meal",
    tags: ["coffee", "local"], neighborhood: "Carmel", lat: 36.5540, lng: -121.9210,
    durationMin: 35, costUsd: 6, opens: "07:00", closes: "16:00", bestTime: "morning", touristy: 2,
    note: "Last reliable coffee before the coast road. There is no service and very little of anything else for the next fifty miles." },

  { id: "cc-stars", cityId: "bigsur", name: "Night sky over the ocean", kind: "outdoor",
    tags: ["nature", "viewpoint", "coast"], neighborhood: "Big Sur", lat: 36.2200, lng: -121.7600,
    durationMin: 60, costUsd: 0, opens: "21:00", closes: "23:59", bestTime: "evening", touristy: 1,
    note: "Nothing between you and Hawaii, and no towns on the ridge behind. Pull into a turnout, kill the headlights, and wait." },
];
