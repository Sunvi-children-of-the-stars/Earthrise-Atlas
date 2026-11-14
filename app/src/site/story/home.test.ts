import { describe, expect, test } from "vitest";
import { homeFacts, PARIS_LAT } from "./home";

describe("comparaison Terre / Lune", () => {
  const f = homeFacts(1.4, -150.4);
  test("hauteur du Soleil à midi à Paris : environ 64,6° en juin et 17,7° en décembre", () => {
    expect(PARIS_LAT).toBeCloseTo(48.86, 2);
    expect(f.earthSunMax).toBeCloseTo(64.6, 1);
    expect(f.earthSunMin).toBeCloseTo(17.7, 1);
    expect(f.moonSunMax).toBe(1.4);
  });
  test("durée du jour : 24 h contre un jour lunaire de 29,5 jours", () => {
    expect(f.earthDayH).toBe(24);
    expect(f.moonDayH / 24).toBeCloseTo(29.53, 2);
  });
  test("délai radio vers la Terre : environ 1,3 seconde", () => {
    expect(f.radioDelayS).toBeCloseTo(1.28, 2);
  });
  test("températures", () => {
    expect(f.earthTempC).toBe(15);
    expect(f.moonTempC).toBe(-150.4);
  });
});
