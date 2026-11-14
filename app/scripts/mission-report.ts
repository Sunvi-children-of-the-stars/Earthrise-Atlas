/**
 * Mission report used by docs/membre4 and docs/membre5: energy/telecom budget per site and the
 * best landing dates, with the same code as the app.  Run: npm run mission-report
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { makeEphemerisTable, setEphemerisTable } from "../src/astro/ephemeris";
import { metrics, simulate } from "../src/astro/analysis";
import { budget, VEHICLES } from "../src/astro/budget";
import { explain, scanSite, scoreScans, topCandidates } from "../src/astro/landing";
import type { HorizonMask } from "../src/astro/horizon";

const DATA = join(process.cwd(), "..", "data");
const sites = JSON.parse(readFileSync(join(DATA, "sites", "sites.json"), "utf8")).sites
  .filter((s: { category: string }) => s.category === "candidat");
const metaFile: string = JSON.parse(readFileSync(join(DATA, "ephemeris", "index.json"), "utf8"))[0];
const meta = JSON.parse(readFileSync(join(DATA, "ephemeris", metaFile), "utf8"));
const buf = readFileSync(join(DATA, "ephemeris", meta.file));
setEphemerisTable(makeEphemerisTable(meta, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)));
const mask = (id: string): HorizonMask => {
  const h = JSON.parse(readFileSync(join(DATA, "horizons", `${id}.json`), "utf8"));
  return { az: h.azimuth_deg, el: h.horizon_elev_deg, source: "precalc", dist: h.obstacle_dist_km };
};
const iso = (t: number) => new Date(t).toISOString().slice(0, 16).replace("T", " ");
const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1] ?? d;

const from = Date.parse(arg("from", "2027-01-01") + "T00:00:00Z");
const months = +arg("months", "12"), missionDays = +arg("days", "14");
console.log(`== Energy & telecom, one lunar day from ${iso(from)} ==`);
for (const [k, v] of Object.entries(VEHICLES)) {
  console.log(`-- ${v.label}`);
  for (const s of sites) {
    const ss = simulate(s, mask(s.id), from, 29.53 * 24, 30);
    const m = metrics(ss), b = budget(v, ss);
    console.log(`${s.short.padEnd(14)} sun ${m.sunPct.toFixed(0)}% night ${m.longestNightH.toFixed(0)}h flux ${m.meanPowerVertical.toFixed(0)} W/m² | gen ${b.genMeanW.toFixed(0)} W load ${b.loadMeanW.toFixed(0)} W`
      + ` | ${b.survives ? "OK" : "BROWNOUT " + b.brownoutH.toFixed(0) + "h"} minSoc ${b.minSocPct.toFixed(0)}% battNeed ${(b.batteryNeededWh / 1000).toFixed(1)} kWh panelNeed ${b.panelNeededM2 === null ? "impossible" : b.panelNeededM2.toFixed(1) + " m²"}`
      + ` | rate ${b.link ? (b.link.rateBps / 1e6).toFixed(2) : "-"} Mb/s margin ${b.link?.marginDb.toFixed(0)} dB data ${b.dataGb.toFixed(1)} GB`);
  }
}
for (const vk of ["lander", "rover"]) {
  const v = VEHICLES[vk];
  console.log(`\n== Landing scan: ${v.label}, ${missionDays}-day mission, ${months} months from ${iso(from)}, hold 6 h ==`);
  const t = Date.now();
  const scans = sites.map((s: any) => scanSite(s, mask(s.id), v, { from, to: from + months * 30.44 * 86400000, missionDays, everyH: 12, landingHoldH: 6 }));
  scoreScans(scans, missionDays);
  console.log(`(${Date.now() - t} ms)`);
  for (const sc of scans) {
    const ok = sc.candidates.filter((c: any) => c.feasible);
    const best = ok.sort((a: any, b: any) => b.score - a.score)[0];
    const rs: Record<string, number> = {};
    for (const c of sc.candidates) for (const r of c.reasons) { const key = r.replace(/\d+/g, "N"); rs[key] = (rs[key] ?? 0) + 1; }
    console.log(`${sc.siteName}: ${ok.length}/${sc.candidates.length} feasible, best ${best ? best.score.toFixed(1) + " on " + iso(best.start) : "-"}; exclusions ${JSON.stringify(rs)}`);
  }
  for (const [i, c] of topCandidates(scans).entries()) {
    const e = explain(c, missionDays);
    console.log(`#${i + 1} ${c.siteName} ${iso(c.start)} score ${c.score.toFixed(1)} sun ${c.sunPct.toFixed(0)} earth ${c.earthPct.toFixed(0)} night ${c.longestNightH.toFixed(0)}h noEarth ${c.longestNoEarthH.toFixed(0)}h soc ${c.minSocPct.toFixed(0)} data ${c.dataGb.toFixed(1)} | + ${e.pros.join("; ")} | - ${e.cons.join("; ")}`);
  }
}
