/**
 * Official Artemis III candidate landing regions (NASA, August 2022 list, via Moon Trek).
 * The polygons are defined in latitude/longitude: their edges are densified before projection
 * to polar stereographic, so that outlines and point-in-region tests follow the real shape.
 */
import { latLonToXY } from "./horizon";

export interface ArtemisRegion {
  name: string;
  xy: [number, number][];      // densified outline, stereographic (m)
  center: [number, number];    // label position (m)
}

export interface ArtemisRegionSet { regions: ArtemisRegion[]; note: string; listYear: number }

const STEPS_PER_EDGE = 40;

function densify(ring: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < ring.length - 1; i++) {
    const [lon1, lat1] = ring[i], [lon2, lat2] = ring[i + 1];
    for (let k = 0; k < STEPS_PER_EDGE; k++) {
      const t = k / STEPS_PER_EDGE;
      out.push(latLonToXY(lat1 + (lat2 - lat1) * t, lon1 + (lon2 - lon1) * t));
    }
  }
  return out;
}

export async function loadArtemisRegions(): Promise<ArtemisRegionSet> {
  const r = await fetch("data/sites/artemis3_regions_2022.geojson");
  if (!r.ok) throw new Error("régions Artemis III introuvables");
  const g = await r.json();
  const regions: ArtemisRegion[] = [];
  for (const f of g.features ?? []) {
    const geom = f.geometry;
    const rings: [number, number][][] = geom.type === "Polygon" ? [geom.coordinates[0]]
      : geom.type === "MultiPolygon" ? geom.coordinates.map((p: [number, number][][]) => p[0]) : [];
    for (const ring of rings) {
      const xy = densify(ring);
      const cx = xy.reduce((a, p) => a + p[0], 0) / xy.length;
      const cy = xy.reduce((a, p) => a + p[1], 0) / xy.length;
      regions.push({ name: f.properties.name, xy, center: [cx, cy] });
    }
  }
  return { regions, note: g.note ?? "", listYear: 2022 };
}

function inside(poly: [number, number][], x: number, y: number): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** Name of the Artemis III region containing the point, or null. */
export function artemisRegionAt(set: ArtemisRegionSet | null, lat: number, lon: number): string | null {
  if (!set) return null;
  const [x, y] = latLonToXY(lat, lon);
  for (const r of set.regions) if (inside(r.xy, x, y)) return r.name;
  return null;
}

/** Distance (km) from a point to the nearest region outline (0 inside). */
export function distanceToArtemisKm(set: ArtemisRegionSet | null, lat: number, lon: number): { name: string; km: number } | null {
  if (!set || !set.regions.length) return null;
  const [x, y] = latLonToXY(lat, lon);
  let best = { name: "", km: Infinity };
  for (const r of set.regions) {
    if (inside(r.xy, x, y)) return { name: r.name, km: 0 };
    for (const [px, py] of r.xy) {
      const d = Math.hypot(px - x, py - y) / 1000;
      if (d < best.km) best = { name: r.name, km: d };
    }
  }
  return best;
}

/**
 * Rasterizes the regions onto a regional grid (scripts/build_horizon_maps.py layout):
 * mask[p] = 1 + index of the region containing pixel p's center, 0 outside.
 * Only pixels inside each region's bounding box are tested.
 */
export function rasterizeRegions(set: ArtemisRegionSet | null,
  grid: { width: number; height: number; pixel_m: number; x_min_m: number; y_max_m: number }): Uint8Array {
  const { width: W, height: H, pixel_m: s, x_min_m: x0, y_max_m: y0 } = grid;
  const mask = new Uint8Array(W * H);
  if (!set) return mask;
  set.regions.forEach((r, k) => {
    const xs = r.xy.map((p) => p[0]), ys = r.xy.map((p) => p[1]);
    const c0 = Math.max(0, Math.floor((Math.min(...xs) - x0) / s)), c1 = Math.min(W - 1, Math.ceil((Math.max(...xs) - x0) / s));
    const r0 = Math.max(0, Math.floor((y0 - Math.max(...ys)) / s)), r1 = Math.min(H - 1, Math.ceil((y0 - Math.min(...ys)) / s));
    for (let row = r0; row <= r1; row++) for (let col = c0; col <= c1; col++) {
      if (inside(r.xy, x0 + (col + 0.5) * s, y0 - (row + 0.5) * s)) mask[row * W + col] = k + 1;
    }
  });
  return mask;
}
