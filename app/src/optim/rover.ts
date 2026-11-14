/**
 * Rover route to a target zone (e.g. a spot that stays lit, or the edge of a permanent shadow),
 * on the 200 m grid of a region. Dijkstra on 8 neighbours:
 *   - a cell is passable if its mean slope ≤ maxSlope (and, optionally, it is not permanently
 *     shadowed: a solar rover cannot stop there);
 *   - the cost of a move is its 3-D length, increased with the slope (steeper = slower and
 *     riskier): cost = length × (1 + slopePenalty × slope / maxSlope).
 * Pure function, ~50–200 ms on a 400 × 400 region.
 */
import type { RegionMetrics } from "./evaluate";
import { pixelOf } from "./neighborhood";
import { pixelLatLon, type RegionData } from "./region";

export interface RoverOptions {
  maxSlope?: number;       // ° (mean slope of the cell); VIPER: 15
  avoidPsr?: boolean;      // do not cross permanently shadowed cells
  slopePenalty?: number;   // 0 = shortest path; 1 = a cell at maxSlope costs twice as much
  maxKm?: number;          // give up beyond this path length
  speedKmH?: number;       // for the drive-time estimate (VIPER: ~0.7 km/h top, ~0.2 average)
}

export interface RoutePoint { lat: number; lon: number; km: number; elevation: number; slope: number }

export interface Route {
  found: boolean;
  reason?: string;
  points: RoutePoint[];
  lengthKm: number;
  climbM: number;          // cumulative elevation gain
  descentM: number;
  maxSlope: number;
  driveH: number;          // at speedKmH
  target?: { lat: number; lon: number; col: number; row: number };
}

/** Target predicates. */
export const targets = {
  /** Cells whose longest night over the evaluated period is ≤ maxNightH. */
  shortNight: (m: RegionMetrics, maxNightH: number) => (p: number) => m.nightH[p] <= maxNightH,
  /** Cells with at least sunPct % of sunlight and earthPct % of Earth visibility. */
  sunAndEarth: (m: RegionMetrics, sunPct: number, earthPct: number) => (p: number) =>
    m.sunPct[p] >= sunPct && m.earthPct[p] >= earthPct,
  /** Cells within km of a permanent shadow (edge of a cold trap), not inside it. */
  nearIce: (r: RegionData, km: number) => (p: number) =>
    r.psrDistKm.length > 0 && r.psrDistKm[p] > 0 && r.psrDistKm[p] <= km,
};

/** Minimal binary heap of (cost, index). */
class Heap {
  private c: number[] = []; private i: number[] = [];
  get size() { return this.c.length; }
  push(cost: number, idx: number) {
    const c = this.c, ii = this.i;
    let k = c.length; c.push(cost); ii.push(idx);
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (c[p] <= c[k]) break;
      [c[p], c[k]] = [c[k], c[p]]; [ii[p], ii[k]] = [ii[k], ii[p]]; k = p;
    }
  }
  pop(): [number, number] {
    const c = this.c, ii = this.i;
    const top: [number, number] = [c[0], ii[0]];
    const lc = c.pop()!, li = ii.pop()!;
    if (c.length) {
      c[0] = lc; ii[0] = li;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1, r = l + 1;
        let m = k;
        if (l < c.length && c[l] < c[m]) m = l;
        if (r < c.length && c[r] < c[m]) m = r;
        if (m === k) break;
        [c[m], c[k]] = [c[k], c[m]]; [ii[m], ii[k]] = [ii[k], ii[m]]; k = m;
      }
    }
    return top;
  }
}

export function roverRoute(region: RegionData, fromLat: number, fromLon: number,
  isTarget: (p: number) => boolean, opts: RoverOptions = {}): Route {
  const { maxSlope = 15, avoidPsr = true, slopePenalty = 1, maxKm = 50, speedKmH = 0.2 } = opts;
  const empty = (reason: string): Route =>
    ({ found: false, reason, points: [], lengthKm: 0, climbM: 0, descentM: 0, maxSlope: 0, driveH: 0 });
  const { meta, elev, slopeMean, psr } = region;
  const W = meta.width, H = meta.height, N = W * H, px = meta.pixel_m;
  const start = pixelOf(meta, fromLat, fromLon);
  if (!start) return empty("départ hors de la région");
  const s0 = start[1] * W + start[0];

  const passable = (p: number) => elev[p] > -20000 && slopeMean[p] / 10 <= maxSlope
    && !(avoidPsr && psr.length && psr[p]);
  // The start cell is always allowed (the rover is already there)
  const dist = new Float64Array(N).fill(Infinity);
  const prev = new Int32Array(N).fill(-1);
  const len = new Float64Array(N).fill(Infinity); // geometric length (km) along the best path
  dist[s0] = 0; len[s0] = 0;
  const heap = new Heap();
  heap.push(0, s0);
  let goal = -1;
  while (heap.size) {
    const [d, p] = heap.pop();
    if (d > dist[p]) continue;
    if (isTarget(p) && passable(p)) { goal = p; break; }
    if (len[p] > maxKm) continue;
    const r = Math.floor(p / W), c = p % W;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || cc < 0 || rr >= H || cc >= W) continue;
      const q = rr * W + cc;
      if (!passable(q)) continue;
      const hor = Math.hypot(dr, dc) * px;
      const l = Math.hypot(hor, elev[q] - elev[p]) / 1000;
      const nd = d + l * (1 + slopePenalty * (slopeMean[q] / 10) / maxSlope);
      if (nd < dist[q]) { dist[q] = nd; prev[q] = p; len[q] = len[p] + l; heap.push(nd, q); }
    }
  }
  if (goal < 0) return empty(`aucune cible atteignable (pente ≤ ${maxSlope}°, ${maxKm} km max)`);

  const chain: number[] = [];
  for (let p = goal; p >= 0; p = prev[p]) chain.push(p);
  chain.reverse();
  let climb = 0, descent = 0, maxS = 0;
  const points = chain.map((p, i) => {
    const [lat, lon] = pixelLatLon(meta, p % W, Math.floor(p / W));
    if (i > 0) { const dh = elev[p] - elev[chain[i - 1]]; if (dh > 0) climb += dh; else descent -= dh; }
    maxS = Math.max(maxS, slopeMean[p] / 10);
    return { lat, lon, km: len[p], elevation: elev[p], slope: slopeMean[p] / 10 };
  });
  const [tl, tn] = pixelLatLon(meta, goal % W, Math.floor(goal / W));
  return {
    found: true, points, lengthKm: len[goal], climbM: climb, descentM: descent, maxSlope: maxS,
    driveH: len[goal] / speedKmH, target: { lat: tl, lon: tn, col: goal % W, row: Math.floor(goal / W) },
  };
}
