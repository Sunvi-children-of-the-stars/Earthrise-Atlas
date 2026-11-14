/**
 * Scoring and zone extraction. Fast (no ephemeris): recomputed live when the user changes the
 * profile, a weight or a constraint. Criteria, weights and profiles are tuned here only.
 */
import type { RegionMetrics } from "./evaluate";
import { pixelLatLon, type RegionData } from "./region";

export type Criterion = "sun" | "night" | "earth" | "outage" | "both" | "flux" | "ice" | "warm" | "subice" | "link" | "nolink";

/** Beyond this distance (km) to a permanent shadow, the "ice proximity" criterion is 0. */
export const ICE_RANGE_KM = 10;
/** Diviner annual mean temperature (2 cm) mapped to 0–1 between these bounds (K): ~50 K in cold
 *  traps, ~200 K on the best-lit ridges of the south polar regions. */
export const TEMP_RANGE_K: [number, number] = [50, 200];
/** "Shallow ice": 1 if water ice is stable at the surface, 0 if it is only stable deeper than this (cm). */
export const ICE_DEPTH_MAX_CM = 100;

export const CRITERIA: { id: Criterion; label: string; hint: string }[] = [
  { id: "sun", label: "Ensoleillement", hint: "Part du temps au Soleil (énergie)" },
  { id: "night", label: "Nuit courte", hint: "Plus longue période sans Soleil (batteries, froid) : plus c'est court, mieux c'est" },
  { id: "flux", label: "Flux solaire", hint: "Flux moyen sur un panneau vertical orientable" },
  { id: "earth", label: "Terre visible", hint: "Part du temps avec liaison directe possible" },
  { id: "outage", label: "Coupure courte", hint: "Plus longue période sans Terre : plus c'est court, mieux c'est" },
  { id: "both", label: "Soleil + Terre", hint: "Énergie et liaison directe en même temps" },
  { id: "link", label: "Terre ou relais", hint: "Part du temps avec la Terre ou le relais LRO (> 5°) : liaison directe ou relayée. Sans orbite du relais pour la période, vaut « Terre visible »" },
  { id: "nolink", label: "Coupure totale courte", hint: "Plus longue période sans Terre ni relais : plus c'est court, mieux c'est. Sans orbite du relais, vaut « Coupure courte »" },
  { id: "ice", label: "Proximité glace", hint: `Proche d'une zone d'ombre permanente (pièges froids où la glace d'eau peut subsister) : 1 sur place, 0 à ${ICE_RANGE_KM} km ou plus` },
  { id: "warm", label: "Température douce", hint: `Température moyenne annuelle mesurée par Diviner (LRO) : plus c'est chaud, plus la survie à la nuit est facile (0 à ${TEMP_RANGE_K[0]} K, 1 à ${TEMP_RANGE_K[1]} K)` },
  { id: "subice", label: "Glace peu profonde", hint: `Profondeur où la glace d'eau est stable (Diviner) : 1 si stable en surface, 0 au-delà de ${ICE_DEPTH_MAX_CM} cm ou si instable` },
];

export interface Constraints {
  slopeMax: number;      // ° (mean slope in the 200 m cell)
  nightMaxH: number;     // h
  earthMinPct: number;   // %
  sunMinPct: number;     // %
  psrMaxKm: number;      // km to the nearest permanent shadow (≥ 50 = no constraint)
  onlyArtemis?: boolean; // keep only pixels inside an official Artemis III candidate region
}

export interface Profile {
  id: string; label: string; description: string;
  weights: Record<Criterion, number>; constraints: Constraints;
  /** Period (h) the profile is designed for (UI hint; the user's period is still used). */
  periodH?: number;
  /** Why these weights / thresholds (documentation, shown nowhere yet). */
  basis?: string;
}

const W0: Record<Criterion, number> = { sun: 0, night: 0, flux: 0, earth: 0, outage: 0, both: 0, ice: 0, warm: 0, subice: 0, link: 0, nolink: 0 };
export const NO_PSR_LIMIT = 50;
/** Slope limits (mean slope of the 200 m cell, °). Landers: 8° (usual value in Artemis / CLPS
 *  site studies; IM-1 tipped over on a ~12° slope). Rovers: 15° (VIPER design slope). */
export const LANDER_SLOPE = 8;
export const ROVER_SLOPE = 15;
const NO_NIGHT_LIMIT = 720;

// Tuning notes (docs/zone_optimizer.md, "Profils"): checked on the 3 regions over 6.5 days and
// one lunar day from 14/11/2026. Hard constraints are only used for physical or safety limits;
// preferences go into weights, so that a profile never ends with zero zones for a period where
// a reasonable compromise exists (e.g. Earth ≥ 60 % is impossible near the pole).
export const PROFILES: Profile[] = [
  {
    id: "lander", label: "Atterrisseur solaire (CLPS)",
    description: "Mission courte alimentée par panneaux, sans relais : beaucoup de Soleil, liaison directe, terrain sûr.",
    weights: { ...W0, sun: 3, both: 3, earth: 2, night: 1 },
    constraints: { slopeMax: LANDER_SLOPE, nightMaxH: NO_NIGHT_LIMIT, earthMinPct: 0, sunMinPct: 50, psrMaxKm: NO_PSR_LIMIT },
    basis: "Les atterrisseurs CLPS (Nova-C, Blue Ghost) vivent un jour lunaire au plus, sur batterie et panneaux, et communiquent en direct avec la Terre : Soleil et Terre simultanés comptent autant que le Soleil seul.",
  },
  {
    id: "artemis", label: "Équipage (Artemis III)",
    description: "Séjour de 6,5 jours : lumière continue, liaison directe, pente faible.",
    weights: { ...W0, sun: 3, night: 3, both: 2, earth: 2, outage: 1 },
    constraints: { slopeMax: LANDER_SLOPE, nightMaxH: 6, earthMinPct: 0, sunMinPct: 0, psrMaxKm: NO_PSR_LIMIT },
    periodH: 156,
    basis: "Critères NASA de sélection des régions Artemis III (2022) : accès continu à la lumière sur 6,5 jours, communication directe avec la Terre, atterrissage sûr. Nuit tolérée : 6 h (ombres brèves de relief).",
  },
  {
    id: "night", label: "Survie à la nuit (station)",
    description: "Station longue durée : nuits les plus courtes possible, liaison quand même utile.",
    weights: { ...W0, night: 4, sun: 2, flux: 1, earth: 1, warm: 1 },
    constraints: { slopeMax: LANDER_SLOPE, nightMaxH: NO_NIGHT_LIMIT, earthMinPct: 0, sunMinPct: 0, psrMaxKm: NO_PSR_LIMIT },
    basis: "La batterie se dimensionne sur la plus longue nuit. Le poids « Terre » (1) départage les zones toutes à 100 % de Soleil, qui sinon peuvent n'avoir aucune liaison. « Température douce » (1) : la moyenne annuelle Diviner résume l'environnement thermique sur toute l'année, pas seulement sur la période choisie.",
  },
  {
    id: "rover", label: "Rover prospecteur (type VIPER)",
    description: "Rover solaire qui va chercher la glace : proche des ombres permanentes, nuits courtes, pentes jusqu'à 15°.",
    weights: { ...W0, ice: 3, sun: 2, night: 2, earth: 1, subice: 2 },
    constraints: { slopeMax: ROVER_SLOPE, nightMaxH: 96, earthMinPct: 0, sunMinPct: 30, psrMaxKm: 5 },
    basis: "VIPER : pentes jusqu'à 15°, alimentation solaire, objectif les pièges froids. Nuit max 96 h : ordre de grandeur de survie d'un petit rover sur batterie (hypothèse à affiner avec le bilan énergétique).",
  },
  {
    id: "dte", label: "Liaison directe Terre",
    description: "Pas de relais : la Terre doit rester visible le plus longtemps possible, coupures courtes.",
    weights: { ...W0, earth: 3, outage: 3, both: 1 },
    constraints: { slopeMax: LANDER_SLOPE, nightMaxH: NO_NIGHT_LIMIT, earthMinPct: 0, sunMinPct: 0, psrMaxKm: NO_PSR_LIMIT },
    basis: "Ancienne contrainte « Terre ≥ 60 % » retirée : près du pôle, la Terre n'est visible qu'environ 50 % du temps au mieux (libration), et le profil ne donnait aucune zone.",
  },
  {
    id: "relay", label: "Liaison avec relais",
    description: "La Terre peut se cacher si un relais en orbite basse (orbite de LRO) prend le relais : on vise les coupures totales les plus courtes.",
    weights: { ...W0, nolink: 3, link: 2, sun: 2 },
    constraints: { slopeMax: LANDER_SLOPE, nightMaxH: NO_NIGHT_LIMIT, earthMinPct: 0, sunMinPct: 0, psrMaxKm: NO_PSR_LIMIT },
    basis: "Avec le relais LRO (un passage toutes les ~2 h), la plus longue coupure totale tombe de plusieurs jours à moins de 2 h : c'est elle qu'on minimise. Pente d'atterrisseur (8°).",
  },
  {
    id: "ice", label: "Science : glace d'eau (atterrisseur)",
    description: "Se poser au Soleil, à courte distance d'une zone d'ombre permanente où la glace d'eau a pu se piéger.",
    weights: { ...W0, ice: 3, sun: 2, earth: 1, night: 1, subice: 2 },
    constraints: { slopeMax: LANDER_SLOPE, nightMaxH: NO_NIGHT_LIMIT, earthMinPct: 0, sunMinPct: 30, psrMaxKm: 5 },
    basis: "Atterrisseur fixe : même pente maximale que les autres atterrisseurs (8°, auparavant 10°). « Glace peu profonde » (2) : un foreur atteint la glace sur place si elle est stable à moins d'un mètre (Diviner).",
  },
  {
    id: "custom", label: "Personnalisé",
    description: "Réglez vous-même les poids et les contraintes.",
    weights: { ...W0, sun: 1, night: 1, earth: 1, both: 1 },
    constraints: { slopeMax: 10, nightMaxH: NO_NIGHT_LIMIT, earthMinPct: 0, sunMinPct: 0, psrMaxKm: NO_PSR_LIMIT },
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
    case "link": return (m.linkPct.length ? m.linkPct[p] : m.earthPct[p]) / 100;
    case "nolink": return 1 - Math.min(1, (m.noLinkH.length ? m.noLinkH[p] : m.outageH[p]) / m.hours);
    case "ice": return region.psrDistKm.length ? 1 - Math.min(1, region.psrDistKm[p] / ICE_RANGE_KM) : 0;
    case "warm": {
      if (!region.tAvg?.length) return 0;
      const [lo, hi] = TEMP_RANGE_K;
      return Math.min(1, Math.max(0, (region.tAvg[p] / 10 - lo) / (hi - lo)));
    }
    case "subice": {
      const d = region.iceDepth?.length ? region.iceDepth[p] : -1;
      return d < 0 ? 0 : 1 - Math.min(1, d / ICE_DEPTH_MAX_CM);
    }
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
  /** Diviner (NaN if unavailable): annual mean temperature (K), depth of stable ice (cm; −1 = unstable). */
  tAvgK: number; iceDepthCm: number;
  linkPct: number; noLinkH: number; // NaN without relay orbit for the period
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
      tAvgK: region.tAvg?.length ? region.tAvg[bp] / 10 : NaN,
      iceDepthCm: region.iceDepth?.length ? region.iceDepth[bp] : NaN,
      linkPct: m.linkPct.length ? m.linkPct[bp] : NaN, noLinkH: m.noLinkH.length ? m.noLinkH[bp] : NaN,
      artemis: artemis && artemis.mask[bp] ? artemis.names[artemis.mask[bp] - 1] : null,
    });
  }
  zones.sort((a, b) => b.score - a.score || b.areaKm2 - a.areaKm2);
  return zones.slice(0, max).map((z, i) => ({ ...z, rank: i + 1 }));
}
