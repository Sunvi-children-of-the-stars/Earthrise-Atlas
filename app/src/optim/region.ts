/** Regional horizon maps (scripts/build_horizon_maps.py) and permanent shadows (scripts/build_psr.py). */
import { xyToLatLon } from "../astro/horizon";

export interface RegionMeta {
  id: string; name: string; pixel_m: number; width: number; height: number;
  x_min_m: number; y_max_m: number; n_az: number; az_step_deg: number; observer_height_m: number;
  files: { horizon: string; elevation: string; slope_mean: string; slope_max: string; psr?: string; sunmax?: string };
}

export interface RegionData {
  meta: RegionMeta;
  hz: Int16Array;          // [row][col][az], centidegrees
  elev: Int16Array;        // m
  slopeMean: Int16Array;   // tenths of a degree
  slopeMax: Int16Array;
  psr: Uint8Array;         // 1 = permanently shadowed (empty if not computed)
  psrDistKm: Float32Array; // distance to the nearest permanently shadowed pixel (km; Infinity if none)
}

export interface RegionIndexEntry { id: string; name: string; file: string }

export async function loadRegionIndex(baseUrl: string): Promise<RegionIndexEntry[]> {
  const r = await fetch(`${baseUrl}index.json`, { cache: "no-cache" });
  if (!r.ok) throw new Error("index des régions introuvable");
  return r.json();
}

/**
 * Distance (km) from every pixel to the nearest seed pixel (seed = 1), by propagating the nearest
 * seed's coordinates in two passes (8 neighbours). Very close to the exact Euclidean distance.
 */
export function distanceTransform(seed: Uint8Array, W: number, H: number, pixelKm: number): Float32Array {
  const N = W * H;
  const out = new Float32Array(N).fill(Infinity);
  if (seed.length !== N) return out;
  const sx = new Int32Array(N).fill(-1), sy = new Int32Array(N).fill(-1);
  for (let p = 0; p < N; p++) if (seed[p]) { sx[p] = p % W; sy[p] = Math.floor(p / W); }
  const d2 = (p: number, x: number, y: number) => sx[p] < 0 ? Infinity : (sx[p] - x) ** 2 + (sy[p] - y) ** 2;
  const relax = (p: number, q: number, x: number, y: number) => {
    if (sx[q] < 0) return;
    if ((sx[q] - x) ** 2 + (sy[q] - y) ** 2 < d2(p, x, y)) { sx[p] = sx[q]; sy[p] = sy[q]; }
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = y * W + x;
    if (x > 0) relax(p, p - 1, x, y);
    if (y > 0) { relax(p, p - W, x, y); if (x > 0) relax(p, p - W - 1, x, y); if (x < W - 1) relax(p, p - W + 1, x, y); }
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const p = y * W + x;
    if (x < W - 1) relax(p, p + 1, x, y);
    if (y < H - 1) { relax(p, p + W, x, y); if (x < W - 1) relax(p, p + W + 1, x, y); if (x > 0) relax(p, p + W - 1, x, y); }
  }
  for (let p = 0; p < N; p++) out[p] = Math.sqrt(d2(p, p % W, Math.floor(p / W))) * pixelKm;
  return out;
}

/** Loads a region; the main thread skips the (large) horizon cube, only the worker needs it. */
export async function loadRegion(baseUrl: string, file: string, withHorizon = true): Promise<RegionData> {
  const metaResp = await fetch(`${baseUrl}${file}`, { cache: "no-cache" });
  if (!metaResp.ok) throw new Error(`région ${file} introuvable`);
  const meta: RegionMeta = await metaResp.json();
  const get = async (f: string) => new Int16Array(await (await fetch(`${baseUrl}${f}`)).arrayBuffer());
  const [hz, elev, slopeMean, slopeMax, psrBuf] = await Promise.all([
    withHorizon ? get(meta.files.horizon) : Promise.resolve(new Int16Array(0)),
    get(meta.files.elevation), get(meta.files.slope_mean), get(meta.files.slope_max),
    meta.files.psr ? fetch(`${baseUrl}${meta.files.psr}`).then((r) => r.arrayBuffer()) : Promise.resolve(new ArrayBuffer(0)),
  ]);
  const psr = new Uint8Array(psrBuf);
  const psrDistKm = withHorizon ? new Float32Array(0) : distanceTransform(psr, meta.width, meta.height, meta.pixel_m / 1000);
  return { meta, hz, elev, slopeMean, slopeMax, psr, psrDistKm };
}

/** Pixel center (col, row) → stereographic x, y (m). */
export function pixelXY(m: RegionMeta, col: number, row: number): [number, number] {
  return [m.x_min_m + (col + 0.5) * m.pixel_m, m.y_max_m - (row + 0.5) * m.pixel_m];
}

export function pixelLatLon(m: RegionMeta, col: number, row: number): [number, number] {
  return xyToLatLon(...pixelXY(m, col, row));
}
