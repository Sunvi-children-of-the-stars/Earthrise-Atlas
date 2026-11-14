/**
 * Data shared by every page: sites, reduced DEM, Artemis regions, relay orbits and the JPL
 * Horizons table (loaded before any computation). Horizon masks are loaded or computed on demand
 * and cached (useMask). Same loading logic as the former expert interface.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { loadEphemerisTable, setEphemerisTable } from "../../astro/ephemeris";
import { computeMask, demElevation, flatMask, loadDem, loadMask, type Dem, type HorizonMask } from "../../astro/horizon";
import { requestTiledHorizon } from "../../astro/onDemand";
import { loadArtemisRegions, type ArtemisRegionSet } from "../../astro/regions";
import { loadRelays, type RelayData } from "../../astro/relay";
import { loadSites, type SiteRecord } from "../../data";

const R_KM = 1737.4;

export type MaskSource = "precomputed" | "tiles" | "preview" | "flat" | "loading";

/** Where the horizon of a custom site comes from, given what is available. */
export function customMaskSource(inDem: boolean, tilesOk: boolean, demOk: boolean): MaskSource {
  if (!inDem) return "flat";
  if (tilesOk) return "tiles";
  return demOk ? "preview" : "flat";
}

export function makeCustomSite(lat: number, lon: number, dem: Dem | null): SiteRecord {
  const h = dem ? demElevation(dem, lat, lon) : NaN;
  const inDem = !Number.isNaN(h);
  return {
    id: `custom:${lat.toFixed(4)},${lon.toFixed(4)}`,
    name: "Custom site", short: `${Math.abs(lat).toFixed(2)}°${lat < 0 ? "S" : "N"} ${Math.abs(lon).toFixed(2)}°${lon < 0 ? "W" : "E"}`,
    category: "custom", region: "", lat, lon, context: "",
    elevation_m: inDem ? Math.round(h) : null,
    dist_to_pole_km: ((90 + lat) * Math.PI / 180) * R_KM,
    in_dem: inDem,
  };
}

export interface DataState {
  sites: SiteRecord[];
  dem: Dem | null;
  artemis: ArtemisRegionSet | null;
  lro: RelayData | null;
  relays: RelayData[];
  ephReady: boolean;
  error: string | null;
}

const Ctx = createContext<DataState | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DataState>({ sites: [], dem: null, artemis: null, lro: null, relays: [], ephReady: false, error: null });
  useEffect(() => {
    let alive = true;
    const set = (p: Partial<DataState>) => alive && setState((s) => ({ ...s, ...p }));
    loadEphemerisTable().then((t) => { setEphemerisTable(t); set({ ephReady: true }); });
    loadSites().then((sites) => set({ sites })).catch(() => set({ error: "sites" }));
    loadDem().then((dem) => set({ dem })).catch(() => { /* custom sites fall back to a smooth horizon */ });
    loadArtemisRegions().then((artemis) => set({ artemis })).catch(() => { /* optional */ });
    loadRelays().then((relays) => set({ relays, lro: relays.find((r) => r.meta.id.startsWith("lro")) ?? null }))
      .catch(() => { /* optional */ });
    return () => { alive = false; };
  }, []);
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export function useData(): DataState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useData outside DataProvider");
  return v;
}

/**
 * Cache key of a horizon mask. A custom point created before the DEM finished loading has
 * in_dem = false (smooth ground): it must not share its cache entry with the same point once the
 * DEM is known, or a shared link would keep a flat horizon for good.
 */
export function maskCacheKey(site: SiteRecord): string {
  return site.category === "custom" ? `${site.id}|${site.in_dem ? 1 : 0}` : site.id;
}

export interface MaskResult { mask: HorizonMask | null; source: MaskSource; elevation_m?: number; slope_local_deg?: number }

const cache = new Map<string, MaskResult>();
const inflight = new Map<string, Promise<MaskResult>>();

function fetchMask(site: SiteRecord, dem: Dem | null): Promise<MaskResult> {
  if (site.category !== "custom") {
    return loadMask(site.id).then((mask) => ({ mask, source: "precomputed" as const }))
      .catch(() => ({ mask: flatMask(site.elevation_m ?? 0), source: "flat" as const }));
  }
  if (!site.in_dem) return Promise.resolve({ mask: flatMask(site.elevation_m ?? 0), source: customMaskSource(false, false, !!dem) });
  return requestTiledHorizon(site.lat, site.lon)
    .then((r) => {
      if (!r) throw new Error("no relief");
      return { mask: r.mask, source: customMaskSource(true, true, !!dem), elevation_m: r.elevation_m, slope_local_deg: r.slope_local_deg };
    })
    .catch(() => {
      const m = dem ? computeMask(dem, site.lat, site.lon) : null;
      return { mask: m ?? flatMask(site.elevation_m ?? 0), source: customMaskSource(true, false, !!m) };
    });
}

/** Horizon mask of a site (cached); custom sites are computed in the background. */
export function useMask(site: SiteRecord | null): MaskResult {
  const { dem } = useData();
  const key = site ? maskCacheKey(site) : "";
  const [res, setRes] = useState<MaskResult>(() => (key && cache.get(key)) || { mask: null, source: "loading" });
  useEffect(() => {
    if (!site) { setRes({ mask: null, source: "loading" }); return; }
    const k = maskCacheKey(site);
    const hit = cache.get(k);
    if (hit) { setRes(hit); return; }
    setRes({ mask: null, source: "loading" });
    let alive = true;
    let p = inflight.get(k);
    if (!p) {
      p = fetchMask(site, dem).then((r) => { cache.set(k, r); inflight.delete(k); return r; });
      inflight.set(k, p);
    }
    p.then((r) => alive && setRes(r));
    return () => { alive = false; };
    // dem matters only for custom sites created before the DEM finished loading
  }, [site, dem]);
  return res;
}
