import { describe, expect, test } from "vitest";
import { fakeMetrics, fakeRegion } from "../test/region";
import { neighborhood, pixelOf, pointMetrics, regionContains, transect } from "./neighborhood";
import { pixelLatLon } from "./region";

describe("« 1 km plus loin »", () => {
  const W = 21, H = 21;
  const r = fakeRegion(W, H);
  // Earth visibility drops sharply east of column 12 (a ridge masking the Earth)
  const m = fakeMetrics(W, H, (c) => ({ earthPct: c > 12 ? 20 : 100, sunPct: 50 + c }));
  const [lat, lon] = pixelLatLon(r.meta, 10, 10);

  test("pixelOf et pointMetrics retrouvent le pixel du point", () => {
    expect(pixelOf(r.meta, lat, lon)).toEqual([10, 10]);
    expect(pointMetrics(r, m, lat, lon)!.sunPct).toBe(60);
    expect(regionContains(r.meta, lat, lon, 1)).toBe(true);
    expect(regionContains(r.meta, -10, 0)).toBe(false);
  });

  test("le voisinage mesure l'écart à moins de 1 km et la part de cellules meilleures", () => {
    const n = neighborhood(r, m, lat, lon, 2)!;
    expect(n.cells).toBeGreaterThan(250);
    expect(n.indicators.earthPct.site).toBe(100);
    expect(n.indicators.earthPct.within1km).toBe(80); // 3 pixels east (600 m): Earth visible 20 %
    expect(n.indicators.earthPct.betterPct).toBe(0);
    expect(n.indicators.sunPct.max).toBe(70);
    expect(n.indicators.sunPct.best.distKm).toBeCloseTo(2, 1);
  });

  test("le transect suit une ligne par pas réguliers", () => {
    const tr = transect(r, m, lat, lon, 90, 1, 0.2);
    expect(tr).toHaveLength(11);
    expect(tr[5].distKm).toBe(0);
    tr.forEach((p, i) => expect(p.distKm).toBeCloseTo(-1 + 0.2 * i, 6));
  });
});
