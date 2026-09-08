import type { Place } from "@/lib/types";

// Japan, Denmark and Catalonia brought up to depth. Same rule throughout.

export const JPN_DK_CAT_PLACES: Place[] = [
  // ----------------------------------------------------------------- Tokyo --
  { id: "tky-meiji", cityId: "tokyo", name: "Meiji Jingū at opening", kind: "sight",
    tags: ["history", "nature", "walk", "church"], neighborhood: "Harajuku", lat: 35.6764, lng: 139.6993,
    durationMin: 90, costUsd: 0, opens: "05:30", closes: "18:00", bestTime: "morning", touristy: 4,
    note: "A forest of a hundred thousand donated trees, planted in 1920 and now indistinguishable from wild. Go at opening and the gravel path is silent." },

  { id: "tky-tsukishima", cityId: "tokyo", name: "Monjayaki in Tsukishima", kind: "meal",
    tags: ["food", "local"], neighborhood: "Tsukishima", lat: 35.6640, lng: 139.7830,
    durationMin: 100, costUsd: 24, opens: "17:00", closes: "22:30", bestTime: "evening", touristy: 2,
    note: "A whole street of it, cooked on the griddle in front of you. It looks wrong and tastes excellent; that is the deal." },

  { id: "tky-kiyosumi", cityId: "tokyo", name: "Kiyosumi garden and the warehouses", kind: "outdoor",
    tags: ["garden", "walk", "contemporary", "coffee"], neighborhood: "Kiyosumi", lat: 35.6810, lng: 139.7970,
    durationMin: 120, costUsd: 2, opens: "09:00", closes: "17:00", bestTime: "morning", touristy: 2,
    note: "A stroll garden with stepping stones across the pond, and a neighborhood of converted warehouses around it holding the city's best roasters." },

  { id: "tky-mori", cityId: "tokyo", name: "Mori Art Museum", kind: "museum",
    tags: ["museum", "art", "contemporary", "viewpoint"], neighborhood: "Roppongi", lat: 35.6605, lng: 139.7292,
    durationMin: 120, costUsd: 20, opens: "10:00", closes: "22:00", bestTime: "evening", touristy: 3,
    note: "Fifty-three floors up, open until ten, and the ticket includes the observation deck. Contemporary shows that take real risks." },

  { id: "tky-koenji", cityId: "tokyo", name: "Kōenji second-hand streets", kind: "walk",
    tags: ["shopping", "walk", "local", "music"], neighborhood: "Kōenji", lat: 35.7050, lng: 139.6500,
    durationMin: 120, costUsd: 0, bestTime: "afternoon", touristy: 1,
    note: "Vintage shops, record stores and punk bars, in a neighborhood that has resisted redevelopment out of stubbornness." },

  { id: "tky-sumida", cityId: "tokyo", name: "Sumida river walk", kind: "walk",
    tags: ["walk", "coast", "local", "viewpoint"], neighborhood: "Asakusa", lat: 35.7100, lng: 139.8000,
    durationMin: 75, costUsd: 0, bestTime: "evening", touristy: 2,
    note: "From Asakusa down past the bridges as the light goes. Free, flat, and the city rearranges itself along the water." },

  { id: "tky-standing-bar", cityId: "tokyo", name: "Standing bar under the tracks", kind: "drink",
    tags: ["nightlife", "local", "food"], neighborhood: "Yūrakuchō", lat: 35.6750, lng: 139.7630,
    durationMin: 75, costUsd: 22, opens: "17:00", closes: "23:30", bestTime: "evening", touristy: 2,
    note: "Grilled skewers, beer, and a train going over your head every ninety seconds. Salarymen three deep by seven." },

  { id: "tky-sushi", cityId: "tokyo", name: "Counter sushi", kind: "meal",
    tags: ["food", "local"], neighborhood: "Ginza", lat: 35.6720, lng: 139.7650,
    durationMin: 105, costUsd: 95, opens: "17:30", closes: "22:00", closedDays: [0], bestTime: "evening", touristy: 3,
    note: "Ten seats, no menu, and it ends when the chef says so. The lunch service at the same counters is a third of the price and nearly as good." },

  { id: "tky-ramen", cityId: "tokyo", name: "Ramen queue worth joining", kind: "meal",
    tags: ["food", "local"], neighborhood: "Shinjuku", lat: 35.6900, lng: 139.7000,
    durationMin: 50, costUsd: 11, opens: "11:00", closes: "22:00", bestTime: "midday", touristy: 2,
    note: "Twenty minutes standing outside, eight minutes eating. That ratio is normal and nobody minds." },

  { id: "tky-onsen", cityId: "tokyo", name: "Neighborhood sentō", kind: "experience",
    tags: ["spa", "local"], neighborhood: "Kōenji", lat: 35.7020, lng: 139.6480,
    durationMin: 80, costUsd: 5, opens: "15:00", closes: "24:00", bestTime: "evening", touristy: 1,
    note: "Five dollars, a tiled mural, and old men who will tell you if you are doing it wrong. Wash thoroughly before you get in." },

  // ----------------------------------------------------------------- Kyoto --
  { id: "kyo-daitokuji", cityId: "kyoto", name: "Daitoku-ji sub-temples", kind: "sight",
    tags: ["garden", "history", "church", "art"], neighborhood: "Kita", lat: 35.0430, lng: 135.7460,
    durationMin: 135, costUsd: 12, opens: "09:00", closes: "16:30", bestTime: "morning", touristy: 2,
    note: "Two dozen walled temples, four of them open, each with a dry garden. Almost nobody comes here and it is better than the famous one." },

  { id: "kyo-arashiyama", cityId: "kyoto", name: "Arashiyama before eight", kind: "walk",
    tags: ["nature", "walk", "garden", "iconic", "earlystart"], neighborhood: "Arashiyama", lat: 35.0170, lng: 135.6710,
    durationMin: 150, costUsd: 6, bestTime: "morning", touristy: 5,
    note: "The bamboo grove is four minutes long and mobbed from nine. Get there at seven and walk on to Ōkōchi Sansō, which almost no one does." },

  { id: "kyo-nanzenji-aqueduct", cityId: "kyoto", name: "Nanzen-ji aqueduct", kind: "sight",
    tags: ["architecture", "history", "walk", "garden"], neighborhood: "Higashiyama", lat: 35.0110, lng: 135.7940,
    durationMin: 75, costUsd: 5, opens: "08:40", closes: "17:00", bestTime: "morning", touristy: 3,
    note: "A Meiji brick aqueduct running straight through a Zen temple complex, which nobody at the time thought was odd. Walk up on top of it." },

  { id: "kyo-pontocho", cityId: "kyoto", name: "Pontochō in the evening", kind: "walk",
    tags: ["walk", "nightlife", "local", "food"], neighborhood: "Nakagyō", lat: 35.0060, lng: 135.7710,
    durationMin: 75, costUsd: 0, bestTime: "evening", touristy: 4,
    note: "One lantern-lit alley the width of your shoulders, running along the river. Walk it, then eat on one of the terraces over the water in summer." },

  { id: "kyo-kaiseki", cityId: "kyoto", name: "Kaiseki dinner", kind: "meal",
    tags: ["food", "local", "art"], neighborhood: "Gion", lat: 35.0030, lng: 135.7750,
    durationMin: 150, costUsd: 110, opens: "17:30", closes: "21:00", closedDays: [3], bestTime: "evening", touristy: 3,
    note: "Eight or nine courses built around what is in season this fortnight, served in a room designed around the meal. Book weeks out; worth one night of the budget." },

  { id: "kyo-tofu", cityId: "kyoto", name: "Yudofu lunch", kind: "meal",
    tags: ["food", "local", "garden"], neighborhood: "Higashiyama", lat: 35.0120, lng: 135.7930,
    durationMin: 80, costUsd: 26, opens: "11:00", closes: "16:00", bestTime: "midday", touristy: 3,
    note: "Simmered tofu in a temple garden, which sounds austere and is genuinely one of the best lunches in the city." },

  { id: "kyo-kurama", cityId: "kyoto", name: "Kurama to Kibune", kind: "outdoor",
    tags: ["hike", "nature", "history"], neighborhood: "Kurama", lat: 35.1190, lng: 135.7700,
    durationMin: 210, costUsd: 8, bestTime: "morning", touristy: 2,
    note: "A two-hour walk over a wooded mountain between two shrines, on a train line out of the city. Cedar roots across the path the whole way." },

  { id: "kyo-teramachi", cityId: "kyoto", name: "Teramachi and the knife shops", kind: "walk",
    tags: ["shopping", "walk", "local", "art"], neighborhood: "Nakagyō", lat: 35.0080, lng: 135.7660,
    durationMin: 90, costUsd: 0, bestTime: "afternoon", touristy: 3,
    note: "Covered arcade with paper makers, tea merchants and two knife shops that will sharpen and engrave while you wait." },

  { id: "kyo-coffee", cityId: "kyoto", name: "Kissaten morning", kind: "meal",
    tags: ["coffee", "local", "food"], neighborhood: "Nakagyō", lat: 35.0070, lng: 135.7680,
    durationMin: 55, costUsd: 9, opens: "07:00", closes: "18:00", bestTime: "morning", touristy: 2,
    note: "Old-style coffee house: siphon brewing, thick toast, egg salad, and no wifi on purpose." },

  // ------------------------------------------------------------ Copenhagen --
  { id: "cph-rosenborg", cityId: "copenhagen", name: "Rosenborg and the King's Garden", kind: "sight",
    tags: ["history", "garden", "architecture"], neighborhood: "Centrum", lat: 55.6853, lng: 12.5773,
    durationMin: 105, costUsd: 19, opens: "10:00", closes: "16:00", bestTime: "morning", touristy: 3,
    note: "A Renaissance castle with the crown jewels in the basement, and the city's oldest park around it. Locals treat the garden as their lawn." },

  { id: "cph-glyptotek", cityId: "copenhagen", name: "Ny Carlsberg Glyptotek", kind: "museum",
    tags: ["museum", "art", "architecture", "garden"], neighborhood: "Centrum", lat: 55.6726, lng: 12.5720,
    durationMin: 120, costUsd: 18, opens: "10:00", closes: "18:00", closedDays: [1], bestTime: "afternoon", touristy: 3,
    note: "A brewer's collection: Roman portrait busts, Rodin, and a domed palm house in the middle you can sit in. The best rainy afternoon in the city." },

  { id: "cph-kayak", cityId: "copenhagen", name: "Kayak the canals", kind: "outdoor",
    tags: ["boat", "coast", "local", "nature"], neighborhood: "Christianshavn", lat: 55.6740, lng: 12.5920,
    durationMin: 120, costUsd: 32, opens: "09:00", closes: "19:00", bestTime: "afternoon", touristy: 2,
    note: "Rent it yourself rather than taking the tour boat. The water is clean enough to swim in and you go where the tour boats cannot." },

  { id: "cph-assistens", cityId: "copenhagen", name: "Assistens cemetery", kind: "outdoor",
    tags: ["garden", "walk", "local", "history"], neighborhood: "Nørrebro", lat: 55.6890, lng: 12.5510,
    durationMin: 75, costUsd: 0, bestTime: "afternoon", touristy: 1,
    note: "Kierkegaard and Hans Christian Andersen are here, and so is half of Nørrebro on a sunny day, sunbathing between the graves. Nobody finds this strange." },

  { id: "cph-bakery", cityId: "copenhagen", name: "Cardamom buns at Juno", kind: "meal",
    tags: ["coffee", "food", "local"], neighborhood: "Nørrebro", lat: 55.6880, lng: 12.5560,
    durationMin: 40, costUsd: 10, opens: "07:00", closes: "17:00", bestTime: "morning", touristy: 3,
    note: "Queue out the door by nine and worth it. Danish baking is a serious craft and this is where the argument gets settled." },

  { id: "cph-smorrebrod", cityId: "copenhagen", name: "Smørrebrød lunch", kind: "meal",
    tags: ["food", "local"], neighborhood: "Centrum", lat: 55.6800, lng: 12.5820,
    durationMin: 80, costUsd: 34, opens: "11:30", closes: "16:00", closedDays: [0], bestTime: "midday", touristy: 3,
    note: "Rye, butter, and one thing done properly on top. Order three, in the order they tell you, and drink the aquavit." },

  { id: "cph-jazz", cityId: "copenhagen", name: "Jazz at a basement club", kind: "experience",
    tags: ["music", "nightlife", "local"], neighborhood: "Centrum", lat: 55.6810, lng: 12.5760,
    durationMin: 120, costUsd: 26, opens: "19:00", closes: "01:00", bestTime: "evening", touristy: 2,
    note: "Copenhagen took in American jazz musicians for decades and the scene never went away. Small rooms, low ceilings, real players." },

  { id: "cph-refshale", cityId: "copenhagen", name: "Reffen and the shipyard", kind: "market",
    tags: ["market", "food", "contemporary", "coast"], neighborhood: "Refshaleøen", lat: 55.6930, lng: 12.6100,
    durationMin: 105, costUsd: 24, opens: "11:00", closes: "22:00", bestTime: "evening", touristy: 3,
    note: "Street food in shipping containers on an old industrial spit, with the sauna and a climbing wall next door. Bike out; the ride is half of it." },

  { id: "cph-arken", cityId: "copenhagen", name: "Cisternerne", kind: "museum",
    tags: ["art", "contemporary", "architecture"], neighborhood: "Frederiksberg", lat: 55.6690, lng: 12.5210,
    durationMin: 75, costUsd: 15, opens: "11:00", closes: "18:00", closedDays: [1], bestTime: "afternoon", touristy: 2,
    note: "An installation space in a disused underground reservoir, dripping and pitch dark between the lights. One artist a year, and it is never dull." },

  { id: "cph-frederiksberg", cityId: "copenhagen", name: "Frederiksberg Gardens", kind: "outdoor",
    tags: ["garden", "walk", "nature", "local"], neighborhood: "Frederiksberg", lat: 55.6740, lng: 12.5250,
    durationMin: 75, costUsd: 0, bestTime: "afternoon", touristy: 2,
    note: "Romantic landscaped park with canals and a palace on the hill, and elephants visible over the zoo wall from one path." },

  // ------------------------------------------------------------- Barcelona --
  { id: "bcn-sanpau", cityId: "barcelona", name: "Sant Pau modernista site", kind: "sight",
    tags: ["architecture", "history", "garden", "art"], neighborhood: "Guinardó", lat: 41.4130, lng: 2.1740,
    durationMin: 105, costUsd: 17, opens: "09:30", closes: "18:30", bestTime: "morning", touristy: 2,
    note: "A hospital built as twenty-seven pavilions in gardens, on the theory that beauty helps people recover. Better modernisme than the Gaudí queues and a tenth of the crowd." },

  { id: "bcn-palau", cityId: "barcelona", name: "Palau de la Música", kind: "sight",
    tags: ["architecture", "music", "art", "history"], neighborhood: "Sant Pere", lat: 41.3875, lng: 2.1750,
    durationMin: 75, costUsd: 22, opens: "10:00", closes: "15:30", bestTime: "morning", touristy: 4,
    note: "A concert hall lit entirely by daylight through a stained glass skylight. If anything is on that evening, go to that instead of the tour." },

  { id: "bcn-bunkers", cityId: "barcelona", name: "Bunkers del Carmel", kind: "outdoor",
    tags: ["viewpoint", "walk", "history", "local"], neighborhood: "El Carmel", lat: 41.4190, lng: 2.1620,
    durationMin: 90, costUsd: 0, bestTime: "evening", touristy: 3,
    note: "Civil war anti-aircraft emplacements on a hilltop, now the best free view in the city. Uphill walk, bring something to drink, go for sunset." },

  { id: "bcn-macba", cityId: "barcelona", name: "MACBA and El Raval", kind: "museum",
    tags: ["museum", "art", "contemporary", "walk"], neighborhood: "El Raval", lat: 41.3830, lng: 2.1670,
    durationMin: 120, costUsd: 12, opens: "11:00", closes: "19:30", closedDays: [2], bestTime: "afternoon", touristy: 3,
    note: "A white Meier box dropped into the roughest old quarter, with skaters permanently occupying the plaza. The neighborhood around it is the more interesting half." },

  { id: "bcn-poblenou", cityId: "barcelona", name: "Poblenou and the old factories", kind: "walk",
    tags: ["walk", "contemporary", "local", "coffee"], neighborhood: "Poblenou", lat: 41.4000, lng: 2.2000,
    durationMin: 105, costUsd: 0, bestTime: "afternoon", touristy: 1,
    note: "The industrial grid, half converted and half not, with a rambla of its own that tourists never reach." },

  { id: "bcn-tibidabo", cityId: "barcelona", name: "Tibidabo and the funicular", kind: "sight",
    tags: ["viewpoint", "history", "nature"], neighborhood: "Tibidabo", lat: 41.4220, lng: 2.1190,
    durationMin: 150, costUsd: 15, opens: "10:00", closes: "20:00", closedDays: [1, 2], bestTime: "afternoon", touristy: 3,
    note: "A 1901 funicular up to a church and an antique fairground on the summit. The whole city and the sea below, and the old rides still run." },

  { id: "bcn-vermuteria", cityId: "barcelona", name: "Bodega with barrels", kind: "drink",
    tags: ["wine", "local", "food"], neighborhood: "Sant Antoni", lat: 41.3790, lng: 2.1620,
    durationMin: 75, costUsd: 18, opens: "12:00", closes: "23:00", closedDays: [0], bestTime: "evening", touristy: 2,
    note: "Wine from the barrel into a refilled bottle, conserves opened on the counter, and a marble table if you are lucky. Cash." },

  { id: "bcn-sansebastia", cityId: "barcelona", name: "Barceloneta seafood lunch", kind: "meal",
    tags: ["food", "coast", "local"], neighborhood: "Barceloneta", lat: 41.3790, lng: 2.1910,
    durationMin: 105, costUsd: 42, opens: "13:00", closes: "16:00", closedDays: [1], bestTime: "midday", touristy: 3,
    note: "Rice, not paella, and cooked to order for two people minimum. Two hours, at the correct hour, which is two o'clock." },

  { id: "bcn-coffee", cityId: "barcelona", name: "Coffee in Gràcia", kind: "meal",
    tags: ["coffee", "local"], neighborhood: "Gràcia", lat: 41.4020, lng: 2.1570,
    durationMin: 40, costUsd: 6, opens: "08:00", closes: "18:00", bestTime: "morning", touristy: 2,
    note: "Sit in one of the squares with it. Gràcia was a separate town until 1897 and still behaves like one." },

  // ---------------------------------------------------------- Costa Brava --
  { id: "cb-calapath", cityId: "costabrava", name: "Camí de Ronda coast path", kind: "outdoor",
    tags: ["hike", "coast", "nature", "viewpoint"], neighborhood: "Begur", lat: 41.9540, lng: 3.2160,
    durationMin: 180, costUsd: 0, bestTime: "morning", touristy: 2,
    note: "A smugglers' path cut into the cliffs, linking cove after cove. Walk a section between two beaches and swim at each end." },

  { id: "cb-calas", cityId: "costabrava", name: "Swim at Sa Tuna", kind: "outdoor",
    tags: ["beach", "coast", "nature"], neighborhood: "Begur", lat: 41.9610, lng: 3.2280,
    durationMin: 150, costUsd: 0, bestTime: "midday", touristy: 2,
    note: "A pebble cove with about eight buildings on it and water you can see the bottom of at four metres." },

  { id: "cb-cadaques", cityId: "costabrava", name: "Cadaqués and the Dalí house", kind: "sight",
    tags: ["art", "walk", "coast", "history"], neighborhood: "Cadaqués", lat: 42.2880, lng: 3.2790,
    durationMin: 180, costUsd: 16, opens: "10:30", closes: "18:00", closedDays: [1], bestTime: "morning", touristy: 4,
    note: "White village round a bay, and Dalí's own house at Portlligat next door with the taxidermy still in it. Booked entry, small groups." },

  { id: "cb-lunch", cityId: "costabrava", name: "Lunch on the water", kind: "meal",
    tags: ["food", "coast", "local"], neighborhood: "Calella de Palafrugell", lat: 41.8880, lng: 3.1810,
    durationMin: 105, costUsd: 40, opens: "13:00", closes: "16:00", bestTime: "midday", touristy: 3,
    note: "Whatever came in this morning, grilled, at a table with your feet almost in the sea. Long lunch is the entire point of the day." },
];
