import { R_MOON_KM } from "./ephemeris";

const DEG = Math.PI / 180;
const R_M = R_MOON_KM * 1000;
export const OBSERVER_HEIGHT_M = 2;

export interface HorizonMask {
  az: number[];
  el: number[];
  source: string;
  /** Distance (km) of the obstacle forming the horizon in each direction, when known. */
  dist?: (number | null)[];
}

/** Obstacle distance (km) at an azimuth (nearest direction); NaN when unknown. */
export function obstacleDistAt(mask: HorizonMask, az: number): number {
  if (!mask.dist) return NaN;
  const n = mask.dist.length;
  const v = mask.dist[Math.round((((az % 360) + 360) % 360) / (360 / n)) % n];
  return v ?? NaN;
}

/** Horizon elevation (deg) at a given azimuth, linear interpolation on a regular grid. */
export function horizonAt(mask: HorizonMask, az: number): number {
  const n = mask.el.length;
  const f = (((az % 360) + 360) % 360) / (360 / n);
  const i = Math.floor(f) % n;
  const t = f - Math.floor(f);
  return mask.el[i] * (1 - t) + mask.el[(i + 1) % n] * t;
}

export function flatMask(elevation_m: number, source = "Sol lisse (pas de relief)"): HorizonMask {
  const r = R_M + elevation_m;
  const dip = -Math.acos(r / (r + OBSERVER_HEIGHT_M)) / DEG;
  const az = Array.from({ length: 360 }, (_, i) => i);
  return { az, el: az.map(() => dip), source };
}

export async function loadMask(id: string): Promise<HorizonMask> {
  const r = await fetch(`data/horizons/${id}.json`);
  const j = await r.json();
  return { az: j.azimuth_deg, el: j.horizon_elev_deg, dist: j.obstacle_dist_km, source: "Précalcul LOLA (membre 2)" };
}

// ----------------------------------------------------------------------------
// Reduced DEM (1.2 km/px) for the map and for custom sites
// ----------------------------------------------------------------------------
const FULL_SCALE = 120;
const FULL_CENTER = 3811.5;

export interface Dem {
  rows: number;
  cols: number;
  factor: number;
  data: Int16Array;
  min: number;
  max: number;
}

export async function loadDem(): Promise<Dem> {
  const meta = await (await fetch("data/dem/south_pole_dem_1200m.json")).json();
  const buf = await (await fetch(`data/dem/${meta.file}`)).arrayBuffer();
  return {
    rows: meta.rows, cols: meta.cols, factor: meta.pixel_m / FULL_SCALE,
    data: new Int16Array(buf), min: meta.min_m, max: meta.max_m,
  };
}

export function latLonToXY(lat: number, lon: number): [number, number] {
  const k = 2 * R_M * Math.tan(Math.PI / 4 + (lat * DEG) / 2);
  return [k * Math.sin(lon * DEG), k * Math.cos(lon * DEG)];
}

export function xyToLatLon(x: number, y: number): [number, number] {
  const lat = (2 * Math.atan(Math.hypot(x, y) / (2 * R_M)) - Math.PI / 2) / DEG;
  return [lat, Math.atan2(x, y) / DEG];
}

/** Stereographic x, y (m) → fractional pixel (col, row) of the reduced DEM. */
export function xyToPx(dem: Dem, x: number, y: number): [number, number] {
  const off = (dem.factor - 1) / 2;
  return [
    (x / FULL_SCALE + FULL_CENTER - off) / dem.factor,
    (FULL_CENTER - y / FULL_SCALE - off) / dem.factor,
  ];
}

export function pxToXY(dem: Dem, col: number, row: number): [number, number] {
  const off = (dem.factor - 1) / 2;
  return [
    (col * dem.factor + off - FULL_CENTER) * FULL_SCALE,
    (FULL_CENTER - (row * dem.factor + off)) * FULL_SCALE,
  ];
}

export function demSample(dem: Dem, col: number, row: number): number {
  if (!(col >= 0 && row >= 0 && col < dem.cols - 1 && row < dem.rows - 1)) return NaN;
  const c = Math.floor(col), r = Math.floor(row), fc = col - c, fr = row - r;
  const v = (i: number, j: number) => dem.data[i * dem.cols + j];
  return v(r, c) * (1 - fc) * (1 - fr) + v(r, c + 1) * fc * (1 - fr)
    + v(r + 1, c) * (1 - fc) * fr + v(r + 1, c + 1) * fc * fr;
}

export function demElevation(dem: Dem, lat: number, lon: number): number {
  const [x, y] = latLonToXY(lat, lon);
  const [c, r] = xyToPx(dem, x, y);
  return demSample(dem, c, r);
}

export function destination(lat: number, lon: number, az: number, dist: number): [number, number] {
  const la = lat * DEG, lo = lon * DEG, a = az * DEG, d = dist / R_M;
  const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(a));
  const lo2 = lo + Math.atan2(Math.sin(a) * Math.sin(d) * Math.cos(la),
    Math.cos(d) - Math.sin(la) * Math.sin(la2));
  return [la2 / DEG, lo2 / DEG];
}

/** Horizon mask computed in the browser from the reduced DEM (custom sites). */
export function computeMask(dem: Dem, lat: number, lon: number): HorizonMask | null {
  const h0 = demElevation(dem, lat, lon);
  if (Number.isNaN(h0)) return null;
  const step = dem.factor * FULL_SCALE;
  const r0 = R_M + h0 + OBSERVER_HEIGHT_M;
  const az: number[] = [];
  const el: number[] = [];
  for (let a = 0; a < 360; a += 1) {
    let best = -90;
    for (let s = step; s < 300_000; s += step) {
      const [la, lo] = destination(lat, lon, a, s);
      const [x, y] = latLonToXY(la, lo);
      const [c, r] = xyToPx(dem, x, y);
      const h = demSample(dem, c, r);
      if (Number.isNaN(h)) break;
      const th = s / R_M;
      const rr = R_M + h;
      const ang = Math.atan2(rr * Math.cos(th) - r0, rr * Math.sin(th)) / DEG;
      if (ang > best) best = ang;
    }
    az.push(a);
    el.push(best);
  }
  return { az, el, source: "MNT réduit 1,2 km (calcul dans le navigateur, approximatif)" };
}
