import type { Place } from "@/lib/types";

// Every `note` here is written by hand. Nothing in this file is generated —
// that is the whole point of section 12 of the spec.

export const PORTUGAL_PLACES: Place[] = [
  // ---------------------------------------------------------------- Lisbon --
  { id: "lis-coffee", cityId: "lisbon", name: "Coffee at Fábrica", kind: "meal",
    tags: ["coffee"], neighborhood: "Baixa", lat: 38.7180, lng: -9.1408,
    durationMin: 40, costUsd: 6, opens: "08:00", closes: "19:00", bestTime: "morning", touristy: 2,
    note: "Actual filter coffee, which is harder to find in Lisbon than you'd expect. Sit outside." },

  { id: "lis-nata", cityId: "lisbon", name: "Pastéis de nata at Manteigaria", kind: "meal",
    tags: ["food", "local"], neighborhood: "Chiado", lat: 38.7104, lng: -9.1428,
    durationMin: 20, costUsd: 3, opens: "08:00", closes: "23:00", bestTime: "any", touristy: 3,
    note: "A new tray comes out every twenty minutes. Better than the famous Belém ones, and no queue around the block." },

  { id: "lis-alfama", cityId: "lisbon", name: "Wander Alfama", kind: "walk",
    tags: ["walk", "history", "local"], neighborhood: "Alfama", lat: 38.7118, lng: -9.1300,
    durationMin: 90, costUsd: 0, bestTime: "morning", touristy: 3,
    note: "No fixed route. Head uphill toward the castle and let the streets take you sideways. This is a neighborhood to leave deliberately unscheduled." },

  { id: "lis-castelo", cityId: "lisbon", name: "São Jorge Castle", kind: "sight",
    tags: ["castle", "history", "viewpoint"], neighborhood: "Alfama", lat: 38.7139, lng: -9.1335,
    durationMin: 75, costUsd: 17, opens: "09:00", closes: "21:00", bestTime: "morning", touristy: 4,
    note: "Worth it for the walls and the view down over the rooftops. The interior is thin — an hour covers it." },

  { id: "lis-graca", cityId: "lisbon", name: "Miradouro da Senhora do Monte", kind: "sight",
    tags: ["viewpoint"], neighborhood: "Graça", lat: 38.7181, lng: -9.1315,
    durationMin: 30, costUsd: 0, bestTime: "evening", touristy: 2,
    note: "The highest viewpoint in the city and the least crowded. Go an hour before sunset, not at midday." },

  { id: "lis-gulbenkian", cityId: "lisbon", name: "Gulbenkian Museum", kind: "museum",
    tags: ["museum", "art", "garden"], neighborhood: "Avenidas Novas", lat: 38.7376, lng: -9.1537,
    durationMin: 120, costUsd: 14, opens: "10:00", closes: "18:00", closedDays: [2], bestTime: "morning", touristy: 3,
    note: "One man's taste across four thousand years, and a garden to sit in afterward. The best museum in the city and rarely busy." },

  { id: "lis-azulejo", cityId: "lisbon", name: "National Tile Museum", kind: "museum",
    tags: ["museum", "art", "history"], neighborhood: "Beato", lat: 38.7250, lng: -9.1130,
    durationMin: 90, costUsd: 9, opens: "10:00", closes: "18:00", closedDays: [1], bestTime: "morning", touristy: 2,
    note: "Five centuries of tile inside a former convent. Explains most of what you've been walking past all week." },

  { id: "lis-maat", cityId: "lisbon", name: "MAAT", kind: "museum",
    tags: ["museum", "contemporary", "architecture"], neighborhood: "Belém", lat: 38.6957, lng: -9.1936,
    durationMin: 90, costUsd: 12, opens: "11:00", closes: "19:00", closedDays: [2], bestTime: "afternoon", touristy: 3,
    note: "Walk over the roof even if the show inside doesn't grab you. It sits right on the river." },

  { id: "lis-jeronimos", cityId: "lisbon", name: "Jerónimos Monastery", kind: "sight",
    tags: ["church", "history", "architecture", "iconic"], neighborhood: "Belém", lat: 38.6979, lng: -9.2065,
    durationMin: 75, costUsd: 13, opens: "10:00", closes: "17:30", closedDays: [1], bestTime: "morning", touristy: 5,
    note: "The cloister is the reason to go, and it earns the crowd. Buy the ticket ahead or you'll spend an hour in line." },

  { id: "lis-belem-tower", cityId: "lisbon", name: "Belém Tower", kind: "sight",
    tags: ["iconic", "history", "coast"], neighborhood: "Belém", lat: 38.6916, lng: -9.2160,
    durationMin: 60, costUsd: 8, opens: "10:00", closes: "17:30", closedDays: [1], bestTime: "afternoon", touristy: 5,
    note: "Small inside, and you'll queue forty minutes to climb a spiral staircase behind other people. Look at it from the lawn and keep walking.", skip: true },

  { id: "lis-tram28", cityId: "lisbon", name: "Tram 28", kind: "experience",
    tags: ["iconic"], neighborhood: "Baixa", lat: 38.7139, lng: -9.1300,
    durationMin: 60, costUsd: 4, bestTime: "any", touristy: 5,
    note: "A pretty route and a pickpocket's office with ninety people standing in it. Walk the same hills instead.", skip: true },

  { id: "lis-principe", cityId: "lisbon", name: "Príncipe Real", kind: "walk",
    tags: ["walk", "garden", "shopping", "local"], neighborhood: "Príncipe Real", lat: 38.7168, lng: -9.1520,
    durationMin: 60, costUsd: 0, bestTime: "afternoon", touristy: 2,
    note: "Independent shops around a garden with one enormous cypress in the middle. Slow, and pleasantly unbothered." },

  { id: "lis-lx", cityId: "lisbon", name: "LX Factory", kind: "walk",
    tags: ["contemporary", "shopping", "walk"], neighborhood: "Alcântara", lat: 38.7036, lng: -9.1786,
    durationMin: 90, costUsd: 0, bestTime: "afternoon", touristy: 3,
    note: "Old industrial block turned over to bookshops and small studios. Half an hour if it isn't your thing, half a day if it is." },

  { id: "lis-ribeira", cityId: "lisbon", name: "Ribeira das Naus", kind: "walk",
    tags: ["walk", "coast"], neighborhood: "Cais do Sodré", lat: 38.7069, lng: -9.1420,
    durationMin: 45, costUsd: 0, bestTime: "afternoon", touristy: 2,
    note: "Concrete steps down to the water where the city sits and does nothing. Bring a beer from the kiosk." },

  { id: "lis-feira", cityId: "lisbon", name: "Feira da Ladra", kind: "market",
    tags: ["market", "local"], neighborhood: "Graça", lat: 38.7155, lng: -9.1257,
    durationMin: 60, costUsd: 0, opens: "09:00", closes: "18:00", closedDays: [0, 1, 3, 4, 5], bestTime: "morning", touristy: 2,
    note: "Flea market, Tuesdays and Saturdays only. Mostly junk, occasionally not." },

  { id: "lis-campo", cityId: "lisbon", name: "Mercado de Campo de Ourique", kind: "market",
    tags: ["market", "food", "local"], neighborhood: "Campo de Ourique", lat: 38.7156, lng: -9.1663,
    durationMin: 75, costUsd: 18, opens: "10:00", closes: "23:00", bestTime: "midday", touristy: 2,
    note: "The food hall locals actually use. Same idea as Time Out, half the crowd, better prices." },

  { id: "lis-timeout", cityId: "lisbon", name: "Time Out Market", kind: "market",
    tags: ["market", "food"], neighborhood: "Cais do Sodré", lat: 38.7071, lng: -9.1459,
    durationMin: 75, costUsd: 24, opens: "10:00", closes: "24:00", bestTime: "midday", touristy: 5,
    note: "Good stalls, impossible crowd. Fine at 11:30, grim at 1pm.", skip: true },

  { id: "lis-taberna", cityId: "lisbon", name: "Dinner at Taberna da Rua das Flores", kind: "meal",
    tags: ["food", "local"], neighborhood: "Chiado", lat: 38.7096, lng: -9.1424,
    durationMin: 90, costUsd: 34, opens: "12:00", closes: "23:00", closedDays: [0], bestTime: "evening", touristy: 2,
    note: "Twenty seats, no reservations, a chalkboard that changes daily. Turn up when it opens or plan to wait." },

  { id: "lis-ramiro", cityId: "lisbon", name: "Dinner at Cervejaria Ramiro", kind: "meal",
    tags: ["food"], neighborhood: "Intendente", lat: 38.7220, lng: -9.1350,
    durationMin: 90, costUsd: 45, opens: "12:00", closes: "24:00", closedDays: [1], bestTime: "evening", touristy: 4,
    note: "Shellfish, paper tablecloths, no ceremony at all. Garlic prawns, then the steak sandwich to finish. That's the order." },

  { id: "lis-prado", cityId: "lisbon", name: "Dinner at Prado", kind: "meal",
    tags: ["food", "wine", "contemporary", "local"], neighborhood: "Baixa", lat: 38.7113, lng: -9.1352,
    durationMin: 100, costUsd: 42, opens: "12:30", closes: "23:00", closedDays: [1, 2], bestTime: "evening", touristy: 2,
    note: "Small producers, short menu, a wine list that takes risks. The most interesting cooking in the city at this price." },

  { id: "lis-bythewine", cityId: "lisbon", name: "By the Wine", kind: "drink",
    tags: ["wine"], neighborhood: "Chiado", lat: 38.7086, lng: -9.1436,
    durationMin: 75, costUsd: 28, opens: "12:00", closes: "24:00", bestTime: "evening", touristy: 3,
    note: "Vaulted ceiling lined with bottles. A good room to work out what you actually like before you buy any." },

  { id: "lis-parkbar", cityId: "lisbon", name: "Park", kind: "drink",
    tags: ["viewpoint", "nightlife", "wine"], neighborhood: "Bairro Alto", lat: 38.7108, lng: -9.1470,
    durationMin: 75, costUsd: 18, opens: "13:00", closes: "02:00", closedDays: [1], bestTime: "evening", touristy: 3,
    note: "On the top floor of a multi-storey car park, facing west. Exactly as good as that sounds." },

  { id: "lis-fado", cityId: "lisbon", name: "Fado at Tasca do Chico", kind: "experience",
    tags: ["music", "local", "nightlife"], neighborhood: "Bairro Alto", lat: 38.7128, lng: -9.1445,
    durationMin: 90, costUsd: 25, opens: "19:00", closes: "02:00", bestTime: "evening", touristy: 2,
    note: "Fado in a room the size of a living room. No cover, no set list, no dinner theatre. Get there early and expect to stand." },

  // ---------------------------------------------------------------- Sintra --
  { id: "sin-regaleira", cityId: "sintra", name: "Quinta da Regaleira", kind: "sight",
    tags: ["history", "garden", "architecture"], neighborhood: "Sintra", lat: 38.7965, lng: -9.3963,
    durationMin: 120, costUsd: 18, opens: "09:30", closes: "18:00", bestTime: "morning", touristy: 4,
    note: "Gardens built by a rich man with an interest in the occult. Everyone photographs the initiation well; the woods above it are the better part." },

  { id: "sin-pena", cityId: "sintra", name: "Pena Palace", kind: "sight",
    tags: ["castle", "iconic", "history"], neighborhood: "Sintra", lat: 38.7876, lng: -9.3904,
    durationMin: 120, costUsd: 22, opens: "09:30", closes: "18:30", bestTime: "morning", touristy: 5,
    note: "Very photogenic, very crowded. Be at the gate when it opens or skip it entirely — there's no good middle option." },

  { id: "sin-moorish", cityId: "sintra", name: "Moorish Castle", kind: "sight",
    tags: ["castle", "history", "viewpoint", "hike"], neighborhood: "Sintra", lat: 38.7920, lng: -9.3890,
    durationMin: 90, costUsd: 12, opens: "09:30", closes: "18:00", bestTime: "morning", touristy: 3,
    note: "Ruined walls along a ridge, which you walk. Quieter than Pena and the view is the same view." },

  { id: "sin-lunch", cityId: "sintra", name: "Lunch at Incomum", kind: "meal",
    tags: ["food", "local"], neighborhood: "Sintra", lat: 38.7960, lng: -9.3900,
    durationMin: 90, costUsd: 28, opens: "12:00", closes: "22:00", bestTime: "midday", touristy: 3,
    note: "Where you eat in Sintra without eating a tourist menu. Book, or come at noon." },

  { id: "sin-ursa", cityId: "sintra", name: "Praia da Ursa cliff walk", kind: "outdoor",
    tags: ["hike", "coast", "nature"], neighborhood: "Sintra coast", lat: 38.7900, lng: -9.4870,
    durationMin: 120, costUsd: 0, bestTime: "afternoon", touristy: 1,
    note: "A steep unmarked path down to a beach almost no day-tripper finds. Real shoes, and don't do it in the wet." },

  { id: "sin-cabo", cityId: "sintra", name: "Cabo da Roca", kind: "outdoor",
    tags: ["coast", "nature", "viewpoint"], neighborhood: "Sintra coast", lat: 38.7803, lng: -9.4989,
    durationMin: 60, costUsd: 0, bestTime: "afternoon", touristy: 3,
    note: "The westernmost point of mainland Europe, which is a fact rather than an experience. Go for the cliffs and the wind." },

  { id: "sin-azenhas", cityId: "sintra", name: "Azenhas do Mar", kind: "outdoor",
    tags: ["coast", "nature", "viewpoint"], neighborhood: "Sintra coast", lat: 38.8080, lng: -9.4600,
    durationMin: 60, costUsd: 0, bestTime: "afternoon", touristy: 2,
    note: "A white village stacked down a cliff over a tidal pool. Twenty minutes of looking, then a drink above it." },

  // ----------------------------------------------------------------- Porto --
  { id: "por-coffee", cityId: "porto", name: "Coffee at Combi", kind: "meal",
    tags: ["coffee"], neighborhood: "Cedofeita", lat: 41.1480, lng: -8.6150,
    durationMin: 40, costUsd: 5, opens: "08:30", closes: "18:00", bestTime: "morning", touristy: 2,
    note: "Small, good, and full of people working. Start here." },

  { id: "por-ribeira", cityId: "porto", name: "Ribeira riverfront", kind: "walk",
    tags: ["walk", "coast", "history"], neighborhood: "Ribeira", lat: 41.1407, lng: -8.6130,
    durationMin: 60, costUsd: 0, bestTime: "morning", touristy: 4,
    note: "Touristy at the waterline, immediately less so one street up the hill. Go up the hill." },

  { id: "por-bridge", cityId: "porto", name: "Cross the Luís I bridge", kind: "walk",
    tags: ["walk", "architecture", "viewpoint"], neighborhood: "Ribeira", lat: 41.1400, lng: -8.6094,
    durationMin: 30, costUsd: 0, bestTime: "any", touristy: 4,
    note: "Take the upper deck. It's a Eiffel-school iron bridge and the walk across it is the best free thing in the city." },

  { id: "por-jardim", cityId: "porto", name: "Jardim do Morro at sunset", kind: "sight",
    tags: ["viewpoint", "garden"], neighborhood: "Gaia", lat: 41.1380, lng: -8.6090,
    durationMin: 45, costUsd: 0, bestTime: "evening", touristy: 3,
    note: "Across the bridge, facing back at the city. Everyone sits on the grass with a beer. Join them." },

  { id: "por-serralves", cityId: "porto", name: "Serralves Museum & Park", kind: "museum",
    tags: ["museum", "contemporary", "art", "garden"], neighborhood: "Serralves", lat: 41.1596, lng: -8.6593,
    durationMin: 150, costUsd: 25, opens: "10:00", closes: "19:00", bestTime: "morning", touristy: 3,
    note: "Contemporary art in a pink art-deco villa with thirty acres of park behind it. Give the grounds as much time as the galleries." },

  { id: "por-lello", cityId: "porto", name: "Livraria Lello", kind: "sight",
    tags: ["shopping", "iconic"], neighborhood: "Baixa", lat: 41.1470, lng: -8.6148,
    durationMin: 45, costUsd: 10, opens: "09:30", closes: "19:00", bestTime: "any", touristy: 5,
    note: "A beautiful staircase with a ticketed queue and a hundred phones pointed at it. I wouldn't.", skip: true },

  { id: "por-clerigos", cityId: "porto", name: "Clérigos Tower", kind: "sight",
    tags: ["viewpoint", "church", "history"], neighborhood: "Baixa", lat: 41.1456, lng: -8.6146,
    durationMin: 45, costUsd: 10, opens: "09:00", closes: "19:00", bestTime: "afternoon", touristy: 4,
    note: "225 steps for the best straight-down view of the old town. Quick, and worth the ten euros." },

  { id: "por-bolhao", cityId: "porto", name: "Mercado do Bolhão", kind: "market",
    tags: ["market", "food", "local"], neighborhood: "Baixa", lat: 41.1490, lng: -8.6070,
    durationMin: 60, costUsd: 12, opens: "08:00", closes: "20:00", closedDays: [0], bestTime: "morning", touristy: 3,
    note: "Recently restored, which cost it some grit but not its purpose. Buy cheese and bread for later." },

  { id: "por-gaia", cityId: "porto", name: "Port tasting at Taylor's", kind: "experience",
    tags: ["wine", "food"], neighborhood: "Gaia", lat: 41.1370, lng: -8.6110,
    durationMin: 90, costUsd: 32, opens: "10:00", closes: "18:00", bestTime: "afternoon", touristy: 3,
    note: "The best cellars and the least theatre of the big lodges. The aged tawnies are the point, not the vintage." },

  { id: "por-prova", cityId: "porto", name: "Prova wine bar", kind: "drink",
    tags: ["wine", "local"], neighborhood: "Vitória", lat: 41.1450, lng: -8.6160,
    durationMin: 75, costUsd: 26, opens: "17:00", closes: "24:00", closedDays: [0], bestTime: "evening", touristy: 2,
    note: "One man, a short list, no interest in upselling you. Tell him what you liked at the lodge and let him take it from there." },

  { id: "por-capela", cityId: "porto", name: "Capela Incomum", kind: "drink",
    tags: ["wine"], neighborhood: "Cedofeita", lat: 41.1520, lng: -8.6180,
    durationMin: 75, costUsd: 24, opens: "18:00", closes: "24:00", closedDays: [0], bestTime: "evening", touristy: 2,
    note: "A wine bar in a deconsecrated chapel. Quiet, dim, and unhurried." },

  { id: "por-foz", cityId: "porto", name: "Foz do Douro coast walk", kind: "walk",
    tags: ["walk", "coast", "nature"], neighborhood: "Foz", lat: 41.1500, lng: -8.6800,
    durationMin: 90, costUsd: 3, bestTime: "afternoon", touristy: 2,
    note: "Tram 1 out along the river, then walk back along the Atlantic. The best hour in Porto and it costs almost nothing." },

  { id: "por-matosinhos", cityId: "porto", name: "Grilled fish in Matosinhos", kind: "meal",
    tags: ["food", "local", "coast"], neighborhood: "Matosinhos", lat: 41.1830, lng: -8.7000,
    durationMin: 90, costUsd: 30, opens: "12:00", closes: "16:00", bestTime: "midday", touristy: 2,
    note: "The fish market is here, so this is where the fish is. Order whatever's whole and on ice, grilled outside on the street." },

  { id: "por-cantina", cityId: "porto", name: "Dinner at Cantina 32", kind: "meal",
    tags: ["food", "local", "contemporary"], neighborhood: "Baixa", lat: 41.1460, lng: -8.6130,
    durationMin: 90, costUsd: 30, opens: "12:30", closes: "23:00", closedDays: [0], bestTime: "evening", touristy: 2,
    note: "Unfussy, consistently good, and they'll pour you something interesting by the glass." },

  { id: "por-majestic", cityId: "porto", name: "Café Majestic", kind: "meal",
    tags: ["coffee", "iconic"], neighborhood: "Baixa", lat: 41.1470, lng: -8.6060,
    durationMin: 45, costUsd: 14, opens: "09:00", closes: "23:00", closedDays: [0], bestTime: "morning", touristy: 5,
    note: "Lovely room, ordinary coffee, twenty-minute queue to pay four times the price. Look through the door and walk on.", skip: true },

  { id: "por-musica", cityId: "porto", name: "Casa da Música", kind: "experience",
    tags: ["music", "architecture", "contemporary"], neighborhood: "Boavista", lat: 41.1585, lng: -8.6310,
    durationMin: 90, costUsd: 22, opens: "10:00", closes: "23:00", bestTime: "evening", touristy: 3,
    note: "Koolhaas building, genuinely good acoustics, and a programme far broader than classical. Check what's on before you commit." },

  // ------------------------------------------------------------ Douro Valley --
  { id: "dou-train", cityId: "douro", name: "Douro line train to Pinhão", kind: "experience",
    tags: ["nature", "coast"], neighborhood: "Douro", lat: 41.1900, lng: -7.5400,
    durationMin: 120, costUsd: 32, bestTime: "morning", touristy: 2,
    note: "The last hour runs along the water through terraced vineyards. Sit on the right going out." },

  { id: "dou-quinta", cityId: "douro", name: "Quinta tasting and lunch", kind: "experience",
    tags: ["wine", "food", "nature"], neighborhood: "Douro", lat: 41.1850, lng: -7.5500,
    durationMin: 180, costUsd: 65, opens: "10:00", closes: "18:00", bestTime: "midday", touristy: 2,
    note: "Lunch on a terrace above the river with the wine made fifty metres away. This is the day, not a stop in it." },

  { id: "dou-boat", cityId: "douro", name: "Rabelo boat on the Douro", kind: "experience",
    tags: ["boat", "nature"], neighborhood: "Douro", lat: 41.1900, lng: -7.5450,
    durationMin: 60, costUsd: 22, opens: "10:00", closes: "17:00", bestTime: "afternoon", touristy: 3,
    note: "An hour on the water in a flat-bottomed wine boat. Slow on purpose." },
];
