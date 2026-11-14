import { describe, expect, test } from "vitest";
import { customMaskSource, makeCustomSite } from "./store";

describe("données", () => {
  test("source de l'horizon d'un site personnalisé, selon ce qui est disponible", () => {
    expect(customMaskSource(false, true, true)).toBe("flat");   // north of 75°S: no relief at all
    expect(customMaskSource(true, true, true)).toBe("tiles");   // full multi-resolution relief
    expect(customMaskSource(true, false, true)).toBe("preview"); // deployed without tiles: 1.2 km DEM
    expect(customMaskSource(true, false, false)).toBe("flat");   // nothing loaded: smooth ground
  });

  test("site personnalisé : identifiant stable et position", () => {
    const s = makeCustomSite(-85.5, 15, null);
    expect(s.id).toBe("custom:-85.5000,15.0000");
    expect(s.category).toBe("custom");
    expect(s.in_dem).toBe(false); // no DEM loaded yet
    expect(s.dist_to_pole_km).toBeCloseTo(4.5 * Math.PI / 180 * 1737.4, 3);
  });
});
