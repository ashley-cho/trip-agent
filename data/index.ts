import type { Place } from "@/lib/types";
import { PORTUGAL_PLACES } from "./places-portugal";
import { OTHER_PLACES } from "./places-other";
import { ICELAND_PLACES } from "./places-iceland";
import { KOREA_PLACES } from "./places-korea";
import { SOUTHWEST_PLACES } from "./places-southwest";
import { WESTCOAST_PLACES } from "./places-westcoast";
import { MEXICO_SPAIN_PLACES } from "./places-mexico-spain";
import { JPN_DK_CAT_PLACES } from "./places-jpn-dk-cat";
import { NZ_PLACES } from "./places-nz";
import { ITALY_BALI_FRANCE_PLACES } from "./places-italy-bali-france";

export const PLACES: Place[] = [
  ...PORTUGAL_PLACES, ...OTHER_PLACES, ...ICELAND_PLACES, ...KOREA_PLACES,
  ...SOUTHWEST_PLACES, ...WESTCOAST_PLACES,
  ...MEXICO_SPAIN_PLACES, ...JPN_DK_CAT_PLACES,
  ...NZ_PLACES, ...ITALY_BALI_FRANCE_PLACES,
];

export const placeById = (id: string): Place | undefined =>
  PLACES.find((p) => p.id === id);

export const placesInCity = (cityId: string): Place[] =>
  PLACES.filter((p) => p.cityId === cityId);

export * from "./destinations";
