/**
 * On-demand horizon computation from the relief pyramid (used for custom sites).
 *
 * Each distance band is read at a suitable level of detail (finer level first, falling back to
 * coarser ones where the fine level has no data), with lunar curvature:
 *   40 m – 5 km    : 20 m  (→ 40, 80, 120 m)
 *   5 – 25 km      : 80 m  (→ 120 m)
 *   25 – 100 km    : 240 m
 *   100 – 300 km   : 480 m
 */
import { R_MOON_KM } from "./ephemeris";
import { destination, latLonToXY, OBSERVER_HEIGHT_M, type HorizonMask } from "./horizon";
import type { TileStore } from "./tiles";

const DEG = Math.PI / 180;
const R_M = R_MOON_KM * 1000;
export const N_AZ = 720;

interface Band { from: number; to: number; step: number; levels: number[] }
export const BANDS: Band[] = [
  { from: 40, to: 5_000, step: 20, levels: [20, 40, 80, 120] },
  { from: 5_000, to: 25_000, step: 80, levels: [80, 120] },
  { from: 25_000, to: 100_000, step: 240, levels: [240] },
  { from: 100_000, to: 300_000, step: 480, levels: [480] },
];
const SITE_LEVELS = [20, 40, 80, 120, 240, 480, 960];

export interface TiledResult {
  mask: HorizonMask;
  elevation_m: number;
  site_res_m: number;           // finest level available at the site
  near_res_m: number;           // level actually used near the site (< 5 km)
  slope_local_deg: number;      // over 2 pixels of the finest level
  slope_mean_100m_deg: number;
  slope_max_100m_deg: number;
  obstacle_dist_km: number[];
  tiles: number;
  megabytes: number;
  ms: number;
}

function sampleChain(store: TileStore, levels: number[], x: number, y: number): [number, number] {
  for (const res of levels) {
    const h = store.sample(res, x, y);
    if (!Number.isNaN(h)) return [h, res];
  }
  return [NaN, 0];
}

async function prefetchAll(store: TileStore, lat: number, lon: number) {
  const [x0, y0] = latLonToXY(lat, lon);
  const jobs: Promise<void>[] = [];
  for (const res of [20, 40, 80, 120]) jobs.push(store.prefetch(res, x0, y0, 1_000));
  for (const b of BANDS) {
    const half = b.to * 1.03; // stereographic scale factor ≤ 1.02 down to 75°S
    for (const res of b.levels) jobs.push(store.prefetch(res, x0, y0, half));
  }
  await Promise.all(jobs);
}

/** Local slope statistics (degrees) on a grid around the site, at the finest available level. */
function slopes(store: TileStore, res: number, x0: number, y0: number) {
  const h = (dx: number, dy: number) => store.sample(res, x0 + dx, y0 + dy);
  const slopeAt = (dx: number, dy: number) => {
    const gx = (h(dx + res, dy) - h(dx - res, dy)) / (2 * res);
    const gy = (h(dx, dy + res) - h(dx, dy - res)) / (2 * res);
    return Math.atan(Math.hypot(gx, gy)) / DEG;
  };
  const vals: number[] = [];
  const n = Math.max(1, Math.round(100 / res));
  for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
    if (i * i + j * j > n * n) continue;
    const s = slopeAt(i * res, j * res);
    if (!Number.isNaN(s)) vals.push(s);
  }
  return {
    local: slopeAt(0, 0),
    mean: vals.reduce((a, b) => a + b, 0) / (vals.length || 1),
    max: vals.length ? Math.max(...vals) : NaN,
  };
}

export async function computeHorizonTiled(store: TileStore, lat: number, lon: number): Promise<TiledResult | null> {
  const t0 = Date.now();
  const before = { n: store.tilesFetched, b: store.bytesFetched };
  await prefetchAll(store, lat, lon);
  const [x0, y0] = latLonToXY(lat, lon);
  const [h0, siteRes] = sampleChain(store, SITE_LEVELS, x0, y0);
  if (Number.isNaN(h0)) return null; // outside the polar relief

  const r0 = R_M + h0 + OBSERVER_HEIGHT_M;
  const az: number[] = [], el: number[] = [], dist: number[] = [];
  let nearRes = 0;
  for (let k = 0; k < N_AZ; k++) {
    const a = (k * 360) / N_AZ;
    let best = -90, bestD = NaN;
    for (const b of BANDS) {
      for (let d = b.from; d < b.to; d += b.step) {
        const [la, lo] = destination(lat, lon, a, d);
        const [x, y] = latLonToXY(la, lo);
        const [h, res] = sampleChain(store, b.levels, x, y);
        if (Number.isNaN(h)) continue;
        if (b === BANDS[0] && (nearRes === 0 || res < nearRes)) nearRes = res;
        const th = d / R_M;
        const r = R_M + h;
        const ang = Math.atan2(r * Math.cos(th) - r0, r * Math.sin(th)) / DEG;
        if (ang > best) { best = ang; bestD = d; }
      }
    }
    az.push(a); el.push(best); dist.push(bestD / 1000);
  }
  const s = slopes(store, siteRes, x0, y0);
  return {
    mask: { az, el, dist, source: `Calcul à la demande — relief ${nearRes} m près du site, jusqu'à 480 m au loin` },
    elevation_m: h0,
    site_res_m: siteRes,
    near_res_m: nearRes,
    slope_local_deg: s.local,
    slope_mean_100m_deg: s.mean,
    slope_max_100m_deg: s.max,
    obstacle_dist_km: dist,
    tiles: store.tilesFetched - before.n,
    megabytes: (store.bytesFetched - before.b) / 1e6,
    ms: Date.now() - t0,
  };
}
