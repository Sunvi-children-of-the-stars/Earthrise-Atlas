/**
 * Evaluates a whole region over a period: for every pixel, Sun and Earth are compared with the
 * pixel's horizon (72 directions) at each time step. Same visibility rules as astro/analysis.ts.
 */
import { bodiesFixed, R_MOON_KM } from "../astro/ephemeris";
import { pixelLatLon, type RegionData } from "./region";

const DEG = Math.PI / 180;
const SUN_DIAM = 0.533;
const SOLAR_CONSTANT = 1361;

export interface RegionMetrics {
  width: number; height: number; hours: number; stepMin: number; steps: number;
  sunPct: Float32Array;     // % of time, weighted by visible fraction of the solar disk
  nightH: Float32Array;     // longest period without the Sun (h)
  earthPct: Float32Array;   // % of time with Earth's center above the horizon
  outageH: Float32Array;    // longest period without Earth (h)
  bothPct: Float32Array;    // % of time Sun (≥ half disk) and Earth together
  flux: Float32Array;       // mean solar flux on a vertical Sun-tracking panel (W/m²)
  ms: number;
}

export function stepForRegion(hours: number): number {
  return Math.max(30, Math.ceil((hours * 60) / 360 / 10) * 10); // ≤ ~360 steps
}

export function evaluateRegion(region: RegionData, start: number, hours: number,
  onProgress?: (f: number) => void): RegionMetrics {
  const t0 = Date.now();
  const { meta, hz, elev } = region;
  const W = meta.width, H = meta.height, N = W * H, NA = meta.n_az, AZS = meta.az_step_deg;
  const stepMin = stepForRegion(hours);
  const steps = Math.floor((hours * 60) / stepMin) + 1;

  // Local frames (body-fixed) for every pixel
  const up = new Float64Array(N * 3), east = new Float64Array(N * 3), north = new Float64Array(N * 3);
  const rad = new Float64Array(N);
  for (let row = 0; row < H; row++) for (let col = 0; col < W; col++) {
    const p = row * W + col;
    const [lat, lon] = pixelLatLon(meta, col, row);
    const la = lat * DEG, lo = lon * DEG;
    const cl = Math.cos(la), sl = Math.sin(la), co = Math.cos(lo), so = Math.sin(lo);
    up.set([cl * co, cl * so, sl], p * 3);
    east.set([-so, co, 0], p * 3);
    north.set([-sl * co, -sl * so, cl], p * 3);
    rad[p] = R_MOON_KM + (elev[p] + meta.observer_height_m) / 1000;
  }

  const sunSum = new Float32Array(N), fluxSum = new Float32Array(N);
  const earthCnt = new Uint16Array(N), bothCnt = new Uint16Array(N);
  const curDark = new Uint16Array(N), maxDark = new Uint16Array(N);
  const curOut = new Uint16Array(N), maxOut = new Uint16Array(N);

  const horizonAt = (p: number, az: number) => {
    const f = az / AZS;
    const i = Math.floor(f) % NA, t = f - Math.floor(f);
    const base = p * NA;
    return (hz[base + i] * (1 - t) + hz[base + ((i + 1) % NA)] * t) / 100;
  };

  for (let s = 0; s < steps; s++) {
    const b = bodiesFixed(new Date(start + s * stepMin * 60_000));
    const sn = Math.hypot(...b.sun);
    const sx = b.sun[0] / sn, sy = b.sun[1] / sn, sz = b.sun[2] / sn; // Sun: parallax negligible
    const [ex, ey, ez] = b.earth;
    for (let p = 0; p < N; p++) {
      const i3 = p * 3;
      const ux = up[i3], uy = up[i3 + 1], uz = up[i3 + 2];
      const exx = east[i3], exy = east[i3 + 1];
      const nx = north[i3], ny = north[i3 + 1], nz = north[i3 + 2];
      // Sun
      const sAlt = Math.asin(sx * ux + sy * uy + sz * uz) / DEG;
      const sAz = ((Math.atan2(sx * exx + sy * exy, sx * nx + sy * ny + sz * nz) / DEG) + 360) % 360;
      const frac = Math.min(1, Math.max(0, (sAlt - horizonAt(p, sAz)) / SUN_DIAM + 0.5));
      // Earth (topocentric: parallax up to 0.26°)
      const r = rad[p];
      const vx = ex - r * ux, vy = ey - r * uy, vz = ez - r * uz;
      const vn = Math.hypot(vx, vy, vz);
      const eAlt = Math.asin((vx * ux + vy * uy + vz * uz) / vn) / DEG;
      const eAz = ((Math.atan2(vx * exx + vy * exy, vx * nx + vy * ny + vz * nz) / DEG) + 360) % 360;
      const earthUp = eAlt > horizonAt(p, eAz);

      sunSum[p] += frac;
      if (frac > 0) fluxSum[p] += frac * Math.cos(sAlt * DEG);
      const sunUp = frac >= 0.5;
      if (sunUp) curDark[p] = 0; else if (++curDark[p] > maxDark[p]) maxDark[p] = curDark[p];
      if (earthUp) { earthCnt[p]++; curOut[p] = 0; } else if (++curOut[p] > maxOut[p]) maxOut[p] = curOut[p];
      if (sunUp && earthUp) bothCnt[p]++;
    }
    if (onProgress && (s % 10 === 0 || s === steps - 1)) onProgress((s + 1) / steps);
  }

  const out = (f: (p: number) => number) => {
    const a = new Float32Array(N);
    for (let p = 0; p < N; p++) a[p] = f(p);
    return a;
  };
  const hStep = stepMin / 60;
  return {
    width: W, height: H, hours, stepMin, steps,
    sunPct: out((p) => (100 * sunSum[p]) / steps),
    nightH: out((p) => maxDark[p] * hStep),
    earthPct: out((p) => (100 * earthCnt[p]) / steps),
    outageH: out((p) => maxOut[p] * hStep),
    bothPct: out((p) => (100 * bothCnt[p]) / steps),
    flux: out((p) => (SOLAR_CONSTANT * fluxSum[p]) / steps),
    ms: Date.now() - t0,
  };
}
