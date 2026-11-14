import { describe, expect, test } from "vitest";
import { mask, relay, site, useHorizonsTable } from "../test/data";
import { flatMask } from "./horizon";
import { makeRelay, relayAnalysis, relayFixedAt, type RelayMeta } from "./relay";

describe("relais", () => {
  test("non-régression : LRO aux sites candidats (jour lunaire du 14/11/2026)", () => {
    useHorizonsTable();
    const lro = relay("lro");
    const start = Date.UTC(2026, 10, 14, 16), hours = 708.7;
    const ridge = relayAnalysis(site("connecting-ridge"), mask("connecting-ridge"), lro, start, hours);
    expect(ridge.available).toBe(true);
    expect(ridge.passesPerDay).toBeCloseTo(12.3, 1);
    expect(ridge.linkPct).toBeCloseTo(52.4, 0);
    // The longest outage falls from ~13 days (Earth alone) to under 2 h with LRO
    expect(ridge.longestNoEarthH).toBeGreaterThan(300);
    expect(ridge.longestNoLinkH).toBeLessThan(2);
    const mal = relayAnalysis(site("malapert-massif"), mask("malapert-massif"), lro, start, hours);
    expect(mal.linkPct).toBeCloseTo(83.4, 0);
  });

  test("hors de la période téléchargée, le résultat est marqué indisponible", () => {
    const r = relayAnalysis(site("malapert-massif"), mask("malapert-massif"), relay("lro"), Date.UTC(2028, 0, 1), 24);
    expect(r.available).toBe(false);
  });

  test("orbite dans le repère lunaire fixe : relais immobile au zénith toujours visible", () => {
    const meta: RelayMeta = { id: "t", satellite: "t", start_jd_tdb: 2461345.5, step_seconds: 60, count: 2000, file: "",
      altitude_km: { min: 1000, max: 1000 }, note: "", kind: "model", frame_kind: "body-fixed" };
    const xyz = new Float32Array(2000 * 3);
    for (let i = 0; i < 2000; i++) xyz[3 * i + 2] = -(1737.4 + 1000); // above the south pole
    const r = makeRelay(meta, xyz);
    const p = relayFixedAt(r, r.startUtcMs + 90_000)!;
    expect(p[0]).toBe(0); expect(p[1]).toBe(0); expect(p[2]).toBeCloseTo(-(1737.4 + 1000), 3);
    const a = relayAnalysis({ lat: -89.9, lon: 0, elevation_m: 0 }, flatMask(0), r, r.startUtcMs, 24);
    expect(a.relayPct).toBe(100);
    expect(a.passes).toHaveLength(1);
    expect(a.passes[0].minutes).toBeGreaterThan(24 * 60 - 2);
  });

  test("modèle Gateway : couvre le pôle Sud presque tout le temps", () => {
    const g = relay("gateway");
    expect(g.meta.kind).toBe("model");
    const a = relayAnalysis(site("malapert-massif"), mask("malapert-massif"), g, Date.UTC(2026, 10, 14), 168);
    expect(a.relayPct).toBeGreaterThan(90);
  });
});
