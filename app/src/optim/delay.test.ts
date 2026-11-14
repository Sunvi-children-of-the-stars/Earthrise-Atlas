import { describe, expect, test } from "vitest";
import { mask, site, useHorizonsTable } from "../test/data";
import { fakeMetrics, fakeRegion } from "../test/region";
import { compareDelay, lunarMonthDelays, shiftScan } from "./delay";
import { pixelLatLon } from "./region";
import { CRITERIA, type Criterion } from "./score";

const w = Object.fromEntries(CRITERIA.map((c) => [c.id, c.id === "sun" ? 1 : 0])) as Record<Criterion, number>;
const free = { slopeMax: 90, nightMaxH: 1e9, earthMinPct: 0, sunMinPct: 20, psrMaxKm: 50 };

describe("mission retardée", () => {
  const W = 30, H = 30;
  const r = fakeRegion(W, H);
  const [lat, lon] = pixelLatLon(r.meta, 5, 5);
  const before = fakeMetrics(W, H, () => ({ sunPct: 80 }));
  // After the delay: the site falls to 10 % (below sunMinPct), a strip 3 km east rises to 95 %
  const after = fakeMetrics(W, H, (c, rr) => ({ sunPct: c === 5 && rr === 5 ? 10 : c >= 20 && rr === 5 ? 95 : 60 }));

  test("le site devient infaisable et une alternative proche est proposée", () => {
    const d = compareDelay(r, before, after, lat, lon, w, free, 4);
    expect(d.verdict).toBe("devient infaisable");
    expect(d.before.score).toBe(80);
    expect(d.alternatives.length).toBeGreaterThan(0);
    expect(d.alternatives[0].score).toBe(95);
    expect(d.alternatives[0].distKm).toBeCloseTo(3, 1);
    expect(d.alternatives.every((a) => a.distKm <= 4)).toBe(true);
  });

  test("sans changement, le verdict est « toujours bon »", () => {
    expect(compareDelay(r, before, before, lat, lon, w, free).verdict).toBe("toujours bon");
  });

  test("shiftScan : 13 décalages d'un mois lunaire, saisons visibles à Mons Mouton", () => {
    useHorizonsTable();
    expect(lunarMonthDelays()).toHaveLength(13);
    const rows = shiftScan(site("mons-mouton"), mask("mons-mouton"), Date.UTC(2026, 10, 14), 156);
    expect(rows).toHaveLength(13);
    // Earth visible all the time in November 2026, mostly hidden around August 2027
    expect(rows[0].earthPct).toBeGreaterThan(95);
    expect(Math.min(...rows.map((x) => x.earthPct))).toBeLessThan(40);
  });
});
