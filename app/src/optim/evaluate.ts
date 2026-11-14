/**
 * Evaluates a whole region over a period: for every pixel, Sun and Earth are compared with the
 * pixel's horizon (72 directions) at each time step. Same visibility rules as astro/analysis.ts.
 */
import { AU, bodiesFixed, daysJ2000, moonRotation, R_MOON_KM } from "../astro/ephemeris";
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
  // Earth OR relay satellite (empty arrays when no relay orbit covers the period)
  linkPct: Float32Array;    // % of time with Earth or the relay usable
  noLinkH: Float32Array;    // longest period with neither (h)
  relayName: string;
  ms: number;
}

/** Relay orbit as sent to the worker (see astro/relay.ts). */
export interface RelayInput { name: string; xyz: Float32Array; startUtcMs: number; stepSeconds: number; count: number }

/** Minimum relay elevation (antenna mask), as in astro/relay.ts. */
const RELAY_MIN_ELEV = 5;
/**
 * Relay visibility is computed on a coarser grid (one node every NODE pixels = 1 km): from orbit,
 * it changes slowly with position. Earth visibility, which can change within 200 m at a summit,
 * stays per pixel; both are combined per pixel at the end.
 */
const NODE = 5;
const RELAY_STEP_MIN = 2;

export function stepForRegion(hours: number): number {
  return Math.max(30, Math.ceil((hours * 60) / 360 / 10) * 10); // ≤ ~360 steps
}

export function evaluateRegion(region: RegionData, start: number, hours: number,
  onProgress?: (f: number) => void, relay?: RelayInput | null): RegionMetrics {
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

  // Relay grid nodes; per-pixel Earth visibility of every coarse step (bit array) for the combination
  const NW = Math.ceil(W / NODE), NH = Math.ceil(H / NODE), NN = NW * NH;
  const nodePix = new Int32Array(NN);
  for (let r = 0; r < NH; r++) for (let c = 0; c < NW; c++) {
    nodePix[r * NW + c] = Math.min(H - 1, r * NODE + (NODE >> 1)) * W + Math.min(W - 1, c * NODE + (NODE >> 1));
  }
  const relayOk = !!relay && start >= relay.startUtcMs
    && start + hours * 3_600_000 <= relay.startUtcMs + (relay.count - 1) * relay.stepSeconds * 1000;
  const earthBits = new Uint32Array(relayOk ? Math.ceil((N * steps) / 32) : 0);

  const horizonAt = (p: number, az: number) => {
    const f = az / AZS;
    const i = Math.floor(f) % NA, t = f - Math.floor(f);
    const base = p * NA;
    return (hz[base + i] * (1 - t) + hz[base + ((i + 1) % NA)] * t) / 100;
  };

  for (let s = 0; s < steps; s++) {
    const b = bodiesFixed(new Date(start + s * stepMin * 60_000));
    const sn = Math.hypot(...b.sun);
    const fluxScale = (AU / sn) ** 2; // real Moon–Sun distance
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
      if (frac > 0) fluxSum[p] += fluxScale * frac * Math.cos(sAlt * DEG);
      const sunUp = frac >= 0.5;
      if (sunUp) curDark[p] = 0; else if (++curDark[p] > maxDark[p]) maxDark[p] = curDark[p];
      if (earthUp) { earthCnt[p]++; curOut[p] = 0; } else if (++curOut[p] > maxOut[p]) maxOut[p] = curOut[p];
      if (relayOk && earthUp) { const b = p * steps + s; earthBits[b >>> 5] |= 1 << (b & 31); }
      if (sunUp && earthUp) bothCnt[p]++;
    }
    if (onProgress && (s % 10 === 0 || s === steps - 1)) onProgress(((relayOk ? 0.8 : 1) * (s + 1)) / steps);
  }

  // Relay passes on the node grid. Each coarse step (Earth sampled at its start) is split into
  // `sub` relay sub-steps; per node and step we keep: covered sub-steps, gap at the start, gap at
  // the end, longest inner gap. Combining them with each pixel's Earth bits gives exact runs.
  const sub = Math.max(1, Math.round(stepMin / RELAY_STEP_MIN));
  const linkPctArr = new Float32Array(relayOk ? N : 0), noLinkArr = new Float32Array(relayOk ? N : 0);
  if (relayOk && relay) {
    const cov = new Uint16Array(NN * steps), lead = new Uint16Array(NN * steps);
    const trail = new Uint16Array(NN * steps), inner = new Uint16Array(NN * steps);
    const cur = new Uint16Array(NN);
    const cp = nodePix[Math.floor(NN / 2)]; // region centre
    const subMs = (stepMin * 60_000) / sub;
    for (let s = 0; s < steps; s++) {
      cur.fill(0);
      const sawRelay = new Uint8Array(NN);
      for (let j = 0; j < sub; j++) {
        const t = start + s * stepMin * 60_000 + j * subMs;
        const k = (t - relay.startUtcMs) / (relay.stepSeconds * 1000);
        const i = Math.max(0, Math.min(relay.count - 2, Math.floor(k))), a = k - i;
        const q = [0, 1, 2].map((c) => relay.xyz[3 * i + c] * (1 - a) + relay.xyz[3 * (i + 1) + c] * a);
        const R = moonRotation(daysJ2000(new Date(t)));
        const rx = R[0][0] * q[0] + R[0][1] * q[1] + R[0][2] * q[2];
        const ry = R[1][0] * q[0] + R[1][1] * q[1] + R[1][2] * q[2];
        const rz = R[2][0] * q[0] + R[2][1] * q[1] + R[2][2] * q[2];
        const c3 = cp * 3;
        const cx = rx - rad[cp] * up[c3], cy = ry - rad[cp] * up[c3 + 1], cz = rz - rad[cp] * up[c3 + 2];
        const cAlt = Math.asin((cx * up[c3] + cy * up[c3 + 1] + cz * up[c3 + 2]) / Math.hypot(cx, cy, cz)) / DEG;
        // The region spans < 2° of arc: if the relay is below -25° at the centre, it is invisible everywhere.
        const maybe = cAlt > -25;
        for (let n = 0; n < NN; n++) {
          let ok = false;
          if (maybe) {
            const p = nodePix[n], i3 = p * 3;
            const vx = rx - rad[p] * up[i3], vy = ry - rad[p] * up[i3 + 1], vz = rz - rad[p] * up[i3 + 2];
            const alt = Math.asin((vx * up[i3] + vy * up[i3 + 1] + vz * up[i3 + 2]) / Math.hypot(vx, vy, vz)) / DEG;
            if (alt > RELAY_MIN_ELEV) {
              const az = ((Math.atan2(vx * east[i3] + vy * east[i3 + 1],
                vx * north[i3] + vy * north[i3 + 1] + vz * north[i3 + 2]) / DEG) + 360) % 360;
              ok = alt > horizonAt(p, az);
            }
          }
          const b = n * steps + s;
          if (ok) {
            cov[b]++;
            if (!sawRelay[n]) { lead[b] = j; sawRelay[n] = 1; } else if (cur[n] > inner[b]) inner[b] = cur[n];
            cur[n] = 0;
          } else cur[n]++;
        }
      }
      for (let n = 0; n < NN; n++) {
        const b = n * steps + s;
        if (!sawRelay[n]) { lead[b] = sub; trail[b] = sub; } else trail[b] = cur[n];
      }
      if (onProgress && (s % 10 === 0 || s === steps - 1)) onProgress(0.8 + (0.2 * (s + 1)) / steps);
    }
    const nodeOf = (p: number) =>
      Math.min(NH - 1, Math.floor(Math.floor(p / W) / NODE)) * NW + Math.min(NW - 1, Math.floor((p % W) / NODE));
    for (let p = 0; p < N; p++) {
      const n = nodeOf(p);
      let linked = 0, run = 0, worst = 0;
      for (let s = 0; s < steps; s++) {
        const bit = p * steps + s;
        const b = n * steps + s;
        if ((earthBits[bit >>> 5] >>> (bit & 31)) & 1) { linked += sub; run = 0; continue; }
        linked += cov[b];
        if (cov[b] === 0) { run += sub; if (run > worst) worst = run; continue; }
        run += lead[b];
        if (run > worst) worst = run;
        if (inner[b] > worst) worst = inner[b];
        run = trail[b];
        if (run > worst) worst = run;
      }
      linkPctArr[p] = (100 * linked) / (steps * sub);
      noLinkArr[p] = (worst * stepMin) / sub / 60;
    }
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
    linkPct: linkPctArr,
    noLinkH: noLinkArr,
    relayName: relayOk && relay ? relay.name : "",
    ms: Date.now() - t0,
  };
}
