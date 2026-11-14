/**
 * Landing-date scan (member 5, decision support).
 *
 * For each site, the whole search interval is simulated once; then every candidate landing time
 * (every `everyH` hours) is scored on the mission that follows it: Sun, Earth, longest night,
 * battery (member 4 vehicle) and data volume. Hard conditions make a date "infeasible":
 *  - Sun and Earth visible during the first hours after landing (power + direct telemetry);
 *  - no energy brownout during the mission.
 * The score also rewards "slip tolerance": how many days the window stays open after this date,
 * i.e. how much launch delay the date tolerates.
 * Weights are documented in docs/membre5_decision.md.
 */
import { simulate, sunUp, earthUp, type Sample } from "./analysis";
import { dataOnSlice, powerOnSlice, type Vehicle } from "./budget";
import type { Site } from "./ephemeris";
import type { HorizonMask } from "./horizon";

export interface LandingParams {
  from: number;           // first landing date tested (UTC ms)
  to: number;             // last landing date tested
  missionDays: number;
  everyH: number;         // spacing of the tested dates
  landingHoldH: number;   // Sun and Earth required during these first hours
}

export const WEIGHTS = { sun: 0.25, earth: 0.2, night: 0.2, slip: 0.15, data: 0.1, battery: 0.1 };
/** Slip tolerance giving the full score (days). */
export const SLIP_FULL_DAYS = 5;

export interface LandingCandidate {
  siteId: string; siteName: string; start: number;
  feasible: boolean; reasons: string[];
  score: number;          // 0–100 (0 if infeasible)
  sunPct: number; earthPct: number; longestNightH: number; longestNoEarthH: number;
  minSocPct: number; brownoutH: number; dataGb: number;
  slipDays: number;       // the following dates stay feasible for this long (launch delay tolerated)
}

export interface SiteScan { siteId: string; siteName: string; candidates: LandingCandidate[] }

const STEP_MIN = 30;

export function scanSite(site: Site & { id: string; short?: string; name: string }, mask: HorizonMask,
  vehicle: Vehicle, p: LandingParams): SiteScan {
  const missionH = p.missionDays * 24;
  const ss: Sample[] = simulate(site, mask, p.from, (p.to - p.from) / 3_600_000 + missionH, STEP_MIN);
  const perStep = STEP_MIN / 60;
  const n = Math.round(missionH / perStep);
  const hold = Math.max(1, Math.round(p.landingHoldH / perStep));
  const every = Math.max(1, Math.round(p.everyH / perStep));
  // Prefix sums for Sun fraction and Earth visibility
  const sunC = new Float64Array(ss.length + 1), earthC = new Float64Array(ss.length + 1);
  ss.forEach((s, i) => { sunC[i + 1] = sunC[i] + s.sunFrac; earthC[i + 1] = earthC[i] + (earthUp(s) ? 1 : 0); });
  const longest = (i0: number, i1: number, pred: (s: Sample) => boolean) => {
    let best = 0, run = 0;
    for (let i = i0; i < i1; i++) { run = pred(ss[i]) ? 0 : run + 1; if (run > best) best = run; }
    return best * perStep;
  };
  const out: LandingCandidate[] = [];
  for (let i0 = 0; i0 + n <= ss.length; i0 += every) {
    const i1 = i0 + n;
    const reasons: string[] = [];
    let landingOk = true;
    for (let i = i0; i < i0 + hold; i++) if (!sunUp(ss[i]) || !earthUp(ss[i])) { landingOk = false; break; }
    if (!landingOk) reasons.push(`Soleil et Terre non visibles tous deux pendant les ${p.landingHoldH} h suivant l'atterrissage`);
    const pw = powerOnSlice(vehicle, ss, i0, i1);
    if (pw.brownoutH > 0) reasons.push(`batterie vide pendant ${Math.round(pw.brownoutH)} h`);
    const sunPct = (100 * (sunC[i1] - sunC[i0])) / n;
    const earthPct = (100 * (earthC[i1] - earthC[i0])) / n;
    const longestNightH = longest(i0, i1, sunUp);
    const longestNoEarthH = longest(i0, i1, earthUp);
    const dataGb = dataOnSlice(vehicle, ss, i0, i1).gb;
    out.push({
      siteId: site.id, siteName: site.short ?? site.name, start: ss[i0].t, feasible: reasons.length === 0, reasons,
      score: 0, sunPct, earthPct, longestNightH, longestNoEarthH, minSocPct: pw.minSocPct, brownoutH: pw.brownoutH, dataGb,
      slipDays: 0,
    });
  }
  // Slip tolerance: length of the run of feasible dates that starts here
  for (let k = out.length - 1; k >= 0; k--) {
    if (!out[k].feasible) continue;
    out[k].slipDays = k + 1 < out.length && out[k + 1].feasible ? out[k + 1].slipDays + p.everyH / 24 : 0;
  }
  return { siteId: site.id, siteName: site.short ?? site.name, candidates: out };
}

/** Scores all candidates together (data volume normalized by the best one). */
export function scoreScans(scans: SiteScan[], missionDays: number): void {
  const all = scans.flatMap((s) => s.candidates);
  const maxData = Math.max(1e-9, ...all.map((c) => c.dataGb));
  const missionH = missionDays * 24;
  for (const c of all) {
    const v = WEIGHTS.sun * (c.sunPct / 100) + WEIGHTS.earth * (c.earthPct / 100)
      + WEIGHTS.night * (1 - Math.min(1, c.longestNightH / missionH))
      + WEIGHTS.slip * Math.min(1, c.slipDays / SLIP_FULL_DAYS)
      + WEIGHTS.data * (c.dataGb / maxData) + WEIGHTS.battery * (c.minSocPct / 100);
    c.score = c.feasible ? 100 * v : 0;
  }
}

/** Best candidates, at most one per half lunar month and per site, so that the list is not one window repeated. */
export function topCandidates(scans: SiteScan[], k = 6): LandingCandidate[] {
  const all = scans.flatMap((s) => s.candidates).filter((c) => c.feasible)
    .sort((a, b) => b.score - a.score || b.slipDays - a.slipDays);
  const out: LandingCandidate[] = [];
  for (const c of all) {
    if (out.some((o) => o.siteId === c.siteId && Math.abs(o.start - c.start) < 15 * 86_400_000)) continue;
    out.push(c);
    if (out.length >= k) break;
  }
  return out;
}

/** Plain-language justification of a candidate. */
export function explain(c: LandingCandidate, missionDays: number): { pros: string[]; cons: string[] } {
  const pros: string[] = [], cons: string[] = [];
  const r = (x: number) => Math.round(x);
  if (c.sunPct >= 90) pros.push(`Soleil ${r(c.sunPct)} % du temps`); else if (c.sunPct < 60) cons.push(`Soleil seulement ${r(c.sunPct)} % du temps`);
  if (c.longestNightH === 0) pros.push("aucune nuit pendant la mission");
  else if (c.longestNightH > 48) cons.push(`une nuit de ${r(c.longestNightH)} h`);
  else pros.push(`nuit la plus longue : ${r(c.longestNightH)} h`);
  if (c.earthPct >= 95) pros.push(`Terre visible ${r(c.earthPct)} % du temps`);
  else if (c.earthPct < 70) cons.push(`Terre cachée ${r(100 - c.earthPct)} % du temps (coupure max ${r(c.longestNoEarthH)} h)`);
  if (c.minSocPct >= 70) pros.push(`batterie jamais sous ${r(c.minSocPct)} %`);
  else cons.push(`batterie descend à ${r(c.minSocPct)} %`);
  if (c.slipDays >= 2) pros.push(`tolère ${r(c.slipDays)} jours de retard au lancement`);
  else cons.push(c.slipDays === 0 ? "aucun retard toléré : la date suivante ne convient plus" : `ne tolère que ${Math.round(c.slipDays * 24)} h de retard`);
  pros.push(`${c.dataGb >= 10 ? r(c.dataGb) : c.dataGb.toFixed(1).replace(".", ",")} Go transmissibles en ${missionDays} jours`);
  return { pros, cons };
}
