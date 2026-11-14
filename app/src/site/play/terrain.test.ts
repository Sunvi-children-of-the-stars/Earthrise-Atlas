import { describe, expect, test } from "vitest";
import { fakeRegion } from "../../test/region";
import { pixelLatLon } from "../../optim/region";
import { azToGrid, terrainPatch } from "./terrain";

describe("relief 3D", () => {
  test("carré de relief centré sur le site, relatif à son altitude, courbure lunaire incluse", () => {
    const r = fakeRegion(41, 41, { y0: -50_000 });
    r.elev = new Int16Array(41 * 41).fill(100);
    const [lat, lon] = pixelLatLon(r.meta, 20, 20);
    const p = terrainPatch(r, lat, lon, 2)!;
    expect(p.n).toBe(21);                  // 2 km each side at 200 m
    expect(p.stepM).toBe(200);
    expect(p.heights[10 * 21 + 10]).toBeCloseTo(0, 6);                         // the site is the reference
    expect(p.heights[10 * 21 + 20]).toBeCloseTo(-(2000 ** 2) / (2 * 1_737_400), 3); // 2 km east: drop of 1.15 m
  });

  test("hors de la région : rien", () => {
    expect(terrainPatch(fakeRegion(10, 10), 0, 0, 2)).toBeNull();
  });

  test("azimut vers la grille polaire : le nord local s'éloigne du pôle", () => {
    // A site on longitude 0 (x = 0, y > 0): local north = +y, local east = +x
    const n = azToGrid(0, 0, 100_000), e = azToGrid(90, 0, 100_000);
    expect(n[0]).toBeCloseTo(0, 9); expect(n[1]).toBeCloseTo(1, 9);
    expect(e[0]).toBeCloseTo(1, 9); expect(e[1]).toBeCloseTo(0, 9);
    // A site on longitude 90°E (x > 0, y = 0): local north = +x
    const n2 = azToGrid(0, 100_000, 0);
    expect(n2[0]).toBeCloseTo(1, 9); expect(n2[1]).toBeCloseTo(0, 9);
  });
});
