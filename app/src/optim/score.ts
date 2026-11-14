/**
 * Scoring and zone extraction. Fast (no ephemeris): recomputed live when the user changes the
 * profile, a weight or a constraint. Criteria and weights are meant to be tuned by member 5.
 */
import type { RegionMetrics } from "./evaluate";
import { pixelLatLon, type RegionData } from "./region";

export type Criterion = "sun" | "night" | "earth" | "outage" | "both" | "flux" | "ice";

/** Beyond this distance (km) to a permanent shadow, the "ice proximity" criterion is 0. */
export const ICE_RANGE_KM = 10;

export const CRITERIA: { id: Criterion; label: string; hint: string }[] = [
  { id: "sun", label: "Ensoleillement", hint: "Part du temps au Soleil (énergie)" },
  { id: "night", label: "Nuit courte", hint: "Plus longue période sans Soleil (batteries, froid) : plus c'est court, mieux c'est" },
  { id: "flux", label: "Flux solaire", hint: "Flux moyen sur un panneau vertical orientable" },
  { id: "earth", label: "Terre visible", hint: "Part du temps avec liaison directe possible" },
  { id: "outage", label: "Coupure courte", hint: "Plus longue période sans Terre : plus c'est court, mieux c'est" },
  { id: "both", label: "Soleil + Terre", hint: "Énergie et liaison directe en même temps" },
  { id: "ice", label: "Proximité glace", hint: `Proche d'une zone d'ombre permanente (pièges froids où la glace d'eau peut subsister) : 1 sur place, 0 à ${ICE_RANGE_KM} km ou plus` },
];

export interface Constraints {
  slopeMax: number;      // ° (mean slope in the 200 m cell)
  nightMaxH: number;     // h
  earthMinPct: number;   // %
  sunMinPct: number;     // %
  psrMaxKm: number;      // km to the nearest permanent shadow (≥ 50 = no constraint)
  onlyArtemis?: boolean; // keep only pixels inside an official Artemis III candidate region
}

export interface Profile { id: string; label: string; description: string; weights: Record<Criterion, number>; constraints: Constraints }

const W0: Record<Criterion, number> = { sun: 0, night: 0, flux: 0, earth: 0, outage: 0, both: 0, ice: 0 };
export const NO_PSR_LIMIT = 50;

export const PROFILES: Profile[] = [
  {
    id: "lander", label: "Atterrisseur solaire",
    description: "Mission courte alimentée par panneaux : beaucoup de Soleil, liaison directe, terrain sûr.",
    weights: { ...W0, sun: 3, both: 2, earth: 1, night: 1 },
    constraints: { slopeMax: 8, nightMaxH: 720, earthMinPct: 0, sunMinPct: 0, psrMaxKm: NO_PSR_LIMIT },
  },
  {
    id: "night", label: "Survie à la nuit",
    description: "Rover ou station longue durée : nuits les plus courtes possible.",
    weights: { ...W0, night: 4, sun: 2, flux: 1 },
    constraints: { slopeMax: 15, nightMaxH: 720, earthMinPct: 0, sunMinPct: 0, psrMaxKm: NO_PSR_LIMIT },
  },
  {
    id: "dte", label: "Liaison directe Terre",
    description: "Pas de relais : la Terre doit rester visible le plus longtemps possible.",
    weights: { ...W0, earth: 3, outage: 2, both: 1 },
    constraints: { slopeMax: 10, nightMaxH: 720, earthMinPct: 60, sunMinPct: 0, psrMaxKm: NO_PSR_LIMIT },
  },
  {
    id: "ice", label: "Science : glace d'eau",
    description: "Se poser au Soleil, à courte distance d'une zone d'ombre permanente où la glace d'eau a pu se piéger.",
    weights: { ...W0, ice: 3, sun: 2, earth: 1, night: 1 },
    constraints: { slopeMax: 10, nightMaxH: 720, earthMinPct: 0, sunMinPct: 30, psrMaxKm: 5 },
  },
  {
    id: "custom", label: "Personnalisé",
    description: "Réglez vous-même les poids et les contraintes.",
    weights: { ...W0, sun: 1, night: 1, earth: 1, both: 1 },
    constraints: { slopeMax: 10, nightMaxH: 720, earthMinPct: 0, sunMinPct: 0, psrMaxKm: NO_PSR_LIMIT },
  },
];

/** Normalized value (0 = worst, 1 = best) of a criterion for pixel p. */
function norm(region: RegionData, m: RegionMetrics, c: Criterion, p: number): number {
  switch (c) {
    case "sun": return m.sunPct[p] / 100;
    case "earth": return m.earthPct[p] / 100;
    case "both": return m.bothPct[p] / 100;
    case "flux": return m.flux[p] / 1361;
    case "night": return 1 - Math.min(1, m.nightH[p] / m.hours);
    case "outage": return 1 - Math.min(1, m.outageH[p] / m.hours);
    case "ice": return region.psrDistKm.length ? 1 - Math.min(1, region.psrDistKm[p] / ICE_RANGE_KM) : 0;
  }
}

export interface Scored { score: Float32Array; feasible: Uint8Array; feasibleCount: number; best: number }

export function scoreRegion(region: RegionData, m: RegionMetrics, weights: Record<Criterion, number>,
  c: Constraints, artemisMask?: Uint8Array): Scored {
  const N = m.width * m.height;
  const score = new Float32Array(N).fill(NaN);
  const feasible = new Uint8Array(N);
  const crit = CRITERIA.map((x) => x.id).filter((k) => weights[k] > 0);
  const wsum = crit.reduce((a, k) => a + weights[k], 0) || 1;
  let count = 0, best = -Infinity;
  for (let p = 0; p < N; p++) {
    const ok = region.slopeMean[p] / 10 <= c.slopeMax && m.nightH[p] <= c.nightMaxH
      && m.earthPct[p] >= c.earthMinPct && m.sunPct[p] >= c.sunMinPct && region.elev[p] > -20000
      && ((c.psrMaxKm ?? NO_PSR_LIMIT) >= NO_PSR_LIMIT || (region.psrDistKm[p] ?? Infinity) <= c.psrMaxKm);
    if (!ok) continue;
    if (c.onlyArtemis && artemisMask && !artemisMask[p]) continue;
    let s = 0;
    for (const k of crit) s += weights[k] * norm(region, m, k, p);
    score[p] = (100 * s) / wsum;
    feasible[p] = 1;
    count++;
    if (score[p] > best) best = score[p];
  }
  return { score, feasible, feasibleCount: count, best };
}

export interface Zone {
  rank: number; pixels: number; areaKm2: number;
  bestCol: number; bestRow: number; lat: number; lon: number;
  score: number; sunPct: number; nightH: number; earthPct: number; outageH: number;
  bothPct: number; slope: number; elevation: number; psrKm: number;
  artemis: string | null; // official Artemis III region containing the best point
}

/**
 * Zones = connected groups (8-neighbours) of feasible pixels whose score is within `tolerance`
 * points of the best feasible score. Ranked by best score, then by area.
 */
export function extractZones(region: RegionData, m: RegionMetrics, s: Scored, tolerance: number, max = 6,
  artemis?: { mask: Uint8Array; names: string[] }): Zone[] {
  const W = m.width, H = m.height, N = W * H;
  const thr = s.best - tolerance;
  const label = new Int32Array(N).fill(-1);
  const zones: Zone[] = [];
  const area = (region.meta.pixel_m / 1000) ** 2;
  for (let p0 = 0; p0 < N; p0++) {
    if (label[p0] >= 0 || !s.feasible[p0] || !(s.score[p0] >= thr)) continue;
    const id = zones.length;
    const stack = [p0];
    label[p0] = id;
    let n = 0, bp = p0;
    while (stack.length) {
      const p = stack.pop()!;
      n++;
      if (s.score[p] > s.score[bp]) bp = p;
      const r = Math.floor(p / W), c = p % W;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= H || cc >= W) continue;
        const q = rr * W + cc;
        if (label[q] < 0 && s.feasible[q] && s.score[q] >= thr) { label[q] = id; stack.push(q); }
      }
    }
    const bc = bp % W, br = Math.floor(bp / W);
    const [lat, lon] = pixelLatLon(region.meta, bc, br);
    zones.push({
      rank: 0, pixels: n, areaKm2: n * area, bestCol: bc, bestRow: br, lat, lon,
      score: s.score[bp], sunPct: m.sunPct[bp], nightH: m.nightH[bp], earthPct: m.earthPct[bp],
      outageH: m.outageH[bp], bothPct: m.bothPct[bp], slope: region.slopeMean[bp] / 10, elevation: region.elev[bp],
      psrKm: region.psrDistKm.length ? region.psrDistKm[bp] : NaN,
      artemis: artemis && artemis.mask[bp] ? artemis.names[artemis.mask[bp] - 1] : null,
    });
  }
  zones.sort((a, b) => b.score - a.score || b.areaKm2 - a.areaKm2);
  return zones.slice(0, max).map((z, i) => ({ ...z, rank: i + 1 }));
}
