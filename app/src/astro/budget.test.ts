import { describe, expect, test } from "vitest";
import type { Sample } from "./analysis";
import { antennaGainDb, budget, linkAt, panelPower, VEHICLES, type Vehicle } from "./budget";

const sample = (sunAlt: number, sunFrac: number, earthUp = true): Sample => ({
  t: 0, sAlt: sunAlt, sAz: 0, sHz: 0, eAlt: earthUp ? 5 : -5, eAz: 0, eHz: 0, sunFrac, earthFrac: earthUp ? 1 : 0,
  sDist: NaN, eDist: NaN, sunAu: 1, earthKm: 384_400,
});
const series = (n: number, f: (i: number) => Sample) => Array.from({ length: n }, (_, i) => ({ ...f(i), t: i * 3_600_000 }));

describe("bilan de liaison radio", () => {
  const lander = VEHICLES.lander;

  test("cas calculé à la main : atterrisseur, bande X, 20 W, antenne 0,5 m, station de 12 m", () => {
    // G = 10 log10(0,55 · (π · 0,5 m · 8,45 GHz / c)²) ≈ 30,3 dBi
    expect(antennaGainDb(lander)).toBeCloseTo(30.3, 1);
    const l = linkAt(lander, 384_400)!;
    // FSPL = 20 log10(4π · 3,844e8 m · 8,45e9 Hz / c) ≈ 222,7 dB
    expect(l.fsplDb).toBeCloseTo(222.7, 1);
    // C/N0 = PIRE (13 + 30,3 − 1,5) − FSPL − 0,5 + G/T 35 + 228,6 ≈ 82,2 dBHz
    expect(l.cn0).toBeCloseTo(82.2, 0);
    // Possible ≈ 47 Mbit/s, limited by the radio to 2 Mbit/s
    expect(l.rateBps).toBe(2e6);
    // Margin = 3 dB kept + the unused capacity: 10 log10(47,4 / 2) ≈ 13,7 dB
    expect(l.marginDb).toBeCloseTo(3 + 10 * Math.log10(47.4 / 2), 0);
  });

  test("le débit chute avec la distance (perte en espace libre en 20 log d)", () => {
    const v: Vehicle = { ...lander, maxRateMbps: 1e6 };
    const near = linkAt(v, 356_500)!, far = linkAt(v, 406_700)!;
    expect(far.fsplDb - near.fsplDb).toBeCloseTo(20 * Math.log10(406_700 / 356_500), 6);
    expect(near.rateBps / far.rateBps).toBeCloseTo((406_700 / 356_500) ** 2, 3);
  });

  test("une station qui ne reçoit pas la bande renvoie null", () => {
    expect(linkAt({ ...lander, band: "Ka", station: "dsn70" }, 384_400)).toBeNull();
  });
});

describe("bilan énergétique", () => {
  const v: Vehicle = { ...VEHICLES.lander, panelM2: 2, panelEff: 0.25, dayW: 100, nightW: 50, batteryWh: 1000, dod: 0.8, chargeEff: 1 };

  test("puissance des panneaux : verticaux en cos(h), horizontaux en sin(h)", () => {
    expect(panelPower(v, sample(0, 1))).toBeCloseTo(2 * 0.25 * 1361, 6);
    expect(panelPower({ ...v, panelMount: "horizontal" }, sample(30, 1))).toBeCloseTo(2 * 0.25 * 1361 * 0.5, 6);
    expect(panelPower(v, sample(5, 0))).toBe(0);
  });

  test("Soleil permanent : pas de panne, batterie pleine", () => {
    const r = budget(v, series(48, () => sample(2, 1)));
    expect(r.survives).toBe(true);
    expect(r.minSocPct).toBe(100);
    expect(r.batteryNeededWh).toBe(0);
  });

  test("nuit de 24 h : la batterie nécessaire vaut consommation × durée / profondeur de décharge", () => {
    const r = budget(v, series(24, () => sample(-5, 0)));
    // 24 samples of 1 h → 24 h at 50 W = 1 200 Wh, usable 80 % → 1 500 Wh needed
    expect(r.batteryNeededWh).toBeCloseTo(1500, 6);
    expect(r.survives).toBe(false);
    expect(r.brownoutH).toBeGreaterThan(0);
    expect(r.minSocPct).toBeCloseTo(20, 6);
  });

  test("le volume de données suit le débit, les heures de station et la visibilité de la Terre", () => {
    const r = budget({ ...v, stationHoursPerDay: 12 }, series(24, (i) => sample(5, 1, i < 12)));
    // 12 h with Earth visible × 50 % station share = 6 h at 2 Mbit/s = 43,2 Gbit = 5,4 Go
    expect(r.dataGb).toBeCloseTo(5.4, 6);
    expect(r.linkHours).toBeCloseTo(6, 6);
  });
});
