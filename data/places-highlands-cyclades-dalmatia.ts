import type { Place } from "@/lib/types";

// Three destinations that stress the planner in different directions: a
// driving region where the weather decides the day, an island chain where the
// ferry decides it, and a coast where the walk between two Roman walls is the
// whole morning. Notes hand-written, same rule as everywhere else in data/.
//
// Coordinates: British sites are OS grid references from Wikipedia, Walkhighlands
// route cards and the Highland HER, converted to WGS84. Greek and Croatian sites
// are the OpenStreetMap-derived figures on Mapcarta, or the decimal coordinates
// printed on the relevant Wikipedia article. Prices are converted from the
// operator's own published figure and are omitted where no operator publishes one.

export const HIGHLANDS_CYCLADES_DALMATIA_PLACES: Place[] = [
  // ======================================================== SCOTTISH HIGHLANDS
  // -------------------------------------------------------------- Inverness --
  { id: "inv-castle", cityId: "inverness", name: "Inverness Castle Experience", kind: "sight",
    tags: ["castle", "history", "viewpoint"], neighborhood: "Castlehill", lat: 57.4764, lng: -4.2254,
    durationMin: 90, costUsd: 26, bestTime: "afternoon", touristy: 3,
    note: "The red sandstone block over the river was a sheriff court until 2020. It reopened in 2025 as a storytelling centre. The tower and the view down the Ness are the part that justifies the ticket." },

  { id: "inv-victorian", cityId: "inverness", name: "Victorian Market", kind: "market",
    tags: ["market", "food", "local", "shopping"], neighborhood: "Academy Street", lat: 57.4792, lng: -4.2256,
    durationMin: 60, costUsd: 0, opens: "08:00", bestTime: "morning", touristy: 2,
    note: "Arcade from 1891, rebuilt after the old one burned down, with thirty-odd independent shops and a food hall added at the back. Dogs are welcome throughout, which is not an accident but a local superstition." },

  { id: "inv-ness", cityId: "inverness", name: "Ness Islands", kind: "walk",
    tags: ["walk", "nature", "local", "garden"], neighborhood: "Ness Bank", lat: 57.4643, lng: -4.2301,
    durationMin: 60, costUsd: 0, bestTime: "morning", touristy: 1,
    note: "Wooded islands in the middle of the river, strung together by Victorian footbridges. Fifteen minutes' walk from the centre and used almost entirely by people who live here." },

  { id: "inv-culloden", cityId: "inverness", name: "Culloden Battlefield", kind: "museum",
    tags: ["history", "museum", "walk"], neighborhood: "Drumossie Moor", lat: 57.4772, lng: -4.0925,
    durationMin: 150, costUsd: 16, opens: "09:00", closes: "17:00", bestTime: "morning", touristy: 4,
    note: "Forty minutes of fighting on 16 April 1746, and with it the end of the Jacobite cause. The centre is good; the moor is better, and you need an hour on it with the audio guide to understand how short the range was." },

  { id: "inv-clava", cityId: "inverness", name: "Clava Cairns", kind: "sight",
    tags: ["history", "nature"], neighborhood: "Balnuaran", lat: 57.4686, lng: -4.0816,
    durationMin: 45, costUsd: 0, bestTime: "morning", touristy: 3,
    note: "Bronze Age passage cairns in a stand of trees, open year-round with nobody taking a ticket. Two of the passages line up on the midwinter sunset. Ten minutes from Culloden and worth pairing with it." },

  { id: "inv-fortgeorge", cityId: "inverness", name: "Fort George", kind: "sight",
    tags: ["history", "architecture", "coast", "museum"], neighborhood: "Ardersier", lat: 57.5839, lng: -4.0703,
    durationMin: 120, costUsd: 13, opens: "09:30", closes: "17:30", bestTime: "afternoon", touristy: 2,
    note: "A star fort finished in 1769 to hold down a rebellion that was already over, and still an army barracks. The rampart circuit is a mile long and points straight at the dolphins in the narrows." },

  { id: "inv-chanonry", cityId: "inverness", name: "Chanonry Point", kind: "outdoor",
    tags: ["nature", "coast", "viewpoint"], neighborhood: "Black Isle", lat: 57.5740, lng: -4.0927,
    durationMin: 90, costUsd: 0, bestTime: "afternoon", touristy: 3,
    note: "Bottlenose dolphins fish the tidal race here on the incoming tide. That timing is the whole trip — turn up at the wrong state of the water and you have driven forty minutes to look at a lighthouse. Park in Fortrose and walk." },

  { id: "inv-cawdor", cityId: "inverness", name: "Cawdor Castle", kind: "sight",
    tags: ["castle", "history", "garden"], neighborhood: "Cawdor", lat: 57.5243, lng: -3.9264,
    durationMin: 120, costUsd: 22, bestTime: "afternoon", touristy: 3,
    note: "Sold on the Macbeth connection, which is invented: the thaneship is a fifteenth-century writer's flourish, the real Macbeth died before the castle existed, and the play never names it. The gardens are fine. The premise is not.", skip: true },

  { id: "inv-market-lunch", cityId: "inverness", name: "Lunch in the Victorian Market food hall", kind: "meal",
    tags: ["food", "local", "market"], neighborhood: "Academy Street", lat: 57.4792, lng: -4.2256,
    durationMin: 60, costUsd: 18, opens: "08:00", bestTime: "midday", touristy: 2,
    note: "Counters round a shared seating floor, Highland producers doing the cooking. The best eating in the city centre and the only place open when the rest of Inverness shuts at five." },

  { id: "inv-dinner", cityId: "inverness", name: "Dinner in Inverness", kind: "meal",
    tags: ["food", "local"], neighborhood: "Centre", lat: 57.4764, lng: -4.2254,
    durationMin: 90, costUsd: 42, opens: "17:30", closes: "21:00", bestTime: "evening", touristy: 2,
    note: "Kitchens here close earlier than you expect and Sunday thins the list badly. Book, and book for seven rather than nine." },

  // ------------------------------------------------------------- Loch Ness --
  { id: "ln-urquhart", cityId: "lochness", name: "Urquhart Castle", kind: "sight",
    tags: ["castle", "history", "viewpoint", "iconic"], neighborhood: "Drumnadrochit", lat: 57.3240, lng: -4.4420,
    durationMin: 90, costUsd: 18, opens: "09:30", closes: "18:00", bestTime: "morning", touristy: 5,
    note: "A ruin on a promontory halfway down the loch, blown up by its own garrison in 1692. Nearly half a million people a year come through it, so buy online and be there at opening or accept the coach parties." },

  { id: "ln-foyers", cityId: "lochness", name: "Falls of Foyers", kind: "outdoor",
    tags: ["nature", "walk", "viewpoint"], neighborhood: "Foyers", lat: 57.2509, lng: -4.4904,
    durationMin: 105, costUsd: 0, bestTime: "afternoon", touristy: 2,
    note: "Steep steps down to a waterfall in a wooded gorge, then on to a pebble shore on the loch itself. Under three miles, 150m of climbing on the way back, and almost nobody does it because it is on the quiet side of the water." },

  // ------------------------------------------------------------ Cairngorms --
  { id: "cai-locheilein", cityId: "cairngorms", name: "Loch an Eilein circuit", kind: "outdoor",
    tags: ["walk", "nature", "castle"], neighborhood: "Rothiemurchus", lat: 57.1545, lng: -3.8258,
    durationMin: 120, costUsd: 0, bestTime: "morning", touristy: 3,
    note: "Seven flat kilometres round a loch with a ruined fourteenth-century castle on an island in it, through old Caledonian pine. There is a parking charge, per person, which surprises people." },

  { id: "cai-funicular", cityId: "cairngorms", name: "Cairngorm funicular", kind: "experience",
    tags: ["viewpoint", "nature", "adventure"], neighborhood: "Coire Cas", lat: 57.1284, lng: -3.6561,
    durationMin: 120, costUsd: 23, closes: "16:30", bestTime: "midday", touristy: 4,
    note: "Britain's highest railway, 635m to 1,097m in under five minutes. It has closed repeatedly for structural repairs, most recently in 2025, so check it is running before you drive up. Last train up is 15:30." },

  { id: "cai-morlich", cityId: "cairngorms", name: "Loch Morlich", kind: "outdoor",
    tags: ["nature", "beach", "walk"], neighborhood: "Glenmore", lat: 57.1670, lng: -3.7000,
    durationMin: 90, costUsd: 0, bestTime: "afternoon", touristy: 3,
    note: "A sand beach at 300m with the Cairngorm plateau behind it, which is a strange thing to find in the middle of Scotland. The sand contains WWII glass — this was a commando training ground — so keep shoes on." },

  { id: "cai-wildlife", cityId: "cairngorms", name: "Highland Wildlife Park", kind: "experience",
    tags: ["nature", "local"], neighborhood: "Kincraig", lat: 57.1111, lng: -3.9747,
    durationMin: 180, costUsd: 29, bestTime: "morning", touristy: 4,
    note: "Cold-climate species in large paddocks you drive through — polar bears, wolverine, muskox, and the Scottish wildcat breeding programme, which is the serious part. Open every day but Christmas." },

  // ----------------------------------------------------------- Isle of Skye --
  { id: "sky-storr", cityId: "skye", name: "Old Man of Storr", kind: "outdoor",
    tags: ["hike", "nature", "viewpoint", "earlystart", "iconic"], neighborhood: "Trotternish", lat: 57.4971, lng: -6.1600,
    durationMin: 120, costUsd: 6, bestTime: "morning", touristy: 5,
    note: "Five kilometres and 340m up to a set of basalt pinnacles left behind by an old landslip. Two hours at a steady pace, paid car park, and completely overrun from ten onwards. Be there at eight or do the Quiraing instead." },

  { id: "sky-quiraing", cityId: "skye", name: "Quiraing circuit", kind: "outdoor",
    tags: ["hike", "nature", "viewpoint"], neighborhood: "Trotternish", lat: 57.6286, lng: -6.2891,
    durationMin: 210, costUsd: 6, bestTime: "morning", touristy: 4,
    note: "The same landslip geology as the Storr but on a scale you walk into rather than up to — 6.5km, 374m, three to four hours, one mild scramble. The return over the top is exposed and the weather turns on it fast." },

  { id: "sky-fairypools", cityId: "skye", name: "Fairy Pools and Coire na Creiche", kind: "outdoor",
    tags: ["hike", "nature", "walk"], neighborhood: "Glen Brittle", lat: 57.2506, lng: -6.2715,
    durationMin: 165, costUsd: 6, bestTime: "morning", touristy: 5,
    note: "Everyone stops at the first three pools and turns round. Carry on up the corrie and the crowd disappears inside twenty minutes — the full loop is 8km with the Cuillin ridge above it the whole way. The water is genuinely too cold to swim in." },

  { id: "sky-neist", cityId: "skye", name: "Neist Point", kind: "outdoor",
    tags: ["coast", "viewpoint", "walk", "nature"], neighborhood: "Duirinish", lat: 57.4302, lng: -6.7794,
    durationMin: 105, costUsd: 0, bestTime: "evening", touristy: 4,
    note: "Concrete path and steps down to a 1909 lighthouse on the westernmost tip of Skye, with the basalt columns stacked like the Giant's Causeway. Unfenced cliffs, and it faces the sunset. Forty-five minutes' drive from anywhere." },

  { id: "sky-coral", cityId: "skye", name: "Coral Beaches at Claigan", kind: "outdoor",
    tags: ["beach", "coast", "walk", "nature"], neighborhood: "Claigan", lat: 57.4892, lng: -6.6201,
    durationMin: 105, costUsd: 0, bestTime: "afternoon", touristy: 3,
    note: "White sand that is not sand at all but dried calcified algae and broken snail shells, which is why it looks wrong in photographs. Four kilometres of easy track and pasture from the car park." },

  { id: "sky-fairyglen", cityId: "skye", name: "The Fairy Glen", kind: "outdoor",
    tags: ["walk", "nature", "viewpoint"], neighborhood: "Uig", lat: 57.5848, lng: -6.3325,
    durationMin: 75, costUsd: 0, bestTime: "afternoon", touristy: 3,
    note: "A pocket landscape of cone-shaped grassy hummocks, the Storr's geology shrunk to garden scale. One kilometre, 45m of climb, and an awkward step up if you want the top of Castle Ewen. Take the stone spirals apart if you find them; the rangers ask people to." },

  { id: "sky-talisker", cityId: "skye", name: "Talisker distillery tour", kind: "experience",
    tags: ["local", "history"], neighborhood: "Carbost", lat: 57.3019, lng: -6.3566,
    durationMin: 90, costUsd: 28, opens: "10:00", closes: "17:00", bestTime: "afternoon", touristy: 4,
    note: "Skye's only working distillery, on the shore of Loch Harport, taking fifty thousand visitors a year through an hour-long tour and tasting. Book it — walk-ups are turned away in season." },

  { id: "sky-dunvegan", cityId: "skye", name: "Dunvegan Castle", kind: "sight",
    tags: ["castle", "history", "garden", "coast"], neighborhood: "Dunvegan", lat: 57.4489, lng: -6.5900,
    durationMin: 120, costUsd: 22, opens: "10:00", closes: "17:30", bestTime: "morning", touristy: 4,
    note: "Open 1 April to 15 October only. Held by the same family for eight hundred years, which is the actual claim to interest rather than the building, much of which is a Victorian re-facing. The gardens run down to the loch and the seal colony boats leave from below." },

  { id: "sky-museum", cityId: "skye", name: "Skye Museum of Island Life", kind: "museum",
    tags: ["history", "museum", "local"], neighborhood: "Kilmuir", lat: 57.6600, lng: -6.3689,
    durationMin: 60, costUsd: 7, bestTime: "afternoon", touristy: 2,
    note: "A township of thatched blackhouses kept as they stood at the end of the eighteenth century. Small and unslick, the right corrective after a day of photographing rock formations." },

  { id: "sky-sligachan", cityId: "skye", name: "Sligachan old bridge", kind: "sight",
    tags: ["viewpoint", "history", "nature"], neighborhood: "Sligachan", lat: 57.2898, lng: -6.1748,
    durationMin: 40, costUsd: 0, bestTime: "evening", touristy: 3,
    note: "Telford's bridge of 1818, now pedestrians only, with the Black Cuillin standing directly behind it. Twenty minutes, and it is the one stop on Skye that works in bad light." },

  { id: "sky-elgol", cityId: "skye", name: "Elgol and the Loch Coruisk boat", kind: "experience",
    tags: ["boat", "nature", "coast", "adventure"], neighborhood: "Elgol", lat: 57.1520, lng: -6.0996,
    durationMin: 210, costUsd: 46, bestTime: "morning", touristy: 3,
    note: "Two operators run small boats from the slip into the Cuillin's inner sanctuary, with seals on the way. It is a long single-track drive to get there and the sailings cancel on swell, so treat it as a plan that might not happen." },

  { id: "sky-portree", cityId: "skye", name: "Portree harbour", kind: "walk",
    tags: ["walk", "coast", "local"], neighborhood: "Portree", lat: 57.4295, lng: -6.1940,
    durationMin: 60, costUsd: 0, bestTime: "evening", touristy: 4,
    note: "Painted houses round a cliff-ringed harbour with a Telford pier. It is the only town on the island and every visitor passes through it, so walk it at eight in the evening rather than at noon." },

  { id: "sky-eileandonan", cityId: "skye", name: "Eilean Donan Castle", kind: "sight",
    tags: ["castle", "history", "iconic", "coast"], neighborhood: "Dornie", lat: 57.2740, lng: -5.5161,
    durationMin: 75, costUsd: 17, opens: "09:30", closes: "18:00", bestTime: "morning", touristy: 5,
    note: "On the mainland side of the bridge, at the meeting of three sea lochs. Almost entirely a 1930s reconstruction of a castle the Royal Navy shelled flat in 1719, which does not make the causeway shot less good. Half an hour on the shore is a legitimate visit." },

  { id: "sky-plockton", cityId: "skye", name: "Plockton", kind: "walk",
    tags: ["walk", "coast", "local", "garden"], neighborhood: "Loch Carron", lat: 57.3385, lng: -5.6515,
    durationMin: 90, costUsd: 0, bestTime: "afternoon", touristy: 3,
    note: "A crofting village facing away from the prevailing wind with New Zealand cabbage trees along the harbour front, planted in the 1960s and everywhere described as palms. Twenty minutes off the Skye road and worth the detour." },

  { id: "sky-coffee", cityId: "skye", name: "Coffee in Portree", kind: "meal",
    tags: ["coffee", "local"], neighborhood: "Portree", lat: 57.4295, lng: -6.1940,
    durationMin: 35, costUsd: 7, opens: "08:00", closes: "17:00", bestTime: "morning", touristy: 3,
    note: "Open early, which matters when the plan is to be at the Storr car park before the first coach. Fill a flask while you are there." },

  { id: "sky-dinner", cityId: "skye", name: "Dinner in Portree", kind: "meal",
    tags: ["food", "local", "coast"], neighborhood: "Portree", lat: 57.4295, lng: -6.1940,
    durationMin: 90, costUsd: 48, opens: "17:00", closes: "21:00", bestTime: "evening", touristy: 3,
    note: "Langoustine and scallops landed within sight of the table, at prices that reflect how few tables there are. Book before you get on the island, not on the day." },

  // ------------------------------------------------------ Glen Coe & Lochaber --
  { id: "glc-lostvalley", cityId: "glencoe", name: "The Lost Valley", kind: "outdoor",
    tags: ["hike", "nature", "history", "viewpoint"], neighborhood: "Glen Coe", lat: 56.6684, lng: -4.9872,
    durationMin: 165, costUsd: 0, bestTime: "morning", touristy: 4,
    note: "Coire Gabhail, where the MacDonalds hid stolen cattle: it reads as an ordinary V-shaped gully from the road and opens into a flat hanging valley at the top. Four kilometres, 335m, with a polished rake and a drop that some people find airy." },

  { id: "glc-threesisters", cityId: "glencoe", name: "Three Sisters viewpoint", kind: "sight",
    tags: ["viewpoint", "nature"], neighborhood: "Glen Coe", lat: 56.6678, lng: -4.9868,
    durationMin: 25, costUsd: 0, bestTime: "morning", touristy: 5,
    note: "The lay-by everyone stops at, looking into three buttresses of the Bidean nam Bian massif. It is a pull-in, not an outing — five minutes, then walk into the Lost Valley from the same car park." },

  { id: "glc-visitorcentre", cityId: "glencoe", name: "Glencoe visitor centre", kind: "museum",
    tags: ["history", "museum", "nature"], neighborhood: "Glencoe", lat: 56.6712, lng: -5.0819,
    durationMin: 75, costUsd: 0, opens: "09:30", closes: "17:30", bestTime: "afternoon", touristy: 3,
    note: "Free, with a relief model of the glen that makes the next two days legible, and an honest account of the 1692 massacre rather than a romantic one. Thirty-eight people died; the treachery is the point, not the body count." },

  { id: "glc-steall", cityId: "glencoe", name: "Nevis Gorge and Steall Falls", kind: "outdoor",
    tags: ["hike", "nature", "walk"], neighborhood: "Glen Nevis", lat: 56.7778, lng: -4.9992,
    durationMin: 120, costUsd: 0, bestTime: "afternoon", touristy: 3,
    note: "Three and a half kilometres through a gorge to one of Scotland's highest falls, with a three-wire bridge at the end that you do not have to cross. Rough and rocky with steep drops — the sign at the car park is not decorative." },

  { id: "glc-bennevis", cityId: "glencoe", name: "Ben Nevis by the Mountain Track", kind: "outdoor",
    tags: ["hike", "nature", "earlystart", "adventure"], neighborhood: "Achintee", lat: 56.7969, lng: -5.0035,
    durationMin: 480, costUsd: 0, bestTime: "morning", touristy: 4,
    note: "1,345m from near sea level, up zigzags on stony ground, seven to nine hours return. The summit plateau is in cloud roughly eighty per cent of the time from November to January and is ringed by cliffs on three sides. Go with a map and the willingness to turn round." },

  { id: "glc-glenfinnan", cityId: "glencoe", name: "Glenfinnan Viaduct viewpoint", kind: "sight",
    tags: ["viewpoint", "architecture", "film", "walk"], neighborhood: "Glenfinnan", lat: 56.8758, lng: -5.4313,
    durationMin: 75, costUsd: 0, bestTime: "morning", touristy: 5,
    note: "Twenty-one concrete arches, 380m long, finished in 1901 and now known mainly from a film franchise. The trail up the hillside gives the view; the car park fills by nine in summer and the overspill parking on the A830 is enforced." },

  { id: "glc-monument", cityId: "glencoe", name: "Glenfinnan Monument", kind: "sight",
    tags: ["history", "coast", "viewpoint"], neighborhood: "Glenfinnan", lat: 56.8692, lng: -5.4369,
    durationMin: 45, costUsd: 0, bestTime: "afternoon", touristy: 4,
    note: "A tower at the head of Loch Shiel where the 1745 rising was raised, put up in 1815 by a Macdonald of Clanranald. Small, and the loch behind it is the reason to stand there." },

  { id: "glc-jacobite", cityId: "glencoe", name: "The Jacobite steam train", kind: "experience",
    tags: ["history", "iconic", "film"], neighborhood: "Glenfinnan", lat: 56.8758, lng: -5.4313,
    durationMin: 360, costUsd: 97, bestTime: "morning", touristy: 5,
    note: "£76 return, six hours, sells out months ahead, and the thing you booked it for — the viaduct — is the one part you cannot see from inside the train. Walk up to the viewpoint and watch it cross instead.", skip: true },

  { id: "glc-lunch", cityId: "glencoe", name: "Lunch out of the pack", kind: "meal",
    tags: ["food", "local"], neighborhood: "Glen Coe", lat: 56.6684, lng: -4.9872,
    durationMin: 40, costUsd: 12, bestTime: "midday", touristy: 1,
    note: "There is nothing to buy between Glencoe village and the Ballachulish junction, and the days here are long. Buy it the night before and eat it on a rock above the Lost Valley." },

  { id: "glc-dinner", cityId: "glencoe", name: "Dinner in Glencoe village", kind: "meal",
    tags: ["food", "local"], neighborhood: "Glencoe", lat: 56.6712, lng: -5.0819,
    durationMin: 90, costUsd: 44, opens: "17:00", closes: "20:30", bestTime: "evening", touristy: 3,
    note: "Two hotel bars, a handful of tables between them, all of it full of people comparing the day's weather. Last orders are early and nobody warns you." },

  // ============================================================= THE CYCLADES
  // ------------------------------------------------------------- Santorini --
  { id: "san-akrotiri", cityId: "santorini", name: "Akrotiri excavations", kind: "sight",
    tags: ["history", "architecture", "art"], neighborhood: "Akrotiri", lat: 36.3514, lng: 25.4036,
    durationMin: 105, costUsd: 22, opens: "08:00", closes: "20:00", bestTime: "midday", touristy: 4,
    note: "A Bronze Age town buried by the eruption and dug out with three-storey walls, drains and furniture intact. No bodies and one gold object were found, which reads as an orderly evacuation. It is roofed, so it is the sane thing to do at two in the afternoon." },

  { id: "san-thera", cityId: "santorini", name: "Ancient Thera", kind: "sight",
    tags: ["history", "viewpoint", "hike"], neighborhood: "Mesa Vouno", lat: 36.3633, lng: 25.4793,
    durationMin: 120, costUsd: 11, opens: "08:30", closes: "15:30", closedDays: [3], bestTime: "morning", touristy: 2,
    note: "The classical city, strung along a limestone ridge 350m above the sea between Kamari and Perissa. Shut Wednesdays, shuts at half past three, and there is no shade at all on the ridge. Go first thing." },

  { id: "san-prehistoric", cityId: "santorini", name: "Museum of Prehistoric Thera", kind: "museum",
    tags: ["museum", "history", "art"], neighborhood: "Fira", lat: 36.4165, lng: 25.4326,
    durationMin: 75, costUsd: 11, opens: "08:30", closes: "15:30", closedDays: [2], bestTime: "morning", touristy: 3,
    note: "Where the frescoes and the gold ibex from Akrotiri actually are. Small, and it makes the site an hour's drive south mean something rather than looking like foundations. Do this one first." },

  { id: "san-caldera-path", cityId: "santorini", name: "Fira to Oia caldera path", kind: "outdoor",
    tags: ["hike", "viewpoint", "coast", "earlystart"], neighborhood: "Caldera rim", lat: 36.4149, lng: 25.4325,
    durationMin: 240, costUsd: 0, bestTime: "morning", touristy: 4,
    note: "Ten kilometres along the rim through Firostefani, Imerovigli and Finikia, half of it on paving and half on volcanic grit. Start at seven; by eleven the exposed middle section is unpleasant and there is no water for two hours." },

  { id: "san-skaros", cityId: "santorini", name: "Skaros Rock", kind: "outdoor",
    tags: ["walk", "viewpoint", "history", "castle"], neighborhood: "Imerovigli", lat: 36.4324, lng: 25.4182,
    durationMin: 90, costUsd: 0, bestTime: "evening", touristy: 3,
    note: "A 244m headland below Imerovigli carrying the remains of the Venetian castle Marco Sanudo built in 1207. Steep loose descent and climb, no railings, and the chapel on the far side is where the view of the caldera actually is." },

  { id: "san-pyrgos", cityId: "santorini", name: "Pyrgos", kind: "walk",
    tags: ["walk", "history", "local", "viewpoint"], neighborhood: "Pyrgos", lat: 36.3826, lng: 25.4502,
    durationMin: 90, costUsd: 0, bestTime: "evening", touristy: 2,
    note: "One of the island's five Venetian castle villages, stacked up a hill in the middle rather than on the rim. You can see both coasts from the top and there are no cruise passengers because there is no caldera view to sell." },

  { id: "san-emporio", cityId: "santorini", name: "Emporio kasteli", kind: "walk",
    tags: ["walk", "history", "local"], neighborhood: "Emporio", lat: 36.3583, lng: 25.4444,
    durationMin: 75, costUsd: 0, bestTime: "afternoon", touristy: 1,
    note: "A medieval quarter built as a defensive block with the outer houses forming the wall, plus the Goulas tower and a marble-columned church. Genuinely confusing to walk and almost empty." },

  { id: "san-perissa", cityId: "santorini", name: "Perissa black sand", kind: "outdoor",
    tags: ["beach", "coast", "nature"], neighborhood: "Perissa", lat: 36.3569, lng: 25.4739,
    durationMin: 150, costUsd: 0, bestTime: "afternoon", touristy: 3,
    note: "Volcanic sand running unbroken into Perivolos and Agios Georgios, with Mesa Vouno at one end. The sand gets hot enough by two o'clock to be a real problem barefoot, which nobody mentions." },

  { id: "san-megalochori", cityId: "santorini", name: "Assyrtiko at Venetsanos", kind: "experience",
    tags: ["wine", "viewpoint", "local"], neighborhood: "Megalochori", lat: 36.3764, lng: 25.4317,
    durationMin: 105, costUsd: 30, opens: "11:00", closes: "20:00", bestTime: "afternoon", touristy: 3,
    note: "Built into the cliff above the old port in 1947 so the wine moved downhill by gravity to the boats. The vines here are trained in baskets on the ground against the wind, which is the whole story of Santorini wine in one image." },

  { id: "san-amoudi", cityId: "santorini", name: "Amoudi Bay steps", kind: "walk",
    tags: ["walk", "coast", "viewpoint"], neighborhood: "Oia", lat: 36.4599, lng: 25.3705,
    durationMin: 75, costUsd: 0, bestTime: "evening", touristy: 4,
    note: "Three hundred steps down from Oia to a red-cliff harbour, and the same three hundred back up. Go down late in the afternoon, swim off the rocks past the tavernas, and climb out after the light has gone off the cliff." },

  { id: "san-oia-morning", cityId: "santorini", name: "Oia before eight", kind: "walk",
    tags: ["walk", "viewpoint", "architecture", "earlystart"], neighborhood: "Oia", lat: 36.4670, lng: 25.3670,
    durationMin: 75, costUsd: 0, bestTime: "morning", touristy: 3,
    note: "The same two kilometres of lane that hold several thousand people at sunset are empty at seven, and the light comes from behind you onto the domes rather than into the lens. Then down the steps to the harbour." },

  { id: "san-oia-sunset", cityId: "santorini", name: "Sunset at Oia castle", kind: "sight",
    tags: ["viewpoint", "iconic"], neighborhood: "Oia", lat: 36.4670, lng: 25.3670,
    durationMin: 90, costUsd: 0, bestTime: "evening", touristy: 5,
    note: "Several thousand people packed onto a ruined bastion, arriving two hours early to hold a spot, then applauding. The same sun sets on Imerovigli, on Pyrgos and from the Skaros path with nobody in the way.", skip: true },

  { id: "san-donkeys", cityId: "santorini", name: "Donkey ride up the Fira steps", kind: "experience",
    tags: ["iconic"], neighborhood: "Fira", lat: 36.4149, lng: 25.4325,
    durationMin: 30, costUsd: 0, bestTime: "any", touristy: 5,
    note: "Animals carrying adults up 580 steps in August heat, which the Greek authorities have repeatedly had to legislate about. There is a cable car beside it and the walk down is fifteen minutes.", skip: true },

  { id: "san-dinner", cityId: "santorini", name: "Dinner in Fira", kind: "meal",
    tags: ["food", "wine", "local"], neighborhood: "Fira", lat: 36.4149, lng: 25.4325,
    durationMin: 105, costUsd: 48, opens: "19:00", closes: "23:30", bestTime: "evening", touristy: 4,
    note: "Anything with a caldera view charges for the view. One street back from the rim the same tomato keftedes and the same assyrtiko cost half as much." },

  { id: "san-amoudi-lunch", cityId: "santorini", name: "Fish lunch at Amoudi", kind: "meal",
    tags: ["food", "coast", "local"], neighborhood: "Amoudi", lat: 36.4599, lng: 25.3705,
    durationMin: 105, costUsd: 55, opens: "12:00", closes: "22:00", bestTime: "midday", touristy: 4,
    note: "Tables on the water at the bottom of the Oia steps, fish sold by the kilo off ice. Ask the price before it goes on the grill; the bill is where people get caught out." },

  // ----------------------------------------------------------------- Naxos --
  { id: "nax-portara", cityId: "naxos", name: "The Portara", kind: "sight",
    tags: ["history", "viewpoint", "coast", "iconic"], neighborhood: "Palatia islet", lat: 37.1102, lng: 25.3723,
    durationMin: 45, costUsd: 0, bestTime: "evening", touristy: 4,
    note: "A marble doorframe from a sixth-century BC temple of Apollo that was never finished, left standing on the islet by the harbour because the blocks were too heavy to steal. Free, always open, and it faces the sunset." },

  { id: "nax-kastro", cityId: "naxos", name: "The Kastro", kind: "walk",
    tags: ["walk", "history", "architecture"], neighborhood: "Chora", lat: 37.1000, lng: 25.3670,
    durationMin: 90, costUsd: 0, bestTime: "evening", touristy: 3,
    note: "Marco Sanudo's fortified town of 1207, still lived in, with the Venetian coats of arms over the doors of families who never left. The Bourgos lanes below it were laid out to confuse anyone who got through the gate and they still work." },

  { id: "nax-museum", cityId: "naxos", name: "Naxos Archaeological Museum", kind: "museum",
    tags: ["museum", "history", "art"], neighborhood: "Kastro", lat: 37.1000, lng: 25.3670,
    durationMin: 75, costUsd: 6, bestTime: "morning", touristy: 2,
    note: "Inside the old Jesuit school in the Kastro, and the Cycladic figurines are the reason to go — flat marble bodies from the third millennium BC that Brancusi spent a career catching up with." },

  { id: "nax-demeter", cityId: "naxos", name: "Temple of Demeter at Sangri", kind: "sight",
    tags: ["history", "architecture", "nature"], neighborhood: "Sangri", lat: 37.0292, lng: 25.4326,
    durationMin: 75, costUsd: 6, bestTime: "morning", touristy: 1,
    note: "An early Ionic temple of about 530 BC, almost square, entirely Naxian marble including the oldest known marble roof. Sixteen hundred fragments survived well enough to put a corner of it back up. Alone in a field with a goat track to it." },

  { id: "nax-zas", cityId: "naxos", name: "Mount Zas", kind: "outdoor",
    tags: ["hike", "nature", "viewpoint", "earlystart"], neighborhood: "Filoti", lat: 37.0306, lng: 25.5022,
    durationMin: 240, costUsd: 0, bestTime: "morning", touristy: 2,
    note: "The highest point in the Cyclades at 1,001m. The easy line starts at the Agia Marina chapel; the better one starts at the Aria spring and goes past the cave where Zeus was supposedly raised. No shade, no water above the spring." },

  { id: "nax-halki", cityId: "naxos", name: "Halki and the Tragaea", kind: "walk",
    tags: ["walk", "history", "church", "local"], neighborhood: "Chalki", lat: 37.0639, lng: 25.4840,
    durationMin: 120, costUsd: 0, bestTime: "morning", touristy: 2,
    note: "The old capital of the interior, sitting in an olive valley full of Byzantine chapels — Panagia Protothronos in the village has frescoes in six layers. Neoclassical houses, one distillery, and no beach, which is why it is quiet." },

  { id: "nax-apeiranthos", cityId: "naxos", name: "Apeiranthos", kind: "walk",
    tags: ["walk", "local", "history", "viewpoint"], neighborhood: "Apeiranthos", lat: 37.0722, lng: 25.5222,
    durationMin: 105, costUsd: 0, bestTime: "afternoon", touristy: 2,
    note: "Marble-paved lanes at 650m on the flank of Fanari, with four museums in it and a dialect that sounds Cretan because the founders probably were. Twenty-eight kilometres of switchbacks from Chora, so make a day of the east side." },

  { id: "nax-flerio", cityId: "naxos", name: "Kouroi of Flerio", kind: "sight",
    tags: ["history", "art", "nature", "walk"], neighborhood: "Melanes", lat: 37.0836, lng: 25.4522,
    durationMin: 60, costUsd: 0, bestTime: "morning", touristy: 2,
    note: "Two unfinished marble youths, five metres long and seven tonnes, lying where they were abandoned in the Archaic period after being dropped in transit. One is in a garden, one is up at the quarry. Nothing is roped off." },

  { id: "nax-plaka", cityId: "naxos", name: "Plaka beach", kind: "outdoor",
    tags: ["beach", "coast", "nature"], neighborhood: "Plaka", lat: 37.0504, lng: 25.3660,
    durationMin: 180, costUsd: 0, bestTime: "afternoon", touristy: 2,
    note: "Four kilometres of dune-backed sand on the west coast with long undeveloped stretches between the beach bars. The meltemi blows straight onto it; pick the sheltered southern end on a windy day." },

  { id: "nax-prokopios", cityId: "naxos", name: "Agios Prokopios", kind: "outdoor",
    tags: ["beach", "coast"], neighborhood: "Agios Prokopios", lat: 37.0750, lng: 25.3514,
    durationMin: 150, costUsd: 0, bestTime: "afternoon", touristy: 4,
    note: "The closest good beach to Chora, which is why the bus runs every twenty minutes and why the near end is loungers to the waterline. Walk five minutes north and it thins out." },

  { id: "nax-moutsouna", cityId: "naxos", name: "The emery road to Moutsouna", kind: "outdoor",
    tags: ["nature", "coast", "history", "viewpoint"], neighborhood: "Moutsouna", lat: 37.0783, lng: 25.5862,
    durationMin: 150, costUsd: 0, bestTime: "afternoon", touristy: 1,
    note: "Down the east side past the rusting cable-car pylons that carried emery from the mountain mines to the harbour until the 1980s. A working fishing village at the bottom and almost no traffic on the road." },

  { id: "nax-filoti", cityId: "naxos", name: "Filoti", kind: "walk",
    tags: ["walk", "local", "nature"], neighborhood: "Filoti", lat: 37.0514, lng: 25.4983,
    durationMin: 75, costUsd: 0, bestTime: "afternoon", touristy: 2,
    note: "Sixteen hundred people on the lower slope of Zas, and where both routes up the mountain start. Somewhere to sit in the shade before or after, which on that walk is not a small thing." },

  { id: "nax-kitron", cityId: "naxos", name: "Kitron tasting in Halki", kind: "drink",
    tags: ["local", "food"], neighborhood: "Chalki", lat: 37.0639, lng: 25.4840,
    durationMin: 45, costUsd: 8, bestTime: "midday", touristy: 3,
    note: "A citron-leaf liqueur made only here, in a distillery that has not changed its equipment in a century. Three strengths, all of them odd. Buy the green one or none." },

  { id: "nax-dinner", cityId: "naxos", name: "Dinner in Naxos town", kind: "meal",
    tags: ["food", "local", "coast"], neighborhood: "Chora", lat: 37.1000, lng: 25.3670,
    durationMin: 105, costUsd: 34, opens: "19:00", closes: "24:00", bestTime: "evening", touristy: 3,
    note: "Naxos grows its own potatoes, cheese and meat, so the island menu is not the same island menu as everywhere else in the Cyclades. Eat in the Bourgos lanes rather than on the waterfront." },

  // ----------------------------------------------------------------- Paros --
  { id: "par-ekatontapyliani", cityId: "paros", name: "Panagia Ekatontapyliani", kind: "sight",
    tags: ["church", "history", "architecture"], neighborhood: "Parikia", lat: 37.0849, lng: 25.1520,
    durationMin: 60, costUsd: 0, bestTime: "morning", touristy: 3,
    note: "A church complex whose oldest fabric predates Christianity becoming the state religion, with a cruciform baptismal font still in place. The name means a hundred doors and there are ninety-nine; the hundredth is a story about Constantinople." },

  { id: "par-parikia", cityId: "paros", name: "Parikia old town", kind: "walk",
    tags: ["walk", "history", "local", "shopping"], neighborhood: "Parikia", lat: 37.0842, lng: 25.1504,
    durationMin: 90, costUsd: 0, bestTime: "evening", touristy: 3,
    note: "The Venetian kastro here was built out of a dismantled classical temple, so there are fluted column drums laid flat in the walls. Ten minutes inland from the ferry quay and a different town from the one you land in." },

  { id: "par-naoussa", cityId: "paros", name: "Naoussa harbour", kind: "walk",
    tags: ["walk", "coast", "local", "history"], neighborhood: "Naoussa", lat: 37.1235, lng: 25.2387,
    durationMin: 105, costUsd: 0, bestTime: "evening", touristy: 4,
    note: "Still a working fishing village at six in the morning and a restaurant strip by eight in the evening. The Venetian breakwater fort is half sunk and you wade to it. Come for one or the other, not both." },

  { id: "par-lefkes", cityId: "paros", name: "Lefkes and the Byzantine road", kind: "outdoor",
    tags: ["hike", "walk", "history", "local"], neighborhood: "Lefkes", lat: 37.0558, lng: 25.2078,
    durationMin: 165, costUsd: 0, bestTime: "morning", touristy: 2,
    note: "A marble-paved mule road drops from the old inland capital at 215m down to Prodromos, laid in the Byzantine period and still the direct route. Downhill the whole way, about an hour, then the bus back." },

  { id: "par-kolymbithres", cityId: "paros", name: "Kolymbithres", kind: "outdoor",
    tags: ["beach", "coast", "nature"], neighborhood: "Kolymbithres", lat: 37.1309, lng: 25.2157,
    durationMin: 150, costUsd: 0, bestTime: "afternoon", touristy: 4,
    note: "Granite worn into smooth lobes that split the beach into a series of small coves, so you can always find one without a sunbed on it. Ten minutes by boat across the bay from Naoussa rather than twenty-five by road." },

  { id: "par-marpissa", cityId: "paros", name: "Marpissa", kind: "walk",
    tags: ["walk", "local", "viewpoint"], neighborhood: "Marpissa", lat: 37.0444, lng: 25.2485,
    durationMin: 75, costUsd: 0, bestTime: "afternoon", touristy: 1,
    note: "Seven hundred people on a hill nineteen kilometres from the ferry, on the wrong side of the island for day trippers. Whitewashed lanes with nothing for sale in them, which is the whole of the appeal." },

  { id: "par-pisolivadi", cityId: "paros", name: "Piso Livadi harbour", kind: "walk",
    tags: ["walk", "coast", "local"], neighborhood: "Piso Livadi", lat: 37.0363, lng: 25.2583,
    durationMin: 60, costUsd: 0, bestTime: "evening", touristy: 2,
    note: "A small east-coast harbour below Marpissa with the fishing boats still working out of it. Ten minutes from Golden Beach and the obvious place to end a day on that side." },

  { id: "par-goldenbeach", cityId: "paros", name: "Golden Beach", kind: "outdoor",
    tags: ["beach", "coast", "adventure"], neighborhood: "Chrissi Akti", lat: 37.0107, lng: 25.2379,
    durationMin: 150, costUsd: 0, bestTime: "afternoon", touristy: 3,
    note: "East-facing and completely unsheltered, so it takes the meltemi head on. That is why the boards are here. On a still day it is a long strand of sand and nothing more." },

  { id: "par-dinner", cityId: "paros", name: "Dinner in Naoussa", kind: "meal",
    tags: ["food", "coast", "wine"], neighborhood: "Naoussa", lat: 37.1235, lng: 25.2387,
    durationMin: 105, costUsd: 42, opens: "19:00", closes: "24:00", bestTime: "evening", touristy: 4,
    note: "The tables wedged into the alleys behind the harbour are better than the ones on it and take bookings a day ahead. In August they take them a week ahead." },

  // ================================================================ DALMATIA
  // ------------------------------------------------------------------ Split --
  { id: "spl-cellars", cityId: "split", name: "Cellars of Diocletian's Palace", kind: "sight",
    tags: ["history", "architecture"], neighborhood: "Grad", lat: 43.5076, lng: 16.4398,
    durationMin: 60, costUsd: 6, bestTime: "midday", touristy: 4,
    note: "The substructures held up the emperor's apartments and were filled with rubbish for centuries, which is why the floor plan of rooms that no longer exist survives underneath. The central corridor is free; the side halls are the ticket." },

  { id: "spl-peristyle", cityId: "split", name: "The Peristyle", kind: "sight",
    tags: ["history", "architecture", "iconic"], neighborhood: "Grad", lat: 43.5082, lng: 16.4402,
    durationMin: 40, costUsd: 0, bestTime: "morning", touristy: 5,
    note: "Diocletian's ceremonial court, with his mausoleum on one side and a sphinx brought from Egypt sitting in the corner. Free and open at all hours — go at seven in the morning, when it is a square rather than a queue." },

  { id: "spl-cathedral", cityId: "split", name: "St Domnius and the bell tower", kind: "sight",
    tags: ["church", "history", "viewpoint", "architecture"], neighborhood: "Grad", lat: 43.5080, lng: 16.4405,
    durationMin: 75, costUsd: 15, bestTime: "morning", touristy: 5,
    note: "A cathedral inside the mausoleum of the emperor who ran the last great persecution, dedicated to one of the men he had killed. The tower is 57m, the stairs are open-sided, and it is the most honest medieval thing in Dalmatia." },

  { id: "spl-jupiter", cityId: "split", name: "Temple of Jupiter", kind: "sight",
    tags: ["history", "architecture"], neighborhood: "Grad", lat: 43.5083, lng: 16.4396,
    durationMin: 25, costUsd: 3, bestTime: "morning", touristy: 4,
    note: "A small barrel-vaulted temple down an alley off the Peristyle, later a baptistery, with a coffered ceiling carved out of a single run of stone. Twenty minutes, three euros, and most people walk past the door." },

  { id: "spl-pazar", cityId: "split", name: "Pazar, the green market", kind: "market",
    tags: ["market", "food", "local"], neighborhood: "Grad", lat: 43.5079, lng: 16.4415,
    durationMin: 45, costUsd: 8, bestTime: "morning", touristy: 2,
    note: "Straight against the east wall of the palace by the church of St Dominic, and loud with bargaining until about eleven. Buy figs and paški sir; the produce is the point and the souvenir stalls at the edge are not." },

  { id: "spl-varos", cityId: "split", name: "Varoš", kind: "walk",
    tags: ["walk", "local", "history"], neighborhood: "Varoš", lat: 43.5097, lng: 16.4338,
    durationMin: 60, costUsd: 0, bestTime: "evening", touristy: 2,
    note: "The old fishermen's quarter climbing the slope west of the palace, stone houses on stepped lanes, laundry across the gaps. Five minutes from the Riva and about a tenth of the foot traffic." },

  { id: "spl-marjan", cityId: "split", name: "Marjan to Telegrin", kind: "outdoor",
    tags: ["walk", "viewpoint", "nature", "coast"], neighborhood: "Marjan", lat: 43.5087, lng: 16.4192,
    durationMin: 105, costUsd: 0, bestTime: "morning", touristy: 3,
    note: "A pine-covered peninsula that the city treats as its back garden, 178m at the top with hermitage caves and a Jewish cemetery from 1573 on the way up. Go before nine; there is no shade on the final stairs." },

  { id: "spl-mestrovic", cityId: "split", name: "Meštrović Gallery", kind: "museum",
    tags: ["museum", "art", "architecture", "garden"], neighborhood: "Meje", lat: 43.5049, lng: 16.4182,
    durationMin: 105, costUsd: 13, bestTime: "afternoon", touristy: 3,
    note: "The sculptor's own villa, with the terraced garden he designed for the work. The ticket also covers the Kaštelet along the road, where a cycle of walnut reliefs lines a chapel — that is the better half and half the visitors skip it." },

  { id: "spl-bacvice", cityId: "split", name: "Bačvice and picigin", kind: "outdoor",
    tags: ["beach", "coast", "local"], neighborhood: "Bačvice", lat: 43.5038, lng: 16.4472,
    durationMin: 120, costUsd: 0, bestTime: "morning", touristy: 3,
    note: "A shallow sand bay ten minutes' walk from the palace where men have been playing picigin — keeping a small ball off the water, barefoot, in shin-deep sea — since 1908. They play it on New Year's Day too." },

  { id: "spl-riva", cityId: "split", name: "Cafés on the Riva", kind: "drink",
    tags: ["coast", "local"], neighborhood: "Riva", lat: 43.5076, lng: 16.4398,
    durationMin: 60, costUsd: 12, bestTime: "evening", touristy: 5,
    note: "Every terrace faces the same water and charges for the privilege, and the waiters know you are not coming back. Walk the length of it at seven, then drink two streets up in Varoš.", skip: true },

  { id: "spl-lunch", cityId: "split", name: "Lunch off the market", kind: "meal",
    tags: ["food", "market", "local"], neighborhood: "Grad", lat: 43.5079, lng: 16.4415,
    durationMin: 45, costUsd: 14, bestTime: "midday", touristy: 2,
    note: "Bread, cheese, prosciutto and a kilo of fruit from the stalls, eaten on the steps somewhere. The palace restaurants at one o'clock are a tax on not planning." },

  { id: "spl-dinner", cityId: "split", name: "Dinner in Varoš", kind: "meal",
    tags: ["food", "wine", "local"], neighborhood: "Varoš", lat: 43.5097, lng: 16.4338,
    durationMin: 105, costUsd: 38, opens: "18:00", closes: "23:00", bestTime: "evening", touristy: 2,
    note: "Konobas up the lanes doing pašticada and black risotto, with Dalmatian wine by the jug. Half the price of the same dish inside the walls and the rooms are better." },

  // ------------------------------------------------------- Klis and Salona --
  { id: "kli-fortress", cityId: "klis", name: "Klis Fortress", kind: "sight",
    tags: ["castle", "history", "viewpoint", "film"], neighborhood: "Klis", lat: 43.5600, lng: 16.5242,
    durationMin: 105, costUsd: 11, opens: "09:00", closes: "17:00", bestTime: "morning", touristy: 3,
    note: "Three rings of wall along a rock spine at 360m, holding the only pass between the coast and the interior. Petar Kružić held it against the Ottomans for twenty-five years before it fell in 1537. Yes, it was Meereen; no, that is not why to come." },

  { id: "kli-salona", cityId: "klis", name: "Salona", kind: "sight",
    tags: ["history", "nature", "walk"], neighborhood: "Solin", lat: 43.5394, lng: 16.4831,
    durationMin: 120, costUsd: 6, bestTime: "morning", touristy: 2,
    note: "The Roman provincial capital Split was built out of, abandoned in the seventh century and never rebuilt over. An amphitheatre for fifteen thousand, a forum, and the Manastirine cemetery where Domnius was buried after his execution in 304. Overgrown, unfenced, nearly empty." },

  // ----------------------------------------------------------------- Trogir --
  { id: "tro-oldtown", cityId: "trogir", name: "Trogir old town and the Radovan portal", kind: "walk",
    tags: ["walk", "history", "architecture", "church"], neighborhood: "Old town", lat: 43.5169, lng: 16.2514,
    durationMin: 120, costUsd: 0, bestTime: "morning", touristy: 4,
    note: "An island the size of a few city blocks, walled in the fifteenth century, with Romanesque through Baroque stacked on one street. Master Radovan's west portal of 1240 on the cathedral is the thing — Adam and Eve on two lions, and a calendar of the working year." },

  { id: "tro-kamerlengo", cityId: "trogir", name: "Kamerlengo Fortress", kind: "sight",
    tags: ["castle", "history", "viewpoint", "coast"], neighborhood: "Old town", lat: 43.5169, lng: 16.2514,
    durationMin: 45, costUsd: 6, bestTime: "afternoon", touristy: 3,
    note: "A fifteenth-century Venetian fort on the western tip, now largely a shell with a stage in the courtyard. You are paying for the walk round the parapet and the view back at the roofs, which is a fair trade at this price." },

  { id: "tro-lunch", cityId: "trogir", name: "Lunch in Trogir", kind: "meal",
    tags: ["food", "coast", "local"], neighborhood: "Old town", lat: 43.5169, lng: 16.2514,
    durationMin: 75, costUsd: 30, opens: "12:00", closes: "23:00", bestTime: "midday", touristy: 4,
    note: "The quayside places are priced for the coaches from Split. One lane inland is where the town eats, and the difference is about a third." },

  // -------------------------------------------------------------------- Krka --
  { id: "krk-skradinski", cityId: "krka", name: "Skradinski buk", kind: "outdoor",
    tags: ["nature", "walk", "viewpoint"], neighborhood: "Skradin", lat: 43.8052, lng: 15.9640,
    durationMin: 210, costUsd: 43, bestTime: "morning", touristy: 5,
    note: "Seventeen falls dropping 47m through a travertine system, on a boardwalk loop you share with everyone who came out of Split that morning. Entry is €40 in high summer and €7 in winter, which tells you what you are really paying for. First bus or don't bother." },

  // ------------------------------------------------------------------- Hvar --
  { id: "hva-fortica", cityId: "hvar", name: "Fortica", kind: "sight",
    tags: ["castle", "viewpoint", "history"], neighborhood: "Hvar town", lat: 43.1748, lng: 16.4418,
    durationMin: 90, costUsd: 4, bestTime: "morning", touristy: 4,
    note: "Twenty minutes up a gentle path to a Venetian fort rebuilt after the 1579 powder explosion, 100m above the roofs. Four euros for the best view in Dalmatia — the Pakleni islands laid out in front of the harbour." },

  { id: "hva-arsenal", cityId: "hvar", name: "The Arsenal and theatre", kind: "sight",
    tags: ["history", "architecture", "music"], neighborhood: "Hvar town", lat: 43.1721, lng: 16.4417,
    durationMin: 60, costUsd: 6, bestTime: "afternoon", touristy: 3,
    note: "A galley shed from 1292, rebuilt around 1600, with a public theatre put on its upper floor in 1612 — open to commoners, which was the unusual part. The grain store and the belvedere terrace are the same building." },

  { id: "hva-town", cityId: "hvar", name: "St Stephen's Square", kind: "walk",
    tags: ["walk", "history", "architecture", "local"], neighborhood: "Hvar town", lat: 43.1714, lng: 16.4433,
    durationMin: 75, costUsd: 0, bestTime: "morning", touristy: 4,
    note: "The largest square in Dalmatia at 4,500 square metres, which was a bay until they filled it in and paved it in 1780. The well in the middle is from 1520. It works best at eight in the morning, before the day boats." },

  { id: "hva-pakleni", cityId: "hvar", name: "Boat to Palmižana", kind: "experience",
    tags: ["boat", "coast", "beach", "nature"], neighborhood: "Sveti Klement", lat: 43.1625, lng: 16.3942,
    durationMin: 300, costUsd: 0, bestTime: "midday", touristy: 4,
    note: "Taxi boats run all day from the Hvar town quay to the Pakleni chain — sixteen low pine-covered limestone islands ten kilometres long. Palmižana has the marina and the botanical garden; the coves either side of it have nobody." },

  { id: "hva-starigrad", cityId: "hvar", name: "Stari Grad and Tvrdalj", kind: "sight",
    tags: ["history", "walk", "garden", "architecture"], neighborhood: "Stari Grad", lat: 43.1830, lng: 16.5830,
    durationMin: 120, costUsd: 0, bestTime: "morning", touristy: 3,
    note: "Greek Pharos, founded from Paros in 384 BC and one of the oldest continuously inhabited towns in Europe. Tvrdalj is the poet Petar Hektorović's sixteenth-century house built round a walled fish pond, with inscriptions cut into the walls for anyone who could read them." },

  { id: "hva-plain", cityId: "hvar", name: "Stari Grad Plain", kind: "outdoor",
    tags: ["history", "nature", "walk", "wine"], neighborhood: "Stari Grad", lat: 43.1817, lng: 16.6386,
    durationMin: 105, costUsd: 0, bestTime: "afternoon", touristy: 1,
    note: "Seventy-five Greek field parcels of about sixteen hectares each, marked out in 384 BC with dry stone walls, still farmed on the same lines with the same two crops. Twenty-four centuries of unbroken use, and it looks like a field, which is the point." },

  { id: "hva-vrboska", cityId: "hvar", name: "Vrboska", kind: "walk",
    tags: ["walk", "coast", "local", "church"], neighborhood: "Vrboska", lat: 43.1817, lng: 16.6712,
    durationMin: 75, costUsd: 0, bestTime: "afternoon", touristy: 2,
    note: "A deep inlet with stone bridges across it and a sixteenth-century church fortified against pirates — crenellations on a nave. Five hundred people live here and it is ten minutes from Jelsa." },

  { id: "hva-svetanedjelja", cityId: "hvar", name: "Wine at Sveta Nedjelja", kind: "experience",
    tags: ["wine", "coast", "viewpoint"], neighborhood: "Sveta Nedjelja", lat: 43.1389, lng: 16.5877,
    durationMin: 150, costUsd: 25, bestTime: "afternoon", touristy: 2,
    note: "Plavac mali grown on the south cliffs at gradients you would not walk up, reached through an unlit single-lane tunnel through the ridge. The tunnel is the part people remember and the wine is the reason to go." },

  { id: "hva-nightlife", cityId: "hvar", name: "The Hvar town club strip", kind: "drink",
    tags: ["nightlife"], neighborhood: "Hvar town", lat: 43.1714, lng: 16.4433,
    durationMin: 180, costUsd: 0, bestTime: "evening", touristy: 5,
    note: "Yacht-week prices, imported DJs, and a town council that has posted fines for wandering the old town shirtless. If that is the trip, go; if it is not, sleep in Stari Grad and come to Hvar town for the morning.", skip: true },

  { id: "hva-dinner", cityId: "hvar", name: "Dinner in Hvar town", kind: "meal",
    tags: ["food", "wine", "coast"], neighborhood: "Hvar town", lat: 43.1714, lng: 16.4433,
    durationMin: 105, costUsd: 52, opens: "18:00", closes: "23:30", bestTime: "evening", touristy: 4,
    note: "Gregada — fish stewed with potatoes and white wine — is the island dish and the only thing worth ordering off a menu written in four languages. Book; the town has more visitors than tables in July." },

  // ------------------------------------------------------------- Dubrovnik --
  { id: "dub-walls", cityId: "dubrovnik", name: "The city walls circuit", kind: "walk",
    tags: ["walk", "history", "viewpoint", "iconic", "earlystart"], neighborhood: "Old City", lat: 42.6400, lng: 18.1080,
    durationMin: 120, costUsd: 43, opens: "08:00", closes: "19:30", bestTime: "morning", touristy: 5,
    note: "Nearly two kilometres of thirteenth to seventeenth century wall, up to 25m high and 6m thick on the landward side, walked anticlockwise with no shade and no way off once you start. €40, which is real money. Worth it at eight in the morning, a mistake at eleven." },

  { id: "dub-stradun", cityId: "dubrovnik", name: "Stradun", kind: "walk",
    tags: ["walk", "history", "architecture"], neighborhood: "Old City", lat: 42.6414, lng: 18.1089,
    durationMin: 45, costUsd: 0, bestTime: "evening", touristy: 5,
    note: "Three hundred metres of limestone polished to a shine, Pile Gate to Ploče, rebuilt to one standard pattern after the 1667 earthquake — which is why every house on it has the same door. Empty at seven in the morning and at eleven at night." },

  { id: "dub-franciscan", cityId: "dubrovnik", name: "Franciscan friary and old pharmacy", kind: "sight",
    tags: ["history", "church", "architecture", "museum"], neighborhood: "Old City", lat: 42.6417, lng: 18.1077,
    durationMin: 60, costUsd: 11, opens: "09:00", closes: "18:00", bestTime: "morning", touristy: 4,
    note: "The lower cloister has 120 columns and no two capitals alike. The pharmacy has been dispensing since 1317, which makes it the oldest still working in Europe, and the seventeenth-century ledgers are in the museum case." },

  { id: "dub-rector", cityId: "dubrovnik", name: "Rector's Palace", kind: "museum",
    tags: ["museum", "history", "architecture"], neighborhood: "Old City", lat: 42.6402, lng: 18.1103,
    durationMin: 90, costUsd: 16, opens: "09:00", closes: "18:00", bestTime: "afternoon", touristy: 4,
    note: "The rector served one month and could not leave the building during it, which tells you most of what the Republic of Ragusa thought about power. Gothic and Renaissance work by Onofrio della Cava after the 1435 fire, and a cultural history museum inside since 1872." },

  { id: "dub-cathedral", cityId: "dubrovnik", name: "Cathedral treasury", kind: "sight",
    tags: ["church", "history", "art"], neighborhood: "Old City", lat: 42.6399, lng: 18.1104,
    durationMin: 45, costUsd: 6, bestTime: "afternoon", touristy: 4,
    note: "182 reliquaries from the eleventh to eighteenth centuries, including the gilded skull of St Blaise made as a Byzantine crown. A Titian over the altar. The church itself is a plain 1713 rebuild and takes ten minutes." },

  { id: "dub-warphoto", cityId: "dubrovnik", name: "War Photo Limited", kind: "museum",
    tags: ["museum", "art", "history", "contemporary"], neighborhood: "Old City", lat: 42.6417, lng: 18.1087,
    durationMin: 75, costUsd: 11, opens: "10:00", closes: "22:00", bestTime: "afternoon", touristy: 3,
    note: "Shut from November to March. Two floors of conflict photography, with the permanent upper floor on the wars that broke Yugoslavia. It is not a pleasant hour and it is the only thing in the old town that acknowledges 1991 happened here." },

  { id: "dub-cablecar", cityId: "dubrovnik", name: "Srđ cable car and Fort Imperial", kind: "experience",
    tags: ["viewpoint", "history", "museum"], neighborhood: "Ploče", lat: 42.6432, lng: 18.1119,
    durationMin: 120, costUsd: 32, opens: "09:00", closes: "24:00", bestTime: "evening", touristy: 5,
    note: "Shut in January and February, and in wind. Four minutes up to 405m, with the Napoleonic fort at the top holding the Homeland War museum — the siege was directed from and against this hill. Go an hour before sunset and walk down if your knees allow." },

  { id: "dub-lokrum", cityId: "dubrovnik", name: "Lokrum", kind: "outdoor",
    tags: ["nature", "coast", "garden", "boat"], neighborhood: "Lokrum", lat: 42.6276, lng: 18.1200,
    durationMin: 240, costUsd: 32, opens: "08:00", closes: "18:00", bestTime: "midday", touristy: 4,
    note: "Six hundred metres offshore, fifteen minutes by boat, with a Benedictine monastery, peacocks that Maximilian let loose, and a botanical garden gone half wild. Nobody is allowed to stay the night; the last boat back is firm." },

  { id: "dub-lovrijenac", cityId: "dubrovnik", name: "Fort Lovrijenac", kind: "sight",
    tags: ["castle", "history", "viewpoint", "film"], neighborhood: "Pile", lat: 42.6408, lng: 18.1043,
    durationMin: 60, costUsd: 6, bestTime: "morning", touristy: 4,
    note: "On its own rock 37m above the sea outside the western wall, with the inscription over the gate refusing to sell freedom for all the gold in the world. It looks back at the walls rather than down from them, which is the angle everyone else misses." },

  { id: "dub-dinner", cityId: "dubrovnik", name: "Dinner in the old town", kind: "meal",
    tags: ["food", "wine", "local"], neighborhood: "Old City", lat: 42.6414, lng: 18.1089,
    durationMin: 105, costUsd: 58, opens: "18:00", closes: "23:00", bestTime: "evening", touristy: 4,
    note: "Prices inside the walls are the highest in Croatia and the cooking mostly is not. Eat on the Prijeko side lanes rather than on Stradun, or take the bus out to Lapad and eat for half." },

  // ----------------------------------------------------------------- Cavtat --
  { id: "cav-town", cityId: "cavtat", name: "Cavtat waterfront and the Račić mausoleum", kind: "walk",
    tags: ["walk", "coast", "art", "local"], neighborhood: "Cavtat", lat: 42.5814, lng: 18.2177,
    durationMin: 180, costUsd: 0, bestTime: "morning", touristy: 3,
    note: "Roman Epidaurum, which is where Dubrovnik's founders ran from. A boat from the old port takes forty-five minutes across the bay. Meštrović's domed mausoleum in the cemetery above the town is the reason to make the trip rather than the promenade." },
];
