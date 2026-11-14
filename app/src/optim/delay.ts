/**
 * "Mission delayed": the landing date slips — is the planned site still good, and if not,
 * which nearby zones are best at the new date? Pure functions, no UI.
 *
 *  - compareDelay(): from two regional evaluations (planned period, delayed period), compares
 *    the site and ranks the alternatives within a radius at the new date;
 *  - planDelay():    same, running both evaluations (heavy: call it from a worker);
 *  - shiftScan():    for one site (horizon mask, no region needed), indicators for a list of
 *                    delays (e.g. +0, +1, +2… lunar months), to see which dates still work.
 */
import { metrics, simulate, SYNODIC_DAYS } from "../astro/analysis";
import type { Site } from "../astro/ephemeris";
import type { HorizonMask } from "../astro/horizon";
import { evaluateRegion, type RegionMetrics } from "./evaluate";
import { pixelOf, pointMetrics, type CellMetrics } from "./neighborhood";
import type { RegionData } from "./region";
import { extractZones, scoreRegion, type Constraints, type Criterion, type Scored, type Zone } from "./score";

export interface SiteScore { cell: CellMetrics; score: number; feasible: boolean }
export type DelayVerdict = "toujours bon" | "dégradé" | "amélioré" | "devient infaisable" | "devient faisable" | "infaisable";

export interface DelayResult {
  before: SiteScore;
  after: SiteScore;
  /** Score change of the site (points, after − before). */
  delta: number;
  verdict: DelayVerdict;
  /** Best zones at the new date within the radius, with their distance to the site. */
  alternatives: (Zone & { distKm: number })[];
  /** Best feasible score within the radius at the new date. */
  bestNearby: number;
}

/** A score change smaller than this (points) counts as "unchanged". */
export const DELAY_TOLERANCE_PTS = 3;

function siteScore(region: RegionData, m: RegionMetrics, s: Scored, lat: number, lon: number): SiteScore {
  const cell = pointMetrics(region, m, lat, lon);
  if (!cell) throw new Error("site hors de la région");
  const p = cell.row * m.width + cell.col;
  return { cell, score: s.feasible[p] ? s.score[p] : NaN, feasible: !!s.feasible[p] };
}

function verdictOf(b: SiteScore, a: SiteScore): DelayVerdict {
  if (!b.feasible && !a.feasible) return "infaisable";
  if (b.feasible && !a.feasible) return "devient infaisable";
  if (!b.feasible && a.feasible) return "devient faisable";
  const d = a.score - b.score;
  return Math.abs(d) < DELAY_TOLERANCE_PTS ? "toujours bon" : d < 0 ? "dégradé" : "amélioré";
}

export function compareDelay(region: RegionData, before: RegionMetrics, after: RegionMetrics,
  lat: number, lon: number, weights: Record<Criterion, number>, constraints: Constraints,
  radiusKm = 10, tolerance = 3, maxZones = 5): DelayResult {
  const sb = scoreRegion(region, before, weights, constraints);
  const sa = scoreRegion(region, after, weights, constraints);
  const b = siteScore(region, before, sb, lat, lon);
  const a = siteScore(region, after, sa, lat, lon);

  // Restrict the delayed-period score to the radius around the site
  const [c0, r0] = pixelOf(region.meta, lat, lon)!;
  const pk = region.meta.pixel_m / 1000;
  const W = after.width, N = W * after.height;
  const feasible = new Uint8Array(N);
  let best = -Infinity, count = 0;
  for (let p = 0; p < N; p++) {
    if (!sa.feasible[p]) continue;
    if (Math.hypot((p % W) - c0, Math.floor(p / W) - r0) * pk > radiusKm) continue;
    feasible[p] = 1; count++;
    if (sa.score[p] > best) best = sa.score[p];
  }
  const local: Scored = { score: sa.score, feasible, feasibleCount: count, best };
  const zones = count ? extractZones(region, after, local, tolerance, maxZones) : [];
  const alternatives = zones.map((z) => ({ ...z, distKm: Math.hypot(z.bestCol - c0, z.bestRow - r0) * pk }));
  return {
    before: b, after: a, delta: a.score - b.score, verdict: verdictOf(b, a),
    alternatives, bestNearby: count ? best : NaN,
  };
}

/** Runs both regional evaluations (planned and delayed period) then compareDelay(). */
export function planDelay(region: RegionData, lat: number, lon: number, start: number, hours: number,
  delayH: number, weights: Record<Criterion, number>, constraints: Constraints, radiusKm = 10,
  onProgress?: (f: number) => void): DelayResult & { metricsAfter: RegionMetrics } {
  const before = evaluateRegion(region, start, hours, onProgress && ((f) => onProgress(f / 2)));
  const after = evaluateRegion(region, start + delayH * 3_600_000, hours, onProgress && ((f) => onProgress(0.5 + f / 2)));
  return { ...compareDelay(region, before, after, lat, lon, weights, constraints, radiusKm), metricsAfter: after };
}

export interface ShiftRow {
  delayH: number; start: number;
  sunPct: number; longestNightH: number; earthPct: number; longestNoEarthH: number; bothPct: number;
}

/** Standard delays: 0 to `months` lunar months (one lunar day each), in hours. */
export function lunarMonthDelays(months = 12): number[] {
  return Array.from({ length: months + 1 }, (_, i) => i * SYNODIC_DAYS * 24);
}

/** Indicators of one site for each delay (same period length). Cheap: ~1 ms per delay. */
export function shiftScan(site: Site, mask: HorizonMask, start: number, hours: number,
  delaysH: number[] = lunarMonthDelays(), stepMin = 60): ShiftRow[] {
  return delaysH.map((delayH) => {
    const t0 = start + delayH * 3_600_000;
    const k = metrics(simulate(site, mask, t0, hours, stepMin));
    return {
      delayH, start: t0, sunPct: k.sunPct, longestNightH: k.longestNightH, earthPct: k.earthPct,
      longestNoEarthH: k.longestNoEarthH, bothPct: k.bothPct,
    };
  });
}
