import type { Place } from "@/lib/types";

// Korea is the opposite stress test to Iceland: everything is close, transit is
// excellent, and the risk is over-scheduling rather than under-filling.

export const KOREA_PLACES: Place[] = [
  // ----------------------------------------------------------------- Seoul --
  { id: "seo-fritz", cityId: "seoul", name: "Coffee at Fritz", kind: "meal",
    tags: ["coffee", "local"], neighborhood: "Mapo", lat: 37.5460, lng: 126.9520,
    durationMin: 40, costUsd: 7, opens: "08:00", closes: "22:00", bestTime: "morning", touristy: 2,
    note: "Seoul takes coffee more seriously than almost anywhere. This is the roaster the other cafés buy from, in an old house with a seal on the sign." },

  { id: "seo-bukchon", cityId: "seoul", name: "Bukchon Hanok Village", kind: "walk",
    tags: ["walk", "history", "architecture"], neighborhood: "Bukchon", lat: 37.5826, lng: 126.9830,
    durationMin: 75, costUsd: 0, bestTime: "morning", touristy: 4,
    note: "People live here, and signs ask you to keep your voice down — that request is real, not decorative. Go before ten and use the upper lanes." },

  { id: "seo-changdeok", cityId: "seoul", name: "Changdeokgung and the Secret Garden", kind: "sight",
    tags: ["history", "garden", "architecture"], neighborhood: "Jongno", lat: 37.5794, lng: 126.9910,
    durationMin: 135, costUsd: 12, opens: "09:00", closes: "17:30", closedDays: [1], bestTime: "morning", touristy: 4,
    note: "The garden is timed-entry and guided, and it's the reason to come — book the slot ahead. Better than Gyeongbokgung next door, which gets the crowds because it's bigger." },

  { id: "seo-gyeongbok", cityId: "seoul", name: "Gyeongbokgung Palace", kind: "sight",
    tags: ["history", "iconic", "architecture"], neighborhood: "Jongno", lat: 37.5796, lng: 126.9770,
    durationMin: 90, costUsd: 3, opens: "09:00", closes: "18:00", closedDays: [2], bestTime: "morning", touristy: 5,
    note: "Mostly reconstruction, and you'll have already seen the better palace. If you only do one, do Changdeokgung.", skip: true },

  { id: "seo-naksan", cityId: "seoul", name: "Naksan Park wall walk", kind: "walk",
    tags: ["walk", "viewpoint", "history", "local"], neighborhood: "Ihwa-dong", lat: 37.5800, lng: 127.0070,
    durationMin: 90, costUsd: 0, bestTime: "evening", touristy: 2,
    note: "Follow the old fortress wall uphill through a residential neighborhood. Do it at dusk, when the city comes on underneath you." },

  { id: "seo-gwangjang", cityId: "seoul", name: "Gwangjang Market", kind: "market",
    tags: ["market", "food", "local"], neighborhood: "Jongno", lat: 37.5701, lng: 127.0000,
    durationMin: 75, costUsd: 14, opens: "09:00", closes: "22:00", closedDays: [0], bestTime: "midday", touristy: 4,
    note: "Sit at a stool, point at the mung bean pancake, drink the makgeolli they put in front of you. The famous aisle is the worst one — go one row over." },

  { id: "seo-tongin", cityId: "seoul", name: "Tongin Market", kind: "market",
    tags: ["market", "food", "local"], neighborhood: "Seochon", lat: 37.5810, lng: 126.9700,
    durationMin: 60, costUsd: 10, opens: "11:00", closes: "17:00", closedDays: [0], bestTime: "midday", touristy: 2,
    note: "Buy brass coins at the desk and spend them stall to stall for a tray of whatever you like. A gimmick that happens to work." },

  { id: "seo-leeum", cityId: "seoul", name: "Leeum Museum", kind: "museum",
    tags: ["museum", "art", "architecture", "contemporary"], neighborhood: "Hannam", lat: 37.5384, lng: 126.9990,
    durationMin: 120, costUsd: 14, opens: "10:00", closes: "18:00", closedDays: [1], bestTime: "afternoon", touristy: 3,
    note: "Three buildings by three architects — Nouvel, Koolhaas, Mario Botta — holding Korean antiquities and contemporary work. The building argument is as good as the art." },

  { id: "seo-nationalmuseum", cityId: "seoul", name: "National Museum of Korea", kind: "museum",
    tags: ["museum", "history", "art"], neighborhood: "Yongsan", lat: 37.5240, lng: 126.9800,
    durationMin: 150, costUsd: 0, opens: "10:00", closes: "18:00", bestTime: "morning", touristy: 3,
    note: "Free, enormous, and best treated as three rooms rather than forty. The gold crowns and the pensive bodhisattva, then leave." },

  { id: "seo-ikseon", cityId: "seoul", name: "Ikseon-dong alleys", kind: "walk",
    tags: ["walk", "local", "coffee", "shopping", "food"], neighborhood: "Ikseon-dong", lat: 37.5740, lng: 126.9900,
    durationMin: 90, costUsd: 0, bestTime: "afternoon", touristy: 3,
    note: "A grid of 1920s courtyard houses turned into narrow bars and cafés. Small enough to cover properly in an hour, which is rare in this city." },

  { id: "seo-seongsu", cityId: "seoul", name: "Seongsu-dong", kind: "walk",
    tags: ["walk", "contemporary", "coffee", "shopping", "local"], neighborhood: "Seongsu", lat: 37.5445, lng: 127.0560,
    durationMin: 120, costUsd: 0, bestTime: "afternoon", touristy: 2,
    note: "Shoe factories and car repair shops with concept stores and roasters wedged between them, mostly unconverted. The most interesting hour of walking in Seoul right now." },

  { id: "seo-jjimjilbang", cityId: "seoul", name: "Jjimjilbang", kind: "experience",
    tags: ["spa", "local"], neighborhood: "Jung-gu", lat: 37.5600, lng: 126.9950,
    durationMin: 150, costUsd: 12, opens: "06:00", closes: "23:00", bestTime: "evening", touristy: 2,
    note: "Bathhouse, then the shared floor in cotton shorts where people nap and eat boiled eggs. Segregated bathing, communal everything else. Nobody is looking at you." },

  { id: "seo-bukhansan", cityId: "seoul", name: "Bukhansan ridge hike", kind: "outdoor",
    tags: ["hike", "nature", "viewpoint"], neighborhood: "Bukhansan", lat: 37.6590, lng: 126.9770,
    durationMin: 240, costUsd: 4, opens: "07:00", closes: "16:00", bestTime: "morning", touristy: 2,
    note: "A granite national park inside the city limits, reachable by subway. Steep, busy with Koreans in serious gear, and the reason this city feels different from Tokyo." },

  { id: "seo-hangang", cityId: "seoul", name: "Han River park in the evening", kind: "walk",
    tags: ["walk", "nature", "local", "coast"], neighborhood: "Ttukseom", lat: 37.5300, lng: 127.0660,
    durationMin: 90, costUsd: 8, bestTime: "evening", touristy: 1,
    note: "Order fried chicken to a picnic mat by the water — the delivery apps genuinely find you. This is what Seoul does with a warm evening." },

  { id: "seo-cheonggyecheon", cityId: "seoul", name: "Cheonggyecheon stream", kind: "walk",
    tags: ["walk", "local", "architecture"], neighborhood: "Jongno", lat: 37.5690, lng: 126.9780,
    durationMin: 50, costUsd: 0, bestTime: "afternoon", touristy: 3,
    note: "A buried stream dug back out from under an elevated highway in 2005. Walk a stretch of it as a shortcut rather than a destination." },

  { id: "seo-naengmyeon", cityId: "seoul", name: "Naengmyeon lunch", kind: "meal",
    tags: ["food", "local"], neighborhood: "Jung-gu", lat: 37.5650, lng: 126.9850,
    durationMin: 60, costUsd: 12, opens: "11:00", closes: "21:00", bestTime: "midday", touristy: 2,
    note: "Cold buckwheat noodles in chilled beef broth, cut with scissors at the table. Underwhelming for two bites and then not." },

  { id: "seo-bbq", cityId: "seoul", name: "Korean barbecue dinner", kind: "meal",
    tags: ["food", "local"], neighborhood: "Mapo", lat: 37.5480, lng: 126.9400,
    durationMin: 105, costUsd: 34, opens: "17:00", closes: "23:00", bestTime: "evening", touristy: 3,
    note: "Pork belly, not beef — that's the everyday version and the better one. The staff will cut and turn it for you; let them." },

  { id: "seo-euljiro", cityId: "seoul", name: "Euljiro drinking alleys", kind: "drink",
    tags: ["nightlife", "local", "food"], neighborhood: "Euljiro", lat: 37.5660, lng: 126.9910,
    durationMin: 105, costUsd: 24, opens: "18:00", closes: "01:00", bestTime: "evening", touristy: 2,
    note: "Print shops and hardware suppliers by day; plastic stools on the street by night. No signage in English, and none needed — point and sit." },

  { id: "seo-makgeolli", cityId: "seoul", name: "Makgeolli bar", kind: "drink",
    tags: ["wine", "local", "food"], neighborhood: "Seochon", lat: 37.5790, lng: 126.9690,
    durationMin: 75, costUsd: 20, opens: "17:00", closes: "24:00", closedDays: [0], bestTime: "evening", touristy: 2,
    note: "Unfiltered rice wine, served cold in a brass kettle. The good ones taste of yoghurt and nothing like the supermarket version." },

  { id: "seo-hongdae", cityId: "seoul", name: "Live music in Hongdae", kind: "experience",
    tags: ["music", "nightlife", "local"], neighborhood: "Hongdae", lat: 37.5560, lng: 126.9240,
    durationMin: 105, costUsd: 18, opens: "19:00", closes: "02:00", bestTime: "evening", touristy: 3,
    note: "Basement venues around the university, indie rather than K-pop. Cover is small and the bands change every forty minutes." },

  { id: "seo-namsan", cityId: "seoul", name: "N Seoul Tower", kind: "sight",
    tags: ["viewpoint", "iconic"], neighborhood: "Namsan", lat: 37.5512, lng: 126.9882,
    durationMin: 120, costUsd: 18, opens: "10:00", closes: "23:00", bestTime: "evening", touristy: 5,
    note: "A queue for a lift for a view, plus a fence full of padlocks. The wall walk at Naksan gives you the same city for free and better light.", skip: true },

  { id: "seo-myeongdong", cityId: "seoul", name: "Myeongdong", kind: "walk",
    tags: ["shopping", "iconic"], neighborhood: "Myeongdong", lat: 37.5636, lng: 126.9820,
    durationMin: 90, costUsd: 0, bestTime: "afternoon", touristy: 5,
    note: "Skincare chains and street food priced for visitors, shoulder to shoulder. Whatever you want here is cheaper two subway stops away.", skip: true },

  // ----------------------------------------------------------------- Busan --
  { id: "bsn-jagalchi", cityId: "busan", name: "Jagalchi fish market", kind: "market",
    tags: ["market", "food", "coast", "local"], neighborhood: "Nampo", lat: 35.0966, lng: 129.0306,
    durationMin: 90, costUsd: 26, opens: "05:00", closes: "22:00", bestTime: "midday", touristy: 3,
    note: "Pick something from a tank downstairs, they cook it upstairs. Run almost entirely by women, and has been for seventy years." },

  { id: "bsn-gamcheon", cityId: "busan", name: "Gamcheon Culture Village", kind: "walk",
    tags: ["walk", "art", "viewpoint", "local"], neighborhood: "Gamcheon", lat: 35.0975, lng: 129.0106,
    durationMin: 105, costUsd: 0, bestTime: "morning", touristy: 4,
    note: "A refugee settlement on a hillside, painted and turned into an art village. Go early, and walk down the back lanes where people still just live." },

  { id: "bsn-igidae", cityId: "busan", name: "Igidae coastal path", kind: "outdoor",
    tags: ["hike", "coast", "nature", "viewpoint"], neighborhood: "Igidae", lat: 35.1300, lng: 129.1180,
    durationMin: 120, costUsd: 0, bestTime: "morning", touristy: 2,
    note: "Cliff path on boardwalk and rock, facing back at the skyline across the water. Ninety minutes, and almost nobody who isn't local." },

  { id: "bsn-gwangalli", cityId: "busan", name: "Gwangalli beach at night", kind: "outdoor",
    tags: ["beach", "coast", "nightlife"], neighborhood: "Gwangalli", lat: 35.1530, lng: 129.1180,
    durationMin: 90, costUsd: 0, bestTime: "evening", touristy: 3,
    note: "The bridge lights up and the drone show runs some Saturdays. Better than Haeundae, which is the one everyone is told to go to." },

  { id: "bsn-beomeosa", cityId: "busan", name: "Beomeosa Temple", kind: "sight",
    tags: ["church", "history", "nature", "architecture"], neighborhood: "Geumjeong", lat: 35.2850, lng: 129.0690,
    durationMin: 90, costUsd: 0, opens: "08:00", closes: "17:30", bestTime: "morning", touristy: 3,
    note: "A working mountain temple at the end of a subway line, above the smog. Go on a weekday and you'll hear the chanting rather than the tour groups." },

  { id: "bsn-seomyeon", cityId: "busan", name: "Seomyeon night food streets", kind: "meal",
    tags: ["food", "nightlife", "local"], neighborhood: "Seomyeon", lat: 35.1580, lng: 129.0590,
    durationMin: 105, costUsd: 26, opens: "18:00", closes: "02:00", bestTime: "evening", touristy: 2,
    note: "Where Busan actually eats after work. Pork soup rice is the local dish and the 24-hour places do it best." },

  { id: "bsn-spa", cityId: "busan", name: "Spa Land", kind: "experience",
    tags: ["spa", "local"], neighborhood: "Centum City", lat: 35.1690, lng: 129.1300,
    durationMin: 150, costUsd: 16, opens: "06:00", closes: "22:00", bestTime: "afternoon", touristy: 3,
    note: "Twenty-two baths fed by real hot springs, inside a shopping centre, which stops being strange after ten minutes." },

  { id: "bsn-coffee", cityId: "busan", name: "Coffee in Jeonpo", kind: "meal",
    tags: ["coffee", "local", "walk"], neighborhood: "Jeonpo", lat: 35.1520, lng: 129.0640,
    durationMin: 45, costUsd: 6, opens: "09:00", closes: "22:00", bestTime: "morning", touristy: 2,
    note: "A street of former tool workshops now full of roasters. The name means Tool Street and half the signage never changed." },

  // ---------------------------------------------------------------- Jeonju --
  { id: "jeo-hanok", cityId: "jeonju", name: "Jeonju Hanok Village", kind: "walk",
    tags: ["walk", "history", "architecture", "local"], neighborhood: "Jeonju", lat: 35.8150, lng: 127.1530,
    durationMin: 120, costUsd: 0, bestTime: "morning", touristy: 4,
    note: "Eight hundred traditional houses in one district, which is more than anywhere else in the country. Busy at the entrance and quiet four streets in." },

  { id: "jeo-bibimbap", cityId: "jeonju", name: "Bibimbap at Gajok Hoegwan", kind: "meal",
    tags: ["food", "local"], neighborhood: "Jeonju", lat: 35.8180, lng: 127.1450,
    durationMin: 75, costUsd: 14, opens: "11:00", closes: "21:00", bestTime: "midday", touristy: 3,
    note: "This is the city bibimbap comes from, and the version here is served in a brass bowl with raw beef and a dozen side dishes. Worth the train on its own." },

  { id: "jeo-makgeolli", cityId: "jeonju", name: "Makgeolli alley", kind: "drink",
    tags: ["wine", "local", "food"], neighborhood: "Samcheon-dong", lat: 35.8080, lng: 127.1290,
    durationMin: 90, costUsd: 22, opens: "17:00", closes: "24:00", bestTime: "evening", touristy: 2,
    note: "Order a kettle and the food arrives free, more of it with each kettle. An arrangement that has ended many evenings earlier than planned." },

  // -------------------------------------------------------------- Gyeongju --
  { id: "gye-bulguksa", cityId: "gyeongju", name: "Bulguksa Temple", kind: "sight",
    tags: ["church", "history", "architecture", "iconic"], neighborhood: "Gyeongju", lat: 35.7900, lng: 129.3320,
    durationMin: 105, costUsd: 5, opens: "08:00", closes: "17:00", bestTime: "morning", touristy: 4,
    note: "Eighth century, stone terraces and two pagodas that survived everything since. Go up to Seokguram after if the shuttle is running." },

  { id: "gye-daereungwon", cityId: "gyeongju", name: "Daereungwon tombs", kind: "walk",
    tags: ["history", "walk", "garden"], neighborhood: "Gyeongju", lat: 35.8390, lng: 129.2120,
    durationMin: 75, costUsd: 3, opens: "09:00", closes: "22:00", bestTime: "afternoon", touristy: 3,
    note: "Twenty-three grass burial mounds the size of small hills, in the middle of town. One is cut open so you can walk inside it." },

  { id: "gye-donggung", cityId: "gyeongju", name: "Donggung Palace and Wolji Pond", kind: "sight",
    tags: ["history", "viewpoint", "architecture"], neighborhood: "Gyeongju", lat: 35.8350, lng: 129.2260,
    durationMin: 60, costUsd: 3, opens: "09:00", closes: "22:00", bestTime: "evening", touristy: 4,
    note: "Go after dark. The reconstructed halls are lit and reflected in the pond, and it is the one place here that is better at night than in daylight." },
];
