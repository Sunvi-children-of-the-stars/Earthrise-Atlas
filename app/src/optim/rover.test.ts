import { describe, expect, test } from "vitest";
import { fakeMetrics, fakeRegion } from "../test/region";
import { pixelLatLon } from "./region";
import { roverRoute, targets } from "./rover";

describe("itinéraire de rover", () => {
  // 15 × 9 grid; a wall of 25° slopes on column 7 with a single gap at row 8
  const W = 15, H = 9;
  const [lat, lon] = pixelLatLon(fakeRegion(W, H).meta, 2, 2);
  const goal = (p: number) => p % W === 12 && Math.floor(p / W) === 2;

  test("contourne un mur trop raide par le seul passage", () => {
    const r = fakeRegion(W, H, { slope: (c, rr) => (c === 7 && rr !== 8 ? 25 : 3) });
    const route = roverRoute(r, lat, lon, goal, { maxSlope: 15 });
    expect(route.found).toBe(true);
    expect(route.maxSlope).toBeLessThanOrEqual(15);
    const [gLat, gLon] = pixelLatLon(r.meta, 7, 8); // the only gap in the wall
    expect(route.points.some((p) => Math.abs(p.lat - gLat) < 1e-9 && Math.abs(p.lon - gLon) < 1e-9)).toBe(true);
    expect(route.lengthKm).toBeGreaterThan(2.5); // detour through row 8, longer than the 2 km straight line
    expect(route.driveH).toBeCloseTo(route.lengthKm / 0.2, 6);
  });

  test("sans passage, aucune route n'est inventée", () => {
    const r = fakeRegion(W, H, { slope: (c) => (c === 7 ? 25 : 3) });
    const route = roverRoute(r, lat, lon, goal, { maxSlope: 15 });
    expect(route.found).toBe(false);
    expect(route.reason).toMatch(/aucune cible/);
  });

  test("les ombres permanentes sont évitées par un rover solaire", () => {
    const r = fakeRegion(W, H, { psr: (c, rr) => c === 7 && rr !== 8 });
    const route = roverRoute(r, lat, lon, goal, { avoidPsr: true });
    expect(route.found).toBe(true);
    expect(route.lengthKm).toBeGreaterThan(2.5);
  });

  test("cible « nuit courte » à partir des métriques", () => {
    const r = fakeRegion(W, H);
    const m = fakeMetrics(W, H, (c) => ({ nightH: c >= 10 ? 5 : 100 }));
    const route = roverRoute(r, lat, lon, targets.shortNight(m, 24));
    expect(route.found).toBe(true);
    expect(route.target!.col).toBe(10);
    expect(route.lengthKm).toBeCloseTo(8 * 0.2, 6);
  });
});
