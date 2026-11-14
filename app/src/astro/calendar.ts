/**
 * Site × date calendar: key indicators of each site for each lunar month, and a 0–100 grade
 * per optimizer profile, to color a heat map (rows = sites, columns = lunar months).
 * Pure functions + an in-memory cache; ~10 ms per site for 13 months.
 */
import type { Criterion } from "../optim/score";
import { metrics, simulate, SYNODIC_DAYS } from "./analysis";
import type { Site } from "./ephemeris";
import type { HorizonMask } from "./horizon";

export interface CalendarCell {
  start: number;            // ms UTC, start of the lunar month
  hours: number;            // length of the cell (one lunar day)
  sunPct: number;
  longestNightH: number;
  earthPct: number;
  longestNoEarthH: number;
  bothPct: number;
  meanFlux: number;         // W/m², vertical Sun-tracking panel
}

export interface CalendarRow { id: string; cells: CalendarCell[] }
export interface Calendar { start: number; months: number; monthStarts: number[]; rows: CalendarRow[] }

const SPAN_H = SYNODIC_DAYS * 24;
const cache = new Map<string, CalendarCell[]>();

/** One site, `months` consecutive lunar months from `start`. Cached by (key, start, months, step). */
export function siteCalendar(site: Site, mask: HorizonMask, start: number, months = 13, stepMin = 120,
  key?: string): CalendarCell[] {
  const k = key && `${key}@${start}@${months}@${stepMin}`;
  if (k && cache.has(k)) return cache.get(k)!;
  const cells: CalendarCell[] = [];
  for (let m = 0; m < months; m++) {
    const t0 = start + m * SPAN_H * 3_600_000;
    const r = metrics(simulate(site, mask, t0, SPAN_H, stepMin));
    cells.push({
      start: t0, hours: SPAN_H, sunPct: r.sunPct, longestNightH: r.longestNightH, earthPct: r.earthPct,
      longestNoEarthH: r.longestNoEarthH, bothPct: r.bothPct, meanFlux: r.meanPowerVertical,
    });
  }
  if (k) {
    if (cache.size > 200) cache.delete(cache.keys().next().value!);
    cache.set(k, cells);
  }
  return cells;
}

export function calendar(entries: { id: string; site: Site; mask: HorizonMask }[], start: number, months = 13): Calendar {
  return {
    start, months,
    monthStarts: Array.from({ length: months }, (_, m) => start + m * SPAN_H * 3_600_000),
    rows: entries.map((e) => ({ id: e.id, cells: siteCalendar(e.site, e.mask, start, months, 120, e.id) })),
  };
}

/**
 * Grade (0–100) of a calendar cell with the optimizer's weights, same normalization as
 * optim/score.ts (terrain criteria "ice", "warm", "subice" are not part of the calendar: ignored).
 */
export function cellGrade(c: CalendarCell, weights: Record<Criterion, number>): number {
  const v: Record<Criterion, number> = {
    sun: c.sunPct / 100,
    night: 1 - Math.min(1, c.longestNightH / c.hours),
    flux: c.meanFlux / 1361,
    earth: c.earthPct / 100,
    outage: 1 - Math.min(1, c.longestNoEarthH / c.hours),
    both: c.bothPct / 100,
    ice: 0, warm: 0, subice: 0, // site-specific (terrain) criteria: not part of the calendar
    // no relay in the calendar: same fallback as optim/score.ts (Earth only)
    link: c.earthPct / 100, nolink: 1 - Math.min(1, c.longestNoEarthH / c.hours),
  };
  let s = 0, w = 0;
  for (const k of Object.keys(v) as Criterion[]) {
    if (k === "ice" || k === "warm" || k === "subice" || !(weights[k] > 0)) continue;
    s += weights[k] * v[k]; w += weights[k];
  }
  return w ? (100 * s) / w : NaN;
}

/** Best month (index) of a row for a profile, or −1. */
export function bestMonth(row: CalendarRow, weights: Record<Criterion, number>): number {
  let best = -1, bv = -Infinity;
  row.cells.forEach((c, i) => { const g = cellGrade(c, weights); if (g > bv) { bv = g; best = i; } });
  return best;
}
