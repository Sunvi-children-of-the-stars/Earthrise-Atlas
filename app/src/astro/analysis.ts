import { altAz, AU, bodiesFixed, type Site } from "./ephemeris";
import { horizonAt, obstacleDistAt, type HorizonMask } from "./horizon";

export const SOLAR_CONSTANT = 1361; // W/m²
const SUN_DIAM = 0.533;   // apparent diameter (deg)
const EARTH_DIAM = 1.9;   // Earth's apparent diameter seen from the Moon (deg)

export interface Sample {
  t: number;        // ms UTC
  sAlt: number; sAz: number; sHz: number;
  eAlt: number; eAz: number; eHz: number;
  sunFrac: number;  // fraction of the solar disk above the terrain horizon (0–1)
  earthFrac: number;
  sDist: number;    // distance (km) of the obstacle in the Sun's direction (NaN if unknown)
  eDist: number;
  sunAu: number;    // Moon–Sun distance (AU): the solar flux scales as 1/sunAu²
  earthKm: number;  // site–Earth distance (km), for the radio link budget
}

const R_SITE_KM = 1737.4;
/** Solar flux (W/m²) at the Moon–Sun distance of a sample. */
export const solarFlux = (s: Sample) => SOLAR_CONSTANT / (s.sunAu * s.sunAu);

const frac = (alt: number, hz: number, diam: number) =>
  Math.min(1, Math.max(0, (alt - hz) / diam + 0.5));

export function simulate(site: Site, mask: HorizonMask, start: number, hours: number,
  stepMin: number): Sample[] {
  const out: Sample[] = [];
  const n = Math.floor((hours * 60) / stepMin);
  for (let i = 0; i <= n; i++) {
    const t = start + i * stepMin * 60_000;
    const b = bodiesFixed(new Date(t));
    const s = altAz(site, b.sun);
    const e = altAz(site, b.earth);
    const sHz = horizonAt(mask, s.az);
    const eHz = horizonAt(mask, e.az);
    out.push({
      t, sAlt: s.alt, sAz: s.az, sHz, eAlt: e.alt, eAz: e.az, eHz,
      sunFrac: frac(s.alt, sHz, SUN_DIAM), earthFrac: frac(e.alt, eHz, EARTH_DIAM),
      sDist: obstacleDistAt(mask, s.az), eDist: obstacleDistAt(mask, e.az),
      sunAu: Math.hypot(...b.sun) / AU, earthKm: Math.hypot(...b.earth) - R_SITE_KM * Math.sin(e.alt * Math.PI / 180),
    });
  }
  return out;
}

export const sunUp = (s: Sample) => s.sunFrac >= 0.5;
export const earthUp = (s: Sample) => s.earthFrac >= 0.5;

export interface Window { start: number; end: number; openStart: boolean; openEnd: boolean }

export function windows(samples: Sample[], pred: (s: Sample) => boolean): Window[] {
  const out: Window[] = [];
  let cur: Window | null = null;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (pred(s)) {
      if (!cur) cur = { start: s.t, end: s.t, openStart: i === 0, openEnd: false };
      cur.end = s.t;
    } else if (cur) {
      out.push(cur);
      cur = null;
    }
  }
  if (cur) {
    cur.openEnd = true;
    out.push(cur);
  }
  return out;
}

function longestGap(samples: Sample[], pred: (s: Sample) => boolean): number {
  let best = 0, run = 0;
  const dt = samples.length > 1 ? samples[1].t - samples[0].t : 0;
  for (const s of samples) {
    run = pred(s) ? 0 : run + dt;
    best = Math.max(best, run);
  }
  return best / 3_600_000;
}

/** Time (h) before the state changes, starting at index i; null if it never changes. */
function untilChange(samples: Sample[], i: number, pred: (s: Sample) => boolean): number | null {
  const now = pred(samples[i]);
  for (let j = i + 1; j < samples.length; j++) {
    if (pred(samples[j]) !== now) return (samples[j].t - samples[i].t) / 3_600_000;
  }
  return null;
}

export interface Metrics {
  sunPct: number;
  earthPct: number;
  bothPct: number;
  longestNightH: number;
  longestNoEarthH: number;
  sunMaxAlt: number;
  meanPowerVertical: number;   // W/m², vertical panel tracking the Sun
  meanPowerHorizontal: number; // W/m², horizontal panel
  now: Sample;
  sunIsUp: boolean;
  earthIsUp: boolean;
  sunChangeH: number | null;
  earthChangeH: number | null;
  sunWindows: Window[];
  earthWindows: Window[];
  bothWindows: Window[];
}

export function metrics(samples: Sample[], cursor = 0): Metrics {
  const n = samples.length;
  const mean = (f: (s: Sample) => number) => samples.reduce((a, s) => a + f(s), 0) / n;
  const both = (s: Sample) => sunUp(s) && earthUp(s);
  const i = Math.min(Math.max(cursor, 0), n - 1);
  return {
    sunPct: 100 * mean((s) => s.sunFrac),
    earthPct: 100 * mean((s) => (earthUp(s) ? 1 : 0)),
    bothPct: 100 * mean((s) => (both(s) ? 1 : 0)),
    longestNightH: longestGap(samples, sunUp),
    longestNoEarthH: longestGap(samples, earthUp),
    sunMaxAlt: Math.max(...samples.map((s) => s.sAlt)),
    meanPowerVertical: mean((s) => solarFlux(s) * s.sunFrac * Math.max(0, Math.cos(s.sAlt * Math.PI / 180))),
    meanPowerHorizontal: mean((s) => solarFlux(s) * s.sunFrac * Math.max(0, Math.sin(s.sAlt * Math.PI / 180))),
    now: samples[i],
    sunIsUp: sunUp(samples[i]),
    earthIsUp: earthUp(samples[i]),
    sunChangeH: untilChange(samples, i, sunUp),
    earthChangeH: untilChange(samples, i, earthUp),
    sunWindows: windows(samples, sunUp),
    earthWindows: windows(samples, earthUp),
    bothWindows: windows(samples, both),
  };
}

/** Synodic month: duration of one lunar day (sunrise to sunrise). */
export const SYNODIC_DAYS = 29.530589;

export interface MonthStat { start: number; sunPct: number; earthPct: number; longestNightH: number }

/** Month-by-month (lunar months) statistics over about one year. */
export function seasonal(site: Site, mask: HorizonMask, start: number, months = 13): MonthStat[] {
  const out: MonthStat[] = [];
  const span = SYNODIC_DAYS * 24;
  for (let m = 0; m < months; m++) {
    const t0 = start + m * span * 3_600_000;
    const s = simulate(site, mask, t0, span, 120);
    const k = metrics(s);
    out.push({ start: t0, sunPct: k.sunPct, earthPct: k.earthPct, longestNightH: k.longestNightH });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Robustness of a result ("fragile cases")
// ---------------------------------------------------------------------------
// Thresholds derived from the QuickMap validation (docs/validation_quickmap.md):
//  * our measured errors are ≤ 0.2° (ephemeris, horizon at 20 m); ±0.5° covers them with margin and
//    the residual gaps seen against QuickMap: within ±0.5° of the horizon the answer is uncertain;
//  * with an obstacle farther than 100 km and a margin below 2.5°, tools that treat lunar
//    curvature differently disagree.
export const GREY_DEG = 0.5;
export const FAR_KM = 100;
export const FAR_MARGIN_DEG = 2.5;

export type Robustness = "robuste" | "à confirmer" | "fragile";

export interface Fragility {
  level: Robustness;
  sunRange: [number, number];     // % of sunlight if the horizon were GREY_DEG higher / lower
  earthRange: [number, number];
  sunGreyPct: number;             // % of time the Sun is within ±GREY_DEG of the horizon
  earthGreyPct: number;
  sunFarPct: number;              // % of time decided by an obstacle > 100 km with margin < 2.5°
  earthFarPct: number;
  nowSunMargin: number;           // margin (°) at the cursor
  nowEarthMargin: number;
  nowSunFar: boolean;
  nowEarthFar: boolean;
  windows: Window[];              // periods when the Sun or the Earth is in a fragile situation
}

const isFar = (dist: number, margin: number) => dist > FAR_KM && Math.abs(margin) < FAR_MARGIN_DEG;

export function fragility(samples: Sample[], cursor = 0): Fragility {
  const n = samples.length;
  let sLo = 0, sHi = 0, eLo = 0, eHi = 0, sGrey = 0, eGrey = 0, sFar = 0, eFar = 0;
  for (const s of samples) {
    const sm = s.sAlt - s.sHz, em = s.eAlt - s.eHz;
    sLo += frac(s.sAlt, s.sHz + GREY_DEG, SUN_DIAM);
    sHi += frac(s.sAlt, s.sHz - GREY_DEG, SUN_DIAM);
    eLo += em > GREY_DEG ? 1 : 0;
    eHi += em > -GREY_DEG ? 1 : 0;
    if (Math.abs(sm) < GREY_DEG) sGrey++;
    if (Math.abs(em) < GREY_DEG) eGrey++;
    if (isFar(s.sDist, sm)) sFar++;
    if (isFar(s.eDist, em)) eFar++;
  }
  const pct = (x: number) => (100 * x) / n;
  const sunRange: [number, number] = [pct(sLo), pct(sHi)];
  const earthRange: [number, number] = [pct(eLo), pct(eHi)];
  const width = Math.max(sunRange[1] - sunRange[0], earthRange[1] - earthRange[0]);
  const far = Math.max(pct(sFar), pct(eFar));
  const level: Robustness = width <= 5 && far < 2 ? "robuste" : width <= 15 && far < 10 ? "à confirmer" : "fragile";
  const c = samples[Math.min(Math.max(cursor, 0), n - 1)];
  return {
    level, sunRange, earthRange,
    sunGreyPct: pct(sGrey), earthGreyPct: pct(eGrey), sunFarPct: pct(sFar), earthFarPct: pct(eFar),
    nowSunMargin: c.sAlt - c.sHz, nowEarthMargin: c.eAlt - c.eHz,
    nowSunFar: isFar(c.sDist, c.sAlt - c.sHz), nowEarthFar: isFar(c.eDist, c.eAlt - c.eHz),
    windows: windows(samples, (s) => {
      const sm = s.sAlt - s.sHz, em = s.eAlt - s.eHz;
      return Math.abs(sm) < GREY_DEG || Math.abs(em) < GREY_DEG || isFar(s.sDist, sm) || isFar(s.eDist, em);
    }),
  };
}
