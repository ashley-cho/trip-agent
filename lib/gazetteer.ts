/**
 * Names of places on earth, so that a word is a place because it IS one.
 *
 * The place detector in lib/discovery.ts reads position: "go to X", "climb
 * the X", "X or Y". Position is evidence that X is somewhere, and it is not
 * proof, and three word lists grew up to catch the misses: NOT_A_PLACE,
 * COMMON_WORD, NOT_A_PLACE_PHRASE. Each entry is a note about the last
 * failure. "the seafood" was filed as a country to research; so were "coral
 * reefs", "every morning", and "desert, stars, silence".
 *
 * This is the other half of the evidence: a candidate that no cue vouches
 * for strongly has to be a name somebody could look up. Countries, their
 * capitals and big cities, the regions, islands, ranges and parks people
 * name when they say where they want to go. Folded to lowercase ASCII.
 *
 * Deliberately generous and deliberately incomplete: a real place missing
 * here costs a "go to" cue to be read (that cue still wins on its own), while
 * an English word present here would file a sentence as a country. So no
 * entry may also be an ordinary English word ("turkey" and "chile" are in
 * because the catalogue and the cue rules already handle them; "nice" is
 * not, and "reading" is not).
 */
import { key as fold } from "@/lib/text";

const NAMES: string[] = [
  "abel tasman", "abu dhabi", "acadia", "accra", "addis ababa", "adelaide", "adirondacks",
  "adriatic", "aegean", "afghanistan", "africa", "agra", "alaska", "albania", "alentejo",
  "algarve", "algeria", "alps", "alsace", "amalfi", "amalfi coast", "amazonia",
  "america", "amman", "amsterdam", "anatolia", "anchorage", "andalucia", "andalusia",
  "andaman", "andaman islands", "andes", "andorra", "angola", "annapurna", "antarctica",
  "antigua", "apennines", "appalachian trail", "appalachians", "apulia", "arctic",
  "arequipa", "argentina", "arizona", "armenia", "aruba", "asia", "aspen", "aswan", "atacama",
  "athens", "atlantic canada", "atlas mountains", "auckland", "australia",
  "austria", "azerbaijan", "azores", "bahamas", "bahia", "bahrain", "baja", "baja california",
  "baku", "balearics", "bali", "balkans", "baltics", "banff", "bangkok", "bangladesh",
  "barbados", "barcelona", "bariloche", "basque country", "bavaria", "bay of kotor", "beijing",
  "beirut", "belarus", "belgium", "belgrade", "belize", "benin", "bergen", "berlin", "bhutan",
  "big bend", "big island", "big sur", "black forest", "blue ridge", "bogota",
  "bolivia", "bonaire", "bora bora", "bordeaux", "borneo", "bosnia", "boston", "botswana",
  "brazil", "bretagne", "brisbane", "britain", "british columbia", "brittany", "bruges",
  "brunei", "brussels", "bryce", "bryce canyon", "bucharest", "budapest", "buenos aires",
  "bukhara", "bulgaria", "burgundy", "burma", "burundi", "busan", "bwindi", "byron bay",
  "cairns", "cairo", "calgary", "california", "cambodia", "cameroon", "canada",
  "canadian rockies", "canaries", "canary islands", "canyonlands", "cape breton", "cape cod",
  "cape town", "cape verde", "capitol reef", "cappadocia", "caribbean", "carpathians",
  "carretera austral", "cartagena", "casablanca", "catalonia", "catalunya", "catskills",
  "caucasus", "cayman islands", "cebu", "central america", "charleston",
  "chefchaouen", "chengdu", "chiang mai", "chiang rai", "chiapas", "chicago", "chile",
  "chiloe", "china", "chobe", "christchurch", "cinque terre", "cochin", "colca canyon",
  "colombia", "colombo", "colorado", "comoros", "congo", "connemara", "cook islands",
  "copenhagen", "copper canyon", "corfu", "cornwall", "corsica", "costa brava",
  "costa del sol", "costa rica", "cote d azur", "cotswolds", "crete", "croatia", "cuba",
  "cuenca", "culebra", "curacao", "cusco", "cuzco", "cyclades", "cyprus", "czech republic",
  "czechia", "dakar", "dalmatia", "damaraland", "danakil", "dar es salaam", "darjeeling",
  "dead sea", "death valley", "delhi", "denali", "denmark", "denver", "devon",
  "dingle", "djibouti", "dodecanese", "doha", "dolomites", "dolomiti", "dominica",
  "dominican republic", "donegal", "dordogne", "douro", "drakensberg", "dubai", "dublin",
  "dubrovnik", "durban", "easter island", "ecuador", "edinburgh", "egypt", "el nido",
  "el salvador", "england", "eritrea", "essaouira", "estonia", "eswatini", "ethiopia",
  "etosha", "europe", "everest", "everest base camp", "everglades", "faroe islands", "faroes",
  "fernando de noronha", "fes", "fez", "fiji", "finland", "fiordland", "florence",
  "flores", "florianopolis", "florida keys", "france", "french polynesia", "french riviera",
  "fukuoka", "gabon", "galapagos", "galicia", "galle", "gambia", "garden route", "georgia",
  "germany", "ghana", "glacier national park", "glasgow", "goa", "gobi",
  "golden circle", "granada", "grand canyon", "grand teton", "great barrier reef",
  "great britain", "great ocean road", "greece", "greenland", "grenada", "guadalajara",
  "guadeloupe", "guatemala", "guilin", "guinea", "guyana", "gyeongju", "ha long bay", "haiti",
  "halifax", "halong bay", "hamburg", "hanoi", "havana", "hawaii", "hebrides", "helsinki",
  "highlands", "hill country", "himachal", "himachal pradesh", "himalaya", "himalayas",
  "hiroshima", "ho chi minh city", "hobart", "hoi an", "hokkaido", "holland", "honduras",
  "hong kong", "honolulu", "honshu", "hudson valley", "hungary", "iberia", "ibiza",
  "iceland", "iguazu", "india", "indonesia", "ionian", "iran", "iraq", "ireland", "isaan",
  "isle of skye", "israel", "istanbul", "istria", "italy", "ivory coast", "jackson hole",
  "jaipur", "jakarta", "jamaica", "japan", "japanese alps", "jeju",
  "jerusalem", "jodhpur", "johannesburg", "jordan", "joshua tree", "kalahari", "kampala",
  "kanazawa", "kandy", "kansai", "kanto", "kashmir", "kathmandu", "kauai", "kazakhstan",
  "kazbegi", "kenya", "kerala", "khiva", "kigali", "kilimanjaro", "kimberley", "kiribati",
  "kochi", "koh phangan", "koh samui", "koh tao", "komodo", "korea", "kosovo", "kotor",
  "krabi", "krakow", "kruger", "kuala lumpur", "kuwait", "kyoto", "kyrgyzstan", "kyushu",
  "la paz", "ladakh", "lagos", "lake como", "lake district", "lake garda", "lake tahoe",
  "lalibela", "langtang", "lanzarote", "laos", "lapland", "las vegas", "latin america",
  "latvia", "lebanon", "lesotho", "liberia", "libya", "liechtenstein", "liguria", "lima",
  "lisbon", "lithuania", "ljubljana", "lofoten", "loire", "loire valley", "lombok", "london",
  "los angeles", "louisiana", "lowcountry", "luang prabang", "luxembourg", "luxor",
  "lycian coast", "maasai mara", "macau", "machu picchu", "madagascar", "madeira", "madrid",
  "maine", "majorca", "malawi", "malaysia", "maldives", "mali", "mallorca", "malta", "manila",
  "marrakech", "marrakesh", "marthas vineyard", "martinique", "masai mara", "maui",
  "mauritania", "mauritius", "medellin", "mediterranean", "mekong", "mekong delta",
  "melbourne", "memphis", "mendoza", "menorca", "merida", "merzouga", "mexico", "mexico city",
  "miami", "micronesia", "middle east", "milan", "milford sound", "moab", "moldova", "monaco",
  "mongolia", "montana", "montenegro", "montreal", "monument valley", "moorea", "morocco",
  "mosel", "moselle", "mount rainier", "mozambique", "mumbai", "munich", "musandam", "muscat",
  "myanmar", "mykonos", "nagano", "nairobi", "namib", "namibia", "nang",
  "nantucket", "napa", "naples", "nara", "nashville", "naxos", "nepal", "netherlands",
  "new caledonia", "new delhi", "new hampshire", "new mexico", "new orleans", "new york",
  "new zealand", "newfoundland", "ngorongoro", "nicaragua", "niger", "nigeria", "nile",
  "ninh binh", "nordics", "normandy", "north america", "north island", "north korea",
  "north macedonia", "norway", "norwegian fjords", "nova scotia", "nyc", "oahu", "oaxaca",
  "oceania", "okavango", "okavango delta", "okinawa", "oman", "olympic national park",
  "olympic peninsula", "oregon", "orkney", "osaka", "oslo", "ottawa", "outback",
  "outer banks", "pacific northwest", "pakistan", "palau", "palawan", "palestine", "panama",
  "pantanal", "papua new guinea", "paraguay", "paris", "paros", "patagonia", "peak district",
  "peloponnese", "pembrokeshire", "penang", "perth", "peru", "petra", "philadelphia",
  "philippines", "phong nha", "phuket", "piedmont", "piemonte", "pokhara", "poland",
  "portland", "porto", "portugal", "prague", "prince edward island", "provence", "puerto rico",
  "puerto vallarta", "puglia", "pyrenees", "qatar", "quebec", "queenstown", "quito",
  "raja ampat", "rajasthan", "red sea", "reunion", "reykjavik", "rhine", "rhodes", "riga",
  "ring of kerry", "ring road", "rio", "rio de janeiro", "riviera", "riviera maya", "rockies",
  "rocky mountain national park", "rocky mountains", "romania", "rome", "russia", "rwanda",
  "sabah", "sacred valley", "sahara", "saigon", "salalah", "salar de uyuni", "salvador",
  "salzkammergut", "samarkand", "samoa", "san diego", "san francisco", "san juan",
  "san juan islands", "san marino", "san miguel de allende", "santa fe", "santorini", "sapa",
  "sapporo", "sarajevo", "sarawak", "sardinia", "saudi arabia", "savannah", "saxony",
  "scandinavia", "scotland", "scottish highlands", "seattle", "sedona", "senegal", "seoul",
  "sequoia", "serbia", "serengeti", "sevilla", "seville", "seychelles", "shanghai",
  "shenandoah", "shetland", "shikoku", "siargao", "sichuan", "sicily", "sierra leone",
  "sierra nevada", "sikkim", "silk road", "simien mountains", "sinai", "singapore",
  "skeleton coast", "skye", "slovakia", "slovenia", "smokies", "smoky mountains", "snowdonia",
  "sofia", "solomon islands", "somalia", "sonoma", "sossusvlei", "south africa",
  "south america", "south island", "south korea", "south sudan", "spain", "split", "sri lanka",
  "st lucia", "stellenbosch", "stockholm", "sudan", "sulawesi", "sumatra", "suriname",
  "svalbard", "svaneti", "sweden", "switzerland", "sydney", "syria", "tahiti", "tahoe",
  "tainan", "taipei", "taiwan", "tajikistan", "takayama", "tallinn", "tanzania", "taos",
  "tasmania", "tayrona", "tbilisi", "tel aviv", "telluride", "tenerife", "tetons",
  "texas hill country", "thailand", "tibet", "timor", "tirol", "tofino", "togo", "tohoku",
  "tokyo", "tonga", "toronto", "torres del paine", "trinidad", "tulum", "tunis", "tunisia",
  "turkey", "turkiye", "turkmenistan", "turks and caicos", "turquoise coast", "tuscany",
  "tuvalu", "tyrol", "uae", "ubud", "udaipur", "uganda", "ukraine", "uluru", "umbria",
  "united arab emirates", "united kingdom", "united states", "urals", "uruguay", "usa",
  "ushuaia", "utah", "uttarakhand", "uyuni", "uzbekistan", "vancouver", "vancouver island",
  "vanuatu", "varanasi", "vatican", "vegas", "veneto", "venezuela", "venice", "vermont",
  "vienna", "vieques", "vietnam", "vilnius", "virgin islands", "wadi rum", "wales", "warsaw",
  "washington", "washington dc", "wellington", "westfjords", "whistler", "white mountains",
  "whitsundays", "wild atlantic way", "winelands", "wyoming", "xian", "xinjiang", "yangshuo",
  "yellowstone", "yemen", "yerevan", "yogyakarta", "yorkshire", "yorkshire dales", "yosemite",
  "yucatan", "yukon", "yunnan", "zagreb", "zambia", "zanzibar", "zhangjiajie", "zimbabwe",
  "zion",
];

export const GAZETTEER: Set<string> = new Set(NAMES.map(fold));
/**
 * Could this phrase be somewhere on earth?
 *
 * True when the whole phrase is a known name, or when any word of it long
 * enough to mean something is one: "northern spain", "rural japan", "the
 * yosemite valley". Short words are skipped because "la" is Los Angeles and
 * also French.
 */
export function inGazetteer(phrase: string): boolean {
  const whole = fold(phrase.replace(/^the\s+/i, ""));
  if (!whole) return false;
  if (GAZETTEER.has(whole)) return true;
  const words = whole.split(/\s+/).filter((w) => w.length >= 4);
  if (words.some((w) => GAZETTEER.has(w))) return true;
  // Two-word names inside a longer phrase: "the costa rica trip".
  for (let i = 0; i + 1 < words.length; i++) if (GAZETTEER.has(`${words[i]} ${words[i + 1]}`)) return true;
  return false;
}
