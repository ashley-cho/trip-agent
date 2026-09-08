import type { Place } from "@/lib/types";

// Iceland stresses the planner differently to Portugal: you drive, the day
// trips are long, and almost nothing is walkable from anything else. Notes
// hand-written, same rule as everywhere else in data/.

export const ICELAND_PLACES: Place[] = [
  // ------------------------------------------------------------- Reykjavík --
  { id: "rvk-braud", cityId: "reykjavik", name: "Braud & Co", kind: "meal",
    tags: ["coffee", "food", "local"], neighborhood: "Frakkastígur", lat: 64.1462, lng: -21.9270,
    durationMin: 40, costUsd: 11, opens: "06:00", closes: "18:00", bestTime: "morning", touristy: 3,
    note: "Cardamom buns out of the oven all morning, in a building painted like a comic. Queue moves fast." },

  { id: "rvk-hallgrim", cityId: "reykjavik", name: "Hallgrímskirkja tower", kind: "sight",
    tags: ["church", "viewpoint", "architecture", "iconic"], neighborhood: "Skólavörðuholt", lat: 64.1417, lng: -21.9266,
    durationMin: 45, costUsd: 9, opens: "09:00", closes: "20:30", bestTime: "morning", touristy: 4,
    note: "A lift, not a climb. Go up for the coloured roofs — the church interior is austere and takes five minutes." },

  { id: "rvk-sundholl", cityId: "reykjavik", name: "Swim at Sundhöllin", kind: "experience",
    tags: ["spa", "local"], neighborhood: "Barónsstígur", lat: 64.1443, lng: -21.9226,
    durationMin: 75, costUsd: 8, opens: "06:30", closes: "22:00", bestTime: "morning", touristy: 1,
    note: "The neighborhood pool, not the tourist lagoon. Eight dollars, hot tubs on the roof, and everybody in Reykjavík is here. Shower properly first — they will tell you." },

  { id: "rvk-harpa", cityId: "reykjavik", name: "Harpa", kind: "sight",
    tags: ["architecture", "music", "contemporary"], neighborhood: "Old Harbour", lat: 64.1505, lng: -21.9327,
    durationMin: 45, costUsd: 0, opens: "09:00", closes: "22:00", bestTime: "afternoon", touristy: 3,
    note: "Walk into the glass honeycomb even with no ticket. The light through it changes completely depending on the weather, which here means hourly." },

  { id: "rvk-grandi", cityId: "reykjavik", name: "Grandi harbour walk", kind: "walk",
    tags: ["walk", "coast", "local"], neighborhood: "Grandi", lat: 64.1545, lng: -21.9450,
    durationMin: 60, costUsd: 0, bestTime: "afternoon", touristy: 2,
    note: "Working docks turning slowly into workshops and an ice cream place. Walk out to the lighthouse if the wind allows." },

  { id: "rvk-laugavegur", cityId: "reykjavik", name: "Laugavegur and the side streets", kind: "walk",
    tags: ["walk", "shopping", "local"], neighborhood: "Centre", lat: 64.1436, lng: -21.9270,
    durationMin: 75, costUsd: 0, bestTime: "afternoon", touristy: 3,
    note: "The main street is mostly puffin shops. One block either side is where the record stores and the good knitwear are." },

  { id: "rvk-kjarval", cityId: "reykjavik", name: "Kjarvalsstaðir", kind: "museum",
    tags: ["museum", "art", "architecture"], neighborhood: "Klambratún", lat: 64.1400, lng: -21.9110,
    durationMin: 75, costUsd: 15, opens: "10:00", closes: "17:00", bestTime: "afternoon", touristy: 2,
    note: "Kjarval painted Icelandic lava for fifty years until you can see faces in it. After the landscape days this makes more sense than before them." },

  { id: "rvk-settlement", cityId: "reykjavik", name: "The Settlement Exhibition", kind: "museum",
    tags: ["museum", "history"], neighborhood: "Aðalstræti", lat: 64.1470, lng: -21.9420,
    durationMin: 60, costUsd: 14, opens: "09:00", closes: "17:00", bestTime: "morning", touristy: 3,
    note: "A tenth-century longhouse found under the street, left where it was and built around. Small, and the right size for the subject." },

  { id: "rvk-kolaportid", cityId: "reykjavik", name: "Kolaportið flea market", kind: "market",
    tags: ["market", "local", "food"], neighborhood: "Old Harbour", lat: 64.1481, lng: -21.9390,
    durationMin: 60, costUsd: 6, opens: "11:00", closes: "17:00", closedDays: [1, 2, 3, 4, 5], bestTime: "midday", touristy: 2,
    note: "Weekends only, in a customs shed. Old books, wool, and a counter selling fermented shark to people who regret it." },

  { id: "rvk-whale", cityId: "reykjavik", name: "Whale watching from the old harbour", kind: "experience",
    tags: ["boat", "nature", "coast"], neighborhood: "Old Harbour", lat: 64.1508, lng: -21.9410,
    durationMin: 180, costUsd: 95, opens: "09:00", closes: "17:00", bestTime: "morning", touristy: 4,
    note: "Three hours, and genuinely might be three hours of grey water. Go if you want the sea; don't go expecting a guarantee." },

  { id: "rvk-nautholsvik", cityId: "reykjavik", name: "Nauthólsvík geothermal beach", kind: "outdoor",
    tags: ["beach", "spa", "coast", "local", "nature"], neighborhood: "Nauthólsvík", lat: 64.1230, lng: -21.9430,
    durationMin: 75, costUsd: 5, opens: "11:00", closes: "19:00", bestTime: "afternoon", touristy: 2,
    note: "Hot water piped into a corner of the North Atlantic, with a hot tub for when that stops being funny." },

  { id: "rvk-skylagoon", cityId: "reykjavik", name: "Sky Lagoon", kind: "experience",
    tags: ["spa", "coast", "nature"], neighborhood: "Kársnes", lat: 64.1200, lng: -21.9330,
    durationMin: 150, costUsd: 75, opens: "11:00", closes: "22:00", bestTime: "evening", touristy: 4,
    note: "The Blue Lagoon's better-sited cousin: infinity edge straight at the ocean, twenty minutes from town instead of fifty. Book the late slot." },

  { id: "rvk-bbp", cityId: "reykjavik", name: "Bæjarins Beztu hot dog", kind: "meal",
    tags: ["food", "local", "iconic"], neighborhood: "Tryggvagata", lat: 64.1478, lng: -21.9391,
    durationMin: 20, costUsd: 6, opens: "10:00", closes: "01:00", bestTime: "any", touristy: 4,
    note: "One with everything, standing up, in the rain. Costs four dollars in a country where nothing costs four dollars." },

  { id: "rvk-lunch", cityId: "reykjavik", name: "Lunch at Skál", kind: "meal",
    tags: ["food", "local", "contemporary"], neighborhood: "Hlemmur", lat: 64.1435, lng: -21.9150,
    durationMin: 75, costUsd: 28, opens: "11:30", closes: "22:00", bestTime: "midday", touristy: 2,
    note: "In the old bus terminal, now a food hall. Icelandic ingredients handled without ceremony." },

  { id: "rvk-dinner", cityId: "reykjavik", name: "Dinner at Matur og Drykkur", kind: "meal",
    tags: ["food", "local"], neighborhood: "Grandi", lat: 64.1540, lng: -21.9480,
    durationMin: 105, costUsd: 62, opens: "18:00", closes: "22:00", closedDays: [0, 1], bestTime: "evening", touristy: 2,
    note: "Old Icelandic cooking taken seriously rather than ironically. The cod head is better than it sounds and they know it." },

  { id: "rvk-seafood", cityId: "reykjavik", name: "Dinner at Messinn", kind: "meal",
    tags: ["food", "coast"], neighborhood: "Lækjargata", lat: 64.1465, lng: -21.9350,
    durationMin: 90, costUsd: 48, opens: "17:00", closes: "22:00", bestTime: "evening", touristy: 3,
    note: "Fish pan-fried in a skillet, brought to the table in the pan. Unfussy and reliably good, which is worth a lot here." },

  { id: "rvk-kaldi", cityId: "reykjavik", name: "Kaldi bar", kind: "drink",
    tags: ["nightlife", "local"], neighborhood: "Laugavegur", lat: 64.1441, lng: -21.9285,
    durationMin: 75, costUsd: 22, opens: "16:00", closes: "01:00", bestTime: "evening", touristy: 2,
    note: "Small, wooden, no music you have to shout over. Reykjavík's nights start late even by European standards — nothing happens here before eleven." },

  { id: "rvk-perlan", cityId: "reykjavik", name: "Perlan", kind: "museum",
    tags: ["museum", "viewpoint", "iconic"], neighborhood: "Öskjuhlíð", lat: 64.1290, lng: -21.9190,
    durationMin: 120, costUsd: 45, opens: "09:00", closes: "22:00", bestTime: "afternoon", touristy: 5,
    note: "Forty-five dollars for an ice cave built indoors and a planetarium about the aurora. You are going to see the real landscape this week. Skip it.", skip: true },

  // ---------------------------------------------------------- Golden Circle --
  { id: "gc-thingvellir", cityId: "goldencircle", name: "Þingvellir", kind: "outdoor",
    tags: ["nature", "history", "hike", "viewpoint"], neighborhood: "Þingvellir", lat: 64.2559, lng: -21.1300,
    durationMin: 105, costUsd: 8, bestTime: "morning", touristy: 4,
    note: "Walk the rift between two continental plates, on the ground where they held parliament from 930. Both facts are true and the place carries them lightly." },

  { id: "gc-geysir", cityId: "goldencircle", name: "Geysir", kind: "outdoor",
    tags: ["nature", "iconic"], neighborhood: "Haukadalur", lat: 64.3104, lng: -20.3024,
    durationMin: 45, costUsd: 0, bestTime: "midday", touristy: 5,
    note: "Strokkur goes off every six minutes or so. Watch it three times, get a photo of the blue dome just before it blows, and move on — there's nothing else here." },

  { id: "gc-gullfoss", cityId: "goldencircle", name: "Gullfoss", kind: "outdoor",
    tags: ["nature", "coast", "viewpoint"], neighborhood: "Gullfoss", lat: 64.3271, lng: -20.1199,
    durationMin: 60, costUsd: 0, bestTime: "midday", touristy: 5,
    note: "Take the lower path to where the spray hits you. From the upper car park it's a postcard; from down there it's genuinely frightening." },

  { id: "gc-fridheimar", cityId: "goldencircle", name: "Lunch at Friðheimar", kind: "meal",
    tags: ["food", "local"], neighborhood: "Reykholt", lat: 64.1650, lng: -20.4300,
    durationMin: 75, costUsd: 32, opens: "12:00", closes: "16:00", bestTime: "midday", touristy: 3,
    note: "Tomato soup eaten inside the greenhouse the tomatoes grow in, heated by the ground. Book — it fills at noon and there is nothing else nearby." },

  { id: "gc-secretlagoon", cityId: "goldencircle", name: "Secret Lagoon", kind: "experience",
    tags: ["spa", "nature", "local"], neighborhood: "Flúðir", lat: 64.1380, lng: -20.3090,
    durationMin: 105, costUsd: 30, opens: "10:00", closes: "20:00", bestTime: "afternoon", touristy: 3,
    note: "The oldest pool in the country, in a field, with a small geyser going off beside it. A third of the price of the famous one and the water is the same water." },

  { id: "gc-kerid", cityId: "goldencircle", name: "Kerið crater", kind: "outdoor",
    tags: ["nature", "viewpoint", "walk"], neighborhood: "Grímsnes", lat: 64.0410, lng: -20.8850,
    durationMin: 40, costUsd: 5, bestTime: "afternoon", touristy: 3,
    note: "A red crater with a green lake in it. Twenty minutes to walk the rim, which is exactly as long as it holds your attention." },

  // ------------------------------------------------------------ South Coast --
  { id: "sc-seljalandsfoss", cityId: "southcoast", name: "Seljalandsfoss", kind: "outdoor",
    tags: ["nature", "walk"], neighborhood: "Seljaland", lat: 63.6156, lng: -19.9886,
    durationMin: 50, costUsd: 6, bestTime: "morning", touristy: 4,
    note: "You can walk behind this one, and you will get soaked doing it. Waterproof layer, and keep walking north to Gljúfrabúi — most people don't." },

  { id: "sc-skogafoss", cityId: "southcoast", name: "Skógafoss", kind: "outdoor",
    tags: ["nature", "hike", "viewpoint"], neighborhood: "Skógar", lat: 63.5321, lng: -19.5114,
    durationMin: 60, costUsd: 0, bestTime: "morning", touristy: 4,
    note: "Stand at the bottom for the scale, then climb the stairs on the right. Twenty minutes up the trail past the top and the crowd is gone entirely." },

  { id: "sc-solheimajokull", cityId: "southcoast", name: "Sólheimajökull glacier walk", kind: "outdoor",
    tags: ["hike", "nature", "boat"], neighborhood: "Sólheimajökull", lat: 63.5300, lng: -19.3700,
    durationMin: 180, costUsd: 110, opens: "09:00", closes: "16:00", bestTime: "midday", touristy: 3,
    note: "Crampons, a guide, and three hours on ice that is visibly retreating year on year. The single most worthwhile expensive thing in the country." },

  { id: "sc-reynisfjara", cityId: "southcoast", name: "Reynisfjara black sand beach", kind: "outdoor",
    tags: ["beach", "coast", "nature"], neighborhood: "Vík", lat: 63.4030, lng: -19.0440,
    durationMin: 60, costUsd: 0, bestTime: "afternoon", touristy: 4,
    note: "Basalt columns, black sand, and sneaker waves that kill people most years. Stay well back from the water. That is not a figure of speech here." },

  { id: "sc-dyrholaey", cityId: "southcoast", name: "Dyrhólaey", kind: "outdoor",
    tags: ["viewpoint", "coast", "nature"], neighborhood: "Dyrhólaey", lat: 63.4020, lng: -19.1270,
    durationMin: 50, costUsd: 0, bestTime: "afternoon", touristy: 3,
    note: "A stone arch you look down on from a headland, with puffins nesting on it in summer. Windier than anywhere else on this list." },

  // ------------------------------------------------------------------- Vík --
  { id: "vik-canyon", cityId: "vik", name: "Fjaðrárgljúfur canyon", kind: "outdoor",
    tags: ["nature", "hike", "viewpoint"], neighborhood: "Kirkjubæjarklaustur", lat: 63.7714, lng: -18.1720,
    durationMin: 90, costUsd: 0, bestTime: "morning", touristy: 3,
    note: "A green mossy gorge with a path along the top edge. Boardwalked and easy, which is not true of much here." },

  { id: "vik-church", cityId: "vik", name: "Vík church and the cliff view", kind: "sight",
    tags: ["viewpoint", "walk", "coast"], neighborhood: "Vík", lat: 63.4200, lng: -19.0060,
    durationMin: 40, costUsd: 0, bestTime: "afternoon", touristy: 2,
    note: "Walk up to the red-roofed church above the village. Ten minutes, and the view back down over the black beach is the reason to stay the night here." },

  { id: "vik-dinner", cityId: "vik", name: "Dinner at Suður-Vík", kind: "meal",
    tags: ["food", "local"], neighborhood: "Vík", lat: 63.4180, lng: -19.0080,
    durationMin: 90, costUsd: 42, opens: "17:00", closes: "21:00", bestTime: "evening", touristy: 2,
    note: "One of about three options in town and comfortably the best. Lamb, and a room with a fire in it." },

  { id: "vik-aurora", cityId: "vik", name: "Northern lights, if the sky allows", kind: "experience",
    tags: ["nature", "viewpoint"], neighborhood: "Vík", lat: 63.4250, lng: -19.0200,
    durationMin: 90, costUsd: 0, opens: "21:00", closes: "23:30", bestTime: "evening", touristy: 2,
    note: "Not bookable and not promisable — September to March, clear sky, away from the village lights. Check the forecast at 9pm and go, or don't." },

  // ---------------------------------------------------------- Snæfellsnes --
  { id: "sn-kirkjufell", cityId: "snaefellsnes", name: "Kirkjufell", kind: "outdoor",
    tags: ["nature", "viewpoint", "iconic"], neighborhood: "Grundarfjörður", lat: 64.9270, lng: -23.3070,
    durationMin: 50, costUsd: 0, bestTime: "morning", touristy: 4,
    note: "The mountain from every Iceland photograph, with the waterfall people frame it through. Worth the stop; don't build the day around it." },

  { id: "sn-djupalonssandur", cityId: "snaefellsnes", name: "Djúpalónssandur", kind: "outdoor",
    tags: ["beach", "coast", "hike", "history"], neighborhood: "Snæfellsjökull", lat: 64.7530, lng: -23.9060,
    durationMin: 70, costUsd: 0, bestTime: "midday", touristy: 2,
    note: "Black pebble beach with the rusted ribs of a trawler still lying on it, left as a memorial. Four lifting stones on the path down that fishermen used as a job interview." },

  { id: "sn-arnarstapi", cityId: "snaefellsnes", name: "Arnarstapi cliff walk", kind: "outdoor",
    tags: ["hike", "coast", "nature", "viewpoint"], neighborhood: "Arnarstapi", lat: 64.7690, lng: -23.6200,
    durationMin: 90, costUsd: 0, bestTime: "afternoon", touristy: 2,
    note: "An hour along the cliff to Hellnar and back, past arches full of nesting birds. Flat, open, and almost nobody on it." },
];
