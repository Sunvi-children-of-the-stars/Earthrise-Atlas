/**
 * Validation of the ephemeris against JPL Horizons, and impact on the results.
 *
 * 1. Angles: Horizons topocentric elevation/azimuth (observer mode, APPARENT='AIRLESS') vs
 *    (a) the built-in series and (b) the Horizons table (member 1).
 * 2. Impact: visibility metrics and rise/set times computed with both, on the real horizon masks.
 *
 * Run: npm run validate-ephemeris   (bundled with esbuild, needs network access to Horizons)
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { altAz, bodiesFixed, makeEphemerisTable, setEphemerisTable, type Site } from "../src/astro/ephemeris";
import { metrics, simulate, windows, sunUp, earthUp, type Sample } from "../src/astro/analysis";
import type { HorizonMask } from "../src/astro/horizon";

const DATA = join(process.cwd(), "..", "data");
const sites: { id: string; name: string; lat: number; lon: number; elevation_m: number }[] =
  JSON.parse(readFileSync(join(DATA, "sites", "sites.json"), "utf8")).sites;
const IDS = ["connecting-ridge", "malapert-massif", "mons-mouton"];
const metaFile: string = JSON.parse(readFileSync(join(DATA, "ephemeris", "index.json"), "utf8"))[0];
const meta = JSON.parse(readFileSync(join(DATA, "ephemeris", metaFile), "utf8"));
const buf = readFileSync(join(DATA, "ephemeris", meta.file));
const tableObj = makeEphemerisTable(meta, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

function loadMask(id: string): HorizonMask {
  const h = JSON.parse(readFileSync(join(DATA, "horizons", `${id}.json`), "utf8"));
  return { az: h.azimuth_deg, el: h.horizon_elev_deg, source: "Précalcul LOLA (membre 2)", dist: h.obstacle_dist_km };
}

async function horizons(site: Site, command: string, start: string, stop: string, step: string) {
  const p = new URLSearchParams({
    format: "json", COMMAND: `'${command}'`, EPHEM_TYPE: "'OBSERVER'", CENTER: "'coord@301'",
    COORD_TYPE: "'GEODETIC'", SITE_COORD: `'${site.lon},${site.lat},${(site.elevation_m ?? 0) / 1000}'`,
    START_TIME: `'${start}'`, STOP_TIME: `'${stop}'`, STEP_SIZE: `'${step}'`, QUANTITIES: "'4'",
    APPARENT: "'AIRLESS'", CSV_FORMAT: "'YES'", ANG_FORMAT: "'DEG'", TIME_DIGITS: "'MINUTES'",
  });
  const res: string = (await (await fetch(`https://ssd.jpl.nasa.gov/api/horizons.api?${p}`)).json()).result;
  const body = res.split("$$SOE")[1].split("$$EOE")[0].trim().split("\n");
  return body.map((l) => {
    const c = l.split(",").map((x) => x.trim());
    return { t: Date.parse(c[0].replace(/^(\d{4})-(\w{3})-(\d{2}) (\d\d:\d\d)$/, "$2 $3 $1 $4 UTC")), az: +c[3], el: +c[4] };
  });
}

const angDiff = (a: number, b: number) => ((a - b + 540) % 360) - 180;
const stats = (v: number[]) => ({ rms: Math.sqrt(v.reduce((s, x) => s + x * x, 0) / v.length), max: Math.max(...v.map(Math.abs)) });
const f3 = (x: number) => x.toFixed(3);

async function angles() {
  console.log("\n== 1. Angles vs Horizons topocentric (2026-11-01 → 2028-12-31, every 12 h) ==");
  console.log("site | body | series: RMS / max elev | table: RMS / max elev | table max az");
  for (const id of IDS) {
    const s = sites.find((x) => x.id === id)!;
    for (const [body, cmd] of [["sun", "10"], ["earth", "399"]] as const) {
      const ref = await horizons(s, cmd, "2026-11-01", "2028-12-31", "12h");
      const res: Record<string, { el: number[]; az: number[] }> = { series: { el: [], az: [] }, table: { el: [], az: [] } };
      for (const mode of ["series", "table"] as const) {
        setEphemerisTable(mode === "table" ? tableObj : null);
        for (const r of ref) {
          const p = altAz(s, bodiesFixed(new Date(r.t))[body]);
          res[mode].el.push(p.alt - r.el);
          if (r.el > -80) res[mode].az.push(angDiff(p.az, r.az));
        }
      }
      const a = stats(res.series.el), b = stats(res.table.el), c = stats(res.table.az);
      console.log(`${id} | ${body} | ${f3(a.rms)} / ${f3(a.max)} | ${f3(b.rms)} / ${f3(b.max)} | ${f3(c.max)}  (${ref.length} pts)`);
    }
  }
}

function transitions(sm: Sample[], pred: (s: Sample) => boolean) {
  return windows(sm, pred).flatMap((w) => [w.openStart ? null : w.start, w.openEnd ? null : w.end]).filter((x): x is number => x !== null);
}

function impact() {
  console.log("\n== 2. Impact on results (series vs Horizons table), 12 lunar months from 2026-11-01, 10-min step ==");
  const start = Date.UTC(2026, 10, 1), hours = 12 * 29.53 * 24;
  for (const id of IDS) {
    const s = sites.find((x) => x.id === id)!;
    const mask = loadMask(id);
    setEphemerisTable(null);
    const a = simulate(s, mask, start, hours, 10);
    setEphemerisTable(tableObj);
    const b = simulate(s, mask, start, hours, 10);
    const ma = metrics(a), mb = metrics(b);
    const shift = (pred: (x: Sample) => boolean) => {
      const ta = transitions(a, pred), tb = transitions(b, pred);
      const d = tb.map((t) => Math.min(...ta.map((u) => Math.abs(u - t))) / 3_600_000);
      return { n: tb.length, med: d.sort((x, y) => x - y)[Math.floor(d.length / 2)] ?? 0, max: Math.max(0, ...d) };
    };
    const ss = shift(sunUp), es = shift(earthUp);
    console.log(`${s.name}: sun ${ma.sunPct.toFixed(2)} → ${mb.sunPct.toFixed(2)} %, earth ${ma.earthPct.toFixed(2)} → ${mb.earthPct.toFixed(2)} %,`
      + ` longest night ${ma.longestNightH.toFixed(1)} → ${mb.longestNightH.toFixed(1)} h, longest no-Earth ${ma.longestNoEarthH.toFixed(1)} → ${mb.longestNoEarthH.toFixed(1)} h`);
    console.log(`   sunrise/sunset shift: ${ss.n} events, median ${ss.med.toFixed(2)} h, max ${ss.max.toFixed(2)} h;`
      + ` Earth rise/set shift: ${es.n} events, median ${es.med.toFixed(2)} h, max ${es.max.toFixed(2)} h`);
  }
}

await angles();
impact();
