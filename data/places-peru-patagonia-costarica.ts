import type { Place } from "@/lib/types";

// Three destinations that the catalogue had nothing for, and one of them —
// Patagonia — is the trip people actually type in. Everything outdoors here is
// a named route from a named trailhead with the real round-trip time on it,
// because "hiking in the park" is not a day you can plan against. Where a walk
// genuinely eats the day, durationMin says so.
//
// Every note is hand-written. Coordinates are taken from a mapped source, four
// decimals. Prices and hours are omitted wherever they could not be verified.

export const PERU_PATAGONIA_CR_PLACES: Place[] = [
  // ======================================================== PERU — Cusco ====
  { id: "cus-plaza", cityId: "cusco", name: "Plaza de Armas after dark", kind: "walk",
    tags: ["walk", "history", "architecture", "local"], neighborhood: "Centro Histórico", lat: -13.5168, lng: -71.9788,
    durationMin: 60, costUsd: 0, bestTime: "evening", touristy: 4,
    note: "Inca foundation walls with a Spanish cathedral built on top of them, which is the whole argument of this city in one square. Busiest at seven, and the arcades on the north side are where people actually sit." },

  { id: "cus-sanblas", cityId: "cusco", name: "Walk up through San Blas", kind: "walk",
    tags: ["walk", "local", "shopping", "architecture"], neighborhood: "San Blas", lat: -13.5152, lng: -71.9742,
    durationMin: 90, costUsd: 0, bestTime: "afternoon", touristy: 3,
    note: "Steep lanes, workshops that still make things, and a small square that fills up at dusk. It is two hundred vertical metres above the plaza, so do it on day two, not day one." },

  { id: "cus-sancristobal", cityId: "cusco", name: "Mirador de San Cristóbal", kind: "sight",
    tags: ["viewpoint", "church", "local"], neighborhood: "San Cristóbal", lat: -13.5135, lng: -71.9798,
    durationMin: 45, costUsd: 0, bestTime: "evening", touristy: 2,
    note: "Ten minutes uphill from the plaza and you can see the whole bowl the city sits in. Free, open whenever, and far quieter than the paid terraces below it." },

  { id: "cus-qorikancha", cityId: "cusco", name: "Qorikancha", kind: "sight",
    tags: ["history", "architecture", "church", "iconic"], neighborhood: "Centro Histórico", lat: -13.5203, lng: -71.9751,
    durationMin: 75, costUsd: 4, opens: "08:30", closes: "17:30", closedDays: [0], bestTime: "morning", touristy: 4,
    note: "The Inca sun temple with a Dominican convent dropped on top of it, and the earthquakes kept knocking the convent down and leaving the Inca masonry standing. That is the exhibit. Shut on Sundays." },

  { id: "cus-museoinka", cityId: "cusco", name: "Museo Inka", kind: "museum",
    tags: ["museum", "history", "art"], neighborhood: "Centro Histórico", lat: -13.5156, lng: -71.9782,
    durationMin: 75, costUsd: 6, opens: "09:15", closes: "16:00", closedDays: [0], bestTime: "morning", touristy: 2,
    note: "The university's collection: keros, textiles, and the best room of mummies in the city. Labelling is thin and it shuts at four, but it is the only place that explains what you are about to look at for a week." },

  { id: "cus-sanpedro", cityId: "cusco", name: "Mercado San Pedro", kind: "market",
    tags: ["market", "food", "local"], neighborhood: "San Pedro", lat: -13.5212, lng: -71.9825,
    durationMin: 60, costUsd: 6, opens: "07:00", closes: "18:00", bestTime: "morning", touristy: 3,
    note: "Juice counters at the front, cheese and bread in the middle, and the parts of an animal you did not expect at the back. Go before nine; by eleven the front two aisles are a souvenir shop." },

  { id: "cus-sacsayhuaman", cityId: "cusco", name: "Sacsayhuamán", kind: "sight",
    tags: ["history", "architecture", "viewpoint", "iconic"], neighborhood: "Above the city", lat: -13.5090, lng: -71.9827,
    durationMin: 120, costUsd: 35, opens: "07:00", closes: "17:30", bestTime: "morning", touristy: 4,
    note: "Zig-zag walls of blocks weighing more than a car, cut so precisely you cannot get a card between them. The $35 is the ten-day Boleto Turístico, which also covers Q'enqo, Pisac, Ollantaytambo, Moray and Chinchero — buy it here and stop paying." },

  { id: "cus-qenqo", cityId: "cusco", name: "Q'enqo", kind: "sight",
    tags: ["history", "nature"], neighborhood: "Above the city", lat: -13.5090, lng: -71.9704,
    durationMin: 40, costUsd: 0, opens: "07:00", closes: "17:30", bestTime: "morning", touristy: 3,
    note: "A limestone outcrop carved into channels and a covered altar. Twenty minutes of looking, and it is on the same road as Sacsayhuamán, which is the only reason to stop." },

  { id: "cus-tambomachay", cityId: "cusco", name: "Tambomachay", kind: "sight",
    tags: ["history", "architecture", "nature"], neighborhood: "Above the city", lat: -13.4821, lng: -71.9658,
    durationMin: 45, costUsd: 0, opens: "07:00", closes: "17:30", bestTime: "morning", touristy: 3,
    note: "Four terraces of stonework with spring water still running through the channels five hundred years on. Small, and the engineering is the point rather than the scale." },

  { id: "cus-pukapukara", cityId: "cusco", name: "Puka Pukara", kind: "sight",
    tags: ["history", "viewpoint"], neighborhood: "Above the city", lat: -13.4834, lng: -71.9622,
    durationMin: 40, costUsd: 0, opens: "07:00", closes: "17:30", bestTime: "afternoon", touristy: 2,
    note: "Directly across the road from Tambomachay and mostly ignored because of it. Rougher stonework, better view down the valley, and you will have it to yourself." },

  { id: "cus-coffee", cityId: "cusco", name: "Coffee before anything", kind: "meal",
    tags: ["coffee", "local"], neighborhood: "San Blas", lat: -13.5152, lng: -71.9742,
    durationMin: 35, costUsd: 5, opens: "07:00", closes: "20:00", bestTime: "morning", touristy: 2,
    note: "Peru grows a lot of coffee and exports nearly all the good part of it, so the places roasting locally are worth finding. Also: at 3,400m the first morning, caffeine is not the drug you need. Drink water first." },

  { id: "cus-lunch", cityId: "cusco", name: "Lunch in the centre", kind: "meal",
    tags: ["food", "local"], neighborhood: "Centro Histórico", lat: -13.5168, lng: -71.9788,
    durationMin: 65, costUsd: 16, opens: "12:00", closes: "16:00", bestTime: "midday", touristy: 3,
    note: "Ask for the menú — two courses at a fixed price, which is how the city eats at midday and a quarter what the plaza charges for the same thing." },

  { id: "cus-dinner", cityId: "cusco", name: "Dinner in Cusco", kind: "meal",
    tags: ["food", "local"], neighborhood: "San Blas", lat: -13.5152, lng: -71.9742,
    durationMin: 95, costUsd: 28, opens: "18:00", closes: "22:30", bestTime: "evening", touristy: 3,
    note: "Alpaca, trout from the lake, and about forty varieties of potato that all taste different. Book if it is a room anyone has heard of; the town fills up on the Machu Picchu cycle." },

  { id: "cus-pisco", cityId: "cusco", name: "Pisco at the end of the day", kind: "drink",
    tags: ["nightlife", "local"], neighborhood: "Centro Histórico", lat: -13.5168, lng: -71.9788,
    durationMin: 70, costUsd: 14, opens: "17:00", closes: "01:00", bestTime: "evening", touristy: 3,
    note: "A sour is fine. What is worth ordering is pisco puro, neat, so you can taste the grape instead of the egg white. Go easy — altitude doubles it." },

  { id: "cus-cuy", cityId: "cusco", name: "Cuy at a tourist restaurant", kind: "meal",
    tags: ["food", "iconic"], neighborhood: "Centro Histórico", lat: -13.5168, lng: -71.9788,
    durationMin: 90, costUsd: 40, bestTime: "evening", touristy: 5,
    note: "Guinea pig is a real Andean dish and a plaza restaurant charging forty dollars to bring one out whole for a photograph is not where it lives. If you want it, eat it at a picantería in the Sacred Valley on a Sunday.", skip: true },

  // ---------------------------------------- PERU — South Valley (day trip) --
  { id: "sv-tipon", cityId: "southvalley", name: "Tipón", kind: "sight",
    tags: ["history", "architecture", "garden", "nature"], neighborhood: "South Valley", lat: -13.5710, lng: -71.7840,
    durationMin: 120, costUsd: 0, opens: "07:00", closes: "17:30", bestTime: "morning", touristy: 2,
    note: "Terraces built around a water system that still runs, level and silent, five centuries on. Covered by the Boleto Turístico and visited by almost nobody, because it is the wrong direction from Machu Picchu." },

  { id: "sv-pikillaqta", cityId: "southvalley", name: "Pikillaqta", kind: "sight",
    tags: ["history", "architecture"], neighborhood: "South Valley", lat: -13.6123, lng: -71.7173,
    durationMin: 90, costUsd: 0, opens: "07:00", closes: "17:30", bestTime: "midday", touristy: 1,
    note: "A Wari city laid out on a grid seven hundred years before the Inca, which is the half of the story Cusco does not tell. Roofless, hot, and you walk the streets of it alone." },

  { id: "sv-andahuaylillas", cityId: "southvalley", name: "San Pedro de Andahuaylillas", kind: "sight",
    tags: ["church", "art", "history"], neighborhood: "South Valley", lat: -13.6739, lng: -71.6776,
    durationMin: 60, costUsd: 0, bestTime: "afternoon", touristy: 2,
    note: "A plain adobe box from outside and painted floor to ceiling inside. The nickname — the Sistine Chapel of the Andes — oversells it, and it is still the best interior in the region." },

  // ------------------------------------ PERU — Rainbow Mountain (day trip) --
  { id: "vin-vinicunca", cityId: "vinicunca", name: "Vinicunca, the striped ridge", kind: "outdoor",
    tags: ["hike", "nature", "viewpoint", "earlystart"], neighborhood: "Pitumarca", lat: -13.8679, lng: -71.3030,
    durationMin: 240, costUsd: 57, bestTime: "morning", touristy: 5,
    note: "Three hours of minibus each way from Cusco and an hour of walking each way that finishes at 5,200m, higher than anything in the Alps. The colours are real mineral bands, not a filter. Thirty soles at the gate on top of the tour. Do it after four days of acclimatising or not at all, and expect three hundred other people on the ridge." },

  // ==================================== PERU — Sacred Valley (Urubamba) =====
  { id: "sac-ollantaytambo", cityId: "sacredvalley", name: "Ollantaytambo terraces", kind: "sight",
    tags: ["history", "architecture", "hike", "viewpoint", "iconic"], neighborhood: "Ollantaytambo", lat: -13.2586, lng: -72.2636,
    durationMin: 150, costUsd: 0, opens: "07:00", closes: "17:30", bestTime: "morning", touristy: 4,
    note: "The one place the Inca beat the Spanish in a set-piece battle, and you climb the terraces they did it from. On the Boleto Turístico. Be there at seven; the Machu Picchu trains empty three hundred people into it at ten." },

  { id: "sac-pinkuylluna", cityId: "sacredvalley", name: "Pinkuylluna storehouses", kind: "outdoor",
    tags: ["hike", "history", "viewpoint"], neighborhood: "Ollantaytambo", lat: -13.2570, lng: -72.2613,
    durationMin: 90, costUsd: 0, bestTime: "afternoon", touristy: 2,
    note: "Free, unticketed, straight up the hill opposite the main site, to the grain stores the Inca put where the wind would dry them. Loose underfoot and no railing anywhere. Best view of the terraces there is, and nobody in the queue below looks up at it." },

  { id: "sac-ollanta-town", cityId: "sacredvalley", name: "Ollantaytambo old town", kind: "walk",
    tags: ["walk", "history", "architecture", "local"], neighborhood: "Ollantaytambo", lat: -13.2586, lng: -72.2636,
    durationMin: 60, costUsd: 0, bestTime: "evening", touristy: 3,
    note: "A grid of Inca streets still lived in, with water running down channels in the middle of them. Fifteen minutes end to end. Go once the day-trippers are back on the train." },

  { id: "sac-pisac-ruins", cityId: "sacredvalley", name: "Pisac ruins along the ridge", kind: "sight",
    tags: ["history", "hike", "viewpoint", "architecture"], neighborhood: "Pisac", lat: -13.4210, lng: -71.8505,
    durationMin: 165, costUsd: 0, opens: "07:00", closes: "17:30", bestTime: "morning", touristy: 3,
    note: "Bigger than Ollantaytambo and far less visited, because the ruins sit a thousand feet above the town and most tours only stop at the market. Get dropped at the top gate and walk down the ridge through the terraces." },

  { id: "sac-pisac-market", cityId: "sacredvalley", name: "Pisac market", kind: "market",
    tags: ["market", "shopping", "local"], neighborhood: "Pisac", lat: -13.4210, lng: -71.8505,
    durationMin: 60, costUsd: 10, opens: "09:00", closes: "17:00", bestTime: "midday", touristy: 4,
    note: "Textiles, ceramics, and a lot of machine-made alpaca sold as hand-made. Tuesdays and Thursdays are the quieter days and the same stalls are there." },

  { id: "sac-moray", cityId: "sacredvalley", name: "Moray", kind: "sight",
    tags: ["history", "architecture", "nature"], neighborhood: "Maras", lat: -13.3299, lng: -72.1970,
    durationMin: 75, costUsd: 0, opens: "07:00", closes: "17:00", bestTime: "morning", touristy: 3,
    note: "Concentric terraced bowls with as much as 15°C between the top ring and the bottom, which is generally read as an agricultural test station. Whatever it was for, it is the strangest-looking thing in the valley." },

  { id: "sac-maras", cityId: "sacredvalley", name: "Salineras de Maras", kind: "sight",
    tags: ["history", "viewpoint", "local"], neighborhood: "Maras", lat: -13.3001, lng: -72.1561,
    durationMin: 75, costUsd: 3, opens: "08:00", closes: "16:30", bestTime: "afternoon", touristy: 4,
    note: "Three thousand salt pans stepped down a ravine, worked by the same families since before the Spanish. You can no longer walk among them — one path, above — and it is still worth the stop." },

  { id: "sac-chinchero", cityId: "sacredvalley", name: "Chinchero church and terraces", kind: "sight",
    tags: ["church", "history", "art", "local"], neighborhood: "Chinchero", lat: -13.3958, lng: -72.0518,
    durationMin: 90, costUsd: 0, opens: "07:00", closes: "17:30", bestTime: "morning", touristy: 3,
    note: "An adobe church painted inside with Andean flowers, standing on an Inca wall, above terraces that are still farmed. At 3,750m it is higher than Cusco, so it is a bad first stop and a good last one." },

  { id: "sac-huchuy", cityId: "sacredvalley", name: "Huchuy Qosqo", kind: "outdoor",
    tags: ["hike", "history", "viewpoint", "nature", "earlystart"], neighborhood: "Lamay", lat: -13.3664, lng: -71.9451,
    durationMin: 420, costUsd: 0, bestTime: "morning", touristy: 1,
    note: "Three and a half hours up from Lamay to an Inca estate on a shelf 600m above the valley, then back the same way. No ticket, no gate, no queue, and on a weekday you will meet nobody. The whole day, and the best walk in the valley that is not the Inca Trail." },

  { id: "sac-lunch", cityId: "sacredvalley", name: "Lunch in the valley", kind: "meal",
    tags: ["food", "local"], neighborhood: "Urubamba", lat: -13.3060, lng: -72.1160,
    durationMin: 80, costUsd: 22, opens: "12:00", closes: "16:00", bestTime: "midday", touristy: 2,
    note: "The valley is where the produce comes from and it eats better than Cusco for less. A picantería at midday, not a hotel dining room." },

  { id: "sac-dinner", cityId: "sacredvalley", name: "Dinner in Urubamba", kind: "meal",
    tags: ["food", "local"], neighborhood: "Urubamba", lat: -13.3060, lng: -72.1160,
    durationMin: 95, costUsd: 30, opens: "18:00", closes: "21:30", bestTime: "evening", touristy: 2,
    note: "Sleeping at 2,870m instead of Cusco's 3,400m is the single best decision on this trip, and the food here is the consolation prize for it being a dull town. Kitchens close early." },

  { id: "sac-chicha", cityId: "sacredvalley", name: "Chicha at a roadside chichería", kind: "drink",
    tags: ["local", "food"], neighborhood: "Urubamba", lat: -13.3060, lng: -72.1160,
    durationMin: 45, costUsd: 3, bestTime: "afternoon", touristy: 1,
    note: "Look for a red plastic bag on a pole — that is the sign, and it means fermented maize beer is being sold in the front room of somebody's house. Sour, cloudy, barely alcoholic, and about fifty cents a litre." },

  { id: "sac-weaving", cityId: "sacredvalley", name: "A weaving demonstration stop", kind: "experience",
    tags: ["local", "shopping", "art"], neighborhood: "Chinchero", lat: -13.3958, lng: -72.0518,
    durationMin: 60, costUsd: 0, bestTime: "midday", touristy: 5,
    note: "Every valley tour stops at one, the cochineal demonstration is identical at all of them, and the twenty minutes of dyeing is the setup for forty minutes of selling. The genuine co-ops exist; they are not the ones with a coach park.", skip: true },

  // ==================================== PERU — Machu Picchu / Aguas Calientes
  { id: "mpu-citadel", cityId: "machupicchu", name: "Machu Picchu, Circuit 2", kind: "sight",
    tags: ["history", "architecture", "iconic", "viewpoint", "earlystart"], neighborhood: "Machu Picchu", lat: -13.1631, lng: -72.5456,
    durationMin: 210, costUsd: 41, opens: "06:00", closes: "15:00", bestTime: "morning", touristy: 5,
    note: "Circuit 2 is the one that goes through the citadel itself and past the classic view; the others look at it or skip parts of it. One direction only, no re-entry, and your ticket names an entry hour you have to hit. Book the moment tickets open — 152 soles, and the day sells out weeks ahead in the dry season." },

  { id: "mpu-mountain", cityId: "machupicchu", name: "Machu Picchu Mountain", kind: "outdoor",
    tags: ["hike", "viewpoint", "nature", "earlystart"], neighborhood: "Machu Picchu", lat: -13.1747, lng: -72.5419,
    durationMin: 210, costUsd: 54, opens: "06:00", closes: "12:00", bestTime: "morning", touristy: 3,
    note: "Three hours up and down 600m of Inca stairs to 3,061m, and the ruins are a model village underneath you at the top. Longer and less exposed than Huayna Picchu, and it does not sell out the same way. Entry closes at midday." },

  { id: "mpu-sungate", cityId: "machupicchu", name: "Inti Punku, the Sun Gate", kind: "outdoor",
    tags: ["hike", "history", "viewpoint"], neighborhood: "Machu Picchu", lat: -13.1698, lng: -72.5339,
    durationMin: 150, costUsd: 41, bestTime: "morning", touristy: 3,
    note: "An hour up the old Inca Trail to the notch the trekkers walk in through, and the view back down is the one they get after four days. Steady rather than steep. Needs the Circuit 1-C ticket, not the standard one." },

  { id: "mpu-bus", cityId: "machupicchu", name: "First bus up the switchbacks", kind: "experience",
    tags: ["earlystart", "nature"], neighborhood: "Aguas Calientes", lat: -13.1543, lng: -72.5256,
    durationMin: 60, costUsd: 35, opens: "05:30", closes: "16:00", bestTime: "morning", touristy: 5,
    note: "Twenty-five minutes of hairpins on a dirt road, $35 return, and the queue in town starts forming before five. Staying up here rather than day-tripping from Cusco is what buys you that queue place." },

  { id: "mpu-river", cityId: "machupicchu", name: "Walk out along the Urubamba", kind: "walk",
    tags: ["walk", "nature", "coast"], neighborhood: "Aguas Calientes", lat: -13.1543, lng: -72.5256,
    durationMin: 60, costUsd: 0, bestTime: "afternoon", touristy: 2,
    note: "Follow the rail line downstream out of town and the souvenir stalls stop within five minutes. Cloud forest, a very loud river, and the only quiet twenty minutes available in Aguas Calientes." },

  { id: "mpu-dinner", cityId: "machupicchu", name: "Dinner in Aguas Calientes", kind: "meal",
    tags: ["food"], neighborhood: "Aguas Calientes", lat: -13.1543, lng: -72.5256,
    durationMin: 85, costUsd: 30, opens: "17:30", closes: "22:00", bestTime: "evening", touristy: 5,
    note: "A captive market of four thousand people a night and the prices know it. Eat, do not expect much, and go to bed — the point of this town is the five a.m. start." },

  { id: "mpu-breakfast", cityId: "machupicchu", name: "Breakfast before the gate", kind: "meal",
    tags: ["coffee", "food"], neighborhood: "Aguas Calientes", lat: -13.1543, lng: -72.5256,
    durationMin: 30, costUsd: 10, opens: "04:30", closes: "10:00", bestTime: "morning", touristy: 4,
    note: "Several places open at half four for exactly one reason. There is nothing to buy inside the site and you cannot take food in, so eat now." },

  // ================================== PATAGONIA — El Calafate (hub) =========
  { id: "cal-perito", cityId: "elcalafate", name: "Perito Moreno boardwalks", kind: "outdoor",
    tags: ["nature", "viewpoint", "walk", "iconic"], neighborhood: "Los Glaciares", lat: -50.4690, lng: -73.0299,
    durationMin: 300, costUsd: 32, opens: "08:00", closes: "18:00", bestTime: "morning", touristy: 5,
    note: "Eighty kilometres from town, then 4.7km of steel walkway on four levels facing a 60m ice wall that calves while you stand there. It is the one famous glacier you do not need a boat or a guide to get in front of. Entry is 50,000 pesos and the north balcony is the quiet one." },

  { id: "cal-minitrek", cityId: "elcalafate", name: "Minitrekking on Perito Moreno", kind: "experience",
    tags: ["adventure", "nature", "hike", "boat"], neighborhood: "Los Glaciares", lat: -50.4690, lng: -73.0299,
    durationMin: 570, costUsd: 306, bestTime: "morning", touristy: 4,
    note: "Nine and a half hours door to door: boat across the channel, half an hour through the woods, crampons on at the ice edge, then about ninety minutes walking between the crevasses. Age-capped, sold out weeks ahead in January, and the only way to stand on the thing." },

  { id: "cal-bigice", cityId: "elcalafate", name: "Big Ice", kind: "experience",
    tags: ["adventure", "nature", "hike", "earlystart"], neighborhood: "Los Glaciares", lat: -50.4690, lng: -73.0299,
    durationMin: 660, costUsd: 306, bestTime: "morning", touristy: 3,
    note: "The long version of the same day: an hour up the lateral moraine, then three hours out in the middle of the ice where the blue pools are. Hard on the ankles, capped by age and fitness, and a different day from minitrekking rather than more of it. Pick one — doing both is the same glacier twice." },

  { id: "cal-nautico", cityId: "elcalafate", name: "Boat under the south face", kind: "experience",
    tags: ["boat", "nature", "viewpoint"], neighborhood: "Los Glaciares", lat: -50.4690, lng: -73.0299,
    durationMin: 90, costUsd: 45, bestTime: "afternoon", touristy: 4,
    note: "An hour on the lake at the foot of the wall, which is the only way to understand how tall it is — the boat gives you the scale the balconies take away. Add it to the boardwalk day rather than making a day of it." },

  { id: "cal-nimez", cityId: "elcalafate", name: "Laguna Nimez reserve", kind: "walk",
    tags: ["walk", "nature", "local", "coast"], neighborhood: "El Calafate", lat: -50.3244, lng: -72.2675,
    durationMin: 90, costUsd: 8, opens: "09:00", closes: "20:00", bestTime: "evening", touristy: 2,
    note: "A flat gravel loop through a lagoon on the edge of town with flamingos, upland geese and black-necked swans on it. Twenty minutes' walk from the main street and almost empty at seven in the evening." },

  { id: "cal-glaciarium", cityId: "elcalafate", name: "Glaciarium", kind: "museum",
    tags: ["museum", "nature", "contemporary"], neighborhood: "El Calafate", lat: -50.3411, lng: -72.3497,
    durationMin: 100, costUsd: 22, bestTime: "afternoon", touristy: 3,
    note: "A serious ice museum that explains what you are looking at out at the glacier — how the Southern Patagonian Icefield works and why this one is not retreating like the rest. There is a bar built of ice downstairs, which is silly, and the exhibits upstairs are not." },

  { id: "cal-bahia", cityId: "elcalafate", name: "Bahía Redonda shore at dusk", kind: "walk",
    tags: ["walk", "coast", "nature", "viewpoint"], neighborhood: "El Calafate", lat: -50.3400, lng: -72.2800,
    durationMin: 60, costUsd: 0, bestTime: "evening", touristy: 2,
    note: "Lago Argentino goes an unreasonable milky turquoise from the rock flour in it, and this is the stretch you can walk to. In December the light holds past ten." },

  { id: "cal-dinner", cityId: "elcalafate", name: "Cordero al asador", kind: "meal",
    tags: ["food", "local", "wine"], neighborhood: "El Calafate", lat: -50.3387, lng: -72.2737,
    durationMin: 110, costUsd: 42, opens: "19:30", closes: "23:30", bestTime: "evening", touristy: 3,
    note: "Lamb split and staked around an open fire for five hours, which is the regional dish and worth eating once even if you then never want it again. Argentina eats late; nine is normal and eight is early." },

  { id: "cal-lunch", cityId: "elcalafate", name: "Lunch on Avenida Libertador", kind: "meal",
    tags: ["food", "local"], neighborhood: "El Calafate", lat: -50.3387, lng: -72.2737,
    durationMin: 70, costUsd: 20, opens: "12:00", closes: "16:00", bestTime: "midday", touristy: 4,
    note: "One long street with everything on it and prices set for people who have just flown in. Empanadas from a counter rather than a set menu is the move." },

  { id: "cal-icebar", cityId: "elcalafate", name: "The ice bar", kind: "drink",
    tags: ["nightlife"], neighborhood: "El Calafate", lat: -50.3411, lng: -72.3497,
    durationMin: 45, costUsd: 25, bestTime: "evening", touristy: 5,
    note: "You pay to put on a parka and drink from a frozen glass in a -10°C room, having spent the day looking at actual ice outdoors for free. Sit upstairs in the museum café instead.", skip: true },

  // ================================== PATAGONIA — El Chaltén ================
  { id: "cht-lostres", cityId: "elchalten", name: "Laguna de los Tres", kind: "outdoor",
    tags: ["hike", "nature", "viewpoint", "earlystart"], neighborhood: "Los Glaciares Norte", lat: -49.2785, lng: -72.9895,
    durationMin: 540, costUsd: 32, bestTime: "morning", touristy: 4,
    note: "From the trailhead at the top of Avenida San Martín: 21km, 950m of climbing, eight to nine hours, and the last kilometre is 400m straight up scree. Fitz Roy stands in the water at the top. This is the day, not a part of one — do not plan anything else against it." },

  { id: "cht-torre", cityId: "elchalten", name: "Laguna Torre", kind: "outdoor",
    tags: ["hike", "nature", "viewpoint"], neighborhood: "Los Glaciares Norte", lat: -49.3250, lng: -73.0021,
    durationMin: 420, costUsd: 0, bestTime: "morning", touristy: 3,
    note: "From the Calle Las Loicas trailhead: 21km but only 570m of climbing, three and a half hours out along the river to a lake with icebergs in it and Cerro Torre behind. Much easier than Los Tres and the summit is behind cloud four days out of five, which is the gamble." },

  { id: "cht-pliegue", cityId: "elchalten", name: "Loma del Pliegue Tumbado", kind: "outdoor",
    tags: ["hike", "nature", "viewpoint", "earlystart"], neighborhood: "Los Glaciares Norte", lat: -49.3594, lng: -72.9675,
    durationMin: 420, costUsd: 0, bestTime: "morning", touristy: 2,
    note: "From the park administration at the south end of town: 19km and 1,100m up an open ridge to the only place you see Fitz Roy and Cerro Torre in the same frame. No shelter at all above the treeline, which matters here more than the gradient does." },

  { id: "cht-capri", cityId: "elchalten", name: "Laguna Capri", kind: "outdoor",
    tags: ["hike", "nature", "viewpoint"], neighborhood: "Los Glaciares Norte", lat: -49.3029, lng: -72.9297,
    durationMin: 240, costUsd: 0, bestTime: "morning", touristy: 3,
    note: "The first two hours of the Los Tres trail and then stop: a lake in the beech forest with the whole Fitz Roy skyline across it. Four hours round trip, none of the scree, and the right call on a day the forecast is bad above 1,000m." },

  { id: "cht-piedrasblancas", cityId: "elchalten", name: "Piedras Blancas viewpoint", kind: "outdoor",
    tags: ["hike", "nature", "viewpoint"], neighborhood: "Los Glaciares Norte", lat: -49.2654, lng: -73.0074,
    durationMin: 300, costUsd: 0, bestTime: "morning", touristy: 2,
    note: "From the Hostería El Pilar trailhead north of town rather than from the village, which turns the Fitz Roy valley into a through-walk instead of an out-and-back. A hanging glacier drops ice into a grey lake and it goes off like a gun when it does." },

  { id: "cht-condores", cityId: "elchalten", name: "Mirador de los Cóndores", kind: "outdoor",
    tags: ["walk", "viewpoint", "nature"], neighborhood: "El Chaltén", lat: -49.3349, lng: -72.9236,
    durationMin: 90, costUsd: 0, bestTime: "evening", touristy: 2,
    note: "Forty minutes up from the park office to a bluff above the town with the Río de las Vueltas running out below it. The short one for the day the wind shuts the high ground, and the right thing to do on your arrival evening." },

  { id: "cht-chorrillo", cityId: "elchalten", name: "Chorrillo del Salto", kind: "walk",
    tags: ["walk", "nature", "viewpoint"], neighborhood: "El Chaltén", lat: -49.2999, lng: -72.9036,
    durationMin: 120, costUsd: 0, bestTime: "afternoon", touristy: 2,
    note: "Flat, an hour each way from the north end of town along the road, to a twenty-metre fall in the beech. You can drive to within five minutes of it, which is what to do if the legs are done." },

  { id: "cht-dinner", cityId: "elchalten", name: "Dinner in El Chaltén", kind: "meal",
    tags: ["food", "local"], neighborhood: "El Chaltén", lat: -49.3320, lng: -72.8860,
    durationMin: 100, costUsd: 38, opens: "19:00", closes: "23:00", bestTime: "evening", touristy: 3,
    note: "A town of two streets that exists entirely to feed climbers, so the portions are enormous and the kitchens are slow. Nothing is cheap — everything comes up the road from El Calafate." },

  { id: "cht-brewery", cityId: "elchalten", name: "Cervecería after the walk", kind: "drink",
    tags: ["nightlife", "local", "food"], neighborhood: "El Chaltén", lat: -49.3320, lng: -72.8860,
    durationMin: 80, costUsd: 16, opens: "16:00", closes: "00:00", bestTime: "evening", touristy: 3,
    note: "Brewed in the building, drunk by people who came down off the same mountain you did an hour ago. This is where you find out whether tomorrow's weather window is real." },

  { id: "cht-packed", cityId: "elchalten", name: "Lunch out of the pack", kind: "meal",
    tags: ["food"], neighborhood: "Los Glaciares Norte", lat: -49.3029, lng: -72.9297,
    durationMin: 40, costUsd: 15, bestTime: "midday", touristy: 1,
    note: "There is nothing to buy on any of these trails and no water you should drink without thinking about it. Buy it in town the night before; the supermarket shelves are stripped by nine in the morning." },

  { id: "cht-coffee", cityId: "elchalten", name: "Coffee at six", kind: "meal",
    tags: ["coffee", "local"], neighborhood: "El Chaltén", lat: -49.3320, lng: -72.8860,
    durationMin: 30, costUsd: 7, opens: "06:00", closes: "13:00", bestTime: "morning", touristy: 2,
    note: "Two or three places open before dawn because half the town is leaving at that hour. In summer it is light by five and the wind gets up around noon, so early is not a preference here." },

  { id: "cht-huemul", cityId: "elchalten", name: "The Huemul circuit", kind: "outdoor",
    tags: ["hike", "adventure", "nature"], neighborhood: "Los Glaciares Norte", lat: -49.3320, lng: -72.8860,
    durationMin: 540, costUsd: 0, bestTime: "morning", touristy: 1,
    note: "Four days, two Tyrolean traverses on fixed cables over a river, mandatory harness and pulley, and a registration you have to pass. It is a genuine expedition and it is not a hike you add to a trip that has other things in it.", skip: true },

  // ================================== PATAGONIA — Torres del Paine ==========
  { id: "tdp-basetorres", cityId: "torresdelpaine", name: "Base Torres", kind: "outdoor",
    tags: ["hike", "nature", "viewpoint", "earlystart", "iconic"], neighborhood: "Valle Ascencio", lat: -50.9427, lng: -72.9497,
    durationMin: 540, costUsd: 35, bestTime: "morning", touristy: 5,
    note: "From the Hotel Las Torres trailhead in the Central sector: 16km, 790m of climbing, eight to nine hours with the last 45 minutes up a boulder field. Three granite towers standing out of a green lake at the top. The $35 is the park entry, 32,400 pesos, good for three days." },

  { id: "tdp-frances", cityId: "torresdelpaine", name: "Valle del Francés to Mirador Británico", kind: "outdoor",
    tags: ["hike", "nature", "viewpoint", "earlystart"], neighborhood: "Valle del Francés", lat: -50.9827, lng: -73.0538,
    durationMin: 540, costUsd: 50, bestTime: "morning", touristy: 3,
    note: "Catamaran from Pudeto to Paine Grande, then two and a half hours to Campamento Italiano and three more up the valley, with the hanging glacier shedding ice off Paine Grande the whole way. Seven hours of walking plus two boats, and the 17:30 return sailing is the hard deadline on the day." },

  { id: "tdp-greymirador", cityId: "torresdelpaine", name: "Mirador Grey", kind: "outdoor",
    tags: ["hike", "nature", "viewpoint"], neighborhood: "Lago Grey", lat: -51.0022, lng: -73.1826,
    durationMin: 420, costUsd: 0, bestTime: "morning", touristy: 3,
    note: "The west arm of the W: from Paine Grande along the ridge above Lago Grey until the glacier front comes into view, then back. Seven hours, undulating rather than steep, and exposed to the westerly for most of it." },

  { id: "tdp-greynav", cityId: "torresdelpaine", name: "Lago Grey navigation", kind: "experience",
    tags: ["boat", "nature", "viewpoint"], neighborhood: "Lago Grey", lat: -51.0080, lng: -73.1792,
    durationMin: 240, costUsd: 128, opens: "08:30", closes: "18:45", bestTime: "midday", touristy: 4,
    note: "Four hours from the Hotel Lago Grey pier out among the bergs to within a few hundred metres of the glacier face. Expensive at 120,000 pesos and it is the version of Grey that does not cost you a seven-hour walk." },

  { id: "tdp-playagrey", cityId: "torresdelpaine", name: "Playa Grey", kind: "walk",
    tags: ["walk", "nature", "coast", "viewpoint"], neighborhood: "Lago Grey", lat: -51.0080, lng: -73.1792,
    durationMin: 90, costUsd: 0, bestTime: "afternoon", touristy: 2,
    note: "Cross the suspension bridge and walk the spit to a grey sand beach with icebergs grounded on it. Forty minutes, flat, and the wind coming off the lake is genuinely hard to stand up in." },

  { id: "tdp-saltogrande", cityId: "torresdelpaine", name: "Salto Grande", kind: "walk",
    tags: ["walk", "nature", "viewpoint"], neighborhood: "Pudeto", lat: -51.0677, lng: -73.0066,
    durationMin: 60, costUsd: 0, bestTime: "afternoon", touristy: 4,
    note: "Fifteen minutes on a gravel path from the Pudeto car park to where Nordenskjöld empties into Pehoé over a ledge. Short, loud, usually full of people waiting for the catamaran, and worth the fifteen minutes anyway." },

  { id: "tdp-cuernos", cityId: "torresdelpaine", name: "Mirador Cuernos", kind: "outdoor",
    tags: ["walk", "viewpoint", "nature"], neighborhood: "Pudeto", lat: -51.0483, lng: -73.0123,
    durationMin: 120, costUsd: 0, bestTime: "afternoon", touristy: 3,
    note: "Another half hour past Salto Grande to a spit on Nordenskjöld looking straight at the Cuernos — the dark sedimentary caps on pale granite that are the actual shape of this park. Flat, and completely unsheltered." },

  { id: "tdp-condor", cityId: "torresdelpaine", name: "Mirador Cóndor", kind: "outdoor",
    tags: ["hike", "viewpoint", "nature"], neighborhood: "Lago Pehoé", lat: -51.1017, lng: -72.9781,
    durationMin: 120, costUsd: 0, bestTime: "evening", touristy: 2,
    note: "Ninety minutes up a steep little hill above the Pehoé campsite for the whole massif at once, with condors usually working the ridge. The best hour-for-hour return in the park and most people drive past the sign." },

  { id: "tdp-pehoe", cityId: "torresdelpaine", name: "Mirador Lago Pehoé", kind: "sight",
    tags: ["viewpoint", "nature", "coast"], neighborhood: "Lago Pehoé", lat: -51.0958, lng: -72.9838,
    durationMin: 45, costUsd: 0, bestTime: "morning", touristy: 4,
    note: "Roadside, two minutes from the car, and it is the photograph everyone has seen of this place. Go at eight before the tour buses and you get it alone." },

  { id: "tdp-catamaran", cityId: "torresdelpaine", name: "Pehoé catamaran", kind: "experience",
    tags: ["boat", "nature", "viewpoint"], neighborhood: "Lago Pehoé", lat: -51.0943, lng: -73.0421,
    durationMin: 60, costUsd: 28, bestTime: "morning", touristy: 4,
    note: "Thirty minutes from Pudeto to Paine Grande, 26,000 pesos each way, and it is the only way into the west end of the park without walking a day to get there. Sailings are few and the last one back is 17:30 — miss it and you are sleeping at the refugio." },

  { id: "tdp-ferrier", cityId: "torresdelpaine", name: "Mirador Ferrier", kind: "outdoor",
    tags: ["hike", "viewpoint", "nature"], neighborhood: "Lago Grey", lat: -51.1265, lng: -73.1544,
    durationMin: 240, costUsd: 0, bestTime: "morning", touristy: 1,
    note: "Four hours and 600m up a steep forested spur from the Grey ranger station for a view down onto the glacier and out over the Serrano. Steep the whole way, no water on it, and you will likely see two other people." },

  { id: "tdp-amarga", cityId: "torresdelpaine", name: "Laguna Amarga and the guanaco flats", kind: "sight",
    tags: ["nature", "viewpoint"], neighborhood: "Laguna Amarga", lat: -50.9798, lng: -72.8012,
    durationMin: 60, costUsd: 0, bestTime: "morning", touristy: 2,
    note: "The east entrance, and the open steppe around it is where the guanaco herds are — which is why it is also the best puma ground in the park. Dawn and dusk, from the road, no walking required." },

  { id: "tdp-sarmiento", cityId: "torresdelpaine", name: "Lago Sarmiento shoreline", kind: "outdoor",
    tags: ["walk", "nature", "coast", "viewpoint"], neighborhood: "Lago Sarmiento", lat: -51.0423, lng: -72.7249,
    durationMin: 90, costUsd: 0, bestTime: "afternoon", touristy: 1,
    note: "A closed basin with white calcium thrombolites built up around the shore by microbes — living rock, essentially, and rare. Nobody stops here because it faces away from the towers." },

  { id: "tdp-nordenskjold", cityId: "torresdelpaine", name: "Nordenskjöld overlooks", kind: "sight",
    tags: ["viewpoint", "nature", "coast"], neighborhood: "Lago Nordenskjöld", lat: -51.0360, lng: -72.9608,
    durationMin: 60, costUsd: 0, bestTime: "afternoon", touristy: 2,
    note: "The road between Amarga and Pudeto runs along the north shore with four or five pull-offs on it, and the lake sits an improbable blue under the Cuernos. Treat the drive as the activity; it is the best half hour of road in the park." },

  { id: "tdp-lunch", cityId: "torresdelpaine", name: "Lunch out of the pack", kind: "meal",
    tags: ["food"], neighborhood: "Torres del Paine", lat: -51.0958, lng: -72.9838,
    durationMin: 40, costUsd: 18, bestTime: "midday", touristy: 1,
    note: "There is nowhere to buy lunch inside the park that is not a refugio charging refugio prices. Sort it in Puerto Natales before you drive in." },

  { id: "tdp-dinner", cityId: "torresdelpaine", name: "Dinner at the lodge", kind: "meal",
    tags: ["food", "wine", "local"], neighborhood: "Torres del Paine", lat: -51.0943, lng: -73.0421,
    durationMin: 105, costUsd: 48, opens: "19:00", closes: "21:30", bestTime: "evening", touristy: 3,
    note: "Set menu, one sitting, everyone eating at the same time because there is no alternative for fifty kilometres. Not cheap and not the reason you are here." },

  { id: "tdp-wtrek", cityId: "torresdelpaine", name: "The W trek as a four-day walk", kind: "outdoor",
    tags: ["hike", "adventure", "nature"], neighborhood: "Torres del Paine", lat: -50.9376, lng: -73.1204,
    durationMin: 540, costUsd: 0, bestTime: "morning", touristy: 4,
    note: "Eighty kilometres over four days, refugio beds booked six months out through two separate companies that do not talk to each other. Worth doing on a trip built around it. On a trip that also has El Chaltén in it, the three day-hikes here cover the same ground and you sleep in a bed.", skip: true },

  // ================================== PATAGONIA — Puerto Natales ============
  { id: "pnt-milodon", cityId: "puertonatales", name: "Cueva del Milodón", kind: "sight",
    tags: ["history", "nature", "viewpoint"], neighborhood: "Cerro Benítez", lat: -51.5653, lng: -72.6192,
    durationMin: 120, costUsd: 13, opens: "08:00", closes: "18:30", bestTime: "morning", touristy: 3,
    note: "A 200m conglomerate cave 24km from town where a giant ground sloth's skin turned up in 1895, still with hair on it. There is a fibreglass sloth at the entrance, which is daft; the cave itself is enormous and worth the detour on the way to the park." },

  { id: "pnt-dorotea", cityId: "puertonatales", name: "Cerro Dorotea", kind: "outdoor",
    tags: ["hike", "viewpoint", "nature"], neighborhood: "Cerro Dorotea", lat: -51.6479, lng: -72.3391,
    durationMin: 180, costUsd: 10, bestTime: "morning", touristy: 1,
    note: "Three hours up and down a private farm track behind the town for the whole Última Esperanza sound underneath you and the Paine massif on the horizon. Pay the family at the gate. Good legs-in acclimatisation on the day you arrive." },

  { id: "pnt-costanera", cityId: "puertonatales", name: "The Costanera at dusk", kind: "walk",
    tags: ["walk", "coast", "local", "viewpoint"], neighborhood: "Puerto Natales", lat: -51.7262, lng: -72.5060,
    durationMin: 60, costUsd: 0, bestTime: "evening", touristy: 2,
    note: "The waterfront road, black-necked swans on the water, a corrugated-iron town behind you and mountains on the far shore. An hour, and it is most of what Puerto Natales is." },

  { id: "pnt-serrano", cityId: "puertonatales", name: "Balmaceda and Serrano glaciers by boat", kind: "experience",
    tags: ["boat", "nature", "viewpoint"], neighborhood: "Última Esperanza", lat: -51.7262, lng: -72.5060,
    durationMin: 630, costUsd: 191, opens: "07:10", closes: "17:30", bestTime: "morning", touristy: 3,
    note: "Ten and a half hours up the fjord from the town pier, past sea lion colonies and a cormorant cliff, to two glaciers coming off the icefield. The right thing to do on the day the park forecast is 80km/h and rain." },

  { id: "pnt-dinner", cityId: "puertonatales", name: "Dinner in Puerto Natales", kind: "meal",
    tags: ["food", "local"], neighborhood: "Puerto Natales", lat: -51.7262, lng: -72.5060,
    durationMin: 95, costUsd: 35, opens: "19:00", closes: "23:00", bestTime: "evening", touristy: 3,
    note: "King crab out of the channels, lamb off the estancias, and about eight rooms doing either well. Everything is booked in January by people coming off the W." },

  { id: "pnt-coffee", cityId: "puertonatales", name: "Coffee and the forecast", kind: "meal",
    tags: ["coffee", "local"], neighborhood: "Puerto Natales", lat: -51.7262, lng: -72.5060,
    durationMin: 40, costUsd: 7, opens: "07:30", closes: "20:00", bestTime: "morning", touristy: 2,
    note: "Every café here has the Paine wind forecast on a board somewhere. Read it before you commit to a day — a 90km/h gust forecast on the Ascencio is a reason to do something else." },

  // ================================= COSTA RICA — San José ==================
  { id: "sjo-oro", cityId: "sanjose", name: "Museo del Oro Precolombino", kind: "museum",
    tags: ["museum", "history", "art"], neighborhood: "Catedral", lat: 9.9335, lng: -84.0767,
    durationMin: 100, costUsd: 17, opens: "09:15", closes: "17:00", bestTime: "morning", touristy: 3,
    note: "Underneath the Plaza de la Cultura, three floors down: 1,600 gold pieces, most of them small animal figures, with the metallurgy actually explained. The best hour in the city and half the people in town walk over the top of it." },

  { id: "sjo-jade", cityId: "sanjose", name: "Museo del Jade", kind: "museum",
    tags: ["museum", "history", "art", "architecture"], neighborhood: "Plaza de la Democracia", lat: 9.9331, lng: -84.0728,
    durationMin: 90, costUsd: 16, opens: "10:00", closes: "17:00", bestTime: "afternoon", touristy: 3,
    note: "The largest jade collection in the Americas in a black concrete box, laid out by theme rather than by date, which works better than it sounds. Do this or the gold museum; both in one day is too much small carved stone." },

  { id: "sjo-nacional", cityId: "sanjose", name: "Museo Nacional", kind: "museum",
    tags: ["museum", "history", "garden"], neighborhood: "Cuesta de Moras", lat: 9.9328, lng: -84.0707,
    durationMin: 90, costUsd: 11, opens: "08:30", closes: "16:30", closedDays: [1], bestTime: "morning", touristy: 3,
    note: "Inside the old army barracks, which still has the 1948 bullet holes in the corner turret, from the civil war after which the country abolished its army. There is a butterfly garden on the way in. Shut Mondays." },

  { id: "sjo-teatro", cityId: "sanjose", name: "Teatro Nacional", kind: "sight",
    tags: ["architecture", "history", "music"], neighborhood: "Catedral", lat: 9.9332, lng: -84.0770,
    durationMin: 60, costUsd: 12, opens: "09:00", closes: "17:00", bestTime: "midday", touristy: 4,
    note: "Built on a coffee export tax in the 1890s so that visiting European singers would have somewhere to perform, and it is far grander than the country was. Twenty minutes on the guided walk-through; go to a concert instead if there is one." },

  { id: "sjo-mercado", cityId: "sanjose", name: "Mercado Central", kind: "market",
    tags: ["market", "food", "local", "coffee"], neighborhood: "Merced", lat: 9.9347, lng: -84.0820,
    durationMin: 75, costUsd: 10, opens: "06:30", closes: "18:00", closedDays: [0], bestTime: "morning", touristy: 3,
    note: "An 1880 covered block of butchers, flower stalls and about a dozen sodas with counters. Order a casado at one of them. Closed Sundays, and the surrounding streets are the ones to have your bag zipped in." },

  { id: "sjo-escalante", cityId: "sanjose", name: "Dinner in Barrio Escalante", kind: "meal",
    tags: ["food", "local", "contemporary", "nightlife"], neighborhood: "Barrio Escalante", lat: 9.9364, lng: -84.0639,
    durationMin: 100, costUsd: 30, opens: "18:00", closes: "23:00", closedDays: [1], bestTime: "evening", touristy: 2,
    note: "Four blocks of Calle 33 where most of the interesting cooking in the country now happens. This is the reason to give San José an evening rather than driving straight out of the airport." },

  { id: "sjo-cafe", cityId: "sanjose", name: "Coffee in Barrio Escalante", kind: "meal",
    tags: ["coffee", "local"], neighborhood: "Barrio Escalante", lat: 9.9364, lng: -84.0639,
    durationMin: 40, costUsd: 6, opens: "07:00", closes: "18:00", bestTime: "morning", touristy: 2,
    note: "The country grows the beans and historically exported every good one. That has changed in the last decade and this is where you taste the difference." },

  { id: "sjo-lunch", cityId: "sanjose", name: "Casado at a soda", kind: "meal",
    tags: ["food", "local"], neighborhood: "Merced", lat: 9.9347, lng: -84.0820,
    durationMin: 55, costUsd: 9, opens: "11:00", closes: "15:00", bestTime: "midday", touristy: 1,
    note: "Rice, beans, plantain, salad and a piece of meat on one plate for under ten dollars. A soda is a counter with six stools, and it is what everyone actually eats at midday." },

  // ================================= COSTA RICA — La Fortuna / Arenal =======
  { id: "arn-park", cityId: "lafortuna", name: "Arenal Volcano National Park, main sector", kind: "outdoor",
    tags: ["hike", "walk", "nature", "viewpoint"], neighborhood: "Arenal", lat: 10.4621, lng: -84.7034,
    durationMin: 180, costUsd: 17, opens: "08:00", closes: "16:00", bestTime: "morning", touristy: 3,
    note: "Las Coladas takes you 2km out onto the 1992 lava flow and El Ceibo loops 3km through secondary forest to a fig tree you can stand inside. Last admission is 2pm, and the cone is in cloud most afternoons — go early or you are walking on rock looking at grey." },

  { id: "arn-1968", cityId: "lafortuna", name: "Arenal 1968 trails", kind: "outdoor",
    tags: ["hike", "walk", "nature", "viewpoint"], neighborhood: "El Castillo road", lat: 10.4664, lng: -84.7362,
    durationMin: 150, costUsd: 27, opens: "08:00", closes: "17:00", bestTime: "morning", touristy: 2,
    note: "Privately run, on the flow from the 1968 eruption that wiped out two villages. Three trails — 1.7km, 3km and 5km — and the lookout has a cleaner line on the cone than the national park does. Last entry 3pm. The better of the two if you only do one." },

  { id: "arn-catarata", cityId: "lafortuna", name: "Catarata Río Fortuna", kind: "outdoor",
    tags: ["nature", "hike", "viewpoint"], neighborhood: "La Fortuna", lat: 10.4392, lng: -84.6693,
    durationMin: 150, costUsd: 18, opens: "07:30", closes: "16:00", bestTime: "morning", touristy: 4,
    note: "Five hundred concrete steps down into a gorge to a 70m fall you can swim at the base of, then five hundred back up. Eighteen dollars for a staircase is steep in both senses; go at half seven and have the pool to yourself, which is what makes it worth it." },

  { id: "arn-bridges", cityId: "lafortuna", name: "Mistico hanging bridges", kind: "walk",
    tags: ["walk", "nature", "viewpoint"], neighborhood: "Arenal", lat: 10.4880, lng: -84.7538,
    durationMin: 150, costUsd: 36, opens: "06:00", closes: "15:50", bestTime: "morning", touristy: 4,
    note: "3.2km through primary forest on six suspension bridges that put you level with the canopy instead of under it. Self-guided is fine; the 6am entry is when the birds are actually doing something and the bridges are empty." },

  { id: "arn-tabaconfree", cityId: "lafortuna", name: "Río Tabacón, the free stretch", kind: "experience",
    tags: ["spa", "nature", "local"], neighborhood: "Tabacón", lat: 10.4886, lng: -84.7240,
    durationMin: 90, costUsd: 0, bestTime: "afternoon", touristy: 3,
    note: "The same geothermal river the resort next door fences off, running under a road bridge with a gravel pull-off beside it. Free, hot, and locals have used it for decades. Do not leave anything in the car." },

  { id: "arn-tabacon", cityId: "lafortuna", name: "Tabacón hot springs", kind: "experience",
    tags: ["spa", "nature", "garden"], neighborhood: "Tabacón", lat: 10.4880, lng: -84.7224,
    durationMin: 210, costUsd: 99, opens: "10:00", closes: "22:00", bestTime: "evening", touristy: 4,
    note: "The river routed through landscaped gardens into a dozen pools between 22 and 41°C, on the volcano's flank. Ninety-nine dollars is a lot for hot water and it is genuinely good; go after dark, when the day-trip coaches have gone." },

  { id: "arn-dinner", cityId: "lafortuna", name: "Dinner in La Fortuna", kind: "meal",
    tags: ["food", "local"], neighborhood: "La Fortuna", lat: 10.4717, lng: -84.6444,
    durationMin: 90, costUsd: 28, opens: "17:00", closes: "22:00", bestTime: "evening", touristy: 4,
    note: "The square is ringed with places charging North American prices for the same casado sold two streets back for nine dollars. Walk two streets back." },

  { id: "arn-lunch", cityId: "lafortuna", name: "Lunch at a soda in town", kind: "meal",
    tags: ["food", "local"], neighborhood: "La Fortuna", lat: 10.4717, lng: -84.6444,
    durationMin: 55, costUsd: 12, opens: "11:00", closes: "16:00", bestTime: "midday", touristy: 2,
    note: "Casado, fresh fruit drink, no menu in English. This is the cheapest you will eat between here and the coast." },

  { id: "arn-atv", cityId: "lafortuna", name: "ATV tour through the farms", kind: "experience",
    tags: ["adventure", "nature"], neighborhood: "La Fortuna", lat: 10.4717, lng: -84.6444,
    durationMin: 180, costUsd: 105, bestTime: "afternoon", touristy: 4,
    note: "A hundred dollars to ride a quad in single file behind a guide along tracks you could walk, in a place whose whole appeal is how much you can hear. Put it into the hot springs instead.", skip: true },

  // ------------------------------------------- COSTA RICA — Río Celeste ----
  { id: "rce-waterfall", cityId: "riocelestenp", name: "Río Celeste waterfall trail", kind: "outdoor",
    tags: ["hike", "nature", "viewpoint", "earlystart"], neighborhood: "Tenorio", lat: 10.6731, lng: -85.0150,
    durationMin: 240, costUsd: 14, opens: "08:00", closes: "16:00", bestTime: "morning", touristy: 3,
    note: "6km round trip on a trail that is mud for half its length, with 253 steps down to the fall and a further hour to Los Teñideros, where two clear streams meet and turn blue. Last entry is 1:45pm and heavy rain upstream turns the whole river brown for days — ask before you drive an hour and a half." },

  { id: "rce-tenideros", cityId: "riocelestenp", name: "Los Teñideros and the blue lagoon", kind: "outdoor",
    tags: ["walk", "nature", "viewpoint"], neighborhood: "Tenorio", lat: 10.7073, lng: -84.9454,
    durationMin: 120, costUsd: 0, bestTime: "midday", touristy: 2,
    note: "The far end of the same trail, past the laguna azul and the bubbling hot spot, where you can watch the colour actually happen. Most people turn round at the waterfall, which is why this half is empty." },

  // ================================= COSTA RICA — Monteverde ================
  { id: "mvd-reserve", cityId: "monteverde", name: "Monteverde Cloud Forest Reserve", kind: "outdoor",
    tags: ["hike", "nature", "viewpoint", "walk"], neighborhood: "Monteverde", lat: 10.3034, lng: -84.7877,
    durationMin: 210, costUsd: 29, opens: "07:30", closes: "16:00", bestTime: "morning", touristy: 4,
    note: "The Continental Divide trail is 4km and about two and a half hours, over a suspension bridge and up to the gap where the Pacific and Caribbean watersheds meet. It rains sideways up there most days. Quetzals are real and you will probably not see one without a guide." },

  { id: "mvd-santaelena", cityId: "monteverde", name: "Santa Elena Reserve", kind: "outdoor",
    tags: ["hike", "walk", "nature", "viewpoint"], neighborhood: "Santa Elena", lat: 10.3442, lng: -84.7901,
    durationMin: 180, costUsd: 18, bestTime: "morning", touristy: 2,
    note: "Higher, wetter and considerably emptier than Monteverde, run by the local high school. Same cloud forest, a third of the visitors, and on a clear morning you can see Arenal across the valley from the observation tower." },

  { id: "mvd-curicancha", cityId: "monteverde", name: "Curi-Cancha Reserve", kind: "outdoor",
    tags: ["walk", "nature", "garden"], neighborhood: "Monteverde", lat: 10.3066, lng: -84.8074,
    durationMin: 180, costUsd: 25, opens: "07:00", closes: "15:00", bestTime: "morning", touristy: 2,
    note: "Eighty-three hectares of mixed forest and old pasture, which is bad for purists and very good for seeing things — the open edges are where the quetzals feed in the wild avocado. Caps its numbers, so it never feels full." },

  { id: "mvd-night", cityId: "monteverde", name: "Night walk in the reserve", kind: "experience",
    tags: ["nature", "walk", "local"], neighborhood: "Monteverde", lat: 10.3034, lng: -84.7877,
    durationMin: 150, costUsd: 30, opens: "17:45", closes: "20:30", bestTime: "evening", touristy: 3,
    note: "Two hours with a torch and a guide who finds sleeping birds, tarantulas and a two-toed sloth eight feet up. The forest at night is a different place and it is the only tour here that is not optional." },

  { id: "mvd-selvatura", cityId: "monteverde", name: "Selvatura zipline and treetop walkway", kind: "experience",
    tags: ["adventure", "nature", "viewpoint"], neighborhood: "Santa Elena", lat: 10.3423, lng: -84.7986,
    durationMin: 240, costUsd: 127, opens: "07:30", closes: "16:00", bestTime: "morning", touristy: 4,
    note: "Thirteen cables, one of them a kilometre long, plus eight fixed bridges through the canopy afterwards. Costa Rica invented the commercial canopy tour in this valley. Do it in the morning; by two the cloud is in and you are flying through grey." },

  { id: "mvd-dinner", cityId: "monteverde", name: "Dinner in Santa Elena", kind: "meal",
    tags: ["food", "local"], neighborhood: "Santa Elena", lat: 10.3165, lng: -84.8243,
    durationMin: 90, costUsd: 26, opens: "17:00", closes: "21:30", bestTime: "evening", touristy: 3,
    note: "A Quaker dairy settlement from the 1950s, which is why there is serious cheese here and why the town shuts early. Bring a jacket — it is 1,400m and it does not feel tropical after dark." },

  { id: "mvd-coffee", cityId: "monteverde", name: "Coffee before the cloud comes in", kind: "meal",
    tags: ["coffee", "local"], neighborhood: "Santa Elena", lat: 10.3165, lng: -84.8243,
    durationMin: 40, costUsd: 6, opens: "06:30", closes: "18:00", bestTime: "morning", touristy: 2,
    note: "Grown on the slopes below the town and roasted here. Open at half six because the reserves open at seven and the road up is slow." },

  // ============================ COSTA RICA — Manuel Antonio / Quepos ========
  { id: "man-park", cityId: "manuelantonio", name: "Manuel Antonio National Park", kind: "outdoor",
    tags: ["nature", "walk", "beach", "coast", "earlystart"], neighborhood: "Manuel Antonio", lat: 9.4021, lng: -84.1382,
    durationMin: 240, costUsd: 18, opens: "07:00", closes: "16:00", closedDays: [2], bestTime: "morning", touristy: 5,
    note: "The smallest national park in the country and the one with sloths, two species of monkey and a beach at the end of the trail. Closed Tuesdays, capped at about 2,000 a day, tickets online only. Be at the gate at seven; by ten it is a queue of people photographing a raccoon." },

  { id: "man-playa", cityId: "manuelantonio", name: "Playa Manuel Antonio", kind: "outdoor",
    tags: ["beach", "coast", "nature"], neighborhood: "Manuel Antonio", lat: 9.3808, lng: -84.1448,
    durationMin: 120, costUsd: 0, bestTime: "midday", touristy: 4,
    note: "Inside the park, a white crescent between two headlands with calm water and capuchins working the treeline for anything left unattended. They will open a backpack. That is not a joke." },

  { id: "man-biesanz", cityId: "manuelantonio", name: "Playa Biesanz", kind: "outdoor",
    tags: ["beach", "coast", "walk", "local"], neighborhood: "Punta Quepos", lat: 9.4009, lng: -84.1677,
    durationMin: 150, costUsd: 0, bestTime: "afternoon", touristy: 2,
    note: "Ten minutes down a forest path off the Punta Quepos road to a sheltered cove with actual snorkelling. Small, and it fills by noon — go late afternoon when the day boats have gone." },

  { id: "man-espadilla", cityId: "manuelantonio", name: "Playa Espadilla at sunset", kind: "walk",
    tags: ["beach", "coast", "walk", "viewpoint"], neighborhood: "Espadilla", lat: 9.3925, lng: -84.1545,
    durationMin: 90, costUsd: 0, bestTime: "evening", touristy: 4,
    note: "The long public beach outside the park gate. Rip currents are genuine here and people drown most years; walk it, do not swim it, and the sunset is straight down the sand." },

  { id: "man-quepos", cityId: "manuelantonio", name: "Quepos marina and the old town", kind: "walk",
    tags: ["walk", "coast", "local", "food"], neighborhood: "Quepos", lat: 9.4321, lng: -84.1625,
    durationMin: 90, costUsd: 0, bestTime: "evening", touristy: 2,
    note: "A banana port that turned into a sportfishing harbour, seven kilometres down the hill from the resort strip. The prices drop by half the moment you cross the bridge." },

  { id: "man-rainmaker", cityId: "manuelantonio", name: "Rainmaker canopy bridges", kind: "outdoor",
    tags: ["hike", "nature", "walk", "viewpoint"], neighborhood: "Parrita road", lat: 9.5784, lng: -84.2139,
    durationMin: 240, costUsd: 25, opens: "07:00", closes: "15:00", bestTime: "morning", touristy: 2,
    note: "Forty minutes north, six bridges strung across a steep primary-forest gorge with swimming holes under them, and a fraction of the people the coast has. Steep, slippery and properly wild in a way Manuel Antonio is not." },

  { id: "man-dinner", cityId: "manuelantonio", name: "Dinner above the bay", kind: "meal",
    tags: ["food", "coast", "viewpoint"], neighborhood: "Manuel Antonio", lat: 9.3925, lng: -84.1545,
    durationMin: 100, costUsd: 32, opens: "17:00", closes: "22:00", bestTime: "evening", touristy: 4,
    note: "The road along the ridge is lined with terraces facing west, and you are paying for the angle rather than the fish. Worth it once, at the right hour, and then eat in Quepos." },

  { id: "man-lunch", cityId: "manuelantonio", name: "Lunch in Quepos", kind: "meal",
    tags: ["food", "local", "coast"], neighborhood: "Quepos", lat: 9.4321, lng: -84.1625,
    durationMin: 70, costUsd: 18, opens: "11:30", closes: "16:00", bestTime: "midday", touristy: 2,
    note: "Whatever came off the boats that morning, cooked simply, at harbour prices. The marina restaurants are not this." },

  // ------------------------------------------- COSTA RICA — Costa Ballena --
  { id: "cba-nauyaca", cityId: "costaballena", name: "Nauyaca Waterfalls", kind: "outdoor",
    tags: ["hike", "nature", "viewpoint"], neighborhood: "Dominical road", lat: 9.2546, lng: -83.8075,
    durationMin: 270, costUsd: 15, closes: "15:30", bestTime: "morning", touristy: 3,
    note: "An hour and a quarter south, then 4km each way down a farm track to a two-stage fall with a pool deep enough to swim in at the bottom. Ten dollars plus five to park. There is a 4x4 shuttle for people who would rather not walk it, and its last run up is 2:30." },

  { id: "cba-ballena", cityId: "costaballena", name: "Marino Ballena and the whale tail", kind: "outdoor",
    tags: ["beach", "coast", "nature", "walk"], neighborhood: "Uvita", lat: 9.1550, lng: -83.7482,
    durationMin: 180, costUsd: 7, opens: "07:00", closes: "18:00", bestTime: "midday", touristy: 3,
    note: "At low tide a sandbar shaped like a whale's fluke runs 2km out from the Uvita entrance and you can walk the length of it. Check the tide table before you drive down — at high water it is underwater and there is nothing to see. Humpbacks are here August to September and again January to March." },
];
