/**
 * Precomputes the site × lunar-month calendar of the curated sites (A7) into
 * data/calendar/sites.json, so the app (and the final recommendation) can read it directly.
 * Usage (from app/):  npm run calendar -- [YYYY-MM-DD] [months]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bestMonth, calendar, cellGrade } from "../src/astro/calendar";
import { PROFILES } from "../src/optim/score";

// Bundled to node_modules/.cache: resolve from the working directory (npm runs scripts in app/)
const root = join(process.cwd(), "..");
const data = join(root, "data");
const [startArg = "2026-11-01", monthsArg = "13"] = process.argv.slice(2);
const start = Date.parse(startArg + "T00:00Z");
const months = Number(monthsArg);
if (Number.isNaN(start) || !(months >= 1 && months <= 40)) throw new Error("usage: [YYYY-MM-DD] [months 1-40]");

const sites = JSON.parse(readFileSync(join(data, "sites", "sites.json"), "utf8")).sites;
const entries = sites.map((s: any) => {
  const j = JSON.parse(readFileSync(join(data, "horizons", `${s.id}.json`), "utf8"));
  return { id: s.id, site: { lat: s.lat, lon: s.lon, elevation_m: s.elevation_m },
    mask: { az: j.azimuth_deg, el: j.horizon_elev_deg, dist: j.obstacle_dist_km, source: "LOLA" } };
});
const t0 = Date.now();
const cal = calendar(entries, start, months);
const r1 = (x: number) => Math.round(x * 10) / 10;
const out = {
  generated: new Date().toISOString(),
  method: "app/src/astro/calendar.ts : un jour lunaire (29,53 j) par case, pas de 2 h, horizons précalculés",
  start: new Date(start).toISOString(), months, month_starts: cal.monthStarts.map((t) => new Date(t).toISOString()),
  profiles: PROFILES.filter((p) => p.id !== "custom").map((p) => ({ id: p.id, label: p.label })),
  sites: cal.rows.map((row) => ({
    id: row.id,
    cells: row.cells.map((c) => ({
      sun_pct: r1(c.sunPct), longest_night_h: r1(c.longestNightH), earth_pct: r1(c.earthPct),
      longest_no_earth_h: r1(c.longestNoEarthH), both_pct: r1(c.bothPct), mean_flux_wm2: Math.round(c.meanFlux),
      grades: Object.fromEntries(PROFILES.filter((p) => p.id !== "custom").map((p) => [p.id, r1(cellGrade(c, p.weights))])),
    })),
    best_month: Object.fromEntries(PROFILES.filter((p) => p.id !== "custom").map((p) => [p.id, bestMonth(row, p.weights)])),
  })),
};
mkdirSync(join(data, "calendar"), { recursive: true });
writeFileSync(join(data, "calendar", "sites.json"), JSON.stringify(out, null, 1));
console.log(`calendar: ${entries.length} sites × ${months} months in ${Date.now() - t0} ms -> data/calendar/sites.json`);
