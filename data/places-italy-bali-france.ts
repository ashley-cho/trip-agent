import type { Place } from "@/lib/types";

// The three most-named gaps left: Italy, Bali and France.

export const ITALY_BALI_FRANCE_PLACES: Place[] = [
  // ------------------------------------------------------------------ Rome --
  { id: "rom-colosseum", cityId: "rome", name: "The Colosseum", kind: "sight",
    tags: ["history", "architecture", "iconic"], neighborhood: "Colosseo", lat: 41.8903, lng: 12.4922,
    durationMin: 120, costUsd: 20, bestTime: "morning", touristy: 5,
    note: "Finished in AD 80 and built for somewhere between fifty and eighty thousand people. The hypogeum underneath, where the animals and the machinery were kept, has been open since 2010 and is the part worth the extra ticket. Book a time or you will spend the morning in a queue." },

  { id: "rom-capitoline", cityId: "rome", name: "Capitoline Museums", kind: "museum",
    tags: ["museum", "history", "art", "architecture"], neighborhood: "Campidoglio", lat: 41.8931, lng: 12.4828,
    durationMin: 120, costUsd: 18, bestTime: "afternoon", touristy: 3,
    note: "The oldest public museum anywhere, open since 1734, on a square Michelangelo laid out for the visit of Charles V. The Capitoline Wolf, the Dying Gaul and the bronze Marcus Aurelius are all here, and it is a fraction as busy as the Vatican." },

  { id: "rom-caracalla", cityId: "rome", name: "Baths of Caracalla", kind: "sight",
    tags: ["history", "architecture", "walk"], neighborhood: "Aventino", lat: 41.8794, lng: 12.4931,
    durationMin: 90, costUsd: 12, bestTime: "morning", touristy: 2,
    note: "A public bath house from AD 216, 250 metres of it, with walls still standing forty metres up. The walkways are roped off the mosaic floors, which tells you how much floor there is. In summer they stage opera in the caldarium." },

  { id: "rom-castel", cityId: "rome", name: "Castel Sant'Angelo", kind: "sight",
    tags: ["history", "architecture", "viewpoint"], neighborhood: "Borgo", lat: 41.9031, lng: 12.4663,
    durationMin: 100, costUsd: 17, bestTime: "afternoon", touristy: 4,
    note: "Hadrian built it as his own tomb and the popes turned it into a fortress, with a walled corridor running from it to St Peter's for the times that mattered. The spiral ramp up through the middle is the good bit." },

  { id: "rom-borghese-park", cityId: "rome", name: "Villa Borghese and the Pincio", kind: "outdoor",
    tags: ["garden", "walk", "viewpoint", "local"], neighborhood: "Pinciano", lat: 41.9142, lng: 12.4922,
    durationMin: 90, costUsd: 0, bestTime: "evening", touristy: 2,
    note: "Eighty hectares of public park since the city bought it in 1903, with a boating lake and a fake Roman temple in the middle of it. Come out at the Pincio end for the view over the rooftops rather than going in that way." },

  { id: "rom-pantheon", cityId: "rome", name: "The Pantheon", kind: "sight",
    tags: ["architecture", "history", "church", "iconic"], neighborhood: "Centro", lat: 41.8986, lng: 12.4769,
    durationMin: 60, costUsd: 6, opens: "09:00", closes: "19:00", bestTime: "morning", touristy: 5,
    note: "Nineteen hundred years old, still the largest unreinforced concrete dome on earth, and the hole in the roof is open to the sky. Go when it rains and watch the drain work." },

  { id: "rom-forum", cityId: "rome", name: "Forum and Palatine", kind: "sight",
    tags: ["history", "architecture", "walk"], neighborhood: "Centro", lat: 41.8925, lng: 12.4853,
    durationMin: 165, costUsd: 20, opens: "09:00", closes: "19:00", bestTime: "morning", touristy: 5,
    note: "Buy the combined ticket and do the Palatine hill first, from the top down. Almost everyone does it backwards and queues twice." },

  { id: "rom-borghese", cityId: "rome", name: "Galleria Borghese", kind: "museum",
    tags: ["museum", "art", "garden", "architecture"], neighborhood: "Villa Borghese", lat: 41.9142, lng: 12.4922,
    durationMin: 120, costUsd: 16, opens: "09:00", closes: "19:00", closedDays: [1], bestTime: "morning", touristy: 4,
    note: "Two-hour timed slots, booked ahead, no exceptions. Bernini's Apollo and Daphne is in here and it is worth arranging the day around." },

  { id: "rom-trastevere", cityId: "rome", name: "Trastevere in the evening", kind: "walk",
    tags: ["walk", "local", "food", "nightlife"], neighborhood: "Trastevere", lat: 41.8890, lng: 12.4700,
    durationMin: 105, costUsd: 0, bestTime: "evening", touristy: 4,
    note: "Cobbles, ivy, and everyone outside. The main squares are for visitors; two streets back it is still people who live there." },

  { id: "rom-testaccio", cityId: "rome", name: "Testaccio market", kind: "market",
    tags: ["market", "food", "local"], neighborhood: "Testaccio", lat: 41.8760, lng: 12.4750,
    durationMin: 80, costUsd: 16, opens: "07:00", closes: "15:00", closedDays: [0], bestTime: "midday", touristy: 2,
    note: "The old slaughterhouse district, which is why the cooking here is offal-heavy and very good. Eat the sandwich from the stall with the queue." },

  { id: "rom-appia", cityId: "rome", name: "Appia Antica by bike", kind: "outdoor",
    tags: ["walk", "history", "nature", "local"], neighborhood: "Appia Antica", lat: 41.8560, lng: 12.5170,
    durationMin: 180, costUsd: 18, bestTime: "morning", touristy: 2,
    note: "Cycle out along the original Roman road, over the original basalt, past tombs and aqueducts, with fields either side. Sundays it is closed to cars." },

  { id: "rom-vatican", cityId: "rome", name: "Vatican Museums", kind: "museum",
    tags: ["museum", "art", "history", "iconic"], neighborhood: "Vatican", lat: 41.9065, lng: 12.4536,
    durationMin: 210, costUsd: 25, opens: "08:00", closes: "18:00", closedDays: [0], bestTime: "morning", touristy: 5,
    note: "Four hours, mostly walking through corridors to reach one ceiling. Book the first slot of the day or a Friday evening opening, or do not go at all." },

  { id: "rom-cacio", cityId: "rome", name: "Cacio e pepe, properly", kind: "meal",
    tags: ["food", "local"], neighborhood: "Testaccio", lat: 41.8780, lng: 12.4760,
    durationMin: 95, costUsd: 32, opens: "12:30", closes: "23:00", closedDays: [0], bestTime: "evening", touristy: 3,
    note: "Four ingredients and nowhere to hide. The four Roman pastas are the whole canon here and every trattoria will do all four." },

  { id: "rom-lunch", cityId: "rome", name: "Lunch standing at a bar", kind: "meal",
    tags: ["food", "local", "coffee"], neighborhood: "Centro", lat: 41.8990, lng: 12.4740,
    durationMin: 45, costUsd: 14, opens: "11:00", closes: "16:00", bestTime: "midday", touristy: 2,
    note: "Sitting down doubles the price in some places, by law and on the menu. Eat at the counter like everyone else." },

  { id: "rom-coffee", cityId: "rome", name: "Espresso at the counter", kind: "meal",
    tags: ["coffee", "local"], neighborhood: "Centro", lat: 41.8980, lng: 12.4780,
    durationMin: 25, costUsd: 3, opens: "07:00", closes: "20:00", bestTime: "morning", touristy: 2,
    note: "One euro, drunk standing, thirty seconds. Ordering a cappuccino after eleven marks you out and nobody actually minds." },

  { id: "rom-aventine", cityId: "rome", name: "Aventine keyhole and orange garden", kind: "sight",
    tags: ["viewpoint", "garden", "walk"], neighborhood: "Aventino", lat: 41.8840, lng: 12.4790,
    durationMin: 70, costUsd: 0, bestTime: "evening", touristy: 3,
    note: "A keyhole in a door that frames St Peter's dome down an avenue of hedges, and a walled orange garden fifty metres away that most of the queue never notices." },

  { id: "rom-spanishsteps", cityId: "rome", name: "Spanish Steps and Trevi", kind: "sight",
    tags: ["iconic", "walk"], neighborhood: "Centro", lat: 41.9060, lng: 12.4830,
    durationMin: 75, costUsd: 0, bestTime: "any", touristy: 5,
    note: "Two crowds around two objects, with people selling selfie sticks between them. Walk past both on the way somewhere else and you have had the experience.", skip: true },

  // -------------------------------------------------------------- Florence --
  { id: "flo-accademia", cityId: "florence", name: "Galleria dell'Accademia", kind: "museum",
    tags: ["museum", "art", "history"], neighborhood: "San Marco", lat: 43.7769, lng: 11.2589,
    durationMin: 90, costUsd: 17, opens: "08:15", closes: "18:50", closedDays: [1], bestTime: "morning", touristy: 5,
    note: "David has been here since 1873. The four unfinished Prisoners in the corridor before him are the better half of the visit — figures half out of the block, and you can see the decisions being made. Book ahead; the door queue is an hour." },

  { id: "flo-duomo", cityId: "florence", name: "Brunelleschi's dome", kind: "sight",
    tags: ["architecture", "history", "viewpoint", "church"], neighborhood: "Duomo", lat: 43.7731, lng: 11.2569,
    durationMin: 90, costUsd: 22, bestTime: "morning", touristy: 5,
    note: "Still the largest masonry dome ever built, finished in 1436, and nobody has fully explained how he did it without a centring frame. You climb between the two shells, which is narrow and hot and not the place to discover you mind that." },

  { id: "flo-vecchio", cityId: "florence", name: "Palazzo Vecchio", kind: "sight",
    tags: ["history", "art", "architecture"], neighborhood: "Signoria", lat: 43.7694, lng: 11.2561,
    durationMin: 100, costUsd: 15, bestTime: "afternoon", touristy: 4,
    note: "Still the town hall, which is the point: the mayor works above a room built in 1494 for a council of five hundred and painted by Vasari with every battle Florence won. The tower is 94 metres and the stairs are not kind." },

  { id: "flo-uffizi", cityId: "florence", name: "The Uffizi", kind: "museum",
    tags: ["museum", "art", "history", "iconic"], neighborhood: "Centro", lat: 43.7678, lng: 11.2553,
    durationMin: 180, costUsd: 28, opens: "08:15", closes: "18:30", closedDays: [1], bestTime: "morning", touristy: 5,
    note: "Book a slot. Do the first floor properly and walk the second, or you will be exhausted before the Botticellis." },

  { id: "flo-brancacci", cityId: "florence", name: "Brancacci Chapel", kind: "sight",
    tags: ["art", "church", "history"], neighborhood: "Oltrarno", lat: 43.7680, lng: 11.2440,
    durationMin: 70, costUsd: 12, opens: "10:00", closes: "17:00", closedDays: [2], bestTime: "morning", touristy: 2,
    note: "Masaccio's frescoes, where perspective in painting arguably starts. Thirty people at a time, booked, and nobody queues for it." },

  { id: "flo-oltrarno", cityId: "florence", name: "Oltrarno workshops", kind: "walk",
    tags: ["walk", "art", "local", "shopping"], neighborhood: "Oltrarno", lat: 43.7660, lng: 11.2470,
    durationMin: 105, costUsd: 0, bestTime: "afternoon", touristy: 2,
    note: "Across the river, where the gilders, bookbinders and leather workers still have street-level workshops with the doors open." },

  { id: "flo-sanminiato", cityId: "florence", name: "San Miniato al Monte", kind: "sight",
    tags: ["church", "viewpoint", "architecture", "music"], neighborhood: "Oltrarno", lat: 43.7590, lng: 11.2650,
    durationMin: 90, costUsd: 0, opens: "09:30", closes: "19:30", bestTime: "evening", touristy: 3,
    note: "Above Piazzale Michelangelo and much better than it. Monks sing vespers in the crypt most evenings; sit at the back and stay." },

  { id: "flo-mercato", cityId: "florence", name: "Mercato Centrale", kind: "market",
    tags: ["market", "food", "local"], neighborhood: "San Lorenzo", lat: 43.7770, lng: 11.2540,
    durationMin: 75, costUsd: 18, opens: "07:00", closes: "15:00", closedDays: [0], bestTime: "midday", touristy: 4,
    note: "Ground floor is a working market; upstairs is a food hall for visitors. Stay downstairs and get the lampredotto from the tripe stall." },

  { id: "flo-boboli", cityId: "florence", name: "Boboli and Bardini gardens", kind: "outdoor",
    tags: ["garden", "walk", "viewpoint", "history"], neighborhood: "Oltrarno", lat: 43.7620, lng: 11.2500,
    durationMin: 135, costUsd: 12, opens: "08:15", closes: "18:30", closedDays: [1], bestTime: "afternoon", touristy: 3,
    note: "The same ticket gets you both, and Bardini is the smaller and better one with a wisteria tunnel over the city." },

  { id: "flo-dinner", cityId: "florence", name: "Bistecca and Chianti", kind: "meal",
    tags: ["food", "wine", "local"], neighborhood: "Oltrarno", lat: 43.7670, lng: 11.2460,
    durationMin: 110, costUsd: 55, opens: "19:00", closes: "23:00", closedDays: [0], bestTime: "evening", touristy: 3,
    note: "One kilo, rare, for two people, and they will not cook it any other way. Do it once and eat lightly either side." },

  { id: "flo-coffee", cityId: "florence", name: "Morning pastry and coffee", kind: "meal",
    tags: ["coffee", "food", "local"], neighborhood: "Centro", lat: 43.7720, lng: 11.2560,
    durationMin: 35, costUsd: 5, opens: "07:00", closes: "13:00", bestTime: "morning", touristy: 2,
    note: "Cornetto and a macchiato, standing. Breakfast here is small and sweet and takes four minutes." },

  // --------------------------------------------------------------- Chianti --
  { id: "chi-tasting", cityId: "chianti", name: "Chianti Classico tasting", kind: "experience",
    tags: ["wine", "food", "nature"], neighborhood: "Greve", lat: 43.5850, lng: 11.3160,
    durationMin: 180, costUsd: 45, opens: "10:00", closes: "18:00", bestTime: "midday", touristy: 3,
    note: "Two estates, not five, with lunch at the second. Sangiovese on these hills is the whole reason the region has a name." },

  { id: "chi-drive", cityId: "chianti", name: "The road through the vineyards", kind: "outdoor",
    tags: ["nature", "viewpoint", "walk"], neighborhood: "Chianti", lat: 43.5300, lng: 11.3000,
    durationMin: 120, costUsd: 0, bestTime: "morning", touristy: 2,
    note: "Cypress avenues, hill towns, and no particular destination. Take the small roads and stop when something looks right." },

  { id: "chi-siena", cityId: "chianti", name: "Siena and the Campo", kind: "sight",
    tags: ["history", "architecture", "walk", "church"], neighborhood: "Siena", lat: 43.3180, lng: 11.3310,
    durationMin: 180, costUsd: 12, bestTime: "morning", touristy: 4,
    note: "A shell-shaped square that slopes, a striped cathedral, and a medieval street plan nobody has straightened out. Lie down on the Campo; everyone does." },

  { id: "chi-lunch", cityId: "chianti", name: "Long lunch at an agriturismo", kind: "meal",
    tags: ["food", "wine", "local", "nature"], neighborhood: "Chianti", lat: 43.5500, lng: 11.3100,
    durationMin: 135, costUsd: 42, opens: "12:30", closes: "15:30", bestTime: "midday", touristy: 2,
    note: "On a farm, four courses, whatever they have. This is the day, not a break in it." },

  // ----------------------------------------------------------------- Ubud --
  { id: "ubu-monkey", cityId: "ubud", name: "Sacred Monkey Forest", kind: "outdoor",
    tags: ["nature", "walk", "history", "church"], neighborhood: "Ubud", lat: -8.5190, lng: 115.2590,
    durationMin: 90, costUsd: 6, opens: "08:30", closes: "18:00", bestTime: "morning", touristy: 5,
    note: "Three temples in a banyan forest with about a thousand macaques who will take anything not held. Genuinely a sanctuary rather than an attraction, but keep your sunglasses in a bag." },

  { id: "ubu-campuhan", cityId: "ubud", name: "Campuhan ridge walk", kind: "outdoor",
    tags: ["walk", "nature", "viewpoint", "local", "earlystart"], neighborhood: "Ubud", lat: -8.5050, lng: 115.2560,
    durationMin: 90, costUsd: 0, bestTime: "morning", touristy: 3,
    note: "A paved ridge between two river valleys, best at six in the morning before the heat and the crowd. Two kilometres out, then breakfast at the far end." },

  { id: "ubu-tegalalang", cityId: "ubud", name: "Tegalalang rice terraces", kind: "outdoor",
    tags: ["nature", "walk", "viewpoint", "iconic"], neighborhood: "Tegalalang", lat: -8.4310, lng: 115.2790,
    durationMin: 120, costUsd: 4, opens: "08:00", closes: "18:00", bestTime: "morning", touristy: 5,
    note: "The famous one, with swings and photo platforms charging separately at every level. Go at eight, walk down into the terraces themselves, and ignore the swings." },

  { id: "ubu-jatiluwih", cityId: "ubud", name: "Jatiluwih terraces", kind: "outdoor",
    tags: ["nature", "walk", "viewpoint", "local"], neighborhood: "Jatiluwih", lat: -8.3690, lng: 115.1310,
    durationMin: 180, costUsd: 5, opens: "08:00", closes: "18:00", bestTime: "morning", touristy: 2,
    note: "Ninety minutes further out, ten times the size, UNESCO listed, and almost nobody there. This is the one to do if you only do one." },

  { id: "ubu-tirta", cityId: "ubud", name: "Purification at Tirta Empul", kind: "experience",
    tags: ["church", "history", "spa", "local"], neighborhood: "Tampaksiring", lat: -8.4150, lng: 115.3150,
    durationMin: 135, costUsd: 5, opens: "08:00", closes: "17:00", bestTime: "morning", touristy: 4,
    note: "A working Hindu temple where people bathe under spouts in a spring-fed pool. If you go in, hire a sarong and follow what the Balinese in the queue are doing." },

  { id: "ubu-cooking", cityId: "ubud", name: "Balinese cooking class", kind: "experience",
    tags: ["food", "market", "local"], neighborhood: "Ubud", lat: -8.5100, lng: 115.2620,
    durationMin: 300, costUsd: 45, opens: "07:00", closes: "15:00", bestTime: "morning", touristy: 3,
    note: "Market at dawn, then a compound kitchen and a base gede paste ground by hand. Five hours and the best value thing you will do here." },

  { id: "ubu-dance", cityId: "ubud", name: "Legong at the palace", kind: "experience",
    tags: ["music", "art", "local", "history"], neighborhood: "Ubud", lat: -8.5070, lng: 115.2630,
    durationMin: 105, costUsd: 8, opens: "19:00", closes: "21:00", bestTime: "evening", touristy: 4,
    note: "Gamelan and dance in the palace courtyard, different troupe each night. Eight dollars, ninety minutes, and the orchestra alone is worth it." },

  { id: "ubu-warung", cityId: "ubud", name: "Babi guling at a warung", kind: "meal",
    tags: ["food", "local"], neighborhood: "Ubud", lat: -8.5120, lng: 115.2610,
    durationMin: 60, costUsd: 8, opens: "11:00", closes: "17:00", bestTime: "midday", touristy: 3,
    note: "Suckling pig, crackling, blood sausage, on rice. Sold out by two most days. This is the local special and it is not subtle." },

  { id: "ubu-dinner", cityId: "ubud", name: "Dinner in a rice field", kind: "meal",
    tags: ["food", "local", "nature"], neighborhood: "Ubud", lat: -8.5030, lng: 115.2680,
    durationMin: 105, costUsd: 26, opens: "17:30", closes: "22:00", bestTime: "evening", touristy: 3,
    note: "Half the good kitchens here back onto a paddy, lit with lanterns, loud with frogs. Book the terrace table." },

  { id: "ubu-coffee", cityId: "ubud", name: "Coffee in a warung", kind: "meal",
    tags: ["coffee", "local"], neighborhood: "Ubud", lat: -8.5090, lng: 115.2650,
    durationMin: 40, costUsd: 3, opens: "07:00", closes: "18:00", bestTime: "morning", touristy: 2,
    note: "Balinese coffee is grown up the hill and served thick with the grounds still in it. Let it settle before you drink." },

  { id: "ubu-spa", cityId: "ubud", name: "Balinese massage", kind: "experience",
    tags: ["spa", "local"], neighborhood: "Ubud", lat: -8.5110, lng: 115.2640,
    durationMin: 105, costUsd: 22, opens: "09:00", closes: "21:00", bestTime: "afternoon", touristy: 3,
    note: "Firmer than you are expecting and about a fifth of what it costs at home. Every third door offers it and the plain ones are usually better." },

  // ----------------------------------------------------------- Mount Batur --
  { id: "bat-sunrise", cityId: "batur", name: "Mount Batur at sunrise", kind: "outdoor",
    tags: ["hike", "nature", "viewpoint", "earlystart"], neighborhood: "Kintamani", lat: -8.2420, lng: 115.3750,
    durationMin: 300, costUsd: 45, opens: "03:00", closes: "10:00", bestTime: "morning", touristy: 4,
    note: "Picked up at two in the morning, two hours up a volcano in the dark, and breakfast eggs cooked in a steam vent at the top. Brutal start, and nobody regrets it." },

  { id: "bat-springs", cityId: "batur", name: "Hot springs on the lake", kind: "experience",
    tags: ["spa", "nature", "coast"], neighborhood: "Toya Bungkah", lat: -8.2500, lng: 115.4000,
    durationMin: 120, costUsd: 25, opens: "08:00", closes: "18:00", bestTime: "midday", touristy: 3,
    note: "Volcanic water into pools at the lake edge, looking back at the crater you just climbed. The obvious and correct thing to do afterwards." },

  { id: "bat-coffee", cityId: "batur", name: "Coffee plantation on the way down", kind: "experience",
    tags: ["coffee", "food", "local", "nature"], neighborhood: "Kintamani", lat: -8.2900, lng: 115.3300,
    durationMin: 75, costUsd: 8, opens: "08:00", closes: "17:00", bestTime: "midday", touristy: 4,
    note: "Free tastings of a dozen things, then a hard sell on kopi luwak, which is a tourist product and unkind to the animals. Taste the regular coffee and skip that one." },

  // ---------------------------------------------------------------- Paris --
  { id: "par-orangerie", cityId: "paris", name: "Musée de l'Orangerie", kind: "museum",
    tags: ["museum", "art", "garden"], neighborhood: "Tuileries", lat: 48.8638, lng: 2.3225,
    durationMin: 75, costUsd: 14, bestTime: "morning", touristy: 4,
    note: "Two oval rooms laid out as a figure of eight, with 91 metres of Monet's water lilies wrapped round the walls at eye height. Go first thing and sit down in one of them rather than walking round it. The Walter-Guillaume pictures downstairs are the other reason." },

  { id: "par-luxembourg", cityId: "paris", name: "Jardin du Luxembourg", kind: "outdoor",
    tags: ["garden", "walk", "local"], neighborhood: "6e", lat: 48.8469, lng: 2.3372,
    durationMin: 75, costUsd: 0, bestTime: "afternoon", touristy: 3,
    note: "Twenty-three hectares Marie de' Medici had built in 1612 to remind her of Florence. Take one of the green metal chairs, move it wherever you want it, and stay an hour. The Medici Fountain at the east end is the quiet corner." },

  { id: "par-carnavalet", cityId: "paris", name: "Musée Carnavalet", kind: "museum",
    tags: ["museum", "history", "local"], neighborhood: "Marais", lat: 48.8574, lng: 2.3621,
    durationMin: 100, costUsd: 12, bestTime: "afternoon", touristy: 2,
    note: "The history of the city itself, in two Marais mansions, from neolithic canoes to Proust's bedroom. It explains what you have been walking past better than anything else in Paris and is half empty on a weekday." },

  { id: "par-pantheon", cityId: "paris", name: "The Panthéon crypt", kind: "sight",
    tags: ["history", "architecture"], neighborhood: "5e", lat: 48.8461, lng: 2.3458,
    durationMin: 75, costUsd: 13, bestTime: "afternoon", touristy: 3,
    note: "A church turned mausoleum in 1881, with 81 people under it — Voltaire, Rousseau, Hugo, Marie Curie, Josephine Baker. Upstairs hangs a copy of the pendulum Foucault used in 1851 to show the earth turning." },

  { id: "par-catacombs", cityId: "paris", name: "The Catacombs", kind: "sight",
    tags: ["history", "walk"], neighborhood: "14e", lat: 48.8339, lng: 2.3322,
    durationMin: 90, costUsd: 32, bestTime: "morning", touristy: 4,
    note: "The bones of more than six million people, moved down here out of the overflowing city cemeteries and stacked in patterns by whoever did the stacking. Timed tickets only, and the queue without one is famously not worth joining." },

  { id: "par-cluny", cityId: "paris", name: "Musée de Cluny", kind: "museum",
    tags: ["museum", "history", "art", "architecture"], neighborhood: "5e", lat: 48.8506, lng: 2.3433,
    durationMin: 90, costUsd: 14, bestTime: "afternoon", touristy: 3,
    note: "Medieval Paris in a mansion built over a Roman bath house, with the frigidarium still standing and full of the collection. The six Lady and the Unicorn tapestries are here, in a room of their own, and nobody has settled what the sixth one means." },

  { id: "par-marmottan", cityId: "paris", name: "Musée Marmottan Monet", kind: "museum",
    tags: ["museum", "art", "garden"], neighborhood: "16e", lat: 48.8593, lng: 2.2673,
    durationMin: 90, costUsd: 15, bestTime: "morning", touristy: 2,
    note: "Three hundred-odd Monets, including the canvas that gave Impressionism its name, plus the largest Berthe Morisot collection anywhere. Out in the 16th, so it takes a deliberate trip and rewards one." },

  { id: "par-orsay", cityId: "paris", name: "Musée d'Orsay", kind: "museum",
    tags: ["museum", "art", "architecture"], neighborhood: "7e", lat: 48.8600, lng: 2.3266,
    durationMin: 150, costUsd: 17, opens: "09:30", closes: "18:00", closedDays: [1], bestTime: "morning", touristy: 4,
    note: "A railway station full of impressionists, which is a better building and a better collection than the Louvre for most people. Fifth floor first." },

  { id: "par-marais", cityId: "paris", name: "The Marais on foot", kind: "walk",
    tags: ["walk", "history", "shopping", "local", "food"], neighborhood: "3e/4e", lat: 48.8590, lng: 2.3620,
    durationMin: 120, costUsd: 0, bestTime: "afternoon", touristy: 4,
    note: "Medieval street plan the Haussmann boulevards never reached. Place des Vosges, then the old Jewish quarter on rue des Rosiers, and it is open on Sundays when much of Paris is not." },

  { id: "par-pere", cityId: "paris", name: "Père Lachaise", kind: "outdoor",
    tags: ["walk", "history", "garden", "art"], neighborhood: "20e", lat: 48.8610, lng: 2.3930,
    durationMin: 105, costUsd: 0, opens: "08:00", closes: "18:00", bestTime: "morning", touristy: 3,
    note: "A hillside city of tombs under old chestnuts. Take a map at the gate; wandering without one is pleasant but you will find nothing." },

  { id: "par-rodin", cityId: "paris", name: "Musée Rodin", kind: "museum",
    tags: ["museum", "art", "garden"], neighborhood: "7e", lat: 48.8554, lng: 2.3158,
    durationMin: 105, costUsd: 14, opens: "10:00", closes: "18:30", closedDays: [1], bestTime: "afternoon", touristy: 3,
    note: "Most of the sculpture is outside in the garden, which makes this the one museum to do on a good day rather than a wet one." },

  { id: "par-canal", cityId: "paris", name: "Canal Saint-Martin", kind: "walk",
    tags: ["walk", "local", "coast", "coffee"], neighborhood: "10e", lat: 48.8710, lng: 2.3660,
    durationMin: 90, costUsd: 0, bestTime: "evening", touristy: 2,
    note: "Iron footbridges, plane trees, and everyone sitting on the quay with a bottle. This is where Parisians go rather than where they send you." },

  { id: "par-market", cityId: "paris", name: "Marché d'Aligre", kind: "market",
    tags: ["market", "food", "local", "wine"], neighborhood: "12e", lat: 48.8490, lng: 2.3780,
    durationMin: 90, costUsd: 18, opens: "07:30", closes: "13:30", closedDays: [1], bestTime: "morning", touristy: 2,
    note: "Covered hall, open-air stalls and a flea market, all in one square, and a wine bar in the middle that opens at nine. Not a tourist market." },

  { id: "par-sainte-chapelle", cityId: "paris", name: "Sainte-Chapelle", kind: "sight",
    tags: ["church", "architecture", "history", "art"], neighborhood: "1er", lat: 48.8554, lng: 2.3450,
    durationMin: 70, costUsd: 13, opens: "09:00", closes: "17:00", bestTime: "morning", touristy: 4,
    note: "Fifteen metres of thirteenth-century stained glass on all sides, built as a reliquary. Go on a bright morning; on a grey day it is half the thing." },

  { id: "par-louvre", cityId: "paris", name: "The Louvre", kind: "museum",
    tags: ["museum", "art", "history", "iconic"], neighborhood: "1er", lat: 48.8606, lng: 2.3376,
    durationMin: 210, costUsd: 24, opens: "09:00", closes: "18:00", closedDays: [2], bestTime: "morning", touristy: 5,
    note: "Enormous, and most of the crowd is in one room looking at one small painting through phones. Pick two wings, enter by the Porte des Lions, and accept you will not see it all." },

  { id: "par-bistro", cityId: "paris", name: "Dinner at a neighbourhood bistro", kind: "meal",
    tags: ["food", "wine", "local"], neighborhood: "11e", lat: 48.8570, lng: 2.3780,
    durationMin: 120, costUsd: 52, opens: "19:30", closes: "23:00", closedDays: [0], bestTime: "evening", touristy: 2,
    note: "Chalkboard, six mains, natural wine, and a room the size of a living room. Book, because they hold four tables and everyone else has booked too." },

  { id: "par-lunch", cityId: "paris", name: "Lunch formule", kind: "meal",
    tags: ["food", "local"], neighborhood: "6e", lat: 48.8510, lng: 2.3350,
    durationMin: 75, costUsd: 24, opens: "12:00", closes: "14:30", closedDays: [0], bestTime: "midday", touristy: 2,
    note: "Two courses and a glass for the price of a starter at dinner, served between noon and two and not a minute after. Best value meal in the city." },

  { id: "par-coffee", cityId: "paris", name: "Coffee and a terrace", kind: "meal",
    tags: ["coffee", "local"], neighborhood: "11e", lat: 48.8600, lng: 2.3730,
    durationMin: 45, costUsd: 6, opens: "07:30", closes: "19:00", bestTime: "morning", touristy: 2,
    note: "Sit facing the street, which is the entire design of a Paris terrace, and take longer over it than you need to." },

  { id: "par-eiffel", cityId: "paris", name: "Going up the Eiffel Tower", kind: "sight",
    tags: ["iconic", "viewpoint"], neighborhood: "7e", lat: 48.8584, lng: 2.2945,
    durationMin: 165, costUsd: 32, opens: "09:30", closes: "23:00", bestTime: "evening", touristy: 5,
    note: "Two hours of queueing for a view that does not have the Eiffel Tower in it. Look at it from the Champ de Mars with a bottle instead.", skip: true },

  // -------------------------------------------------------------- Provence --
  { id: "pro-lesbaux", cityId: "provence", name: "Les Baux-de-Provence", kind: "sight",
    tags: ["history", "walk", "viewpoint", "castle"], neighborhood: "Alpilles", lat: 43.7439, lng: 4.7953,
    durationMin: 150, costUsd: 14, bestTime: "morning", touristy: 5,
    note: "A ruined 11th-century fortress on a rock over the Alpilles, with 264 residents and a million and a half visitors a year. Go at opening or don't go. The quarry below it, Carrières de Lumières, projects paintings onto four thousand square metres of limestone wall." },

  { id: "pro-orange", cityId: "provence", name: "Roman theatre at Orange", kind: "sight",
    tags: ["history", "architecture", "music"], neighborhood: "Orange", lat: 44.1357, lng: 4.8084,
    durationMin: 90, costUsd: 12, bestTime: "afternoon", touristy: 3,
    note: "Built under Augustus, and the stage wall behind it still stands 37 metres high — the reason the acoustics work and the reason it is one of the few Roman theatres left with its back intact. They still put opera on in it every summer." },

  { id: "pro-fontaine", cityId: "provence", name: "Fontaine-de-Vaucluse", kind: "outdoor",
    tags: ["nature", "walk", "viewpoint"], neighborhood: "Vaucluse", lat: 43.9231, lng: 5.1270,
    durationMin: 90, costUsd: 0, bestTime: "morning", touristy: 4,
    note: "The largest spring in France comes straight out of the bottom of a 230-metre cliff, draining 1,200 square kilometres of limestone through one hole. A robot got 308 metres down it in 1985 and did not find the bottom. Low water in autumn is less spectacular and much quieter." },

  { id: "pro-arles", cityId: "provence", name: "Arles on foot", kind: "walk",
    tags: ["history", "walk", "art", "architecture"], neighborhood: "Arles", lat: 43.6767, lng: 4.6278,
    durationMin: 180, costUsd: 0, bestTime: "morning", touristy: 4,
    note: "A Roman amphitheatre from AD 90 that still holds bullfights, a theatre, a necropolis, and the streets Van Gogh painted three hundred times in fifteen months. Small enough to do all of it on foot in a morning." },

  { id: "pro-pontavignon", cityId: "provence", name: "Pont Saint-Bénézet", kind: "sight",
    tags: ["history", "architecture", "viewpoint"], neighborhood: "Avignon", lat: 43.9539, lng: 4.8050,
    durationMin: 60, costUsd: 10, bestTime: "afternoon", touristy: 4,
    note: "Twenty-two arches and nine hundred metres of it went across the Rhône in the 1180s; four arches and the gatehouse are what the river left. The song is about dancing under it, not on it, which is the sort of thing you find out standing on it." },

  { id: "pro-avignon", cityId: "provence", name: "Avignon and the Papal Palace", kind: "sight",
    tags: ["history", "architecture", "walk"], neighborhood: "Avignon", lat: 43.9510, lng: 4.8080,
    durationMin: 150, costUsd: 14, opens: "09:00", closes: "19:00", bestTime: "morning", touristy: 4,
    note: "The largest Gothic palace in Europe, built when the popes moved here for seventy years. Mostly empty rooms, and the scale is the point." },

  { id: "pro-luberon", cityId: "provence", name: "Luberon hill villages", kind: "walk",
    tags: ["walk", "history", "viewpoint", "local"], neighborhood: "Luberon", lat: 43.8300, lng: 5.3000,
    durationMin: 210, costUsd: 0, bestTime: "morning", touristy: 3,
    note: "Gordes, Roussillon and Ménerbes in one loop, built out of the rock they stand on. Roussillon is ochre red and looks like nowhere else in France." },

  { id: "pro-market", cityId: "provence", name: "Provençal market morning", kind: "market",
    tags: ["market", "food", "local"], neighborhood: "Isle-sur-la-Sorgue", lat: 43.9180, lng: 5.0510,
    durationMin: 120, costUsd: 20, opens: "08:00", closes: "13:00", closedDays: [1, 2, 3, 4, 5], bestTime: "morning", touristy: 3,
    note: "Sundays and Thursdays, along the canals, with antiques as well as food. Get there by nine or park a long way out." },

  { id: "pro-pontdugard", cityId: "provence", name: "Pont du Gard", kind: "sight",
    tags: ["history", "architecture", "nature", "coast"], neighborhood: "Vers-Pont-du-Gard", lat: 43.9475, lng: 4.5350,
    durationMin: 150, costUsd: 10, opens: "09:00", closes: "19:00", bestTime: "afternoon", touristy: 4,
    note: "A Roman aqueduct forty-nine metres high, still standing, with a river underneath you can swim in. Bring a towel; almost nobody does." },

  { id: "pro-wine", cityId: "provence", name: "Châteauneuf-du-Pape tasting", kind: "experience",
    tags: ["wine", "nature", "food"], neighborhood: "Châteauneuf", lat: 44.0560, lng: 4.8320,
    durationMin: 165, costUsd: 40, opens: "10:00", closes: "18:00", closedDays: [0], bestTime: "midday", touristy: 3,
    note: "Grenache off vineyards covered in fist-sized stones that hold the day's heat overnight. Two domaines, and the village tasting rooms will pour without an appointment." },

  { id: "pro-dinner", cityId: "provence", name: "Dinner under plane trees", kind: "meal",
    tags: ["food", "wine", "local"], neighborhood: "Avignon", lat: 43.9490, lng: 4.8060,
    durationMin: 115, costUsd: 44, opens: "19:00", closes: "22:30", closedDays: [1], bestTime: "evening", touristy: 2,
    note: "Outside, in a square, for three hours. The food is good and the sitting there is most of it." },

  { id: "pro-lunch", cityId: "provence", name: "Lunch in a village", kind: "meal",
    tags: ["food", "local"], neighborhood: "Luberon", lat: 43.8500, lng: 5.2000,
    durationMin: 90, costUsd: 28, opens: "12:00", closes: "14:00", bestTime: "midday", touristy: 2,
    note: "Everything shuts at two and does not reopen. Plan the day around lunch rather than fitting lunch into it." },
];
