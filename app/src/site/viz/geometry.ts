/** Pure geometry shared by the charts and maps. */

/** Panorama x for an azimuth (°, from north, clockwise), with `centerAz` in the middle. */
export function azToX(az: number, width: number, centerAz = 180): number {
  const a = (((az - centerAz + 180) % 360) + 360) % 360;
  return (a / 360) * width;
}

/** LROC basemap grid (data/lroc/south_pole_wac_400m.json): 2286 × 2286 px of 400 m, pole-centred. */
export const LROC = { size: 2286, pixel: 400, half: 457_380 };

/** Stereographic x, y (m) → fractional pixel (col, row) of the LROC basemap (pixel centres on integers). */
export function lrocPixel(x: number, y: number): [number, number] {
  return [(x + LROC.half) / LROC.pixel - 0.5, (LROC.half - y) / LROC.pixel - 0.5];
}

export function lrocXY(col: number, row: number): [number, number] {
  return [(col + 0.5) * LROC.pixel - LROC.half, LROC.half - (row + 0.5) * LROC.pixel];
}

/** Round tick values between lo and hi (2°, 5° or 15° apart depending on the span). */
export function niceTicks(lo: number, hi: number): number[] {
  const span = hi - lo;
  const step = span > 40 ? 15 : span > 15 ? 5 : 2;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(v + 0);
  return out.map((v) => (Object.is(v, -0) ? 0 : v));
}
