/**
 * "Mission delayed": find the regional horizon map that contains a site, then compare the site
 * with its neighbourhood at the planned and at the delayed date (optim/delay.ts compareDelay).
 */
import type { RelayData } from "../../astro/relay";
import { mapsBaseUrl, runRegion } from "../../optim/client";
import { compareDelay, type DelayResult } from "../../optim/delay";
import { pixelOf } from "../../optim/neighborhood";
import { loadRegion, loadRegionIndex, type RegionMeta } from "../../optim/region";
import { PROFILES } from "../../optim/score";

/** Region that contains the point at least `marginKm` from its edges (the most central one if several). */
export function findRegionFor(lat: number, lon: number, metas: RegionMeta[], marginKm = 2): RegionMeta | null {
  let best: RegionMeta | null = null, bestMargin = -1;
  for (const m of metas) {
    const px = pixelOf(m, lat, lon);
    if (!px) continue;
    const margin = Math.min(px[0], px[1], m.width - 1 - px[0], m.height - 1 - px[1]) * (m.pixel_m / 1000);
    if (margin >= marginKm && margin > bestMargin) { best = m; bestMargin = margin; }
  }
  return best;
}

let metasCache: Promise<{ meta: RegionMeta; file: string }[]> | null = null;
export function loadRegionMetas(): Promise<{ meta: RegionMeta; file: string }[]> {
  if (!metasCache) {
    metasCache = loadRegionIndex(mapsBaseUrl()).then((ix) => Promise.all(ix.map(async (e) => ({
      file: e.file, meta: (await (await fetch(`${mapsBaseUrl()}${e.file}`, { cache: "no-cache" })).json()) as RegionMeta,
    }))));
    metasCache.catch(() => { metasCache = null; });
  }
  return metasCache;
}

/** Planned period vs delayed period around the site, lander profile, within `radiusKm`. Runs in the worker. */
export async function delayedNeighbourhood(lat: number, lon: number, start: number, hours: number, delayH: number,
  relay: RelayData | null, onProgress: (f: number) => void, radiusKm = 10): Promise<(DelayResult & { regionId: string }) | null> {
  const metas = await loadRegionMetas();
  const hit = findRegionFor(lat, lon, metas.map((m) => m.meta));
  if (!hit) return null;
  const file = metas.find((m) => m.meta.id === hit.id)!.file;
  const region = await loadRegion(mapsBaseUrl(), file, false);
  const before = await runRegion(file, start, hours, (_p, f) => onProgress(f / 2), relay);
  const after = await runRegion(file, start + delayH * 3_600_000, hours, (_p, f) => onProgress(0.5 + f / 2), relay);
  const p = PROFILES.find((x) => x.id === "lander")!;
  return { ...compareDelay(region, before, after, lat, lon, p.weights, p.constraints, radiusKm), regionId: hit.id };
}
