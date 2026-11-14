import { describe, expect, test } from "vitest";
import { fakeMetrics, fakeRegion } from "../test/region";
import { CRITERIA, extractZones, PROFILES, scoreRegion, type Criterion } from "./score";

const ALL = CRITERIA.map((c) => c.id);
const only = (k: Criterion, w = 1) => Object.fromEntries(ALL.map((c) => [c, c === k ? w : 0])) as Record<Criterion, number>;
const free = { slopeMax: 90, nightMaxH: 1e9, earthMinPct: 0, sunMinPct: 0, psrMaxKm: 50 };

describe("score et zones", () => {
  test("chaque profil a un poids pour chaque critère et au moins un poids positif", () => {
    for (const p of PROFILES) {
      expect(Object.keys(p.weights).sort()).toEqual([...ALL].sort());
      expect(Object.values(p.weights).some((w) => w > 0)).toBe(true);
    }
  });

  test("le score est la moyenne pondérée des critères normalisés (0 à 100)", () => {
    const r = fakeRegion(3, 1);
    const m = fakeMetrics(3, 1, (c) => ({ sunPct: [0, 50, 100][c], earthPct: [100, 50, 0][c] }));
    const s = scoreRegion(r, m, { ...only("sun", 3), earth: 1 }, free);
    expect(Array.from(s.score)).toEqual([25, 50, 75]);
    expect(s.best).toBe(75);
    expect(s.feasibleCount).toBe(3);
  });

  test("les contraintes excluent les pixels (pente, nuit, Soleil, Terre)", () => {
    const r = fakeRegion(4, 1, { slope: (c) => (c === 0 ? 20 : 2) });
    const m = fakeMetrics(4, 1, (c) => ({ nightH: c === 1 ? 300 : 10, sunPct: c === 2 ? 5 : 80, earthPct: 80 }));
    const s = scoreRegion(r, m, only("sun"), { ...free, slopeMax: 8, nightMaxH: 100, sunMinPct: 10 });
    expect(Array.from(s.feasible)).toEqual([0, 0, 0, 1]);
    expect(Number.isNaN(s.score[0])).toBe(true);
  });

  test("« coupure courte » et « nuit courte » : plus c'est court, meilleur est le score", () => {
    const r = fakeRegion(2, 1);
    const m = fakeMetrics(2, 1, (c) => ({ nightH: [0, 100][c], outageH: [100, 0][c] }));
    expect(Array.from(scoreRegion(r, m, only("night"), free).score)).toEqual([100, 0]);
    expect(Array.from(scoreRegion(r, m, only("outage"), free).score)).toEqual([0, 100]);
  });

  test("sans orbite de relais, « Terre ou relais » vaut « Terre visible »", () => {
    const r = fakeRegion(2, 1);
    const m = fakeMetrics(2, 1, (c) => ({ earthPct: [30, 90][c] }));
    expect(Array.from(scoreRegion(r, m, only("link"), free).score)).toEqual(Array.from(scoreRegion(r, m, only("earth"), free).score));
  });

  test("critères Diviner : température douce et glace peu profonde", () => {
    const r = fakeRegion(3, 1);
    r.tAvg = Int16Array.from([500, 1250, 2500]);      // 50 K, 125 K, 250 K
    r.iceDepth = Int16Array.from([-1, 0, 50]);        // unstable, at the surface, 50 cm
    const m = fakeMetrics(3, 1, () => ({}));
    expect(Array.from(scoreRegion(r, m, only("warm"), free).score)).toEqual([0, 50, 100]);
    expect(Array.from(scoreRegion(r, m, only("subice"), free).score)).toEqual([0, 100, 50]);
  });

  test("les zones regroupent les pixels voisins proches du meilleur score", () => {
    // Two separate high blocks (left 2×2 = 90, right 1×1 = 100), the rest at 10
    const r = fakeRegion(6, 3);
    const m = fakeMetrics(6, 3, (c, rr) => ({ sunPct: c === 5 && rr === 0 ? 100 : c < 2 && rr < 2 ? 90 : 10 }));
    const s = scoreRegion(r, m, only("sun"), free);
    const z = extractZones(r, m, s, 15);
    expect(z.map((x) => x.pixels)).toEqual([1, 4]);
    expect(z[0].rank).toBe(1);
    expect(z[0].score).toBe(100);
    expect(z[1].areaKm2).toBeCloseTo(4 * 0.04, 6);
  });
});
