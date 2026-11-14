import { describe, expect, test } from "vitest";
import { latLonToXY } from "../../astro/horizon";
import type { RegionMeta } from "../../optim/region";
import { findRegionFor } from "./nearby";

/** Square region of half-size `halfKm` centred on a point (same layout as data/horizon_maps metas). */
const region = (id: string, lat: number, lon: number, halfKm: number): RegionMeta => {
  const [x, y] = latLonToXY(lat, lon);
  return { id, name: id, pixel_m: 200, width: (halfKm * 2000) / 200, height: (halfKm * 2000) / 200,
    x_min_m: x - halfKm * 1000, y_max_m: y + halfKm * 1000, n_az: 72, az_step_deg: 5, observer_height_m: 2,
    files: { horizon: "", elevation: "", slope_mean: "", slope_max: "" } };
};
const metas = [region("pole", -90, 0, 40), region("malapert", -85.988, 2.058, 25)];

describe("région de calcul d'un site", () => {
  test("un site dans une région, avec de la marge, la trouve", () => {
    expect(findRegionFor(-89.439, -137.144, metas)?.id).toBe("pole");
    expect(findRegionFor(-85.988, 2.058, metas)?.id).toBe("malapert");
  });
  test("un site trop près du bord ou en dehors : aucune région", () => {
    const [x, y] = latLonToXY(-85.988, 2.058);
    const edge = [x + 24_500, y]; // 0.5 km from the east edge of malapert
    const rho = Math.hypot(edge[0], edge[1]);
    const lat = (2 * Math.atan(rho / (2 * 1_737_400)) - Math.PI / 2) * 180 / Math.PI;
    const lon = Math.atan2(edge[0], edge[1]) * 180 / Math.PI;
    expect(findRegionFor(lat, lon, metas, 2)).toBeNull();
    expect(findRegionFor(0.67, 23.47, metas)).toBeNull();
  });
});
