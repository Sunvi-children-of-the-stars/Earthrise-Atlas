import { describe, expect, test } from "vitest";
import { mask, site, useHorizonsTable } from "../test/data";
import { fragility, metrics, seasonal, simulate, SOLAR_CONSTANT, solarFlux, windows, type Sample } from "./analysis";
import { flatMask } from "./horizon";

/** Synthetic samples (1 h apart): Sun/Earth margins above the horizon given per hour. */
function fake(sunAlt: number[], earthAlt: number[]): Sample[] {
  return sunAlt.map((a, i) => ({
    t: i * 3_600_000, sAlt: a, sAz: 0, sHz: 0, eAlt: earthAlt[i], eAz: 0, eHz: 0,
    sunFrac: Math.min(1, Math.max(0, a / 0.533 + 0.5)), earthFrac: earthAlt[i] > 0 ? 1 : 0,
    sDist: NaN, eDist: NaN, sunAu: 1, earthKm: 384_400,
  }));
}

describe("fenêtres et indicateurs", () => {
  const up = 5, down = -5;
  const sun = [up, up, down, down, down, up, up, up, down, up];
  const earth = [up, down, down, up, up, up, down, down, down, up];
  const ss = fake(sun, earth);

  test("windows() découpe les périodes et marque les bords ouverts", () => {
    const w = windows(ss, (s) => s.sunFrac >= 0.5);
    expect(w.map((x) => [x.start / 3.6e6, x.end / 3.6e6])).toEqual([[0, 1], [5, 7], [9, 9]]);
    expect(w[0].openStart).toBe(true);
    expect(w[2].openEnd).toBe(true);
  });

  test("metrics() : pourcentages, plus longue nuit, temps avant changement", () => {
    const m = metrics(ss, 0);
    expect(m.sunPct).toBeCloseTo(60, 5);
    expect(m.earthPct).toBeCloseTo(50, 5);
    expect(m.bothPct).toBeCloseTo(30, 5); // hours 0, 5, 9
    expect(m.longestNightH).toBe(3);
    expect(m.longestNoEarthH).toBe(3);
    expect(m.sunChangeH).toBe(2);
    expect(m.earthChangeH).toBe(1);
  });

  test("flux solaire : constante solaire à 1 UA, en 1/d²", () => {
    const s = { ...ss[0], sunAu: 1 };
    expect(solarFlux(s)).toBeCloseTo(SOLAR_CONSTANT, 6);
    expect(solarFlux({ ...s, sunAu: 0.983 })).toBeCloseTo(1408.5, 0); // early January
    expect(solarFlux({ ...s, sunAu: 1.017 })).toBeCloseTo(1315.9, 0); // early July
  });

  test("fragility() : robuste loin de l'horizon, fragile au ras de l'horizon", () => {
    const high = fake(Array(48).fill(10), Array(48).fill(30));
    expect(fragility(high).level).toBe("robuste");
    const grazing = fake(Array.from({ length: 48 }, (_, i) => (i % 2 ? 0.3 : -0.3)), Array(48).fill(30));
    expect(fragility(grazing).level).toBe("fragile");
    expect(fragility(grazing).sunGreyPct).toBe(100);
  });
});

describe("non-régression sur les sites candidats (jour lunaire du 14/11/2026, table Horizons)", () => {
  // Reference values of docs/member3_application.md (14/11/2026)
  const start = Date.UTC(2026, 10, 14, 16), hours = 708.7;
  const cases = [
    { id: "connecting-ridge", sun: 100, earth: 48.3, noEarthH: 321.5 },
    { id: "malapert-massif", sun: 88.6, earth: 82.1, noEarthH: 127 },
    { id: "mons-mouton", sun: 52.5, earth: 82.4, noEarthH: 125 },
  ];
  for (const c of cases) {
    test(c.id, () => {
      useHorizonsTable();
      const m = metrics(simulate(site(c.id), mask(c.id), start, hours, 30));
      expect(m.sunPct).toBeCloseTo(c.sun, 0);
      expect(m.earthPct).toBeCloseTo(c.earth, 0);
      expect(Math.abs(m.longestNoEarthH - c.noEarthH)).toBeLessThanOrEqual(1);
    });
  }

  test("horizon lisse à l'équateur : environ la moitié du temps au Soleil, Terre toujours visible", () => {
    useHorizonsTable();
    const s = { lat: 0.674, lon: 23.473, elevation_m: 0 };
    const months = seasonal(s, flatMask(0), Date.UTC(2027, 0, 1), 3);
    for (const mo of months) {
      expect(mo.sunPct).toBeGreaterThan(46); expect(mo.sunPct).toBeLessThan(54);
      expect(mo.earthPct).toBe(100);
    }
  });
});
