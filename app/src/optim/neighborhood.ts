/**
 * "1 km further": how the indicators change around a site, from a regional evaluation
 * (evaluate.ts). Pure functions, no UI. They answer the question the challenge highlights:
 * why does a small change of location have a large impact?
 *
 *  - pointMetrics(): indicators of the 200 m cell containing a point;
 *  - transect():     indicators every `stepKm` along a line through the site;
 *  - neighborhood(): range of each indicator within a radius, the share of nearby cells
 *                    that do better, and the steepest change per km (sensitivity).
 */
import { destination, latLonToXY } from "../astro/horizon";
import type { RegionMetrics } from "./evaluate";
import { pixelLatLon, type RegionData, type RegionMeta } from "./region";

export interface CellMetrics {
  lat: number; lon: number; col: number; row: number;
  sunPct: number; nightH: number; earthPct: number; outageH: number; bothPct: number; flux: number;
  slope: number;      // mean slope of the cell (°)
  elevation: number;  // m
  psrKm: number;      // km to the nearest permanent shadow (NaN if unknown)
}

/** Pixel (col, row) of a point, or null if outside the region. */
export function pixelOf(meta: RegionMeta, lat: number, lon: number): [number, number] | null {
  const [x, y] = latLonToXY(lat, lon);
  const col = Math.floor((x - meta.x_min_m) / meta.pixel_m);
  const row = Math.floor((meta.y_max_m - y) / meta.pixel_m);
  return col >= 0 && row >= 0 && col < meta.width && row < meta.height ? [col, row] : null;
}

/** True if the point lies in the region, at least `marginKm` from its edge. */
export function regionContains(meta: RegionMeta, lat: number, lon: number, marginKm = 0): boolean {
  const px = pixelOf(meta, lat, lon);
  if (!px) return false;
  const m = Math.ceil((marginKm * 1000) / meta.pixel_m);
  return px[0] >= m && px[1] >= m && px[0] < meta.width - m && px[1] < meta.height - m;
}

function cell(region: RegionData, m: RegionMetrics, col: number, row: number): CellMetrics {
  const p = row * m.width + col;
  const [lat, lon] = pixelLatLon(region.meta, col, row);
  return {
    lat, lon, col, row,
    sunPct: m.sunPct[p], nightH: m.nightH[p], earthPct: m.earthPct[p], outageH: m.outageH[p],
    bothPct: m.bothPct[p], flux: m.flux[p],
    slope: region.slopeMean[p] / 10, elevation: region.elev[p],
    psrKm: region.psrDistKm.length ? region.psrDistKm[p] : NaN,
  };
}

export function pointMetrics(region: RegionData, m: RegionMetrics, lat: number, lon: number): CellMetrics | null {
  const px = pixelOf(region.meta, lat, lon);
  return px ? cell(region, m, px[0], px[1]) : null;
}

export interface TransectPoint extends CellMetrics { distKm: number }

/**
 * Indicators along a line through (lat, lon), from −halfLengthKm to +halfLengthKm in the
 * direction `azDeg` (0 = local north, clockwise). Points outside the region are skipped.
 */
export function transect(region: RegionData, m: RegionMetrics, lat: number, lon: number,
  azDeg: number, halfLengthKm = 2, stepKm = 0.2): TransectPoint[] {
  const out: TransectPoint[] = [];
  const n = Math.round(halfLengthKm / stepKm);
  for (let i = -n; i <= n; i++) {
    const d = i * stepKm;
    const [la, lo] = d === 0 ? [lat, lon] : destination(lat, lon, d >= 0 ? azDeg : azDeg + 180, Math.abs(d) * 1000);
    const c = pointMetrics(region, m, la, lo);
    if (c) out.push({ ...c, distKm: d });
  }
  return out;
}

export type Indicator = "sunPct" | "nightH" | "earthPct" | "outageH" | "bothPct";
/** Direction of "better" for each indicator. */
export const HIGHER_IS_BETTER: Record<Indicator, boolean> = {
  sunPct: true, nightH: false, earthPct: true, outageH: false, bothPct: true,
};

export interface IndicatorSpread {
  site: number; min: number; max: number;
  /** % of feasible cells within the radius that do strictly better than the site. */
  betterPct: number;
  /** Largest change between the site and a cell ≤ 1 km away (indicator units). */
  within1km: number;
  /** Best cell for this indicator within the radius. */
  best: { lat: number; lon: number; value: number; distKm: number };
}

export interface Neighborhood {
  site: CellMetrics;
  radiusKm: number;
  cells: number;           // cells considered (slope ≤ slopeMax, valid elevation)
  indicators: Record<Indicator, IndicatorSpread>;
}

/**
 * Spread of the indicators within `radiusKm` of the site, among cells with a mean slope
 * ≤ `slopeMax` (default: any). Null if the site is outside the region.
 */
export function neighborhood(region: RegionData, m: RegionMetrics, lat: number, lon: number,
  radiusKm = 2, slopeMax = 90): Neighborhood | null {
  const px = pixelOf(region.meta, lat, lon);
  if (!px) return null;
  const site = cell(region, m, px[0], px[1]);
  const pk = region.meta.pixel_m / 1000;
  const R = Math.ceil(radiusKm / pk);
  const keys = Object.keys(HIGHER_IS_BETTER) as Indicator[];
  const acc = Object.fromEntries(keys.map((k) => [k, {
    site: site[k], min: site[k], max: site[k], better: 0, within1km: 0,
    best: { lat: site.lat, lon: site.lon, value: site[k], distKm: 0 },
  }])) as Record<Indicator, { site: number; min: number; max: number; better: number; within1km: number; best: IndicatorSpread["best"] }>;
  let n = 0;
  for (let dr = -R; dr <= R; dr++) for (let dc = -R; dc <= R; dc++) {
    const c = px[0] + dc, r = px[1] + dr;
    if (c < 0 || r < 0 || c >= m.width || r >= m.height) continue;
    const dist = Math.hypot(dc, dr) * pk;
    if (dist > radiusKm) continue;
    const p = r * m.width + c;
    if (region.elev[p] <= -20000 || region.slopeMean[p] / 10 > slopeMax) continue;
    n++;
    for (const k of keys) {
      const v = (m as unknown as Record<Indicator, Float32Array>)[k][p];
      const a = acc[k];
      a.min = Math.min(a.min, v); a.max = Math.max(a.max, v);
      const better = HIGHER_IS_BETTER[k] ? v > a.site : v < a.site;
      if (better) a.better++;
      if (dist <= 1) a.within1km = Math.max(a.within1km, Math.abs(v - a.site));
      const beats = HIGHER_IS_BETTER[k] ? v > a.best.value : v < a.best.value;
      if (beats || (v === a.best.value && dist < a.best.distKm)) {
        const [la, lo] = pixelLatLon(region.meta, c, r);
        a.best = { lat: la, lon: lo, value: v, distKm: dist };
      }
    }
  }
  const indicators = Object.fromEntries(keys.map((k) => {
    const a = acc[k];
    return [k, { site: a.site, min: a.min, max: a.max, betterPct: n ? (100 * a.better) / n : 0, within1km: a.within1km, best: a.best }];
  })) as Record<Indicator, IndicatorSpread>;
  return { site, radiusKm, cells: n, indicators };
}
