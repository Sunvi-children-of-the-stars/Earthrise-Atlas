import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { DATA, mask, relay, site, useHorizonsTable } from "../../test/data";
import { STORY_HOURS, STORY_START, storyFigures } from "./figures";

describe("chiffres du récit (période fixe du 14/11/2026)", () => {
  test("période de référence", () => {
    expect(STORY_START).toBe(Date.UTC(2026, 10, 14, 16));
    expect(STORY_HOURS).toBe(708.7);
  });

  test("crête de liaison : Soleil rasant, Terre cachée 13 jours, moins de 2 h avec LRO", () => {
    useHorizonsTable();
    const f = storyFigures(site("connecting-ridge"), mask("connecting-ridge"), relay("lro"));
    expect(f.sunMaxAlt).toBeLessThan(2.2);
    expect(f.sunPct).toBeCloseTo(100, 0);
    expect(f.earthPct).toBeCloseTo(48.3, 0);
    expect(Math.abs(f.longestNoEarthH - 321.5)).toBeLessThanOrEqual(1);
    expect(f.longestNoLinkH!).toBeLessThan(2);
    expect(f.passesPerDay!).toBeCloseTo(12.3, 1);
  });

  test("sans relais, les chiffres du relais sont absents", () => {
    useHorizonsTable();
    const f = storyFigures(site("connecting-ridge"), mask("connecting-ridge"), null);
    expect(f.longestNoLinkH).toBeNull();
    expect(f.passesPerDay).toBeNull();
  });

  test("transect de Mons Mouton : la Terre disparaît à quelques centaines de mètres du site", () => {
    const tr = JSON.parse(readFileSync(join(DATA, "story", "mons-mouton-transect.json"), "utf8"));
    expect(tr.site).toBe("mons-mouton");
    expect(tr.points.length).toBe(41);
    const at0 = tr.points.find((p: { distKm: number }) => p.distKm === 0);
    expect(at0.earthPct).toBeGreaterThan(95);
    const near = tr.points.filter((p: { distKm: number }) => Math.abs(p.distKm) <= 1).map((p: { earthPct: number }) => p.earthPct);
    expect(Math.min(...near)).toBeLessThan(80);
  });
});
