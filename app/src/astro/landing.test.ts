import { describe, expect, test } from "vitest";
import { mask, site, useHorizonsTable } from "../test/data";
import { VEHICLES } from "./budget";
import { explain, scanSite, scoreScans, topCandidates, type LandingCandidate, type SiteScan } from "./landing";

const day = 86_400_000;
const cand = (o: Partial<LandingCandidate>): LandingCandidate => ({ siteId: "a", siteName: "A", start: 0, feasible: true, reasons: [],
  score: 0, sunPct: 100, earthPct: 100, longestNightH: 0, longestNoEarthH: 0, minSocPct: 100, brownoutH: 0, dataGb: 10, slipDays: 0, ...o });

describe("choix de la date d'atterrissage", () => {
  test("la tolérance au retard départage des fenêtres sinon identiques", () => {
    const scans: SiteScan[] = [{ siteId: "a", siteName: "A", candidates: [cand({ slipDays: 22 }), cand({ start: 40 * day, slipDays: 14 })] }];
    scoreScans(scans, 14);
    const [a, b] = scans[0].candidates;
    expect(a.score).toBeCloseTo(100, 6);
    expect(b.score).toBeLessThan(100);
  });

  test("une date infaisable a une note nulle et n'est jamais classée", () => {
    const scans: SiteScan[] = [{ siteId: "a", siteName: "A", candidates: [cand({ feasible: false, reasons: ["x"] }), cand({ start: day, slipDays: 3 })] }];
    scoreScans(scans, 14);
    expect(scans[0].candidates[0].score).toBe(0);
    expect(topCandidates(scans).map((c) => c.start)).toEqual([day]);
  });

  test("le classement garde une seule date par site et par demi-mois", () => {
    const scans: SiteScan[] = [{ siteId: "a", siteName: "A", candidates: [0, 1, 2, 20].map((d) => cand({ start: d * day, slipDays: 5 - d })) }];
    scoreScans(scans, 14);
    expect(topCandidates(scans).map((c) => c.start / day)).toEqual([0, 20]);
  });

  test("balayage réel : Malapert offre des dates possibles début octobre 2027", () => {
    useHorizonsTable();
    const s = site("malapert-massif");
    const scan = scanSite(s, mask("malapert-massif"), VEHICLES.lander,
      { from: Date.UTC(2027, 9, 1), to: Date.UTC(2027, 9, 10), missionDays: 14, everyH: 12, landingHoldH: 6 });
    expect(scan.candidates.length).toBe(19);
    expect(scan.candidates.some((c) => c.feasible)).toBe(true);
    expect(explain(scan.candidates.find((c) => c.feasible)!, 14).pros.length).toBeGreaterThan(0);
  });
});
