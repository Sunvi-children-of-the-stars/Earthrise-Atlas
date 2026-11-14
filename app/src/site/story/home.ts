/** "Not like home": a day in Paris against a day on the lunar south pole. Earth values are textbook constants. */
import { SYNODIC_DAYS } from "../../astro/analysis";

export const PARIS_LAT = 48.8566;
const OBLIQUITY = 23.44;             // tilt of the Earth's axis (°)
const EARTH_MOON_KM = 384_400;       // mean distance
const C_KM_S = 299_792.458;
const EARTH_MEAN_TEMP_C = 15;        // global mean surface temperature (NASA)

export interface HomeFacts {
  earthDayH: number; moonDayH: number;
  earthSunMax: number; earthSunMin: number; moonSunMax: number;
  earthTempC: number; moonTempC: number;
  radioDelayS: number;
}

/** moonSunMax: highest Sun at the site over a lunar day (°); moonTempC: annual mean temperature there (°C). */
export function homeFacts(moonSunMax: number, moonTempC: number): HomeFacts {
  return {
    earthDayH: 24, moonDayH: SYNODIC_DAYS * 24,
    earthSunMax: 90 - PARIS_LAT + OBLIQUITY, earthSunMin: 90 - PARIS_LAT - OBLIQUITY, moonSunMax,
    earthTempC: EARTH_MEAN_TEMP_C, moonTempC,
    radioDelayS: EARTH_MOON_KM / C_KM_S,
  };
}
