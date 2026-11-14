export interface Obstacle {
  az_from_deg: number; az_to_deg: number; peak_az_deg: number; peak_elev_deg: number;
  peak_dist_km: number; peak_terrain_elev_m: number;
  sun_blocked_pct_time: number; earth_blocked_pct_time: number;
}

export interface SiteRecord {
  id: string;
  name: string;
  short: string;
  category: "candidat" | "reference" | "custom";
  region: string;
  context: string;
  lat: number;
  lon: number;
  elevation_m: number | null;
  dist_to_pole_km: number;
  in_dem: boolean;
  coord_method?: string;
  refs?: string[];
  terrain?: {
    slope_deg_local_240m: number; slope_deg_mean_1km: number; slope_deg_max_1km: number;
    relief_5km: { min_m: number; max_m: number; std_m: number };
    hires?: {
      res_m: number; slope_deg_local_40m: number; slope_deg_mean_100m: number;
      slope_deg_max_500m: number; pct_area_slope_gt_10deg_500m: number;
    };
  } | null;
  elevation_res_m?: number;
  /** Nearest permanently shadowed area (scripts/build_psr.py). */
  psr?: PsrProximity;
  /** Custom sites: result of the on-demand computation from the relief tiles. */
  custom_info?: {
    status: "pending" | "tiles" | "preview" | "flat";
    site_res_m?: number; near_res_m?: number;
    slope_local_deg?: number; slope_mean_100m_deg?: number; slope_max_100m_deg?: number;
    tiles?: number; megabytes?: number; ms?: number;
  };
  horizon_source?: string;
  horizon?: { max_elev_deg: number; max_elev_az_deg: number; mean_elev_deg: number };
  obstacles?: Obstacle[];
}

export interface PsrProximity { region: string; nearest_psr_km: number; nearest_psr_lat: number; nearest_psr_lon: number }

export async function loadSites(): Promise<SiteRecord[]> {
  const r = await fetch("data/sites/sites.json");
  const sites: SiteRecord[] = (await r.json()).sites;
  try { // optional: produced by scripts/build_psr.py
    const p = await fetch("data/sites/psr_proximity.json");
    if (p.ok) {
      const j = await p.json();
      for (const s of sites) if (j.sites?.[s.id]) s.psr = j.sites[s.id];
    }
  } catch { /* no permanent-shadow data */ }
  return sites;
}

export const DURATIONS = [
  { label: "3 jours", hours: 72 },
  { label: "7 jours", hours: 168 },
  { label: "1 jour lunaire (29,5 j)", hours: 708.7 },
  { label: "3 mois", hours: 2160 },
];
