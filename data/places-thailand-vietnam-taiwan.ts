import type { Place } from "@/lib/types";

// Northern Thailand, Vietnam and Taiwan. Every coordinate here was read off a
// page rather than remembered, and every note is hand-written. Where a price
// could not be sourced it is set from the nearest comparable in the same city
// and flagged in the research notes, not guessed upward to look authoritative.

export const THA_VNM_TWN_PLACES: Place[] = [
  // ------------------------------------------------------------ Chiang Mai --
  { id: "cnx-phrasingh", cityId: "chiangmai", name: "Wat Phra Singh", kind: "sight",
    tags: ["history", "architecture", "church", "iconic"], neighborhood: "Phra Sing", lat: 18.7888, lng: 98.9812,
    durationMin: 60, costUsd: 2, opens: "06:00", closes: "18:00", bestTime: "morning", touristy: 4,
    note: "The small wooden Lai Kham chapel at the back is the thing worth standing in front of; the big hall in front of it is a reconstruction. Shoulders and knees covered or you get turned around at the door." },

  { id: "cnx-chediluang", cityId: "chiangmai", name: "Wat Chedi Luang", kind: "sight",
    tags: ["history", "architecture", "church"], neighborhood: "Phra Sing", lat: 18.7869, lng: 98.9864,
    durationMin: 60, costUsd: 2, opens: "05:00", closes: "22:00", bestTime: "morning", touristy: 4,
    note: "An earthquake took the top sixty metres off in 1545 and nobody put it back, which is why this is the one that holds up. Monks sit out under the trees most afternoons and will talk to anyone who asks." },

  { id: "cnx-phantao", cityId: "chiangmai", name: "Wat Phan Tao", kind: "sight",
    tags: ["history", "architecture", "church", "local"], neighborhood: "Phra Sing", lat: 18.7877, lng: 98.9875,
    durationMin: 30, costUsd: 0, bestTime: "afternoon", touristy: 2,
    note: "All teak, assembled from the panels of a dismantled royal house, and dark inside in a way none of the white-and-gold temples are. Two minutes' walk from Chedi Luang and a tenth of the crowd." },

  { id: "cnx-chiangman", cityId: "chiangmai", name: "Wat Chiang Man", kind: "sight",
    tags: ["history", "architecture", "church"], neighborhood: "Si Phum", lat: 18.7938, lng: 98.9894,
    durationMin: 45, costUsd: 0, bestTime: "morning", touristy: 2,
    note: "The oldest temple in the city — 1297, the year Mangrai founded the place. Go for the chedi propped on stone elephants round the back rather than the two famous little Buddhas, which are behind glass and hard to see." },

  { id: "cnx-suandok", cityId: "chiangmai", name: "Wat Suan Dok", kind: "sight",
    tags: ["history", "architecture", "church"], neighborhood: "Suthep", lat: 18.7882, lng: 98.9677,
    durationMin: 45, costUsd: 0, bestTime: "evening", touristy: 3,
    note: "A field of whitewashed royal mausoleums with the mountain behind them, which is a strange and good thing to look at half an hour before sunset. The temple runs a monk-chat table most afternoons." },

  { id: "cnx-umong", cityId: "chiangmai", name: "Wat Umong", kind: "sight",
    tags: ["history", "nature", "church", "walk"], neighborhood: "Suthep", lat: 18.7832, lng: 98.9513,
    durationMin: 75, costUsd: 0, bestTime: "morning", touristy: 2,
    note: "Brick tunnels dug under a chedi in the fourteenth century, plus fifteen acres of woods with proverbs nailed to the trees. The broken Buddha field at the back is the part people remember." },

  { id: "cnx-lokmolee", cityId: "chiangmai", name: "Wat Lok Molee", kind: "sight",
    tags: ["history", "architecture", "church", "local"], neighborhood: "Si Phum", lat: 18.7964, lng: 98.9826,
    durationMin: 30, costUsd: 0, bestTime: "afternoon", touristy: 1,
    note: "Outside the north moat, so the tuk-tuks don't stop and almost nobody walks up. Big sixteenth-century brick chedi, a teak hall, and usually one cat." },

  { id: "cnx-chetyot", cityId: "chiangmai", name: "Wat Chet Yot", kind: "sight",
    tags: ["history", "architecture", "church"], neighborhood: "Chang Phueak", lat: 18.8091, lng: 98.9722,
    durationMin: 45, costUsd: 0, bestTime: "afternoon", touristy: 1,
    note: "A copy of the Mahabodhi temple at Bodh Gaya, built in 1455, with seventy stucco deities weathering off the outside walls. It sits next to a motorway and is still quiet." },

  { id: "cnx-srisuphan", cityId: "chiangmai", name: "Wat Sri Suphan", kind: "sight",
    tags: ["architecture", "art", "church"], neighborhood: "Wua Lai", lat: 18.7787, lng: 98.9834,
    durationMin: 40, costUsd: 0, bestTime: "evening", touristy: 3,
    note: "The ordination hall is panelled entirely in beaten silver and aluminium by the silversmiths who still work this street. Women are not allowed inside that building — the sign is blunt about it — but the exterior is most of the point." },

  { id: "cnx-doisuthep", cityId: "chiangmai", name: "Wat Phra That Doi Suthep", kind: "sight",
    tags: ["history", "viewpoint", "church", "iconic"], neighborhood: "Doi Suthep", lat: 18.8050, lng: 98.9216,
    durationMin: 120, costUsd: 1, opens: "06:00", closes: "17:00", bestTime: "morning", touristy: 5,
    note: "Three hundred-odd steps up a naga staircase to a gold chedi at 1,050 m. Everyone goes, and the trick is to go at seven, before the songthaews start running in convoy." },

  { id: "cnx-phalat", cityId: "chiangmai", name: "The Monk's Trail to Wat Pha Lat", kind: "outdoor",
    tags: ["hike", "nature", "walk", "earlystart"], neighborhood: "Doi Suthep", lat: 18.7991, lng: 98.9342,
    durationMin: 150, costUsd: 0, bestTime: "morning", touristy: 2,
    note: "Forty minutes uphill through the trees on a path marked with strips of orange cloth, ending at a mossy temple built into a stream. Do it before the heat and pair it with Doi Suthep further up the road." },

  { id: "cnx-doikham", cityId: "chiangmai", name: "Wat Phra That Doi Kham", kind: "sight",
    tags: ["viewpoint", "church", "local"], neighborhood: "Mae Hia", lat: 18.7596, lng: 98.9181,
    durationMin: 60, costUsd: 0, bestTime: "evening", touristy: 2,
    note: "A seventeen-metre seated Buddha on a hill southwest of town, hung with jasmine garlands people buy on the way up. Thais come here to ask for things; visitors mostly don't come at all." },

  { id: "cnx-warorot", cityId: "chiangmai", name: "Warorot Market", kind: "market",
    tags: ["market", "food", "local"], neighborhood: "Chang Moi", lat: 18.7902, lng: 99.0007,
    durationMin: 75, costUsd: 8, opens: "07:00", closes: "17:00", bestTime: "morning", touristy: 2,
    note: "Where the city buys sai ua and nam phrik num rather than where it sells them to you. The Hmong textile alley on the north side is the good part and it shuts at five." },

  { id: "cnx-tonlamyai", cityId: "chiangmai", name: "Ton Lamyai flower market", kind: "market",
    tags: ["market", "local", "walk"], neighborhood: "Chang Moi", lat: 18.7904, lng: 99.0014,
    durationMin: 40, costUsd: 0, bestTime: "evening", touristy: 1,
    note: "Marigolds and jasmine by the sackful, next door to Warorot and open when Warorot isn't. Go after dark, when the orchid sellers are unpacking for the morning." },

  { id: "cnx-thaphae", cityId: "chiangmai", name: "The old city walls from Tha Phae Gate", kind: "walk",
    tags: ["walk", "history", "architecture"], neighborhood: "Old City", lat: 18.7876, lng: 98.9934,
    durationMin: 75, costUsd: 0, bestTime: "evening", touristy: 3,
    note: "The moat is a perfect square and you can walk a side of it in half an hour. The gate square itself is pigeons and rented photo shoots — start there and leave quickly." },

  { id: "cnx-lanna", cityId: "chiangmai", name: "Lanna Folklife Museum", kind: "museum",
    tags: ["museum", "history", "local"], neighborhood: "Si Phum", lat: 18.7902, lng: 98.9884,
    durationMin: 75, costUsd: 3, bestTime: "afternoon", touristy: 2,
    note: "Dioramas and lacquerware in a colonial courthouse behind the Three Kings monument. Dry, but it explains what you have been looking at in every temple for three days." },

  { id: "cnx-natmuseum", cityId: "chiangmai", name: "Chiang Mai National Museum", kind: "museum",
    tags: ["museum", "history", "art"], neighborhood: "Chang Phueak", lat: 18.8116, lng: 98.9764,
    durationMin: 100, costUsd: 3, opens: "09:00", closes: "16:00", closedDays: [1, 2], bestTime: "morning", touristy: 2,
    note: "The Lanna kingdom told properly, with the bronzes and the elephant howdahs to back it up. Shut Mondays and Tuesdays, which catches people out, and it is a 4 km ride from the moat." },

  { id: "cnx-maiiam", cityId: "chiangmai", name: "MAIIAM Contemporary Art Museum", kind: "museum",
    tags: ["museum", "contemporary", "art", "architecture"], neighborhood: "San Kamphaeng", lat: 18.7656, lng: 99.0784,
    durationMin: 110, costUsd: 6, opens: "10:00", closes: "18:00", closedDays: [2], bestTime: "afternoon", touristy: 2,
    note: "A converted warehouse thirteen km east, front-faced in mirror mosaic, holding the best collection of Thai contemporary art outside Bangkok. Closed Tuesdays, and worth building the afternoon around rather than squeezing in." },

  { id: "cnx-sunday", cityId: "chiangmai", name: "Sunday Walking Street", kind: "market",
    tags: ["market", "food", "shopping", "local"], neighborhood: "Ratchadamnoen", lat: 18.7876, lng: 98.9934,
    durationMin: 120, costUsd: 10, opens: "16:00", closes: "23:00", closedDays: [1, 2, 3, 4, 5, 6], bestTime: "evening", touristy: 4,
    note: "A kilometre of Ratchadamnoen closed to traffic, Sundays only. After six you cannot move — start at the Wat Phra Singh end at four and walk against the flow." },

  { id: "cnx-saturday", cityId: "chiangmai", name: "Saturday Walking Street on Wua Lai", kind: "market",
    tags: ["market", "food", "shopping", "local"], neighborhood: "Wua Lai", lat: 18.7787, lng: 98.9834,
    durationMin: 100, costUsd: 8, opens: "16:00", closes: "23:00", closedDays: [0, 1, 2, 3, 4, 5], bestTime: "evening", touristy: 3,
    note: "The silversmiths' street, Saturdays only, and smaller than the Sunday one in a way that works in its favour. The food is at the temple end." },

  { id: "cnx-nightbazaar", cityId: "chiangmai", name: "Chiang Mai Night Bazaar", kind: "market",
    tags: ["market", "shopping"], neighborhood: "Chang Khlan", lat: 18.7853, lng: 99.0011,
    durationMin: 90, costUsd: 0, bestTime: "evening", touristy: 5,
    note: "The same elephant trousers and carved soap every night of the year, at tourist prices, under strip lighting. The two weekend walking streets do this better and the day markets do it honestly.", skip: true },

  { id: "cnx-buatong", cityId: "chiangmai", name: "Bua Tong sticky waterfalls", kind: "outdoor",
    tags: ["nature", "adventure", "hike"], neighborhood: "Mae Taeng", lat: 19.0680, lng: 99.0795,
    durationMin: 210, costUsd: 0, bestTime: "midday", touristy: 3,
    note: "Limestone deposits make the rock grip rather than slip, so you climb up the falls barefoot against the water. Free, an hour's drive north, and much better than it sounds written down." },

  { id: "cnx-elephants", cityId: "chiangmai", name: "Elephant Nature Park", kind: "experience",
    tags: ["nature", "local"], neighborhood: "Mae Taeng", lat: 19.2142, lng: 98.8570,
    durationMin: 300, costUsd: 75, opens: "07:00", closes: "17:00", bestTime: "morning", touristy: 3,
    note: "A rescue sanctuary where you feed and watch and nobody rides anything — the half-day visit is enough. Book direct and weeks ahead; the outfits touting rides on Loi Kroh are not this." },

  { id: "cnx-huaytungtao", cityId: "chiangmai", name: "Huay Tung Tao reservoir", kind: "outdoor",
    tags: ["nature", "walk", "local"], neighborhood: "Mae Rim", lat: 18.8666, lng: 98.9413,
    durationMin: 120, costUsd: 2, bestTime: "afternoon", touristy: 1,
    note: "A reservoir under Doi Suthep ringed with bamboo huts you rent by the afternoon while somebody brings grilled fish out to you. This is what Chiang Mai does on a Sunday." },

  { id: "cnx-muaythai", cityId: "chiangmai", name: "Muay Thai at Thapae Stadium", kind: "experience",
    tags: ["local", "nightlife"], neighborhood: "Old City", lat: 18.7872, lng: 98.9925,
    durationMin: 150, costUsd: 15, opens: "21:00", closes: "23:30", bestTime: "evening", touristy: 3,
    note: "Eight or nine bouts, the early ones fought by teenagers and worth more than the headline. Ringside costs double and the cheap seats are fine." },

  { id: "cnx-khaosoi", cityId: "chiangmai", name: "Khao soi at Khun Yai", kind: "meal",
    tags: ["food", "local"], neighborhood: "Si Phum", lat: 18.7953, lng: 98.9833,
    durationMin: 45, costUsd: 3, opens: "10:00", closes: "14:00", closedDays: [0], bestTime: "midday", touristy: 2,
    note: "Curry noodles with a nest of fried noodles on top, pickled mustard greens and lime on the side — put both in. Lunch only, shut Sundays, and gone by two." },

  { id: "cnx-huenphen", cityId: "chiangmai", name: "Northern dinner at Huen Phen", kind: "meal",
    tags: ["food", "local"], neighborhood: "Phra Sing", lat: 18.7858, lng: 98.9852,
    durationMin: 90, costUsd: 11, opens: "17:00", closes: "22:00", bestTime: "evening", touristy: 3,
    note: "Nam phrik ong, hung lay pork curry, crispy pork rind to scoop with. The evening room next door is the atmospheric one and takes no bookings, so arrive at five." },

  { id: "cnx-akhaama", cityId: "chiangmai", name: "Coffee at Akha Ama", kind: "meal",
    tags: ["coffee", "local"], neighborhood: "Phra Sing", lat: 18.7884, lng: 98.9832,
    durationMin: 40, costUsd: 3, opens: "08:00", closes: "17:30", bestTime: "morning", touristy: 2,
    note: "Grown by one Akha village in Chiang Rai province and roasted by the family that farms it. Order it as filter — the espresso is fine but the point is the single origin." },

  { id: "cnx-changphueak", cityId: "chiangmai", name: "Chang Phueak gate night food", kind: "meal",
    tags: ["food", "local", "market"], neighborhood: "Si Phum", lat: 18.7954, lng: 98.9866,
    durationMin: 60, costUsd: 6, opens: "18:00", closes: "24:00", bestTime: "evening", touristy: 2,
    note: "Two dozen carts on the pavement outside the north gate, the stewed pork leg one with the queue being the one you want. Plastic stools, no English, nothing over sixty baht." },

  // ------------------------------------------------------------- Chiang Rai --
  { id: "cei-rongkhun", cityId: "chiangrai", name: "Wat Rong Khun, the White Temple", kind: "sight",
    tags: ["art", "architecture", "contemporary", "iconic"], neighborhood: "Pa O Don Chai", lat: 19.8247, lng: 99.7633,
    durationMin: 90, costUsd: 6, bestTime: "morning", touristy: 5,
    note: "One artist's ongoing private project since 1997, and closer to a haunted house than a temple — you cross a bridge over a pit of reaching hands to get in. Go at opening or you queue on that bridge." },

  { id: "cei-rongsueaten", cityId: "chiangrai", name: "Wat Rong Suea Ten, the Blue Temple", kind: "sight",
    tags: ["art", "architecture", "contemporary", "church"], neighborhood: "Rim Kok", lat: 19.9234, lng: 99.8418,
    durationMin: 45, costUsd: 0, bestTime: "afternoon", touristy: 4,
    note: "Built 2016 by a student of the White Temple's architect, entirely in cobalt and gold. Free, ten minutes from town, and done in half an hour." },

  { id: "cei-baandam", cityId: "chiangrai", name: "Baan Dam, the Black House", kind: "museum",
    tags: ["art", "architecture", "contemporary", "museum"], neighborhood: "Nang Lae", lat: 19.9912, lng: 99.8610,
    durationMin: 90, costUsd: 3, opens: "09:00", closes: "17:00", bestTime: "morning", touristy: 4,
    note: "Forty black teak buildings full of animal bones, hides and horn furniture, assembled by an artist who clearly enjoyed unsettling people. Shuts for lunch between twelve and one." },

  { id: "cei-phrakaew", cityId: "chiangrai", name: "Wat Phra Kaew", kind: "sight",
    tags: ["history", "church", "museum"], neighborhood: "Wiang", lat: 19.9117, lng: 99.8270,
    durationMin: 50, costUsd: 0, bestTime: "morning", touristy: 2,
    note: "Lightning cracked a chedi here in 1434 and the Emerald Buddha was found inside it — the original is now in Bangkok and this keeps a jade replica. The small museum behind is better than the halls." },

  { id: "cei-maefahluang", cityId: "chiangrai", name: "Mae Fah Luang Art and Culture Park", kind: "museum",
    tags: ["museum", "art", "garden", "architecture"], neighborhood: "Rop Wiang", lat: 19.9045, lng: 99.7951,
    durationMin: 100, costUsd: 6, opens: "08:30", closes: "16:30", closedDays: [1], bestTime: "afternoon", touristy: 2,
    note: "The Haw Kham pavilion is built from dismantled teak houses and holds the best Lanna woodwork collection anywhere. Gardens around it, and hardly anyone in them." },

  { id: "cei-chouifong", cityId: "chiangrai", name: "Choui Fong tea terraces", kind: "outdoor",
    tags: ["nature", "viewpoint", "coffee", "local"], neighborhood: "Mae Chan", lat: 20.2000, lng: 99.8192,
    durationMin: 90, costUsd: 6, bestTime: "morning", touristy: 3,
    note: "Green corduroy over the hills forty minutes north, with a café at the top that does a decent tea-leaf cake. Mist burns off by ten, so this is a before-nine drive or not worth it." },

  { id: "cei-opium", cityId: "chiangrai", name: "Hall of Opium", kind: "museum",
    tags: ["museum", "history"], neighborhood: "Golden Triangle", lat: 20.3629, lng: 100.0730,
    durationMin: 120, costUsd: 6, opens: "08:30", closes: "16:00", closedDays: [1], bestTime: "midday", touristy: 3,
    note: "A serious, unflattering museum about the opium trade, built by a royal foundation on the ground the trade ran through. An hour and a half north of Chiang Rai and much better than the Golden Triangle viewpoint everyone drives up for." },

  // -------------------------------------------------------------------- Pai --
  { id: "pai-canyon", cityId: "pai", name: "Pai Canyon at sunset", kind: "outdoor",
    tags: ["viewpoint", "nature", "hike"], neighborhood: "Mae Hi", lat: 19.3060, lng: 98.4525,
    durationMin: 90, costUsd: 0, bestTime: "evening", touristy: 4,
    note: "Eroded sandstone ridges a metre wide with long drops either side and no railings anywhere. Everybody comes for sunset; the ridges past the first junction are where the people stop." },

  { id: "pai-hotsprings", cityId: "pai", name: "Tha Pai hot springs", kind: "experience",
    tags: ["spa", "nature"], neighborhood: "Mae Hi", lat: 19.3074, lng: 98.4760,
    durationMin: 90, costUsd: 9, bestTime: "afternoon", touristy: 3,
    note: "Pools in the forest stepping down from an 80°C source — the top ones will cook you and people do boil eggs in them. Foreigner pricing is roughly ten times the Thai rate, which is worth knowing before the gate." },

  { id: "pai-maeyen", cityId: "pai", name: "Wat Phra That Mae Yen", kind: "sight",
    tags: ["viewpoint", "church", "hike"], neighborhood: "Mae Hi", lat: 19.3499, lng: 98.4543,
    durationMin: 75, costUsd: 0, bestTime: "morning", touristy: 3,
    note: "Three hundred and fifty-odd steps up to a white Buddha looking back down the valley. Climb it early — there is no shade on the staircase at all." },

  { id: "pai-walkingstreet", cityId: "pai", name: "Pai walking street", kind: "walk",
    tags: ["walk", "food", "market", "nightlife"], neighborhood: "Wiang Tai", lat: 19.3581, lng: 98.4406,
    durationMin: 90, costUsd: 8, opens: "18:00", closes: "23:00", bestTime: "evening", touristy: 4,
    note: "Two hundred metres of food carts and hemp trousers, which is the whole of Pai after dark. Eat here and drink elsewhere; the bars on this strip are the worst of the town." },

  // ------------------------------------------------------------ Doi Inthanon --
  { id: "din-summit", cityId: "doiinthanon", name: "Doi Inthanon summit and the Ang Ka trail", kind: "outdoor",
    tags: ["nature", "viewpoint", "walk", "hike"], neighborhood: "Chom Thong", lat: 18.5875, lng: 98.4867,
    durationMin: 90, costUsd: 9, opens: "08:00", closes: "16:00", bestTime: "morning", touristy: 4,
    note: "The highest point in Thailand at 2,565 m, and the summit itself is a car park with a sign. The boardwalk loop through the mossy cloud forest beside it is the actual reason to drive up." },

  { id: "din-kewmaepan", cityId: "doiinthanon", name: "Kew Mae Pan nature trail", kind: "outdoor",
    tags: ["hike", "nature", "viewpoint", "earlystart"], neighborhood: "Mae Chaem", lat: 18.5558, lng: 98.4822,
    durationMin: 150, costUsd: 7, opens: "06:00", closes: "16:00", bestTime: "morning", touristy: 3,
    note: "Two and a half km of ridge above the cloud, and you may not walk it without hiring a local guide at the gate. Closed every year from June to October and reopens on 1 November — check before you commit the day." },

  { id: "din-wachirathan", cityId: "doiinthanon", name: "Wachirathan waterfall", kind: "outdoor",
    tags: ["nature", "viewpoint"], neighborhood: "Chom Thong", lat: 18.5421, lng: 98.5984,
    durationMin: 45, costUsd: 0, bestTime: "midday", touristy: 3,
    note: "Forty metres onto granite, throwing enough spray that the viewing platform soaks you and the rainbow is permanent. It is directly on the road up, so there is no reason not to stop." },

  { id: "din-maeklang", cityId: "doiinthanon", name: "Mae Klang waterfall", kind: "outdoor",
    tags: ["nature", "walk", "local"], neighborhood: "Ban Luang", lat: 18.4971, lng: 98.6677,
    durationMin: 45, costUsd: 0, bestTime: "afternoon", touristy: 3,
    note: "The first falls after the checkpoint and the one Thai families picnic at, so it is busy at weekends and empty on a Tuesday. Swimmable below the bottom tier." },

  // ----------------------------------------------------------------- Hanoi --
  { id: "han-oldquarter", cityId: "hanoi", name: "The Old Quarter on foot", kind: "walk",
    tags: ["walk", "history", "local", "shopping"], neighborhood: "Hoàn Kiếm", lat: 21.0359, lng: 105.8510,
    durationMin: 120, costUsd: 0, bestTime: "morning", touristy: 3,
    note: "Thirty-six streets each named for the guild that once owned it, and some of them still sell only that one thing — Hàng Thiếc is still tinsmiths. Crossing the road is the skill: walk at a constant speed and let the scooters read you." },

  { id: "han-hoankiem", cityId: "hanoi", name: "Hoàn Kiếm lake and Ngọc Sơn temple", kind: "sight",
    tags: ["history", "walk", "garden"], neighborhood: "Hoàn Kiếm", lat: 21.0307, lng: 105.8524,
    durationMin: 60, costUsd: 2, opens: "07:00", closes: "18:00", bestTime: "morning", touristy: 4,
    note: "The temple sits on an islet reached by a red wooden bridge and holds a preserved giant softshell turtle, which is stranger and sadder than the brochures suggest. The roads round the lake shut to traffic at weekends." },

  { id: "han-vanmieu", cityId: "hanoi", name: "Temple of Literature", kind: "sight",
    tags: ["history", "architecture", "garden"], neighborhood: "Đống Đa", lat: 21.0288, lng: 105.8360,
    durationMin: 75, costUsd: 3, bestTime: "morning", touristy: 5,
    note: "Vietnam's first university, 1070, laid out as five courtyards you pass through in order. The stone stelae on turtles list every doctoral graduate from 1442 onward, and students still come to touch them before exams." },

  { id: "han-citadel", cityId: "hanoi", name: "Imperial Citadel of Thăng Long", kind: "sight",
    tags: ["history", "architecture", "museum"], neighborhood: "Ba Đình", lat: 21.0363, lng: 105.8404,
    durationMin: 100, costUsd: 4, opens: "08:00", closes: "17:00", closedDays: [1], bestTime: "morning", touristy: 3,
    note: "A thousand years of capital, most of it dug up rather than standing, plus the concrete bunker the North ran the war from in 1972. That bunker is the part worth the ticket." },

  { id: "han-hoalo", cityId: "hanoi", name: "Hỏa Lò Prison", kind: "museum",
    tags: ["museum", "history"], neighborhood: "Hoàn Kiếm", lat: 21.0254, lng: 105.8464,
    durationMin: 90, costUsd: 2, opens: "08:00", closes: "17:00", bestTime: "morning", touristy: 4,
    note: "French colonial prison first, American POW camp second, and the museum is far more interested in the first than the second. Read it as a document of how Vietnam tells this story and it becomes much more interesting." },

  { id: "han-ethnology", cityId: "hanoi", name: "Vietnam Museum of Ethnology", kind: "museum",
    tags: ["museum", "history", "architecture"], neighborhood: "Cầu Giấy", lat: 21.0404, lng: 105.7988,
    durationMin: 150, costUsd: 2, opens: "08:30", closes: "17:30", closedDays: [1], bestTime: "morning", touristy: 2,
    note: "Fifty-four ethnic groups done properly, and outside there are full-size houses rebuilt by the communities they belong to — you climb into them. Eight km out and the best museum in the country." },

  { id: "han-womens", cityId: "hanoi", name: "Vietnamese Women's Museum", kind: "museum",
    tags: ["museum", "history", "art"], neighborhood: "Hoàn Kiếm", lat: 21.0234, lng: 105.8516,
    durationMin: 90, costUsd: 2, opens: "08:00", closes: "17:00", bestTime: "afternoon", touristy: 2,
    note: "Three floors: marriage customs, the war, and street vendors photographed at work. The street-vendor floor is the one that changes how you see the next day of walking." },

  { id: "han-finearts", cityId: "hanoi", name: "Vietnam National Museum of Fine Arts", kind: "museum",
    tags: ["museum", "art"], neighborhood: "Ba Đình", lat: 21.0307, lng: 105.8370,
    durationMin: 100, costUsd: 2, opens: "08:30", closes: "17:00", bestTime: "afternoon", touristy: 2,
    note: "Lacquer and silk painting from the 1930s École des Beaux-Arts years, which is the run nobody expects and the reason to come. The socialist-realist rooms upstairs are worth twenty minutes, not an hour." },

  { id: "han-mausoleum", cityId: "hanoi", name: "Hồ Chí Minh Mausoleum", kind: "sight",
    tags: ["history", "iconic"], neighborhood: "Ba Đình", lat: 21.0368, lng: 105.8347,
    durationMin: 75, costUsd: 0, opens: "07:30", closes: "10:30", closedDays: [1, 5], bestTime: "morning", touristy: 5,
    note: "Free, silent, and over in ninety seconds of filing past — no bags, no phones, hands out of pockets, and the guards will correct you. Mornings only, shut Mondays and Fridays, and closed outright for two months most autumns while the body goes to Russia." },

  { id: "han-tranquoc", cityId: "hanoi", name: "Trấn Quốc Pagoda", kind: "sight",
    tags: ["history", "church", "coast"], neighborhood: "Tây Hồ", lat: 21.0479, lng: 105.8368,
    durationMin: 40, costUsd: 0, bestTime: "evening", touristy: 3,
    note: "Sixth century, on its own spit into West Lake, with a red stupa that catches the last of the light. Twenty minutes is enough and the causeway walk to it is half the value." },

  { id: "han-quanthanh", cityId: "hanoi", name: "Quán Thánh Temple", kind: "sight",
    tags: ["history", "church", "local"], neighborhood: "Ba Đình", lat: 21.0430, lng: 105.8366,
    durationMin: 30, costUsd: 1, bestTime: "afternoon", touristy: 2,
    note: "A Taoist temple from the eleventh century holding a four-tonne black bronze of Trấn Vũ cast in 1677. Small, dark, incense-thick, and two minutes from the lake road." },

  { id: "han-westlake", cityId: "hanoi", name: "West Lake at dusk", kind: "walk",
    tags: ["walk", "coast", "local"], neighborhood: "Tây Hồ", lat: 21.0550, lng: 105.8200,
    durationMin: 90, costUsd: 0, bestTime: "evening", touristy: 2,
    note: "Seventeen km of shoreline, and the western side is where Hanoi goes to run, fish and drink beer out of plastic crates. Nothing to see, which after three days in the Old Quarter is the point." },

  { id: "han-longbien", cityId: "hanoi", name: "Long Biên Bridge", kind: "walk",
    tags: ["walk", "history", "architecture", "viewpoint"], neighborhood: "Hoàn Kiếm", lat: 21.0431, lng: 105.8580,
    durationMin: 60, costUsd: 0, bestTime: "evening", touristy: 2,
    note: "A Doumer-era cantilever bridge, bombed repeatedly and patched with whatever was available, still carrying trains and mopeds. Walk the pedestrian strip out over the banana fields on the sandbank and come back." },

  { id: "han-dongxuan", cityId: "hanoi", name: "Đồng Xuân Market", kind: "market",
    tags: ["market", "local", "shopping"], neighborhood: "Hoàn Kiếm", lat: 21.0382, lng: 105.8497,
    durationMin: 60, costUsd: 5, opens: "06:00", closes: "19:00", bestTime: "morning", touristy: 3,
    note: "Three floors of wholesale everything, which is more interesting from the lanes outside than inside. The food alley on the north flank is where you actually want to end up." },

  { id: "han-puppets", cityId: "hanoi", name: "Water puppets at Thăng Long", kind: "experience",
    tags: ["music", "local", "film"], neighborhood: "Hoàn Kiếm", lat: 21.0317, lng: 105.8535,
    durationMin: 60, costUsd: 6, opens: "15:00", closes: "20:00", bestTime: "evening", touristy: 5,
    note: "Puppeteers waist-deep behind a screen working figures across a flooded stage, with a live band at the side. It is fifty minutes, it is aimed squarely at visitors, and it is still the only place you will see this." },

  { id: "han-cathedral", cityId: "hanoi", name: "St Joseph's Cathedral", kind: "sight",
    tags: ["architecture", "church", "history"], neighborhood: "Hoàn Kiếm", lat: 21.0287, lng: 105.8489,
    durationMin: 30, costUsd: 0, bestTime: "afternoon", touristy: 3,
    note: "1886, neo-Gothic, and left deliberately unwashed so it looks two centuries older than it is. The interest is the square in front of it, which is where the city drinks iced tea on plastic stools." },

  { id: "han-bachma", cityId: "hanoi", name: "Bạch Mã Temple", kind: "sight",
    tags: ["history", "church", "local"], neighborhood: "Hàng Buồm", lat: 21.0359, lng: 105.8510,
    durationMin: 25, costUsd: 0, bestTime: "morning", touristy: 2,
    note: "The oldest temple in the Old Quarter, wedged into a shopfront on Hàng Buồm so completely that most people walk past the door. Step in for ten minutes when the street gets too loud." },

  { id: "han-opera", cityId: "hanoi", name: "Hanoi Opera House", kind: "sight",
    tags: ["architecture", "history", "music"], neighborhood: "Tràng Tiền", lat: 21.0242, lng: 105.8578,
    durationMin: 30, costUsd: 0, bestTime: "evening", touristy: 3,
    note: "A smaller Palais Garnier dropped into Hanoi between 1901 and 1911, and unless there is a concert on you are looking at the outside. Check the programme — tickets are cheap and the interior is the only way in." },

  { id: "han-trainstreet", cityId: "hanoi", name: "Train Street", kind: "walk",
    tags: ["walk", "iconic"], neighborhood: "Hoàn Kiếm", lat: 21.0300, lng: 105.8431,
    durationMin: 60, costUsd: 0, bestTime: "afternoon", touristy: 5,
    note: "Police have closed and reopened the cafés along the track repeatedly since 2019, and the whole activity is standing in a live railway for a photograph. Long Biên gives you trains and a better bridge without the theatre.", skip: true },

  { id: "han-eggcoffee", cityId: "hanoi", name: "Egg coffee at Giảng", kind: "meal",
    tags: ["coffee", "local"], neighborhood: "Yên Phụ", lat: 21.0415, lng: 105.8490,
    durationMin: 40, costUsd: 2, opens: "07:00", closes: "22:00", bestTime: "morning", touristy: 3,
    note: "Yolk whipped with condensed milk over hot black coffee, invented here in 1946 when milk ran short. Drink it fast, before the top cools into custard." },

  { id: "han-buncha", cityId: "hanoi", name: "Bún chả on Hàng Buồm", kind: "meal",
    tags: ["food", "local"], neighborhood: "Hàng Buồm", lat: 21.0359, lng: 105.8510,
    durationMin: 50, costUsd: 3, opens: "11:00", closes: "14:00", bestTime: "midday", touristy: 2,
    note: "Charcoal-grilled pork dropped into a bowl of sweet fish-sauce broth, with cold noodles and a basket of herbs to wreck it with. A lunch dish — the places doing it at eight in the evening are doing it for you, not for them." },

  { id: "han-pho", cityId: "hanoi", name: "Phở for breakfast", kind: "meal",
    tags: ["food", "local", "earlystart"], neighborhood: "Hoàn Kiếm", lat: 21.0287, lng: 105.8489,
    durationMin: 35, costUsd: 3, opens: "06:00", closes: "10:00", bestTime: "morning", touristy: 2,
    note: "Northern phở is clear, beefy and almost bare — no hoisin, no bean sprouts, a wedge of lime if you insist. Find the shop with one thing on the sign and a queue at seven." },

  { id: "han-biahoi", cityId: "hanoi", name: "Bia hơi around Đồng Xuân", kind: "drink",
    tags: ["nightlife", "local", "food"], neighborhood: "Hoàn Kiếm", lat: 21.0382, lng: 105.8497,
    durationMin: 90, costUsd: 6, opens: "16:00", closes: "23:00", bestTime: "evening", touristy: 2,
    note: "Unpasteurised draught brewed that morning and drunk the same day, at about twenty-five cents a glass on a kerbside stool. It is weak and it is meant to be — the food coming off the cart beside you is the other half." },

  // ------------------------------------------------------------- Ninh Bình --
  { id: "nib-trangan", cityId: "ninhbinh", name: "Tràng An boat trip", kind: "experience",
    tags: ["boat", "nature", "viewpoint"], neighborhood: "Hoa Lư", lat: 20.2567, lng: 105.8964,
    durationMin: 180, costUsd: 10, opens: "07:00", closes: "16:00", bestTime: "morning", touristy: 4,
    note: "Two and a half hours rowed by one woman using her feet, through nine flooded caves you have to lie flat in. Route one is the long one and the least busy; go at opening, because the last boats leave early." },

  { id: "nib-tamcoc", cityId: "ninhbinh", name: "Tam Cốc by sampan", kind: "experience",
    tags: ["boat", "nature", "viewpoint"], neighborhood: "Hoa Lư", lat: 20.2163, lng: 105.9375,
    durationMin: 150, costUsd: 8, bestTime: "afternoon", touristy: 4,
    note: "The older, shorter version of the Tràng An trip, through three caves with rice either side — best in late May when the paddy has turned. Agree the price at the pier, because the mid-river souvenir boat is a fixture." },

  { id: "nib-baidinh", cityId: "ninhbinh", name: "Bái Đính Temple", kind: "sight",
    tags: ["church", "architecture", "walk"], neighborhood: "Gia Viễn", lat: 20.2737, lng: 105.8644,
    durationMin: 120, costUsd: 3, bestTime: "morning", touristy: 4,
    note: "Built in 2003 at a scale that reads as a statement rather than a temple — five hundred stone arhats down a 3 km covered corridor. Impressive and entirely new, and worth knowing that before you spend the morning on it." },

  { id: "nib-hangmua", cityId: "ninhbinh", name: "Hang Múa steps", kind: "outdoor",
    tags: ["hike", "viewpoint", "nature"], neighborhood: "Hoa Lư", lat: 20.2299, lng: 105.9342,
    durationMin: 90, costUsd: 4, bestTime: "morning", touristy: 4,
    note: "About five hundred uneven stone steps to a dragon on a limestone spine, looking down over the rice and the river. Worn slick in places and genuinely steep at the top — not a flip-flop climb." },

  // ---------------------------------------------------------------- Hạ Long --
  { id: "hal-cruise", cityId: "halong", name: "A night on the bay", kind: "experience",
    tags: ["boat", "nature", "viewpoint"], neighborhood: "Hạ Long Bay", lat: 20.9084, lng: 107.0683,
    durationMin: 300, costUsd: 0, bestTime: "afternoon", touristy: 4,
    note: "Nearly two thousand limestone islands, and the difference between a good trip and a bad one is entirely which boat and which route. One night is the sweet spot; two is a lot of buffet." },

  { id: "hal-sungsot", cityId: "halong", name: "Sửng Sốt cave", kind: "sight",
    tags: ["nature", "boat"], neighborhood: "Bồ Hòn", lat: 20.8440, lng: 107.0910,
    durationMin: 75, costUsd: 0, bestTime: "midday", touristy: 5,
    note: "Two enormous chambers up a stepped path from the water, lit in colours nobody would have chosen. Every day boat stops here at the same hour, so the queue on the steps is part of the deal." },

  { id: "hal-lanha", cityId: "halong", name: "Kayaking in Lan Hạ Bay", kind: "outdoor",
    tags: ["adventure", "boat", "nature", "coast"], neighborhood: "Lan Hạ", lat: 20.7516, lng: 107.1043,
    durationMin: 120, costUsd: 0, bestTime: "afternoon", touristy: 2,
    note: "The southern bay, technically Haiphong's, with a fraction of the boat traffic and the same karst. If an operator offers Hạ Long or Lan Hạ, take Lan Hạ." },

  { id: "hal-catba", cityId: "halong", name: "Cát Bà island", kind: "outdoor",
    tags: ["nature", "hike", "coast", "beach"], neighborhood: "Cát Hải", lat: 20.8067, lng: 107.0017,
    durationMin: 240, costUsd: 0, bestTime: "morning", touristy: 3,
    note: "Half of it is national park and the other half is a seafront of tall thin hotels. Come for the forest trails and the beaches on the east side, not the town." },

  // ---------------------------------------------------------------- Hội An --
  { id: "hoi-oldtown", cityId: "hoian", name: "Hội An Ancient Town", kind: "walk",
    tags: ["walk", "history", "architecture", "iconic"], neighborhood: "Minh An", lat: 15.8771, lng: 108.3287,
    durationMin: 120, costUsd: 5, bestTime: "morning", touristy: 5,
    note: "One ticket buys entry to five of twenty-odd heritage houses and halls, which is the right number — do more and they blur. Before eight the streets belong to people sweeping them." },

  { id: "hoi-bridge", cityId: "hoian", name: "The Japanese Covered Bridge", kind: "sight",
    tags: ["history", "architecture", "iconic"], neighborhood: "Minh An", lat: 15.8771, lng: 108.3260,
    durationMin: 25, costUsd: 0, bestTime: "morning", touristy: 5,
    note: "Late sixteenth century, with a small temple built into the span and a monkey at one end, a dog at the other. It was taken apart and rebuilt in 2024, so the paint is new and people complain about that." },

  { id: "hoi-fujian", cityId: "hoian", name: "Fujian Assembly Hall", kind: "sight",
    tags: ["history", "architecture", "church"], neighborhood: "Minh An", lat: 15.8781, lng: 108.3310,
    durationMin: 40, costUsd: 0, bestTime: "morning", touristy: 4,
    note: "The Fujianese merchants' clubhouse and temple to the sea goddess, with coils of incense burning overhead for a month at a time. The biggest and most theatrical of the five assembly halls — if you do one, do this." },

  { id: "hoi-quancong", cityId: "hoian", name: "Quan Công Temple", kind: "sight",
    tags: ["history", "church", "local"], neighborhood: "Minh An", lat: 15.8775, lng: 108.3314,
    durationMin: 25, costUsd: 0, bestTime: "afternoon", touristy: 3,
    note: "1653, on the corner opposite the market, and still a working temple rather than an exhibit. Papier-mâché horses either side of the altar and a courtyard pond full of turtles." },

  { id: "hoi-market", cityId: "hoian", name: "Hội An central market", kind: "market",
    tags: ["market", "food", "local"], neighborhood: "Minh An", lat: 15.8768, lng: 108.3314,
    durationMin: 60, costUsd: 4, bestTime: "morning", touristy: 3,
    note: "Riverside, loud, and at its best at seven when the boats land. The cooked-food end at the back is where to eat; the souvenir end at the front is not the same market." },

  { id: "hoi-precious", cityId: "hoian", name: "Precious Heritage gallery", kind: "museum",
    tags: ["museum", "art", "local"], neighborhood: "Minh An", lat: 15.8772, lng: 108.3342,
    durationMin: 60, costUsd: 0, opens: "08:00", closes: "20:00", bestTime: "afternoon", touristy: 2,
    note: "One photographer's portraits of all fifty-four ethnic groups, shown with the costumes he was given, in a courtyard house. Free, open late, and the best hour in town when it rains." },

  { id: "hoi-thanhha", cityId: "hoian", name: "Thanh Hà pottery village", kind: "experience",
    tags: ["local", "walk", "shopping"], neighborhood: "Thanh Hà", lat: 15.8833, lng: 108.3315,
    durationMin: 90, costUsd: 2, bestTime: "afternoon", touristy: 3,
    note: "Five hundred years of terracotta, still thrown on foot-powered wheels in about thirty family workshops along one lane. Cycle out; it is 3 km and flat the whole way." },

  { id: "hoi-traque", cityId: "hoian", name: "Trà Quế herb village", kind: "experience",
    tags: ["local", "food", "garden", "walk"], neighborhood: "Trà Quế", lat: 15.9022, lng: 108.3388,
    durationMin: 90, costUsd: 2, bestTime: "morning", touristy: 3,
    note: "Forty hectares of herbs grown on lake weed dragged up from the lagoon, which is why everything here tastes stronger than it should. Go early and you will be handed a watering yoke, which wears off after about ten minutes." },

  { id: "hoi-cooking", cityId: "hoian", name: "A cooking class in Trà Quế", kind: "experience",
    tags: ["food", "local"], neighborhood: "Trà Quế", lat: 15.9022, lng: 108.3388,
    durationMin: 240, costUsd: 30, bestTime: "morning", touristy: 3,
    note: "Market, boat, garden, then four dishes — the good ones start at the market and the bad ones start at a bench. Ask whether you shop first; if not, book elsewhere." },

  { id: "hoi-anbang", cityId: "hoian", name: "An Bàng beach", kind: "outdoor",
    tags: ["beach", "coast", "walk"], neighborhood: "Cẩm An", lat: 15.9048, lng: 108.3548,
    durationMin: 180, costUsd: 6, bestTime: "afternoon", touristy: 3,
    note: "Four km from the old town by bike, and the one that survived while Cửa Đại down the coast washed away. A lounger and a beer costs about what a coffee does in town." },

  { id: "hoi-banhmi", cityId: "hoian", name: "Bánh mì at Phượng", kind: "meal",
    tags: ["food", "local"], neighborhood: "Minh An", lat: 15.8785, lng: 108.3320,
    durationMin: 30, costUsd: 2, opens: "06:30", closes: "21:00", bestTime: "midday", touristy: 5,
    note: "Pâté, three kinds of pork, herbs and a sauce the family will not explain, in a roll baked to stay crisp in the humidity. The queue moves fast and is worth it; the copycat two doors down is not." },

  { id: "hoi-balewell", cityId: "hoian", name: "Dinner at Bale Well", kind: "meal",
    tags: ["food", "local"], neighborhood: "Minh An", lat: 15.8789, lng: 108.3298,
    durationMin: 90, costUsd: 8, opens: "10:00", closes: "22:00", bestTime: "evening", touristy: 3,
    note: "One set menu down an alley — grilled pork, bánh xèo, a stack of rice paper, and a woman who will roll the first one for you and then watch. No choosing involved, which is the appeal." },

  { id: "hoi-caolau", cityId: "hoian", name: "Cao lầu at the market", kind: "meal",
    tags: ["food", "local", "market"], neighborhood: "Minh An", lat: 15.8768, lng: 108.3314,
    durationMin: 45, costUsd: 3, bestTime: "midday", touristy: 2,
    note: "Thick chewy noodles that are only made here, because the recipe needs ash from Chàm island and water from one particular well. Pork, greens, croutons, barely any broth." },

  // -------------------------------------------------------------- Mỹ Sơn --
  { id: "mys-sanctuary", cityId: "myson", name: "Mỹ Sơn sanctuary", kind: "sight",
    tags: ["history", "architecture", "iconic"], neighborhood: "Duy Xuyên", lat: 15.7656, lng: 108.1223,
    durationMin: 150, costUsd: 6, opens: "06:00", closes: "18:00", bestTime: "morning", touristy: 4,
    note: "Cham brick towers from the fourth to the thirteenth century, in a bowl of jungle, about a fifth of them still standing after a week of B-52s in 1969. First bus at dawn or you walk it at noon in a valley with no breeze." },

  { id: "mys-chamdance", cityId: "myson", name: "The Cham dance at Mỹ Sơn", kind: "experience",
    tags: ["music", "local", "history"], neighborhood: "Duy Xuyên", lat: 15.7656, lng: 108.1223,
    durationMin: 40, costUsd: 0, opens: "09:00", closes: "16:00", bestTime: "morning", touristy: 4,
    note: "Twenty minutes of apsara dance and Cham drums, included in the ticket, run six or seven times a day between the performance house and tower group G. The nine o'clock one at the towers is the only one performed outdoors." },

  // ----------------------------------------------------------------- Taipei --
  { id: "tpe-longshan", cityId: "taipei", name: "Longshan Temple", kind: "sight",
    tags: ["history", "architecture", "church", "local"], neighborhood: "Wanhua", lat: 25.0373, lng: 121.4999,
    durationMin: 50, costUsd: 0, opens: "06:00", closes: "22:00", bestTime: "evening", touristy: 4,
    note: "Founded 1738, bombed in 1945, and still the busiest working temple in the city — a hundred deities and a queue for all of them. Go at six in the evening for the chanting rather than at eleven for the photographs." },

  { id: "tpe-baoan", cityId: "taipei", name: "Dalongdong Baoan Temple", kind: "sight",
    tags: ["history", "architecture", "church", "art"], neighborhood: "Datong", lat: 25.0732, lng: 121.5156,
    durationMin: 45, costUsd: 0, bestTime: "afternoon", touristy: 2,
    note: "A restoration so careful UNESCO gave it an award in 2003, and the murals on the outer wall were painted by one man over two years. Quieter than Longshan by an order of magnitude." },

  { id: "tpe-confucius", cityId: "taipei", name: "Taipei Confucius Temple", kind: "sight",
    tags: ["history", "architecture", "garden"], neighborhood: "Datong", lat: 25.0729, lng: 121.5166,
    durationMin: 40, costUsd: 0, bestTime: "morning", touristy: 2,
    note: "Deliberately plain — no statues, no images, just tablets — which after two days of gold dragons is a relief. Across the road from Baoan, so do the pair in one go." },

  { id: "tpe-xingtian", cityId: "taipei", name: "Xingtian Temple", kind: "sight",
    tags: ["church", "local"], neighborhood: "Zhongshan", lat: 25.0631, lng: 121.5338,
    durationMin: 35, costUsd: 0, bestTime: "midday", touristy: 2,
    note: "No incense, no paper money, no donation box — this one banned all three. Come for the blue-robed volunteers performing the shoujing ritual over people's heads, which happens all day and costs nothing." },

  { id: "tpe-palacemuseum", cityId: "taipei", name: "National Palace Museum", kind: "museum",
    tags: ["museum", "art", "history", "iconic"], neighborhood: "Shilin", lat: 25.1022, lng: 121.5486,
    durationMin: 180, costUsd: 11, bestTime: "morning", touristy: 5,
    note: "The imperial collection that left Beijing in crates in 1948, and only a fraction is out at a time. Treat it as three galleries and go — the jade cabbage has its own queue and is the size of a hand." },

  { id: "tpe-tfam", cityId: "taipei", name: "Taipei Fine Arts Museum", kind: "museum",
    tags: ["museum", "contemporary", "art", "architecture"], neighborhood: "Zhongshan", lat: 25.0725, lng: 121.5247,
    durationMin: 110, costUsd: 1, closedDays: [1], bestTime: "afternoon", touristy: 2,
    note: "Taiwanese modern and contemporary work in a white stacked-tube building from 1983, and the ticket costs less than a coffee. Shut Mondays." },

  { id: "tpe-moca", cityId: "taipei", name: "MOCA Taipei", kind: "museum",
    tags: ["museum", "contemporary", "art"], neighborhood: "Datong", lat: 25.0508, lng: 121.5190,
    durationMin: 80, costUsd: 3, opens: "10:00", closes: "18:00", closedDays: [1], bestTime: "afternoon", touristy: 2,
    note: "Small, in a 1920s Japanese school building, and it programmes harder than its size suggests. Two shows at a time, so check what is up before you commit an afternoon." },

  { id: "tpe-228museum", cityId: "taipei", name: "National 228 Memorial Museum", kind: "museum",
    tags: ["museum", "history"], neighborhood: "Zhongzheng", lat: 25.0315, lng: 121.5140,
    durationMin: 75, costUsd: 1, opens: "10:00", closes: "17:00", closedDays: [1], bestTime: "afternoon", touristy: 1,
    note: "The 1947 massacre and the forty years of martial law that followed, told without hedging. An hour here makes the rest of the country legible in a way the palace museum does not." },

  { id: "tpe-cks", cityId: "taipei", name: "Chiang Kai-shek Memorial Hall", kind: "sight",
    tags: ["history", "architecture", "iconic"], neighborhood: "Zhongzheng", lat: 25.0344, lng: 121.5217,
    durationMin: 60, costUsd: 0, bestTime: "morning", touristy: 5,
    note: "An enormous white hall at the top of eighty-nine steps, with a permanent exhibition downstairs that now argues with the man upstairs. Whether the guard change still happens depends on which year's politics you have arrived in." },

  { id: "tpe-dihua", cityId: "taipei", name: "Dihua Street", kind: "walk",
    tags: ["walk", "history", "shopping", "market", "architecture"], neighborhood: "Dadaocheng", lat: 25.0666, lng: 121.5099,
    durationMin: 90, costUsd: 0, bestTime: "afternoon", touristy: 3,
    note: "Baroque shophouse fronts over sacks of dried scallop and medicinal bark, with a handful of good design shops wedged in between. The tea merchants at the south end will brew you something for nothing." },

  { id: "tpe-dadaocheng", cityId: "taipei", name: "Dadaocheng Wharf at sunset", kind: "walk",
    tags: ["walk", "coast", "local", "viewpoint"], neighborhood: "Dadaocheng", lat: 25.0566, lng: 121.5078,
    durationMin: 60, costUsd: 0, bestTime: "evening", touristy: 2,
    note: "Through a floodgate in the river wall to a strip of container bars facing west down the Tamsui. Five minutes from Dihua Street and the obvious thing to do after it." },

  { id: "tpe-huashan", cityId: "taipei", name: "Huashan 1914 Creative Park", kind: "walk",
    tags: ["contemporary", "walk", "shopping", "art"], neighborhood: "Zhongzheng", lat: 25.0444, lng: 121.5294,
    durationMin: 90, costUsd: 0, bestTime: "afternoon", touristy: 3,
    note: "A Japanese-era winery turned into galleries, a cinema and too many gift shops. Worth an hour for whatever ticketed show is on; the permanent retail is skippable." },

  { id: "tpe-songshan", cityId: "taipei", name: "Songshan Cultural and Creative Park", kind: "walk",
    tags: ["contemporary", "architecture", "walk", "art"], neighborhood: "Xinyi", lat: 25.0439, lng: 121.5608,
    durationMin: 90, costUsd: 0, bestTime: "afternoon", touristy: 3,
    note: "A 1937 tobacco factory with a baroque garden in the middle and Ito's Eslite building bolted on the side. Better bones than Huashan and fewer people in them." },

  { id: "tpe-101", cityId: "taipei", name: "Taipei 101 observatory", kind: "sight",
    tags: ["viewpoint", "iconic", "architecture"], neighborhood: "Xinyi", lat: 25.0336, lng: 121.5647,
    durationMin: 90, costUsd: 19, opens: "09:00", closes: "22:00", bestTime: "evening", touristy: 5,
    note: "Thirty-seven seconds to the 89th floor, and the 660-tonne gold damper hanging in the middle is more interesting than the view. Elephant Mountain gives you the tower in the picture instead of under your feet, for free." },

  { id: "tpe-elephant", cityId: "taipei", name: "Elephant Mountain", kind: "outdoor",
    tags: ["hike", "viewpoint", "nature"], neighborhood: "Xinyi", lat: 25.0265, lng: 121.5755,
    durationMin: 90, costUsd: 0, bestTime: "evening", touristy: 4,
    note: "Twenty minutes of steep stone steps from the metro to the standard postcard of the city. Everyone arrives at the same six boulders — keep going another ten minutes and you get the same view alone." },

  { id: "tpe-maokong", cityId: "taipei", name: "Maokong gondola and the tea houses", kind: "experience",
    tags: ["viewpoint", "nature", "coffee", "local"], neighborhood: "Wenshan", lat: 24.9959, lng: 121.5762,
    durationMin: 180, costUsd: 6, closedDays: [1], bestTime: "afternoon", touristy: 3,
    note: "Twenty-five minutes over the tea terraces in a cable car with a glass floor if you queue for one, then a hillside of open-air tea houses where you brew it yourself. Shut most Mondays for maintenance." },

  { id: "tpe-thermalvalley", cityId: "taipei", name: "Beitou Thermal Valley", kind: "sight",
    tags: ["nature", "walk"], neighborhood: "Beitou", lat: 25.1380, lng: 121.5120,
    durationMin: 40, costUsd: 0, closedDays: [1], bestTime: "morning", touristy: 3,
    note: "A steaming green sulphur lake at the top of the park, hot enough that the railings exist for a reason. Fifteen minutes, and it is the reason the whole valley smells the way it does." },

  { id: "tpe-hotspringmuseum", cityId: "taipei", name: "Beitou Hot Spring Museum", kind: "museum",
    tags: ["museum", "history", "architecture", "spa"], neighborhood: "Beitou", lat: 25.1367, lng: 121.5072,
    durationMin: 60, costUsd: 0, closedDays: [1], bestTime: "morning", touristy: 3,
    note: "The 1913 Japanese public bathhouse, half brick villa and half tatami hall, kept as it was. Free, and it explains why a Taipei suburb looks like a spa town in Shizuoka." },

  { id: "tpe-beitousoak", cityId: "taipei", name: "The Beitou public hot spring", kind: "experience",
    tags: ["spa", "local"], neighborhood: "Beitou", lat: 25.1368, lng: 121.5079,
    durationMin: 90, costUsd: 2, bestTime: "evening", touristy: 2,
    note: "Six terraced outdoor pools, swimsuits required, mostly full of pensioners who have been coming for decades. Two dollars, and the private hotel baths up the hill cost fifty times that for the same water." },

  { id: "tpe-xiaoyoukeng", cityId: "yangmingshan", name: "Xiaoyoukeng", kind: "outdoor",
    tags: ["nature", "viewpoint", "walk"], neighborhood: "Yangmingshan", lat: 25.1754, lng: 121.5476,
    durationMin: 60, costUsd: 0, bestTime: "morning", touristy: 3,
    note: "A sulphur fumarole roaring out of the hillside with yellow crystals building up around it, twenty metres from the car park. The smell is the whole experience and it gets into your clothes." },

  { id: "tpe-qixing", cityId: "yangmingshan", name: "Qixing Mountain", kind: "outdoor",
    tags: ["hike", "nature", "viewpoint", "earlystart"], neighborhood: "Yangmingshan", lat: 25.1707, lng: 121.5534,
    durationMin: 210, costUsd: 0, bestTime: "morning", touristy: 2,
    note: "Taiwan's tallest dormant volcano at 1,120 m, and a city bus gets you to the trailhead. The top is in cloud most afternoons, so this is a morning or it is a walk in fog." },

  { id: "tpe-qingtiangang", cityId: "yangmingshan", name: "Qingtiangang grassland", kind: "outdoor",
    tags: ["walk", "nature", "viewpoint"], neighborhood: "Yangmingshan", lat: 25.1674, lng: 121.5740,
    durationMin: 90, costUsd: 0, bestTime: "afternoon", touristy: 3,
    note: "A flat lava terrace at 770 m grazed by semi-wild water buffalo, which have right of way and know it. Forty minutes of level walking, which after Qixing is exactly what you want." },

  { id: "tpe-yangmingsoak", cityId: "yangmingshan", name: "A sulphur soak on the mountain", kind: "experience",
    tags: ["spa", "nature", "local"], neighborhood: "Yangmingshan", lat: 25.1707, lng: 121.5534,
    durationMin: 90, costUsd: 6, bestTime: "evening", touristy: 2,
    note: "The white springs up here are the same water as Beitou's without the town wrapped round them, and most of the bathhouses up here are small and take cash only. Do it at the end of the walking." },

  { id: "tpe-raohe", cityId: "taipei", name: "Raohe Street Night Market", kind: "market",
    tags: ["market", "food", "local"], neighborhood: "Songshan", lat: 25.0502, lng: 121.5726,
    durationMin: 90, costUsd: 8, opens: "17:00", closes: "24:00", bestTime: "evening", touristy: 4,
    note: "One straight six-hundred-metre lane, which makes it the easiest of the big markets to actually work through. The black-pepper bun oven at the temple end is the first stop and the queue moves." },

  { id: "tpe-ningxia", cityId: "taipei", name: "Ningxia Night Market", kind: "market",
    tags: ["market", "food", "local"], neighborhood: "Datong", lat: 25.0556, lng: 121.5151,
    durationMin: 75, costUsd: 8, opens: "17:30", closes: "01:00", bestTime: "evening", touristy: 2,
    note: "Short, old, and almost entirely food rather than phone cases — oyster omelette, taro balls, sesame oil chicken. This is the one locals name when you ask them." },

  { id: "tpe-linjiang", cityId: "taipei", name: "Linjiang Street Night Market", kind: "market",
    tags: ["market", "food", "local"], neighborhood: "Da'an", lat: 25.0299, lng: 121.5554,
    durationMin: 75, costUsd: 8, bestTime: "evening", touristy: 2,
    note: "Tonghua to everyone who lives near it, a kilometre from Taipei 101 and untroubled by anyone visiting it. Grilled skewers, xiaolongbao, and a stall selling only fried sweet potato balls." },

  { id: "tpe-shilin", cityId: "taipei", name: "Shilin Night Market", kind: "market",
    tags: ["market", "food", "iconic"], neighborhood: "Shilin", lat: 25.0866, lng: 121.5254,
    durationMin: 90, costUsd: 0, bestTime: "evening", touristy: 5,
    note: "Five hundred stalls, a basement food court with no air, and prices a third above every other market in this list. Go to Ningxia and eat better for less.", skip: true },

  { id: "tpe-tamsui", cityId: "tamsui", name: "The Tamsui waterfront", kind: "walk",
    tags: ["walk", "coast", "local", "food"], neighborhood: "Tamsui", lat: 25.1719, lng: 121.4439,
    durationMin: 120, costUsd: 0, bestTime: "evening", touristy: 4,
    note: "Forty minutes to the end of the red line and the river mouth, with a seafront of iron-egg stalls and A-gei. Cross on the ferry to Bali for the sunset back at the town." },

  { id: "tpe-fortsandomingo", cityId: "tamsui", name: "Fort San Domingo", kind: "sight",
    tags: ["history", "architecture", "viewpoint"], neighborhood: "Tamsui", lat: 25.1742, lng: 121.4375,
    durationMin: 75, costUsd: 3, closedDays: [1], bestTime: "afternoon", touristy: 3,
    note: "Spanish in 1628, Dutch after, then the British consulate for a century — the consul's brick house next door is the better half. Ten minutes uphill from the Tamsui waterfront, so pair them." },

  { id: "tpe-hobefort", cityId: "tamsui", name: "Hobe Fort", kind: "sight",
    tags: ["history", "architecture", "viewpoint"], neighborhood: "Tamsui", lat: 25.1794, lng: 121.4293,
    durationMin: 45, costUsd: 0, bestTime: "afternoon", touristy: 2,
    note: "An 1886 earth-and-brick gun emplacement thrown up after the French shelled the estuary, guns long gone and the casemates open. Empty on a weekday, and a quarter of an hour from the fort everyone else goes to." },

  { id: "tpe-fishermanswharf", cityId: "tamsui", name: "Fisherman's Wharf", kind: "walk",
    tags: ["walk", "coast", "viewpoint"], neighborhood: "Tamsui", lat: 25.1820, lng: 121.4186,
    durationMin: 60, costUsd: 2, bestTime: "evening", touristy: 4,
    note: "A white cable-stayed footbridge over a marina at the river mouth, which is where the sunset actually is — the old street faces the wrong way. Take the ferry up from the town rather than the bus." },

  { id: "tpe-botanical", cityId: "taipei", name: "Taipei Botanical Garden", kind: "outdoor",
    tags: ["garden", "nature", "walk"], neighborhood: "Zhongzheng", lat: 25.0323, lng: 121.5095,
    durationMin: 60, costUsd: 0, bestTime: "morning", touristy: 1,
    note: "Eight hectares laid out by the Japanese in 1921, with a lotus pond that is worth the trip in July and not much in January. Free, and next door to the 228 museum." },

  { id: "tpe-beefnoodle", cityId: "taipei", name: "Beef noodles at Lin Dong Fang", kind: "meal",
    tags: ["food", "local"], neighborhood: "Zhongshan", lat: 25.0472, lng: 121.5431,
    durationMin: 50, costUsd: 6, opens: "11:00", closes: "23:00", closedDays: [0], bestTime: "evening", touristy: 3,
    note: "Clear broth rather than the dark braised kind, with a jar of beef-fat chilli on the table you should use. Open until three in the morning and shut all day Sunday." },

  { id: "tpe-ximending", cityId: "taipei", name: "Ximending", kind: "walk",
    tags: ["walk", "shopping", "nightlife", "contemporary"], neighborhood: "Wanhua", lat: 25.0435, lng: 121.5072,
    durationMin: 75, costUsd: 0, bestTime: "evening", touristy: 4,
    note: "Taipei's pedestrianised teenage quarter — neon, sneaker shops, buskers, and a 1908 octagonal market building in the middle of it. An hour is plenty and you will not want to sleep here." },

  { id: "tpe-aychung", cityId: "taipei", name: "Ay-Chung rice noodles", kind: "meal",
    tags: ["food", "local"], neighborhood: "Ximending", lat: 25.0433, lng: 121.5077,
    durationMin: 25, costUsd: 3, opens: "10:00", closes: "22:30", bestTime: "afternoon", touristy: 4,
    note: "Thickened broth with pork intestine and fine noodles, eaten standing on the pavement because there are no seats and never have been. Add the chilli and the black vinegar from the counter; nobody eats it plain." },

  { id: "tpe-yongkang", cityId: "taipei", name: "Beef noodles on Yongkang Street", kind: "meal",
    tags: ["food", "local"], neighborhood: "Da'an", lat: 25.0329, lng: 121.5281,
    durationMin: 60, costUsd: 8, bestTime: "midday", touristy: 4,
    note: "The dark braised version, thick with soy and spice, which is the other half of the argument Taipei has been having with itself about beef noodles since the 1950s. Queues at one, empty at three." },

  { id: "tpe-pepperbun", cityId: "taipei", name: "Pepper buns at the Raohe oven", kind: "meal",
    tags: ["food", "local", "market"], neighborhood: "Songshan", lat: 25.0502, lng: 121.5726,
    durationMin: 25, costUsd: 2, opens: "17:00", closes: "24:00", bestTime: "evening", touristy: 4,
    note: "Pork and spring onion in a bun slapped onto the inside wall of a clay tandoor at the temple end of the market. Eat it walking and give it two minutes first, or you will take the roof off your mouth." },

  { id: "tpe-wistaria", cityId: "taipei", name: "Wistaria Tea House", kind: "drink",
    tags: ["coffee", "history", "architecture", "local"], neighborhood: "Da'an", lat: 25.0246, lng: 121.5343,
    durationMin: 90, costUsd: 13, opens: "10:00", closes: "23:00", bestTime: "afternoon", touristy: 2,
    note: "A 1920s wooden house where the democracy movement did its arguing in the 1970s, now a listed monument. You get a table, a burner and leaves, and are expected to sit there for two hours." },

  // ---------------------------------------------------------------- Jiufen --
  { id: "jiu-oldstreet", cityId: "jiufen", name: "Jiufen Old Street", kind: "walk",
    tags: ["walk", "food", "viewpoint", "iconic"], neighborhood: "Ruifang", lat: 25.1117, lng: 121.8451,
    durationMin: 120, costUsd: 8, bestTime: "evening", touristy: 5,
    note: "A gold-rush town of stepped alleys and red lanterns above the sea, and between eleven and four it is shoulder to shoulder. Arrive after five, when the coaches leave and the lanterns come on." },

  { id: "jiu-goldmuseum", cityId: "jiufen", name: "Jinguashi Gold Museum", kind: "museum",
    tags: ["museum", "history", "walk"], neighborhood: "Jinguashi", lat: 25.1084, lng: 121.8561,
    durationMin: 120, costUsd: 3, closedDays: [1], bestTime: "morning", touristy: 3,
    note: "The mining settlement over the ridge from Jiufen, including the Japanese-era barracks and a tunnel you walk into. It also tells the story of the Allied POW camp here, which most visitors do not know existed." },

  { id: "jiu-teapot", cityId: "jiufen", name: "Teapot Mountain", kind: "outdoor",
    tags: ["hike", "viewpoint", "nature"], neighborhood: "Jinguashi", lat: 25.1064, lng: 121.8659,
    durationMin: 150, costUsd: 0, bestTime: "morning", touristy: 2,
    note: "An hour of steps and then a short scramble through a rock hole to a 599 m summit over the coast. Exposed, windy, and the payoff is the whole gold coast at once." },

  // ---------------------------------------------------------------- Pingxi --
  { id: "pin-shifen", cityId: "pingxi", name: "Shifen Waterfall", kind: "outdoor",
    tags: ["nature", "walk", "viewpoint"], neighborhood: "Pingxi", lat: 25.0490, lng: 121.7873,
    durationMin: 75, costUsd: 0, bestTime: "morning", touristy: 4,
    note: "Twenty metres high and forty wide, the broadest in Taiwan, on a boardwalk loop from the road. Free since the county took it back, and quiet before ten." },

  { id: "pin-houtong", cityId: "pingxi", name: "Houtong cat village", kind: "walk",
    tags: ["walk", "local", "history"], neighborhood: "Ruifang", lat: 25.0871, lng: 121.8266,
    durationMin: 90, costUsd: 0, bestTime: "afternoon", touristy: 3,
    note: "A dead coal village that residents restocked with cats in 2008 and thereby saved. The coal-washing plant ruins above the tracks are the better half and almost nobody walks up to them." },

  { id: "pin-shifenoldstreet", cityId: "pingxi", name: "Shifen Old Street", kind: "walk",
    tags: ["walk", "iconic", "shopping"], neighborhood: "Pingxi", lat: 25.0427, lng: 121.7768,
    durationMin: 60, costUsd: 0, bestTime: "afternoon", touristy: 5,
    note: "A shopping street built either side of a live railway, where the business is selling paper lanterns to release over the hills. The lanterns come down in the forest, and someone is paid to collect them.", skip: true },

  // --------------------------------------------------------------- Keelung --
  { id: "kee-miaokou", cityId: "keelung", name: "Keelung Miaokou Night Market", kind: "market",
    tags: ["market", "food", "local", "coast"], neighborhood: "Ren'ai", lat: 25.1289, lng: 121.7437,
    durationMin: 100, costUsd: 8, bestTime: "evening", touristy: 3,
    note: "Two hundred numbered stalls down both sides of a temple forecourt, and it is a port so the seafood is the reason. Fifty minutes from Taipei and easily bolted onto a Jiufen day." },

  { id: "kee-zhengbin", cityId: "keelung", name: "Zhengbin fishing harbour", kind: "walk",
    tags: ["walk", "coast", "local", "viewpoint"], neighborhood: "Zhongzheng", lat: 25.1526, lng: 121.7659,
    durationMin: 60, costUsd: 0, bestTime: "afternoon", touristy: 2,
    note: "A working harbour whose terrace of houses was painted in sixteen flat colours in 2017, which sounds like a gimmick and photographs like one. The fish are still landed on the quay in front of it." },

  // ----------------------------------------------------------------- Wulai --
  { id: "wul-waterfall", cityId: "wulai", name: "Wulai waterfall and the old tram", kind: "outdoor",
    tags: ["nature", "viewpoint", "walk"], neighborhood: "Wulai", lat: 24.8475, lng: 121.5524,
    durationMin: 120, costUsd: 2, bestTime: "morning", touristy: 3,
    note: "Eighty metres onto the river, reached on a narrow-gauge logging tram that now carries people instead of trees. The riverside path beside the track is free and takes fifteen minutes." },

  { id: "wul-hotspring", cityId: "wulai", name: "Wulai hot spring village", kind: "experience",
    tags: ["spa", "local", "nature"], neighborhood: "Wulai", lat: 24.8640, lng: 121.5510,
    durationMin: 150, costUsd: 0, bestTime: "afternoon", touristy: 2,
    note: "Atayal territory, an hour south of Taipei, with free public pools cut into the riverbed below the bridge and paid bathhouses above it. Bring a towel; nobody rents them down at the river." },
];
