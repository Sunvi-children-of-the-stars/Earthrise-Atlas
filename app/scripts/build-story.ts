/**
 * Precomputes the "One kilometre changes everything" chapter: indicators every 100 m along a
 * 4 km line through the Mons Mouton site, over 6.5 days from the Story reference date.
 * Writes data/story/mons-mouton-transect.json. Needs data/horizon_maps/ (not versioned).
 * Usage (from app/):  npm run story
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { evaluateRegion } from "../src/optim/evaluate";
import { transect } from "../src/optim/neighborhood";
import { STORY_START } from "../src/site/story/figures";
import { loadRegionFs, useHorizonsTableFs } from "./lib/fsRegion";

const DATA = join(process.cwd(), "..", "data");
const HOURS = 156;
const AZIMUTH = 90; // west to east through the site: the Earth disappears behind a ridge to the east
const STEP_KM = 0.1, HALF_KM = 2;

useHorizonsTableFs(DATA);
const site = JSON.parse(readFileSync(join(DATA, "sites", "sites.json"), "utf8")).sites.find((s: { id: string }) => s.id === "mons-mouton");
const region = loadRegionFs(DATA, "mons-mouton");
const t0 = Date.now();
const m = evaluateRegion(region, STORY_START, HOURS);
const r1 = (x: number) => Math.round(x * 10) / 10;
const points = transect(region, m, site.lat, site.lon, AZIMUTH, HALF_KM, STEP_KM).map((p) => ({
  distKm: r1(p.distKm), sunPct: r1(p.sunPct), earthPct: r1(p.earthPct), nightH: r1(p.nightH), outageH: r1(p.outageH),
}));
mkdirSync(join(DATA, "story"), { recursive: true });
writeFileSync(join(DATA, "story", "mons-mouton-transect.json"), JSON.stringify({
  site: "mons-mouton", start: new Date(STORY_START).toISOString(), hours: HOURS, azimuthDeg: AZIMUTH, stepKm: STEP_KM,
  method: "app/src/optim/evaluate.ts on the 200 m Mons Mouton horizon map, JPL Horizons table, then optim/neighborhood.ts transect()",
  points,
}, null, 1));
console.log(`story: ${points.length} points in ${Date.now() - t0} ms -> data/story/mons-mouton-transect.json`);
