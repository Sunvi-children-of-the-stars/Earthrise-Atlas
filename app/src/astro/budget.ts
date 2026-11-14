/**
 * Energy and radio-link budget for a reference vehicle (member 4).
 *
 * Energy: solar panels + battery, simulated along the samples of a period (state of charge).
 * Telecom: direct-to-Earth link budget (free-space loss at the real Earth distance, antenna gains,
 * ground-station G/T), giving the achievable data rate and the data volume over the period.
 *
 * Values are orders of magnitude for comparing sites and dates, not a vehicle design.
 * Sources and assumptions: docs/member4_energy_telecom.md.
 */
import { solarFlux, sunUp, earthUp, type Sample } from "./analysis";

export type Band = "S" | "X" | "Ka";
export type Station = "dsn34" | "dsn70" | "com12";

export interface Vehicle {
  label: string;
  panelM2: number;        // solar panel area (m²)
  panelEff: number;       // cell + wiring efficiency (0–1)
  panelMount: "vertical" | "horizontal"; // vertical, turning to face the Sun / flat on the deck
  dayW: number;           // consumption when the Sun is visible (W)
  nightW: number;         // survival consumption in the dark: heaters, computer (W)
  batteryWh: number;      // battery capacity (Wh)
  dod: number;            // usable depth of discharge (0–1)
  chargeEff: number;      // charge efficiency (0–1)
  band: Band;
  txW: number;            // radio transmit power (W)
  antennaM: number;       // dish diameter on the vehicle (m)
  station: Station;
  stationHoursPerDay: number; // ground-station time allocated per day (h)
  maxRateMbps: number;    // radio hardware limit (Mbit/s)
}

export const VEHICLES: Record<string, Vehicle> = {
  lander: {
    label: "Petit atterrisseur (classe CLPS)", panelM2: 2.5, panelEff: 0.28, panelMount: "vertical",
    dayW: 250, nightW: 80, batteryWh: 3000, dod: 0.8, chargeEff: 0.95,
    band: "X", txW: 20, antennaM: 0.5, station: "com12", stationHoursPerDay: 24, maxRateMbps: 2,
  },
  rover: {
    label: "Rover (classe VIPER)", panelM2: 1.5, panelEff: 0.28, panelMount: "vertical",
    dayW: 200, nightW: 50, batteryWh: 2000, dod: 0.8, chargeEff: 0.95,
    band: "X", txW: 15, antennaM: 0.3, station: "dsn34", stationHoursPerDay: 8, maxRateMbps: 1,
  },
  base: {
    label: "Station longue durée", panelM2: 30, panelEff: 0.28, panelMount: "vertical",
    dayW: 3000, nightW: 1500, batteryWh: 30000, dod: 0.8, chargeEff: 0.95,
    band: "Ka", txW: 50, antennaM: 1, station: "dsn34", stationHoursPerDay: 24, maxRateMbps: 100,
  },
};

export const BANDS: Record<Band, { label: string; ghz: number; atmDb: number }> = {
  S: { label: "Bande S (2,2 GHz)", ghz: 2.25, atmDb: 0.3 },
  X: { label: "Bande X (8,4 GHz)", ghz: 8.45, atmDb: 0.5 },
  Ka: { label: "Bande Ka (26 GHz)", ghz: 26, atmDb: 2.0 },
};

/** Ground-station figure of merit G/T (dB/K), typical values at mid elevation. */
export const STATIONS: Record<Station, { label: string; gt: Partial<Record<Band, number>> }> = {
  dsn34: { label: "DSN, antenne de 34 m", gt: { S: 41, X: 53.5, Ka: 61 } },
  dsn70: { label: "DSN, antenne de 70 m", gt: { S: 50, X: 61 } },
  com12: { label: "Station commerciale de 12 m", gt: { S: 22, X: 35, Ka: 43 } },
};

const C = 299_792_458;
const K_DB = -228.6;          // Boltzmann constant (dBW/K/Hz)
const TX_LOSS_DB = 1.5;       // cables + pointing on the vehicle
const EBN0_REQ_DB = 2.5;      // modern coding (turbo / LDPC) including implementation loss
const MARGIN_DB = 3;          // link margin kept in reserve
const ANT_EFF = 0.55;

const db = (x: number) => 10 * Math.log10(x);

/** Vehicle antenna gain (dBi). */
export const antennaGainDb = (v: Vehicle) => db(ANT_EFF * ((Math.PI * v.antennaM * BANDS[v.band].ghz * 1e9) / C) ** 2);

export interface LinkPoint { rangeKm: number; fsplDb: number; cn0: number; rateBps: number; marginDb: number }

/** Link budget at a given distance. null if the station cannot receive that band. */
export function linkAt(v: Vehicle, rangeKm: number): LinkPoint | null {
  const gt = STATIONS[v.station].gt[v.band];
  if (gt === undefined) return null;
  const f = BANDS[v.band].ghz * 1e9;
  const fspl = 20 * Math.log10((4 * Math.PI * rangeKm * 1000 * f) / C);
  const eirp = db(v.txW) + antennaGainDb(v) - TX_LOSS_DB;
  const cn0 = eirp - fspl - BANDS[v.band].atmDb + gt - K_DB;
  const maxRate = v.maxRateMbps * 1e6;
  const ideal = 10 ** ((cn0 - EBN0_REQ_DB - MARGIN_DB) / 10);
  const rateBps = Math.min(maxRate, ideal);
  return { rangeKm, fsplDb: fspl, cn0, rateBps, marginDb: MARGIN_DB + db(ideal / rateBps) };
}

/** Electrical power produced by the panels (W) for one sample. */
export function panelPower(v: Vehicle, s: Sample): number {
  const geom = v.panelMount === "vertical"
    ? Math.max(0, Math.cos((s.sAlt * Math.PI) / 180))
    : Math.max(0, Math.sin((s.sAlt * Math.PI) / 180));
  return v.panelM2 * v.panelEff * solarFlux(s) * s.sunFrac * geom;
}

export interface BudgetResult {
  socPct: Float32Array;     // battery state of charge, % of capacity, per sample
  genMeanW: number; loadMeanW: number;
  energyInKWh: number; energyOutKWh: number;
  minSocPct: number;
  brownoutH: number;        // time with an empty battery and not enough sunlight
  survives: boolean;
  batteryNeededWh: number;  // capacity that avoids any brownout with these panels
  panelNeededM2: number | null; // area that avoids any brownout with this battery (null: impossible)
  // telecom
  link: LinkPoint | null;   // at the mean distance
  linkNear: LinkPoint | null; linkFar: LinkPoint | null;
  dataGb: number;           // data volume downlinked over the period (gigabytes)
  linkHours: number;        // hours with Earth visible, power available and station allocated
}

interface PowerRun { soc: Float32Array; minSoc: number; brownoutH: number; inWh: number; outWh: number }

function runPower(v: Vehicle, ss: Sample[], i0: number, i1: number, area = v.panelM2, battery = v.batteryWh,
  keepSoc = true): PowerRun {
  const dt = ss.length > 1 ? (ss[1].t - ss[0].t) / 3_600_000 : 0;
  const floor = battery * (1 - v.dod);
  const k = area / v.panelM2;
  let e = battery, minE = battery, brownout = 0, inWh = 0, outWh = 0;
  const soc = new Float32Array(keepSoc ? i1 - i0 : 0);
  for (let i = i0; i < i1; i++) {
    const s = ss[i];
    const gen = k * panelPower(v, s);
    const load = sunUp(s) ? v.dayW : v.nightW;
    inWh += gen * dt; outWh += load * dt;
    const net = gen - load;
    if (net >= 0) e = Math.min(battery, e + net * v.chargeEff * dt);
    else {
      e += net * dt;
      if (e < floor) { brownout += dt * Math.min(1, (floor - e) / (-net * dt)); e = floor; }
    }
    minE = Math.min(minE, e);
    if (keepSoc) soc[i - i0] = (100 * e) / battery;
  }
  return { soc, minSoc: (100 * minE) / battery, brownoutH: brownout, inWh, outWh };
}

/** Largest energy deficit (Wh) over the period, starting full: the battery must store it. */
function worstDeficitWh(v: Vehicle, ss: Sample[], i0: number, i1: number): number {
  const dt = ss.length > 1 ? (ss[1].t - ss[0].t) / 3_600_000 : 0;
  let level = 0, peak = 0, worst = 0;
  for (let i = i0; i < i1; i++) {
    const s = ss[i];
    const net = panelPower(v, s) - (sunUp(s) ? v.dayW : v.nightW);
    level += net >= 0 ? net * v.chargeEff * dt : net * dt;
    peak = Math.max(peak, level);
    worst = Math.max(worst, peak - level);
  }
  return worst;
}

/** Energy part only, on a slice of samples (used by the landing-date scan). */
export function powerOnSlice(v: Vehicle, ss: Sample[], i0: number, i1: number) {
  const r = runPower(v, ss, i0, i1, v.panelM2, v.batteryWh, false);
  return { minSocPct: r.minSoc, brownoutH: r.brownoutH };
}

/** Data volume (Gb, gigabytes) on a slice, with the power state known per sample when given. */
export function dataOnSlice(v: Vehicle, ss: Sample[], i0: number, i1: number, socPct?: Float32Array): { gb: number; hours: number } {
  const dt = ss.length > 1 ? (ss[1].t - ss[0].t) / 3_600_000 : 0;
  const share = Math.min(1, v.stationHoursPerDay / 24);
  const floorPct = 100 * (1 - v.dod) + 0.01;
  let bits = 0, hours = 0;
  for (let i = i0; i < i1; i++) {
    const s = ss[i];
    if (!earthUp(s)) continue;
    if (socPct && socPct[i - i0] <= floorPct && !sunUp(s)) continue; // no power left to transmit
    const l = linkAt(v, s.earthKm);
    if (!l) continue;
    bits += l.rateBps * dt * 3600 * share;
    hours += dt * share;
  }
  return { gb: bits / 8e9, hours };
}

export function budget(v: Vehicle, ss: Sample[]): BudgetResult {
  const n = ss.length;
  const p = runPower(v, ss, 0, n);
  const hours = n > 1 ? (ss[n - 1].t - ss[0].t) / 3_600_000 + (ss[1].t - ss[0].t) / 3_600_000 : 1;
  const need = worstDeficitWh(v, ss, 0, n) / v.dod;
  // Smallest panel area that avoids any brownout with the chosen battery (bisection)
  let panelNeeded: number | null = null;
  const ok = (a: number) => runPower(v, ss, 0, n, a, v.batteryWh, false).brownoutH < 1e-6;
  if (ok(1000)) {
    let lo = 0, hi = 1000;
    for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (ok(mid)) hi = mid; else lo = mid; }
    panelNeeded = hi;
  }
  const ranges = ss.map((s) => s.earthKm);
  const mean = ranges.reduce((a, b) => a + b, 0) / Math.max(1, n);
  const d = dataOnSlice(v, ss, 0, n, p.soc);
  return {
    socPct: p.soc, genMeanW: p.inWh / hours, loadMeanW: p.outWh / hours,
    energyInKWh: p.inWh / 1000, energyOutKWh: p.outWh / 1000,
    minSocPct: p.minSoc, brownoutH: p.brownoutH, survives: p.brownoutH < 1e-6,
    batteryNeededWh: need, panelNeededM2: panelNeeded,
    link: linkAt(v, mean), linkNear: linkAt(v, Math.min(...ranges)), linkFar: linkAt(v, Math.max(...ranges)),
    dataGb: d.gb, linkHours: d.hours,
  };
}
