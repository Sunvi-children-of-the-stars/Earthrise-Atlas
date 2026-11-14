import { afterEach, describe, expect, test } from "vitest";
import { useHorizonsTable } from "../test/data";
import { altAz, AU, bodiesFixed, ephemerisSourceAt, getEphemerisTable, setEphemerisTable, subPoint } from "./ephemeris";

const SITES = { ridge: { lat: -89.439, lon: -137.144, elevation_m: 1959 }, apollo11: { lat: 0.674, lon: 23.473, elevation_m: 0 } };
const dates = Array.from({ length: 60 }, (_, i) => new Date(Date.UTC(2026, 10, 1) + i * 12.3 * 86_400_000));

afterEach(() => setEphemerisTable(null));

describe("éphémérides", () => {
  test("la table Horizons couvre 2026 à 2030 et sert de source dans cette période", () => {
    const t = useHorizonsTable();
    // Table epochs are TDB (= UTC + 69.2 s): 2026-01-01 00:00 TDB is 2025-12-31 23:58:51 UTC
    expect(Math.abs(t.startUtcMs - Date.UTC(2026, 0, 1))).toBeLessThan(70_000);
    expect(new Date(t.endUtcMs).getUTCFullYear()).toBeGreaterThanOrEqual(2030);
    expect(ephemerisSourceAt(Date.UTC(2027, 5, 1))).toBe("horizons");
    expect(ephemerisSourceAt(Date.UTC(2035, 0, 1))).toBe("series");
    setEphemerisTable(null);
    expect(getEphemerisTable()).toBeNull();
    expect(ephemerisSourceAt(Date.UTC(2027, 5, 1))).toBe("series");
  });

  test("séries intégrées et table Horizons concordent dans les limites validées", () => {
    // Documented accuracy of the series (docs/decision_ephemerides.md): Sun ≤ 0.005°, Earth ≤ 0.19°
    const series = dates.map((d) => bodiesFixed(d));
    useHorizonsTable();
    dates.forEach((d, i) => {
      const t = bodiesFixed(d);
      for (const s of Object.values(SITES)) {
        expect(Math.abs(altAz(s, t.sun).alt - altAz(s, series[i].sun).alt)).toBeLessThan(0.01);
        expect(Math.abs(altAz(s, t.earth).alt - altAz(s, series[i].earth).alt)).toBeLessThan(0.4);
      }
    });
  });

  test("géométrie physique : distances, déclinaison du Soleil, libration de la Terre", () => {
    useHorizonsTable();
    for (const d of dates) {
      const b = bodiesFixed(d);
      const sunAu = Math.hypot(...b.sun) / AU;
      expect(sunAu).toBeGreaterThan(0.98); expect(sunAu).toBeLessThan(1.02);
      const earthKm = Math.hypot(...b.earth);
      expect(earthKm).toBeGreaterThan(356_000); expect(earthKm).toBeLessThan(407_000);
      // Sun latitude on the Moon ≤ 1.54° (lunar axis tilt to the ecliptic)
      expect(Math.abs(subPoint(b.sun).lat)).toBeLessThan(1.6);
      // Earth stays near the sub-Earth point (0°, 0°) within the librations (~7–8°)
      const e = subPoint(b.earth);
      expect(Math.abs(e.lat)).toBeLessThan(7.5);
      expect(Math.abs(e.lon)).toBeLessThan(8.5);
    }
  });

  test("Apollo 11 voit toujours la Terre haut dans le ciel, la crête la voit à l'horizon", () => {
    useHorizonsTable();
    for (const d of dates) {
      const b = bodiesFixed(d);
      expect(altAz(SITES.apollo11, b.earth).alt).toBeGreaterThan(55);
      expect(Math.abs(altAz(SITES.ridge, b.earth).alt)).toBeLessThan(8);
      expect(Math.abs(altAz(SITES.ridge, b.sun).alt)).toBeLessThan(2.2);
    }
  });
});
