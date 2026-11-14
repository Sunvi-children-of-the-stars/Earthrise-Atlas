/** Terrain patch for the 3D view, cut from a 200 m regional map (pure functions). */
import { latLonToXY } from "../../astro/horizon";
import { pixelOf } from "../../optim/neighborhood";
import type { RegionData } from "../../optim/region";

const R_MOON_M = 1_737_400;

export interface TerrainPatch {
  n: number;                  // grid is n × n, row 0 = largest stereographic y
  stepM: number;
  heights: Float32Array;      // m, relative to the site, curvature drop included
  shade: Uint8Array | null;   // LROC photo values (0 = no data), same grid
  siteXY: [number, number];   // stereographic position of the site (m)
}

/** Square of half-size `halfKm` around the site, or null if the site is outside the region. */
export function terrainPatch(region: Pick<RegionData, "meta" | "elev"> & { wac?: Uint8Array | null }, lat: number, lon: number, halfKm: number): TerrainPatch | null {
  const { meta, elev } = region;
  const px = pixelOf(meta, lat, lon);
  if (!px) return null;
  const R = Math.round((halfKm * 1000) / meta.pixel_m), n = 2 * R + 1;
  const [c0, r0] = px;
  const at = (c: number, r: number) => Math.min(meta.height - 1, Math.max(0, r)) * meta.width + Math.min(meta.width - 1, Math.max(0, c));
  const h0 = elev[at(c0, r0)];
  const heights = new Float32Array(n * n);
  const shade = region.wac && region.wac.length === meta.width * meta.height ? new Uint8Array(n * n) : null;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const p = at(c0 - R + j, r0 - R + i);
    const d = Math.hypot(j - R, i - R) * meta.pixel_m;
    heights[i * n + j] = elev[p] - h0 - (d * d) / (2 * R_MOON_M);
    if (shade) shade[i * n + j] = region.wac![p];
  }
  return { n, stepM: meta.pixel_m, heights, shade, siteXY: latLonToXY(lat, lon) };
}

/**
 * Direction on the polar grid (x, y) of an azimuth measured from local north, clockwise, at the
 * stereographic point (x, y). Local north points away from the pole; east is north turned clockwise.
 */
export function azToGrid(azDeg: number, x: number, y: number): [number, number] {
  const rho = Math.hypot(x, y);
  const [nx, ny] = rho > 1 ? [x / rho, y / rho] : [0, 1];
  const [ex, ey] = [ny, -nx];
  const a = (azDeg * Math.PI) / 180;
  return [Math.cos(a) * nx + Math.sin(a) * ex, Math.cos(a) * ny + Math.sin(a) * ey];
}
