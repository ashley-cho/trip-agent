import type { Place } from "@/lib/types";

// Japan, Denmark and Catalonia brought up to depth. Same rule throughout.

export const JPN_DK_CAT_PLACES: Place[] = [
  // ----------------------------------------------------------------- Tokyo --
  { id: "tky-sensoji", cityId: "tokyo", name: "Sensō-ji at seven", kind: "sight",
    tags: ["history", "church", "iconic", "earlystart"], neighborhood: "Asakusa", lat: 35.7147, lng: 139.7968,
    durationMin: 75, costUsd: 0, bestTime: "morning", touristy: 5,
    note: "The oldest temple in the city, founded in 645, and thirty million people a year come through it. The 250 metres of Nakamise-dōri in front are shut and empty before eight, which is the only hour this is a temple rather than a queue." },

  { id: "tky-tnm", cityId: "tokyo", name: "Tokyo National Museum", kind: "museum",
    tags: ["museum", "history", "art"], neighborhood: "Ueno", lat: 35.7189, lng: 139.7764,
    durationMin: 150, costUsd: 7, opens: "09:30", closes: "17:00", closedDays: [1], bestTime: "afternoon", touristy: 3,
    note: "A hundred and twenty thousand objects, 89 of them National Treasures. Do the Honkan and nothing else on a first visit: it is Japanese art in one building, in order, and it takes two hours to walk a thousand years." },

  { id: "tky-hamarikyu", cityId: "tokyo", name: "Hama-rikyū Gardens", kind: "outdoor",
    tags: ["garden", "walk", "coast", "history"], neighborhood: "Shiodome", lat: 35.6600, lng: 139.7620,
    durationMin: 75, costUsd: 3, bestTime: "afternoon", touristy: 2,
    note: "A shogun's duck-hunting grounds at the mouth of the Sumida, with a pond that fills and empties with the tide off Tokyo Bay. The teahouse in the middle of it does matcha, and the office towers stand right behind the pines." },

  { id: "tky-ueno", cityId: "tokyo", name: "Ueno Park", kind: "outdoor",
    tags: ["garden", "walk", "local", "museum"], neighborhood: "Ueno", lat: 35.7122, lng: 139.7711,
    durationMin: 90, costUsd: 0, bestTime: "morning", touristy: 3,
    note: "Fifty-three hectares with eight thousand trees, five museums and a lotus pond, and about twelve hundred cherries that make it unusable for two weeks a year. The five-storey pagoda from 1639 is the thing most people walk past." },

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
  { id: "kyo-kiyomizu", cityId: "kyoto", name: "Kiyomizu-dera", kind: "sight",
    tags: ["history", "architecture", "viewpoint", "church"], neighborhood: "Higashiyama", lat: 34.9950, lng: 135.7850,
    durationMin: 90, costUsd: 4, bestTime: "morning", touristy: 5,
    note: "The hall from 1633 stands on a lattice of pillars off the hillside with no nails anywhere in it. Under it three channels of the Otowa spring drop into a pond and people queue with cups. Go at opening or accept the crowd." },

  { id: "kyo-ryoanji", cityId: "kyoto", name: "Ryōan-ji rock garden", kind: "sight",
    tags: ["garden", "history", "architecture"], neighborhood: "Ukyō", lat: 35.0344, lng: 135.7183,
    durationMin: 60, costUsd: 5, bestTime: "morning", touristy: 4,
    note: "Fifteen stones in five groups on raked gravel, and from the veranda you can never see more than fourteen at once. Sit down for twenty minutes; walking past it takes ninety seconds and tells you nothing." },

  { id: "kyo-kinkakuji", cityId: "kyoto", name: "Kinkaku-ji", kind: "sight",
    tags: ["history", "architecture", "garden", "iconic"], neighborhood: "Kita", lat: 35.0395, lng: 135.7285,
    durationMin: 60, costUsd: 4, bestTime: "morning", touristy: 5,
    note: "A novice monk burned the original down in 1950; what stands is a 1955 copy, re-leafed in 1986 with twenty kilos of gold five times thicker than before. It is a one-way path round a pond, and it is worth the twenty minutes it takes." },

  { id: "kyo-tofukuji", cityId: "kyoto", name: "Tōfuku-ji gardens", kind: "sight",
    tags: ["garden", "history", "nature"], neighborhood: "Higashiyama", lat: 34.9771, lng: 135.7741,
    durationMin: 90, costUsd: 7, bestTime: "afternoon", touristy: 3,
    note: "One of the five great Zen temples, founded 1236, and the gardens round the abbot's hall were rebuilt by Mirei Shigemori in 1939 — chequerboard moss and stone, and clearly of their century. In November the maples under the Tsūten-kyō bridge make it unbearable; any other month it is quiet." },

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
  { id: "cph-vorfrelser", cityId: "copenhagen", name: "Church of Our Saviour spire", kind: "sight",
    tags: ["church", "viewpoint", "architecture"], neighborhood: "Christianshavn", lat: 55.6728, lng: 12.5939,
    durationMin: 60, costUsd: 12, opens: "11:00", closes: "15:30", bestTime: "afternoon", touristy: 3,
    note: "Four hundred steps to the top, the last 150 of them on an external staircase that spirals anticlockwise round the outside of the spire and narrows as it goes. If that sentence bothers you, this is not for you." },

  { id: "cph-smk", cityId: "copenhagen", name: "SMK, the national gallery", kind: "museum",
    tags: ["museum", "art", "contemporary"], neighborhood: "Sølvgade", lat: 55.6889, lng: 12.5786,
    durationMin: 120, costUsd: 20, opens: "10:00", closes: "18:00", closedDays: [1], bestTime: "afternoon", touristy: 2,
    note: "Nine thousand paintings, from Mantegna and Rembrandt through to the Danish Golden Age and a good modern French room. The Danish nineteenth century is the part you cannot see properly anywhere else." },

  { id: "cph-nationalmuseet", cityId: "copenhagen", name: "The National Museum", kind: "museum",
    tags: ["museum", "history"], neighborhood: "Centrum", lat: 55.6747, lng: 12.5747,
    durationMin: 120, costUsd: 22, opens: "10:00", closes: "17:00", bestTime: "morning", touristy: 3,
    note: "Fourteen thousand years of it, and the prehistory rooms are the reason: the Sun Chariot, the Gundestrup cauldron, and a bronze age girl still in her oak coffin. Do those and leave the rest." },

  { id: "cph-tivoli", cityId: "copenhagen", name: "Tivoli after dark", kind: "experience",
    tags: ["garden", "nightlife", "iconic", "music"], neighborhood: "Vesterbrogade", lat: 55.6736, lng: 12.5683,
    durationMin: 150, costUsd: 25, bestTime: "evening", touristy: 5,
    note: "Open since 1843 and the second-oldest working amusement park there is, which is a different proposition from a modern one — gardens and lights and a bandstand, with the rides incidental. Go when it is dark or don't bother." },

  { id: "cph-kastellet", cityId: "copenhagen", name: "Kastellet ramparts", kind: "outdoor",
    tags: ["walk", "history", "garden", "local"], neighborhood: "Østerbro", lat: 55.6911, lng: 12.5939,
    durationMin: 60, costUsd: 0, bestTime: "morning", touristy: 2,
    note: "A five-pointed star fort finished in 1664, still an army site and still a public park, which is very Danish. The lap of the grass ramparts is about twenty minutes and half the city runs it." },

  { id: "cph-grundtvig", cityId: "copenhagen", name: "Grundtvig's Church", kind: "sight",
    tags: ["church", "architecture"], neighborhood: "Bispebjerg", lat: 55.7166, lng: 12.5336,
    durationMin: 45, costUsd: 0, bestTime: "morning", touristy: 1,
    note: "Jensen-Klint took a Gothic west front and built it out of nothing but yellow brick, and the housing around it is the same brick again. Twenty minutes out of the centre and almost nobody goes." },

  { id: "cph-amalienborg", cityId: "copenhagen", name: "Amalienborg at noon", kind: "sight",
    tags: ["history", "architecture"], neighborhood: "Frederiksstaden", lat: 55.6840, lng: 12.5933,
    durationMin: 50, costUsd: 0, bestTime: "midday", touristy: 4,
    note: "Four identical palaces round an octagonal square, which is the whole architectural idea. The guard marches down from Rosenborg at 11.30 and changes at twelve; stand on the far side and you will see it without being in it." },

  { id: "cph-botanisk", cityId: "copenhagen", name: "Botanical Garden glasshouses", kind: "outdoor",
    tags: ["garden", "walk", "nature"], neighborhood: "Nørreport", lat: 55.6869, lng: 12.5739,
    durationMin: 70, costUsd: 0, opens: "08:30", closes: "18:00", bestTime: "midday", touristy: 2,
    note: "Ten hectares, free to walk, and a 3,000-square-metre conservatory from 1874 in the middle. There is a cast-iron spiral stair up the 16-metre palm house to a walkway at the top, and a palm underneath it planted in 1824." },

  { id: "cph-christiania", cityId: "copenhagen", name: "Christiania", kind: "walk",
    tags: ["walk", "local", "history", "contemporary"], neighborhood: "Christianshavn", lat: 55.6736, lng: 12.5997,
    durationMin: 75, costUsd: 0, bestTime: "afternoon", touristy: 4,
    note: "Declared a free town in some abandoned barracks in 1971 and still about a thousand people running their own affairs, though they bought the land in 2012 and ordinary Danish law has applied since 2013. Pusher Street was dug up by the residents themselves in 2024." },

  { id: "cph-nyhavn", cityId: "copenhagen", name: "Nyhavn", kind: "walk",
    tags: ["walk", "coast", "iconic"], neighborhood: "Nyhavn", lat: 55.6797, lng: 12.5906,
    durationMin: 40, costUsd: 0, bestTime: "afternoon", touristy: 5,
    note: "Four hundred and fifty metres of painted merchant houses that stopped being a working harbour in the 1960s. Andersen lived at number 67 for nineteen years. Walk the length of it on the way somewhere and do not eat here.", skip: true },

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
