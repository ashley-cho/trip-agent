import type { Place } from "@/lib/types";

// Cheap, close, short, and overwhelmingly outdoor: the combination nothing
// else in the catalogue covered. Fly to Las Vegas, drive from there.

export const SOUTHWEST_PLACES: Place[] = [
  // ------------------------------------------------------------------ Zion --
  { id: "zio-narrows", cityId: "zion", name: "The Narrows", kind: "outdoor",
    tags: ["hike", "nature", "coast"], neighborhood: "Zion Canyon", lat: 37.2850, lng: -112.9480,
    durationMin: 300, costUsd: 30, opens: "07:00", closes: "18:00", bestTime: "morning", touristy: 4,
    note: "You walk up the river itself, in the river, between walls a thousand feet high. Rent the boots and stick; your own shoes will not do. Check the flash flood forecast that morning, every morning." },

  { id: "zio-angels", cityId: "zion", name: "Angels Landing", kind: "outdoor",
    tags: ["hike", "nature", "viewpoint", "earlystart"], neighborhood: "Zion Canyon", lat: 37.2690, lng: -112.9490,
    durationMin: 270, costUsd: 6, opens: "06:00", closes: "17:00", bestTime: "morning", touristy: 5,
    note: "Chains bolted to a fin of rock with a drop either side. Permit by lottery, and genuinely not for everyone. If the exposure worries you, Scout Lookout gets you most of the view and none of the chain." },

  { id: "zio-watchman", cityId: "zion", name: "Watchman Trail at sunset", kind: "outdoor",
    tags: ["hike", "nature", "viewpoint"], neighborhood: "Zion Canyon", lat: 37.1990, lng: -112.9860,
    durationMin: 120, costUsd: 0, bestTime: "evening", touristy: 3,
    note: "Two hours, moderate, and it faces west at the one hour the canyon walls turn properly red. Start ninety minutes before sunset." },

  { id: "zio-canyonoverlook", cityId: "zion", name: "Canyon Overlook", kind: "outdoor",
    tags: ["hike", "viewpoint", "nature"], neighborhood: "East Zion", lat: 37.2130, lng: -112.9400,
    durationMin: 70, costUsd: 0, bestTime: "morning", touristy: 4,
    note: "One mile, some drop-offs, and a view straight down the main canyon that people hike all day for. The best return on effort in the park." },

  { id: "zio-emerald", cityId: "zion", name: "Emerald Pools", kind: "outdoor",
    tags: ["hike", "nature", "walk"], neighborhood: "Zion Canyon", lat: 37.2510, lng: -112.9580,
    durationMin: 100, costUsd: 0, bestTime: "afternoon", touristy: 4,
    note: "Easy, shaded, and wet underfoot where the seeps come off the rock. Good on a day your legs have already been used." },

  { id: "zio-kolob", cityId: "zion", name: "Kolob Canyons", kind: "outdoor",
    tags: ["nature", "hike", "viewpoint"], neighborhood: "Kolob", lat: 37.4520, lng: -113.2060,
    durationMin: 180, costUsd: 0, bestTime: "morning", touristy: 1,
    note: "Separate entrance forty minutes north, and almost nobody uses it. Same red rock, no shuttle, no queue for parking." },

  { id: "zio-springdale-dinner", cityId: "zion", name: "Dinner in Springdale", kind: "meal",
    tags: ["food", "local"], neighborhood: "Springdale", lat: 37.1890, lng: -112.9980,
    durationMin: 90, costUsd: 34, opens: "17:00", closes: "21:30", bestTime: "evening", touristy: 3,
    note: "The whole town is one street against the canyon wall. Eat outside, and be aware kitchens here close early by city standards." },

  { id: "zio-coffee", cityId: "zion", name: "Coffee in Springdale", kind: "meal",
    tags: ["coffee", "local"], neighborhood: "Springdale", lat: 37.1900, lng: -112.9950,
    durationMin: 35, costUsd: 6, opens: "06:00", closes: "14:00", bestTime: "morning", touristy: 2,
    note: "Open at six, which matters, because the shuttle queue at seven is already long." },

  { id: "zio-lunch", cityId: "zion", name: "Lunch out of the pack", kind: "meal",
    tags: ["food", "local"], neighborhood: "Zion Canyon", lat: 37.2400, lng: -112.9600,
    durationMin: 45, costUsd: 14, bestTime: "midday", touristy: 1,
    note: "There is nothing to buy inside the canyon past the lodge. Pick something up in Springdale in the morning and eat it on a rock." },

  { id: "zio-brewery", cityId: "zion", name: "Zion Canyon Brew Pub", kind: "drink",
    tags: ["food", "local", "nightlife"], neighborhood: "Springdale", lat: 37.1930, lng: -112.9880,
    durationMin: 75, costUsd: 22, opens: "12:00", closes: "22:00", bestTime: "evening", touristy: 3,
    note: "On the patio at the park entrance, full of people comparing the day. Utah's beer laws are strange; the beer is fine." },

  { id: "zio-thai", cityId: "zion", name: "Dinner at the Thai place", kind: "meal",
    tags: ["food", "local"], neighborhood: "Springdale", lat: 37.1875, lng: -113.0010,
    durationMin: 80, costUsd: 26, opens: "17:00", closes: "21:00", closedDays: [0], bestTime: "evening", touristy: 2,
    note: "In a garden behind a petrol station, which is not a recommendation you get often. Half the town eats here." },

  { id: "zio-stars", cityId: "zion", name: "Stars from the canyon floor", kind: "outdoor",
    tags: ["nature", "viewpoint"], neighborhood: "Zion Canyon", lat: 37.2000, lng: -112.9800,
    durationMin: 60, costUsd: 0, opens: "21:00", closes: "23:59", bestTime: "evening", touristy: 1,
    note: "Walk out past the lodge lights and let your eyes adjust for fifteen minutes. There is no trick to this and it is the best free hour of the trip." },

  // ------------------------------------------------------------------ Moab --
  { id: "mob-delicate", cityId: "moab", name: "Delicate Arch at sunset", kind: "outdoor",
    tags: ["hike", "nature", "viewpoint", "iconic"], neighborhood: "Arches", lat: 38.7436, lng: -109.4993,
    durationMin: 180, costUsd: 30, opens: "07:00", closes: "22:00", bestTime: "evening", touristy: 5,
    note: "Three miles round trip over open slickrock with no shade. Everyone goes at sunset and it is still worth it; bring more water than you think and a headlamp for coming down." },

  { id: "mob-devilsgarden", cityId: "moab", name: "Devils Garden", kind: "outdoor",
    tags: ["hike", "nature", "viewpoint"], neighborhood: "Arches", lat: 38.7830, lng: -109.5940,
    durationMin: 240, costUsd: 0, bestTime: "morning", touristy: 3,
    note: "Eight arches on one loop, and the crowd thins to nothing past Landscape Arch. The primitive section involves scrambling on a rock fin, which is the good part." },

  { id: "mob-islandsky", cityId: "moab", name: "Island in the Sky", kind: "outdoor",
    tags: ["nature", "viewpoint", "walk"], neighborhood: "Canyonlands", lat: 38.4590, lng: -109.8210,
    durationMin: 210, costUsd: 30, opens: "07:00", closes: "20:00", bestTime: "morning", touristy: 3,
    note: "A mesa with two canyon systems dropping away on both sides. Mesa Arch at dawn is the famous shot; Grand View Point at the end of the road is the better stop." },

  { id: "mob-deadhorse", cityId: "moab", name: "Dead Horse Point", kind: "outdoor",
    tags: ["viewpoint", "nature", "walk"], neighborhood: "Dead Horse", lat: 38.4820, lng: -109.7400,
    durationMin: 120, costUsd: 20, opens: "06:00", closes: "22:00", bestTime: "evening", touristy: 3,
    note: "Two thousand feet above a gooseneck in the Colorado. Grim name, real history, and the best sunset within half an hour of town." },

  { id: "mob-corona", cityId: "moab", name: "Corona Arch", kind: "outdoor",
    tags: ["hike", "nature", "viewpoint"], neighborhood: "Potash Road", lat: 38.5760, lng: -109.6270,
    durationMin: 150, costUsd: 0, bestTime: "morning", touristy: 2,
    note: "Outside the park, so no entry fee and no shuttle. A ladder and a cable section on the way, and an arch as big as the famous ones with a tenth of the people." },

  { id: "mob-fisher", cityId: "moab", name: "Fisher Towers", kind: "outdoor",
    tags: ["hike", "nature", "viewpoint"], neighborhood: "Castle Valley", lat: 38.7240, lng: -109.3080,
    durationMin: 180, costUsd: 0, bestTime: "afternoon", touristy: 2,
    note: "Dark red spires that climbers come from Europe for. The trail runs around their base; the drive out along the river is half the point." },

  { id: "mob-raft", cityId: "moab", name: "Half day on the Colorado", kind: "experience",
    tags: ["boat", "nature", "coast"], neighborhood: "Moab", lat: 38.5730, lng: -109.5500,
    durationMin: 240, costUsd: 85, opens: "08:00", closes: "16:00", bestTime: "midday", touristy: 3,
    note: "Gentle water, not whitewater, unless you ask for it. Being down in the canyon looking up is a different trip from standing on the rim." },

  { id: "mob-potash", cityId: "moab", name: "Potash Road petroglyphs", kind: "sight",
    tags: ["history", "walk", "nature"], neighborhood: "Potash Road", lat: 38.5620, lng: -109.6100,
    durationMin: 60, costUsd: 0, bestTime: "afternoon", touristy: 2,
    note: "Rock art a few feet from the road, made by people who lived here for a thousand years. Unmarked, unfenced, and easy to drive straight past." },

  { id: "mob-dinner", cityId: "moab", name: "Dinner in Moab", kind: "meal",
    tags: ["food", "local"], neighborhood: "Moab", lat: 38.5730, lng: -109.5490,
    durationMin: 90, costUsd: 32, opens: "17:00", closes: "22:00", bestTime: "evening", touristy: 3,
    note: "A mountain-bike town that eats early and well enough. The brewery is the default and it earns it after a day on rock." },

  { id: "mob-lunch", cityId: "moab", name: "Lunch off the trail", kind: "meal",
    tags: ["food", "local"], neighborhood: "Moab", lat: 38.5710, lng: -109.5510,
    durationMin: 60, costUsd: 18, opens: "11:00", closes: "16:00", bestTime: "midday", touristy: 2,
    note: "Get it to go and eat it somewhere with a view. Sitting in an air-conditioned room in the middle of this is a waste of the day." },

  { id: "mob-coffee", cityId: "moab", name: "Coffee in Moab", kind: "meal",
    tags: ["coffee", "local"], neighborhood: "Moab", lat: 38.5700, lng: -109.5460,
    durationMin: 35, costUsd: 6, opens: "06:00", closes: "15:00", bestTime: "morning", touristy: 2,
    note: "Full of people in climbing shoes checking the forecast at half past six. Join them." },

  { id: "mob-stars", cityId: "moab", name: "Dark sky night", kind: "outdoor",
    tags: ["nature", "viewpoint"], neighborhood: "Arches", lat: 38.7000, lng: -109.5700,
    durationMin: 90, costUsd: 0, opens: "21:00", closes: "23:59", bestTime: "evening", touristy: 2,
    note: "Certified dark sky, which means the Milky Way is not a metaphor here. Drive ten minutes out of town, turn the engine off, and wait." },

];
