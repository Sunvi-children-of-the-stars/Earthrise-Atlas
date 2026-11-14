import { describe, expect, test } from "vitest";
import type { Sample } from "../../astro/analysis";
import type { RelayResult } from "../../astro/relay";
import { missionVerdict, relaySummary } from "./verdict";

const sample = (i: number, sunUp: boolean): Sample => ({
  t: i * 3_600_000, sAlt: sunUp ? 2 : -5, sAz: 0, sHz: 0, eAlt: 5, eAz: 0, eHz: 0, sunFrac: sunUp ? 1 : 0, earthFrac: 1,
  sDist: NaN, eDist: NaN, sunAu: 1, earthKm: 384_400,
});
const series = (n: number, sun: (i: number) => boolean) => Array.from({ length: n }, (_, i) => sample(i, sun(i)));

const relay = (o: Partial<RelayResult>): RelayResult => ({
  available: true, coveredFrom: 0, coveredTo: 1, passes: [], passesPerDay: 12.3, relayPct: 8, earthPct: 48,
  linkPct: 52.4, outageCoveredPct: 10, longestNoLinkH: 1.8, longestNoEarthH: 321, windows: [], ...o,
});

describe("verdict de mission", () => {
  test("Soleil permanent : le petit atterrisseur tient", () => {
    const v = missionVerdict(series(48, () => true));
    expect(v.ok).toBe(true);
    expect(v.key).toBe("verdict.survives");
  });

  test("longue nuit : panne d'énergie, avec l'heure de la panne", () => {
    // 6 h of Sun then 200 h of night: the 3 kWh battery at 80 W lasts about 30 h
    const v = missionVerdict(series(206, (i) => i < 6));
    expect(v.ok).toBe(false);
    expect(v.key).toBe("verdict.brownout");
    expect(v.vars.afterH).toBeGreaterThan(25);
    expect(v.vars.afterH).toBeLessThan(40);
  });

  test("résumé du relais : rien si absent ou hors période", () => {
    expect(relaySummary(null)).toBeNull();
    expect(relaySummary(relay({ available: false }))).toBeNull();
    expect(relaySummary(relay({}))).toEqual({ linkPct: 52.4, longestNoLinkH: 1.8, passesPerDay: 12.3 });
  });
});
