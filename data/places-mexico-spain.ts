import type { Place } from "@/lib/types";

// Bringing Mexico and Andalusia up to the depth Portugal, Iceland and Korea
// already had. Same rule: every note written by hand.

export const MEXICO_SPAIN_PLACES: Place[] = [
  // ----------------------------------------------------------- Mexico City --
  { id: "cdmx-templomayor", cityId: "cdmx", name: "Templo Mayor", kind: "sight",
    tags: ["history", "architecture"], neighborhood: "Centro", lat: 19.4344, lng: -99.1316,
    durationMin: 105, costUsd: 5, opens: "09:00", closes: "17:00", closedDays: [1], bestTime: "morning", touristy: 4,
    note: "The Aztec great temple, dug out from under the colonial city that was built on top of it using its stones. The layering is the point and the museum explains it well." },

  { id: "cdmx-bellasartes", cityId: "cdmx", name: "Palacio de Bellas Artes", kind: "museum",
    tags: ["art", "architecture", "music"], neighborhood: "Centro", lat: 19.4352, lng: -99.1412,
    durationMin: 90, costUsd: 5, opens: "10:00", closes: "18:00", closedDays: [1], bestTime: "morning", touristy: 4,
    note: "Rivera, Siqueiros and Orozco murals upstairs, all arguing with each other about the revolution. Marble outside, art deco inside, and it is visibly sinking." },

  { id: "cdmx-chapultepec", cityId: "cdmx", name: "Bosque de Chapultepec", kind: "outdoor",
    tags: ["nature", "garden", "walk", "local"], neighborhood: "Chapultepec", lat: 19.4200, lng: -99.1810,
    durationMin: 120, costUsd: 0, bestTime: "morning", touristy: 3,
    note: "Twice the size of Central Park and full of families on a Sunday. Walk up to the castle for the view back down the Reforma." },

  { id: "cdmx-jumex", cityId: "cdmx", name: "Museo Jumex", kind: "museum",
    tags: ["museum", "art", "contemporary", "architecture"], neighborhood: "Polanco", lat: 19.4400, lng: -99.2040,
    durationMin: 90, costUsd: 3, opens: "11:00", closes: "19:00", closedDays: [1], bestTime: "afternoon", touristy: 2,
    note: "A Chipperfield sawtooth roof over the best contemporary collection in the country. Three dollars, and next door to the Soumaya if you want the contrast." },

  { id: "cdmx-lucha", cityId: "cdmx", name: "Lucha libre at Arena México", kind: "experience",
    tags: ["nightlife", "local", "music"], neighborhood: "Doctores", lat: 19.4230, lng: -99.1520,
    durationMin: 150, costUsd: 18, opens: "19:30", closes: "23:00", closedDays: [0, 1, 3, 4, 6], bestTime: "evening", touristy: 3,
    note: "Friday nights, cheap seats, and the crowd is the show as much as the wrestling. Buy from the box office, not the men outside." },

  { id: "cdmx-sanjuan", cityId: "cdmx", name: "Mercado de San Juan", kind: "market",
    tags: ["market", "food", "local"], neighborhood: "Centro", lat: 19.4310, lng: -99.1440,
    durationMin: 70, costUsd: 14, opens: "08:00", closes: "17:00", bestTime: "midday", touristy: 3,
    note: "Where the city's chefs buy. Cheese, imported oddities, and a stall that will make you a sandwich out of anything on the counter." },

  { id: "cdmx-sanangel", cityId: "cdmx", name: "San Ángel on a Saturday", kind: "market",
    tags: ["market", "art", "walk", "local"], neighborhood: "San Ángel", lat: 19.3460, lng: -99.1900,
    durationMin: 120, costUsd: 10, opens: "10:00", closes: "18:00", closedDays: [0, 1, 2, 3, 4, 5], bestTime: "midday", touristy: 3,
    note: "Saturdays only. Cobbled streets, a crafts market in a plaza, and the Rivera and Kahlo studio-house up the road, which is better architecture than either of them painted." },

  { id: "cdmx-elmoro", cityId: "cdmx", name: "Churros at El Moro", kind: "meal",
    tags: ["food", "local", "coffee"], neighborhood: "Centro", lat: 19.4330, lng: -99.1420,
    durationMin: 35, costUsd: 6, opens: "07:00", closes: "23:00", bestTime: "any", touristy: 4,
    note: "Open since 1935 and open very late. Churros and thick chocolate, standing at the counter, ideally at eleven at night." },

  { id: "cdmx-parquemexico", cityId: "cdmx", name: "Parque México", kind: "outdoor",
    tags: ["garden", "walk", "local", "nature"], neighborhood: "Condesa", lat: 19.4110, lng: -99.1710,
    durationMin: 60, costUsd: 0, bestTime: "afternoon", touristy: 1,
    note: "An art deco park built on a racetrack, full of dogs and jacarandas. Sit on a bench for an hour; this is what living here looks like." },

  { id: "cdmx-mezcal", cityId: "cdmx", name: "Mezcalería in Roma", kind: "drink",
    tags: ["wine", "local", "nightlife"], neighborhood: "Roma Norte", lat: 19.4160, lng: -99.1620,
    durationMin: 90, costUsd: 24, opens: "18:00", closes: "02:00", bestTime: "evening", touristy: 2,
    note: "Sipped from a clay copita with orange and sal de gusano. Ask what village it came from; the good bars can tell you and the answer changes the taste." },

  { id: "cdmx-torrelatino", cityId: "cdmx", name: "Torre Latinoamericana at dusk", kind: "sight",
    tags: ["viewpoint", "architecture", "history"], neighborhood: "Centro", lat: 19.4340, lng: -99.1410,
    durationMin: 60, costUsd: 9, opens: "09:00", closes: "22:00", bestTime: "evening", touristy: 4,
    note: "Built to survive earthquakes in 1956 and has, repeatedly. Go up at dusk: the city runs to the mountains in every direction and you finally understand the scale of it." },

  { id: "cdmx-breakfast", cityId: "cdmx", name: "Breakfast in Roma", kind: "meal",
    tags: ["food", "coffee", "local"], neighborhood: "Roma Norte", lat: 19.4180, lng: -99.1600,
    durationMin: 60, costUsd: 12, opens: "08:00", closes: "13:00", bestTime: "morning", touristy: 2,
    note: "Chilaquiles, eggs however you want them, and a jug of coffee. Breakfast is a real meal here and lunch does not happen until three." },

  // --------------------------------------------------------- Teotihuacán --
  { id: "teo-pyramids", cityId: "teotihuacan", name: "Teotihuacán", kind: "sight",
    tags: ["history", "architecture", "hike", "iconic"], neighborhood: "Teotihuacán", lat: 19.6925, lng: -98.8438,
    durationMin: 210, costUsd: 6, opens: "09:00", closes: "17:00", bestTime: "morning", touristy: 4,
    note: "A city of a hundred thousand people, abandoned before the Aztecs arrived and named by them. Walk the Avenue of the Dead end to end; be there at opening, because there is no shade at all." },

  { id: "teo-caves", cityId: "teotihuacan", name: "Lunch in La Gruta", kind: "meal",
    tags: ["food", "local"], neighborhood: "Teotihuacán", lat: 19.6960, lng: -98.8380,
    durationMin: 90, costUsd: 28, opens: "11:00", closes: "19:00", bestTime: "midday", touristy: 4,
    note: "Lunch inside a lava cave next to the site, which has been happening since 1906. Touristy, undeniably, and still a good hour out of the sun." },

  { id: "teo-balloon", cityId: "teotihuacan", name: "Balloon over the pyramids", kind: "experience",
    tags: ["viewpoint", "nature", "earlystart"], neighborhood: "Teotihuacán", lat: 19.6900, lng: -98.8500,
    durationMin: 180, costUsd: 130, opens: "06:00", closes: "09:00", bestTime: "morning", touristy: 4,
    note: "Up at four in the morning to be airborne at sunrise over the whole valley. Expensive, weather-dependent, and the one thing people talk about afterwards." },

  // -------------------------------------------------------------- Oaxaca --
  { id: "oax-santodomingo", cityId: "oaxaca", name: "Santo Domingo and the cultural museum", kind: "museum",
    tags: ["church", "history", "museum", "architecture"], neighborhood: "Centro", lat: 17.0650, lng: -96.7230,
    durationMin: 135, costUsd: 5, opens: "10:00", closes: "18:00", closedDays: [1], bestTime: "morning", touristy: 4,
    note: "Gold-leafed ceiling in the church, and behind it the Monte Albán tomb finds, including the jewellery. The ethnobotanical garden shares the wall." },

  { id: "oax-cooking", cityId: "oaxaca", name: "Cooking class and market run", kind: "experience",
    tags: ["food", "market", "local"], neighborhood: "Centro", lat: 17.0600, lng: -96.7280,
    durationMin: 300, costUsd: 75, opens: "09:00", closes: "16:00", bestTime: "morning", touristy: 3,
    note: "Shop the market first, then cook a mole with someone who has made it a thousand times. Five hours, and the single best way to understand the food here." },

  { id: "oax-tlacolula", cityId: "oaxaca", name: "Tlacolula Sunday market", kind: "market",
    tags: ["market", "local", "food"], neighborhood: "Tlacolula", lat: 16.9540, lng: -96.4770,
    durationMin: 150, costUsd: 12, opens: "08:00", closes: "17:00", closedDays: [1, 2, 3, 4, 5, 6], bestTime: "morning", touristy: 2,
    note: "Sundays only, an hour out, and it is a Zapotec market rather than a market for visitors. Livestock at one end, barbacoa at the other." },

  { id: "oax-tamayo", cityId: "oaxaca", name: "Museo Rufino Tamayo", kind: "museum",
    tags: ["museum", "art", "history"], neighborhood: "Centro", lat: 17.0640, lng: -96.7280,
    durationMin: 75, costUsd: 4, opens: "10:00", closes: "18:00", closedDays: [2], bestTime: "afternoon", touristy: 2,
    note: "Pre-Hispanic pieces the painter collected himself, hung as sculpture rather than as archaeology. Small, and the better museum of the two." },

  { id: "oax-mitla", cityId: "oaxaca", name: "Mitla", kind: "sight",
    tags: ["history", "architecture"], neighborhood: "Mitla", lat: 16.9230, lng: -96.3590,
    durationMin: 120, costUsd: 5, opens: "08:00", closes: "17:00", bestTime: "morning", touristy: 3,
    note: "Geometric stone fretwork, tens of thousands of pieces cut and fitted without mortar. Nothing else in Mesoamerica looks like it." },

  { id: "oax-tejate", cityId: "oaxaca", name: "Tejate in the zócalo", kind: "meal",
    tags: ["food", "local"], neighborhood: "Centro", lat: 17.0610, lng: -96.7250,
    durationMin: 30, costUsd: 3, opens: "09:00", closes: "20:00", bestTime: "afternoon", touristy: 2,
    note: "Maize and cacao, hand-beaten until it foams, drunk cold from a painted gourd. Pre-Hispanic and still an everyday drink." },

  { id: "oax-dinner", cityId: "oaxaca", name: "Dinner in Jalatlaco", kind: "meal",
    tags: ["food", "local", "contemporary"], neighborhood: "Jalatlaco", lat: 17.0640, lng: -96.7180,
    durationMin: 100, costUsd: 30, opens: "18:00", closes: "23:00", closedDays: [1], bestTime: "evening", touristy: 2,
    note: "The quiet neighborhood over the road from the centre, painted and cobbled, where the newer kitchens have opened." },

  // -------------------------------------------------------- Hierve el Agua --
  { id: "hea-pools", cityId: "hierve", name: "Hierve el Agua", kind: "outdoor",
    tags: ["nature", "viewpoint", "spa", "hike"], neighborhood: "San Lorenzo", lat: 16.8660, lng: -96.2760,
    durationMin: 180, costUsd: 8, opens: "08:00", closes: "17:00", bestTime: "morning", touristy: 4,
    note: "Mineral springs that have petrified down a cliff into what look like frozen waterfalls, with pools at the top you can sit in. Community-run, occasionally closed by local disputes; check before you drive." },

  { id: "hea-trail", cityId: "hierve", name: "The trail below the falls", kind: "outdoor",
    tags: ["hike", "nature", "viewpoint"], neighborhood: "San Lorenzo", lat: 16.8640, lng: -96.2740,
    durationMin: 90, costUsd: 0, bestTime: "midday", touristy: 1,
    note: "Forty minutes down and rather longer back, to look up at the formations from underneath. Almost nobody does it and it is the better view." },

  // -------------------------------------------------------------- Seville --
  { id: "sev-plazaespana", cityId: "seville", name: "Plaza de España", kind: "sight",
    tags: ["architecture", "history", "viewpoint"], neighborhood: "María Luisa", lat: 37.3773, lng: -5.9869,
    durationMin: 75, costUsd: 0, bestTime: "morning", touristy: 4,
    note: "A half-kilometre curve of brick and tile built for the 1929 exposition, with a canal and rowing boats in front of it. Free, and it fills up by eleven." },

  { id: "sev-casapilatos", cityId: "seville", name: "Casa de Pilatos", kind: "sight",
    tags: ["architecture", "history", "garden", "art"], neighborhood: "Centro", lat: 37.3920, lng: -5.9870,
    durationMin: 90, costUsd: 12, opens: "09:00", closes: "18:00", bestTime: "morning", touristy: 2,
    note: "A private palace mixing mudéjar tilework with Italian marble, and a fraction of the Alcázar's queue. The upstairs is worth the extra ticket." },

  { id: "sev-bellasartes", cityId: "seville", name: "Museo de Bellas Artes", kind: "museum",
    tags: ["museum", "art", "church"], neighborhood: "Centro", lat: 37.3930, lng: -5.9960,
    durationMin: 105, costUsd: 3, opens: "09:00", closes: "20:00", closedDays: [1], bestTime: "afternoon", touristy: 2,
    note: "Murillo and Zurbarán in a former convent, hung in the church itself. Second only to the Prado for Spanish painting and almost empty on a weekday." },

  { id: "sev-santacruz", cityId: "seville", name: "Santa Cruz early", kind: "walk",
    tags: ["walk", "history", "architecture"], neighborhood: "Santa Cruz", lat: 37.3860, lng: -5.9900,
    durationMin: 75, costUsd: 0, bestTime: "morning", touristy: 4,
    note: "The old Jewish quarter, now a maze of whitewashed lanes. Before nine it is yours; by noon it is a queue with orange trees in it." },

  { id: "sev-kayak", cityId: "seville", name: "Kayak on the Guadalquivir", kind: "outdoor",
    tags: ["boat", "coast", "nature"], neighborhood: "Río", lat: 37.3820, lng: -6.0030,
    durationMin: 105, costUsd: 22, opens: "10:00", closes: "19:00", bestTime: "afternoon", touristy: 2,
    note: "An hour and a half on flat water under the bridges, looking up at the Torre del Oro. The coolest you will be all day in summer." },

  { id: "sev-bodega", cityId: "seville", name: "Sherry at an old bodega", kind: "drink",
    tags: ["wine", "local", "food"], neighborhood: "Centro", lat: 37.3900, lng: -5.9950,
    durationMin: 75, costUsd: 18, opens: "12:00", closes: "24:00", bestTime: "evening", touristy: 2,
    note: "Manzanilla from the barrel, cold, with olives. Sherry is not a dessert wine and one hour here will fix that idea permanently." },

  { id: "sev-triana-market", cityId: "seville", name: "Mercado de Triana", kind: "market",
    tags: ["market", "food", "local"], neighborhood: "Triana", lat: 37.3860, lng: -6.0010,
    durationMin: 70, costUsd: 16, opens: "09:00", closes: "15:00", closedDays: [0], bestTime: "midday", touristy: 3,
    note: "Built on the ruins of the castle the Inquisition ran from, which the market makes no fuss about. Eat at the counters at the back." },

  // -------------------------------------------------------------- Granada --
  { id: "gra-sacromonte", cityId: "granada", name: "Zambra in Sacromonte", kind: "experience",
    tags: ["music", "local", "history"], neighborhood: "Sacromonte", lat: 37.1810, lng: -3.5860,
    durationMin: 105, costUsd: 28, opens: "20:00", closes: "23:30", bestTime: "evening", touristy: 3,
    note: "Flamenco in a whitewashed cave, which is where this particular form came from. Small rooms, and the closer you sit the better it is." },

  { id: "gra-capillareal", cityId: "granada", name: "Capilla Real", kind: "sight",
    tags: ["history", "church", "art"], neighborhood: "Centro", lat: 37.1760, lng: -3.5990,
    durationMin: 60, costUsd: 6, opens: "10:15", closes: "18:30", bestTime: "morning", touristy: 4,
    note: "Ferdinand and Isabella are in the crypt, in lead boxes, under a marble monument that cost more than most cathedrals. The proximity is the strange part." },

  { id: "gra-hammam", cityId: "granada", name: "Hammam Al Ándalus", kind: "experience",
    tags: ["spa", "history", "architecture"], neighborhood: "Centro", lat: 37.1770, lng: -3.5940,
    durationMin: 105, costUsd: 45, opens: "10:00", closes: "24:00", bestTime: "evening", touristy: 3,
    note: "Hot, warm and cold rooms under star-cut vaults, on the site of the medieval baths. Book the late slot and skip the massage; the rooms are the thing." },

  { id: "gra-darro", cityId: "granada", name: "Carrera del Darro at dusk", kind: "walk",
    tags: ["walk", "history", "architecture", "viewpoint"], neighborhood: "Albaicín", lat: 37.1780, lng: -3.5920,
    durationMin: 60, costUsd: 0, bestTime: "evening", touristy: 3,
    note: "A river, three bridges, and the Alhambra walls directly above you. Ten minutes long and worth doing twice." },

  // --------------------------------------------------------------- Córdoba --
  { id: "cor-mezquita", cityId: "cordoba", name: "The Mezquita", kind: "sight",
    tags: ["architecture", "history", "church", "iconic"], neighborhood: "Judería", lat: 37.8790, lng: -4.7794,
    durationMin: 105, costUsd: 14, opens: "10:00", closes: "19:00", bestTime: "morning", touristy: 5,
    note: "Eight hundred columns of a tenth-century mosque with a cathedral dropped through the middle of it in the sixteenth. Go at 08:30 when entry is free and nearly empty." },

  { id: "cor-alcazar", cityId: "cordoba", name: "Alcázar gardens", kind: "sight",
    tags: ["garden", "history", "architecture"], neighborhood: "Judería", lat: 37.8770, lng: -4.7820,
    durationMin: 75, costUsd: 6, opens: "08:15", closes: "20:00", closedDays: [1], bestTime: "morning", touristy: 4,
    note: "Terraced water gardens where Columbus petitioned the monarchs. The building is thin; the gardens are the reason." },

  { id: "cor-patios", cityId: "cordoba", name: "The patios of San Basilio", kind: "walk",
    tags: ["walk", "garden", "local", "architecture"], neighborhood: "San Basilio", lat: 37.8780, lng: -4.7870,
    durationMin: 75, costUsd: 5, opens: "11:00", closes: "19:00", bestTime: "afternoon", touristy: 3,
    note: "Private courtyards their owners open to visitors, every surface covered in potted geraniums. May is the competition and the crowd; the rest of the year several stay open anyway." },

  { id: "cor-puente", cityId: "cordoba", name: "Roman bridge at dusk", kind: "walk",
    tags: ["walk", "history", "viewpoint", "architecture"], neighborhood: "Centro", lat: 37.8760, lng: -4.7790,
    durationMin: 45, costUsd: 0, bestTime: "evening", touristy: 4,
    note: "Cross to the far bank and look back as the Mezquita lights come on. Free, five minutes, and the best photograph in the city." },

  { id: "cor-salmorejo", cityId: "cordoba", name: "Salmorejo and lunch", kind: "meal",
    tags: ["food", "local"], neighborhood: "Centro", lat: 37.8830, lng: -4.7790,
    durationMin: 75, costUsd: 20, opens: "13:00", closes: "16:00", closedDays: [0], bestTime: "midday", touristy: 2,
    note: "Thicker than gazpacho, made with bread and far more garlic, topped with egg and jamón. This is its city and it is better here than anywhere." },
];
