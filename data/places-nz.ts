import type { Place } from "@/lib/types";

// South Island. Film locations are marked in the notes where they are real and
// worth going to, and left out where the site is a paddock with nothing on it.

export const NZ_PLACES: Place[] = [
  // ------------------------------------------------------------ Queenstown --
  { id: "qt-benlomond", cityId: "queenstown", name: "Ben Lomond track", kind: "outdoor",
    tags: ["hike", "nature", "viewpoint"], neighborhood: "Queenstown", lat: -44.9800, lng: 168.6400,
    durationMin: 330, costUsd: 34, bestTime: "morning", touristy: 3,
    note: "Gondola to the saddle, then two hours up a ridge to 1,748m with the whole Wakatipu basin underneath. Steep, exposed at the top, and the best day's walking from a town centre anywhere." },

  { id: "qt-gondola", cityId: "queenstown", name: "Skyline gondola at dusk", kind: "sight",
    tags: ["viewpoint", "nature"], neighborhood: "Queenstown", lat: -45.0280, lng: 168.6560,
    durationMin: 90, costUsd: 34, opens: "09:00", closes: "21:00", bestTime: "evening", touristy: 4,
    note: "Steepest cable car in the southern hemisphere, and the view down the lake at last light is the postcard. Go up late, not at midday." },

  { id: "qt-lakewalk", cityId: "queenstown", name: "Frankton Track along the lake", kind: "walk",
    tags: ["walk", "coast", "nature", "local"], neighborhood: "Queenstown", lat: -45.0330, lng: 168.6700,
    durationMin: 100, costUsd: 0, bestTime: "morning", touristy: 2,
    note: "Flat, on the water the whole way, and full of people running before work. The lake is glacial and genuinely that colour." },

  { id: "qt-shotover", cityId: "queenstown", name: "Shotover jet", kind: "experience",
    tags: ["boat", "adventure", "nature"], neighborhood: "Arthurs Point", lat: -44.9880, lng: 168.6800,
    durationMin: 90, costUsd: 105, opens: "09:00", closes: "17:00", bestTime: "afternoon", touristy: 5,
    note: "Twenty-five minutes of being thrown at canyon walls at eighty kilometres an hour. Unashamedly a ride, and the canyon itself is worth seeing from the water." },

  { id: "qt-bungy", cityId: "queenstown", name: "Kawarau bridge bungy", kind: "experience",
    tags: ["adventure", "nature", "history"], neighborhood: "Gibbston", lat: -45.0000, lng: 168.8600,
    durationMin: 120, costUsd: 135, opens: "09:00", closes: "17:00", bestTime: "midday", touristy: 4,
    note: "The original one, from 1988, which is why this whole town is like this. Watching from the platform is free and nearly as good." },

  { id: "qt-gibbston", cityId: "queenstown", name: "Gibbston Valley wineries", kind: "experience",
    tags: ["wine", "food", "nature"], neighborhood: "Gibbston", lat: -45.0100, lng: 168.8300,
    durationMin: 180, costUsd: 40, opens: "11:00", closes: "17:00", bestTime: "midday", touristy: 3,
    note: "Pinot noir grown at the southern limit of where it will ripen, which is exactly why it tastes like that. Cycle the trail between three of them rather than driving." },

  { id: "qt-arrowtown", cityId: "queenstown", name: "Arrowtown", kind: "walk",
    tags: ["walk", "history", "local", "food"], neighborhood: "Arrowtown", lat: -44.9400, lng: 168.8300,
    durationMin: 120, costUsd: 0, bestTime: "afternoon", touristy: 3,
    note: "A gold rush town that kept its miners' cottages and its Chinese settlement, which most places quietly demolished. Autumn here is the reason people book flights." },

  { id: "qt-fergburger", cityId: "queenstown", name: "Fergburger", kind: "meal",
    tags: ["food", "local", "iconic"], neighborhood: "Queenstown", lat: -45.0320, lng: 168.6600,
    durationMin: 45, costUsd: 14, opens: "08:00", closes: "05:00", bestTime: "any", touristy: 5,
    note: "Open twenty-one hours a day and there is always a queue. It is a very good burger; it is not worth forty minutes at seven in the evening. Go at three in the afternoon." },

  { id: "qt-dinner", cityId: "queenstown", name: "Dinner in Queenstown", kind: "meal",
    tags: ["food", "local", "wine"], neighborhood: "Queenstown", lat: -45.0310, lng: 168.6620,
    durationMin: 100, costUsd: 48, opens: "17:00", closes: "22:00", bestTime: "evening", touristy: 3,
    note: "Lamb, venison, and Central Otago pinot by the glass. The town eats early and the good rooms are booked a week out." },

  { id: "qt-lunch", cityId: "queenstown", name: "Lunch by the water", kind: "meal",
    tags: ["food", "coast", "local"], neighborhood: "Queenstown", lat: -45.0330, lng: 168.6590,
    durationMin: 70, costUsd: 24, opens: "11:30", closes: "16:00", bestTime: "midday", touristy: 3,
    note: "Take it down to the beach by the pier and eat it looking at the Remarkables. Nobody will mind." },

  { id: "qt-coffee", cityId: "queenstown", name: "Coffee before the drive", kind: "meal",
    tags: ["coffee", "local"], neighborhood: "Queenstown", lat: -45.0300, lng: 168.6630,
    durationMin: 35, costUsd: 6, opens: "07:00", closes: "16:00", bestTime: "morning", touristy: 2,
    note: "New Zealand invented the flat white and takes it seriously. Get one before any drive; there is nothing between towns." },

  { id: "qt-onsen", cityId: "queenstown", name: "Hot tubs over the Shotover", kind: "experience",
    tags: ["spa", "nature", "viewpoint"], neighborhood: "Arthurs Point", lat: -44.9900, lng: 168.6740,
    durationMin: 90, costUsd: 75, opens: "09:00", closes: "22:00", bestTime: "evening", touristy: 3,
    note: "Private cedar tubs with a window that opens onto the canyon. Expensive, and the correct end to a day on Ben Lomond." },

  // ------------------------------------------------------------- Glenorchy --
  { id: "gl-paradise", cityId: "glenorchy", name: "Paradise and the Dart valley", kind: "outdoor",
    tags: ["nature", "viewpoint", "walk"], neighborhood: "Glenorchy", lat: -44.7500, lng: 168.3300,
    durationMin: 180, costUsd: 0, bestTime: "morning", touristy: 2,
    note: "The beech forest here was Lothlórien and the valley beyond it Isengard. No signs, no gate, no gift shop: it is a gravel road through a working farm and it looks exactly as it did on film." },

  { id: "gl-routeburn", cityId: "glenorchy", name: "Routeburn Track day walk", kind: "outdoor",
    tags: ["hike", "nature", "viewpoint"], neighborhood: "Routeburn", lat: -44.7200, lng: 168.2000,
    durationMin: 300, costUsd: 0, bestTime: "morning", touristy: 3,
    note: "Walk in as far as the Falls Hut and back, about five hours, on one of the great tracks without needing a booking. Beech forest, then above the treeline." },

  { id: "gl-lagoon", cityId: "glenorchy", name: "Glenorchy lagoon boardwalk", kind: "walk",
    tags: ["walk", "nature", "coast", "viewpoint"], neighborhood: "Glenorchy", lat: -44.8500, lng: 168.3800,
    durationMin: 75, costUsd: 0, bestTime: "afternoon", touristy: 2,
    note: "A boardwalk over a wetland with the Humboldt mountains standing straight up out of the far side. Forty minutes, flat, and the light in the late afternoon is absurd." },

  { id: "gl-horse", cityId: "glenorchy", name: "Ride out into the Dart", kind: "experience",
    tags: ["nature", "local", "adventure"], neighborhood: "Glenorchy", lat: -44.8400, lng: 168.3700,
    durationMin: 180, costUsd: 130, opens: "09:00", closes: "16:00", bestTime: "midday", touristy: 3,
    note: "The horses used in the films came from here and some of the same outfit still runs rides. Riding through it beats driving through it by a distance." },

  { id: "gl-lunch", cityId: "glenorchy", name: "Lunch in Glenorchy", kind: "meal",
    tags: ["food", "local"], neighborhood: "Glenorchy", lat: -44.8480, lng: 168.3830,
    durationMin: 60, costUsd: 20, opens: "10:00", closes: "16:00", bestTime: "midday", touristy: 2,
    note: "There are about two options and they both know it. Perfectly good, and the alternative is nothing for forty-five minutes in either direction." },

  // ---------------------------------------------------------------- Wanaka --
  { id: "wk-roysipeak", cityId: "wanaka", name: "Roys Peak", kind: "outdoor",
    tags: ["hike", "nature", "viewpoint", "earlystart"], neighborhood: "Wanaka", lat: -44.6900, lng: 169.1000,
    durationMin: 330, costUsd: 0, bestTime: "morning", touristy: 4,
    note: "Five to six hours, twelve hundred metres of climbing, and a queue for a photograph on a ridge near the top. Start at six and you will have the descent to yourself." },

  { id: "wk-rob-roy", cityId: "wanaka", name: "Rob Roy Glacier track", kind: "outdoor",
    tags: ["hike", "nature", "viewpoint"], neighborhood: "Matukituki", lat: -44.5500, lng: 168.7500,
    durationMin: 270, costUsd: 0, bestTime: "morning", touristy: 2,
    note: "An hour of gravel road with river fords, then three hours up a valley to stand under a hanging glacier. Do not take a small hire car up the road after rain." },

  { id: "wk-lakefront", cityId: "wanaka", name: "That Wanaka Tree and the lakefront", kind: "walk",
    tags: ["walk", "coast", "viewpoint", "iconic"], neighborhood: "Wanaka", lat: -44.7000, lng: 169.1300,
    durationMin: 60, costUsd: 0, bestTime: "evening", touristy: 4,
    note: "A willow growing out of the lake that became a photograph, then a queue of photographs. Ninety seconds of looking; the lakefront either side of it is the actual walk." },

  { id: "wk-cinema", cityId: "wanaka", name: "Cinema Paradiso", kind: "experience",
    tags: ["local", "music", "food"], neighborhood: "Wanaka", lat: -44.7010, lng: 169.1420,
    durationMin: 165, costUsd: 22, opens: "16:00", closes: "23:00", bestTime: "evening", touristy: 3,
    note: "Sofas, an old Morris Minor for seating, and they stop the film halfway through so everyone can get a cookie. Genuinely charming rather than twee." },

  { id: "wk-dinner", cityId: "wanaka", name: "Dinner in Wanaka", kind: "meal",
    tags: ["food", "local", "wine"], neighborhood: "Wanaka", lat: -44.7000, lng: 169.1400,
    durationMin: 90, costUsd: 40, opens: "17:00", closes: "21:30", bestTime: "evening", touristy: 2,
    note: "Smaller and calmer than Queenstown, which is most of the reason to come here for the evening." },

  // -------------------------------------------------------------- Te Anau --
  { id: "ta-kepler", cityId: "teanau", name: "Kepler Track lakeside section", kind: "outdoor",
    tags: ["hike", "nature", "coast", "walk"], neighborhood: "Te Anau", lat: -45.4300, lng: 167.7000,
    durationMin: 180, costUsd: 0, bestTime: "morning", touristy: 2,
    note: "Walk the flat first section along the lake through mossy beech forest and turn back at the control gates. All of the forest, none of the mountain." },

  { id: "ta-glowworm", cityId: "teanau", name: "Te Anau glowworm caves", kind: "experience",
    tags: ["nature", "boat"], neighborhood: "Te Anau", lat: -45.4100, lng: 167.6700,
    durationMin: 135, costUsd: 65, opens: "10:00", closes: "20:00", bestTime: "evening", touristy: 4,
    note: "Boat across the lake, then a punt through a limestone cave under a ceiling of larvae. Silly, and quite beautiful in the dark." },

  { id: "ta-lakefront", cityId: "teanau", name: "Te Anau lakefront at dusk", kind: "walk",
    tags: ["walk", "coast", "nature", "viewpoint"], neighborhood: "Te Anau", lat: -45.4160, lng: 167.7180,
    durationMin: 60, costUsd: 0, bestTime: "evening", touristy: 2,
    note: "The Murchison mountains go dark across the water and the town does very little. That is the appeal." },

  { id: "ta-dinner", cityId: "teanau", name: "Dinner in Te Anau", kind: "meal",
    tags: ["food", "local"], neighborhood: "Te Anau", lat: -45.4150, lng: 167.7160,
    durationMin: 85, costUsd: 36, opens: "17:00", closes: "21:00", bestTime: "evening", touristy: 2,
    note: "A small town that feeds people before and after Milford. Blue cod, and everything closes by nine." },

  { id: "ta-coffee", cityId: "teanau", name: "Coffee before Milford", kind: "meal",
    tags: ["coffee", "local"], neighborhood: "Te Anau", lat: -45.4140, lng: 167.7170,
    durationMin: 35, costUsd: 6, opens: "06:30", closes: "15:00", bestTime: "morning", touristy: 2,
    note: "Open at half six for exactly this reason. There is no fuel and no coffee for the next hundred and twenty kilometres." },

  // -------------------------------------------------------- Milford Sound --
  { id: "mf-cruise", cityId: "milford", name: "Milford Sound cruise", kind: "experience",
    tags: ["boat", "nature", "coast", "viewpoint", "iconic"], neighborhood: "Milford", lat: -44.6700, lng: 167.9250,
    durationMin: 135, costUsd: 85, opens: "09:00", closes: "16:00", bestTime: "midday", touristy: 5,
    note: "Mitre Peak rises seventeen hundred metres straight out of the water. Go on a wet day rather than a clear one: rain turns the walls into hundreds of waterfalls, which is the actual spectacle." },

  { id: "mf-road", cityId: "milford", name: "The Milford Road itself", kind: "outdoor",
    tags: ["nature", "viewpoint", "walk"], neighborhood: "Milford Road", lat: -44.8000, lng: 167.9500,
    durationMin: 150, costUsd: 0, bestTime: "morning", touristy: 3,
    note: "Stop at Mirror Lakes, the Chasm, and Monkey Creek where the kea will try to eat your car. The drive is half the day and should be treated as an activity, not transit." },

  { id: "mf-keysummit", cityId: "milford", name: "Key Summit", kind: "outdoor",
    tags: ["hike", "nature", "viewpoint"], neighborhood: "Milford Road", lat: -44.8300, lng: 168.1100,
    durationMin: 180, costUsd: 0, bestTime: "morning", touristy: 2,
    note: "Three hours up onto an alpine bog with three valleys running away below you. The best short walk on the road and most people drive straight past the car park." },

  { id: "mf-kayak", cityId: "milford", name: "Kayak the sound", kind: "outdoor",
    tags: ["boat", "nature", "coast", "adventure"], neighborhood: "Milford", lat: -44.6720, lng: 167.9280,
    durationMin: 240, costUsd: 140, opens: "07:00", closes: "15:00", bestTime: "morning", touristy: 2,
    note: "At water level, under the cliffs, with seals on the rocks and no engine noise. The early departure gets the flat water before the wind picks up." },
];
