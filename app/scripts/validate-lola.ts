/**
 * Long-term average Sun and Earth visibility, computed with our method, for comparison with the
 * official LOLA maps (Mazarico et al. 2011: hourly averages over an 18.6-year nutation cycle).
 *
 * - every pixel of the optimizer regions (horizon maps, 72 directions, 200 m);
 * - the precomputed site horizons (720 directions).
 * Times: N instants spread over 18.6 years (step not commensurate with the lunar month).
 * Outputs (data/validation_lola/): ours_<region>_sun.f32, ours_<region>_earth.f32, ours_sites.json,
 * sun_vectors.json (the Sun directions used, for scripts/validate_curvature.py).
 * The comparison itself is done by scripts/validate_lola.py.
 *
 * Run: npm run validate-lola
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { altAz, bodiesFixed, R_MOON_KM } from "../src/astro/ephemeris";
import { horizonAt, type HorizonMask } from "../src/astro/horizon";
import { pixelLatLon, type RegionMeta } from "../src/optim/region";

const DATA = join(process.cwd(), "..", "data");
const OUT = join(DATA, "validation_lola");
const DEG = Math.PI / 180;
const SUN_DIAM = 0.533;
const N = 2400;
const START = Date.UTC(2010, 0, 1);
const SPAN = 18.6 * 365.25 * 86_400_000;
const times = Array.from({ length: N }, (_, k) => START + ((k + 0.5) / N) * SPAN);
const bodies = times.map((t) => bodiesFixed(new Date(t)));

function region(id: string) {
  const meta: RegionMeta = JSON.parse(readFileSync(join(DATA, "horizon_maps", `${id}.json`), "utf8"));
  const rd = (f: string) => { const b = readFileSync(join(DATA, "horizon_maps", f)); return new Int16Array(b.buffer, b.byteOffset, b.byteLength / 2); };
  const hz = rd(meta.files.horizon), elev = rd(meta.files.elevation);
  const W = meta.width, H = meta.height, NA = meta.n_az, AZS = meta.az_step_deg;
  const sun = new Float32Array(W * H), earth = new Float32Array(W * H);
  const t0 = Date.now();
  for (let row = 0; row < H; row++) {
    for (let col = 0; col < W; col++) {
      const p = row * W + col;
      const [lat, lon] = pixelLatLon(meta, col, row);
      const la = lat * DEG, lo = lon * DEG;
      const up = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
      const east = [-Math.sin(lo), Math.cos(lo), 0];
      const north = [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)];
      const r = R_MOON_KM + (elev[p] + meta.observer_height_m) / 1000;
      const hAt = (az: number) => {
        const f = az / AZS, i = Math.floor(f) % NA, t = f - Math.floor(f);
        return (hz[p * NA + i] * (1 - t) + hz[p * NA + ((i + 1) % NA)] * t) / 100;
      };
      let s = 0, e = 0;
      for (const b of bodies) {
        const sn = Math.hypot(...b.sun);
        const sx = b.sun[0] / sn, sy = b.sun[1] / sn, sz = b.sun[2] / sn;
        const sAlt = Math.asin(sx * up[0] + sy * up[1] + sz * up[2]) / DEG;
        const sAz = (Math.atan2(sx * east[0] + sy * east[1], sx * north[0] + sy * north[1] + sz * north[2]) / DEG + 360) % 360;
        s += Math.min(1, Math.max(0, (sAlt - hAt(sAz)) / SUN_DIAM + 0.5));
        const vx = b.earth[0] - r * up[0], vy = b.earth[1] - r * up[1], vz = b.earth[2] - r * up[2];
        const vn = Math.hypot(vx, vy, vz);
        const eAlt = Math.asin((vx * up[0] + vy * up[1] + vz * up[2]) / vn) / DEG;
        const eAz = (Math.atan2(vx * east[0] + vy * east[1], vx * north[0] + vy * north[1] + vz * north[2]) / DEG + 360) % 360;
        if (eAlt > hAt(eAz)) e++;
      }
      sun[p] = s / N;
      earth[p] = e / N;
    }
  }
  writeFileSync(join(OUT, `ours_${id}_sun.f32`), Buffer.from(sun.buffer));
  writeFileSync(join(OUT, `ours_${id}_earth.f32`), Buffer.from(earth.buffer));
  console.log(`${id}: ${W}×${H} pixels, ${N} instants, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

function sites() {
  const list = JSON.parse(readFileSync(join(DATA, "sites", "sites.json"), "utf8")).sites;
  const out: Record<string, { lat: number; lon: number; sun: number; earth: number }> = {};
  for (const s of list) {
    if (!s.in_dem) continue;
    const h = JSON.parse(readFileSync(join(DATA, "horizons", `${s.id}.json`), "utf8"));
    const mask: HorizonMask = { az: h.azimuth_deg, el: h.horizon_elev_deg, source: "precalc" };
    let sun = 0, earth = 0;
    for (const b of bodies) {
      const p = altAz(s, b.sun);
      sun += Math.min(1, Math.max(0, (p.alt - horizonAt(mask, p.az)) / SUN_DIAM + 0.5));
      const q = altAz(s, b.earth);
      if (q.alt > horizonAt(mask, q.az)) earth++;
    }
    out[s.id] = { lat: s.lat, lon: s.lon, sun: sun / N, earth: earth / N };
  }
  writeFileSync(join(OUT, "ours_sites.json"), JSON.stringify(out, null, 2));
  console.log(`sites: ${Object.keys(out).length}`);
}

writeFileSync(join(OUT, "sun_vectors.json"), JSON.stringify(bodies.map((b) => { const n = Math.hypot(...b.sun); return b.sun.map((x) => +(x / n).toFixed(7)); })));
sites();
for (const id of JSON.parse(readFileSync(join(DATA, "horizon_maps", "index.json"), "utf8")).map((e: { id: string }) => e.id)) region(id);
