/**
 * Relay satellite passes seen from a site.
 *
 * - LRO: real orbit (Moon-centered, ICRF/J2000, one point per minute) from JPL Horizons
 *   (scripts/fetch_relay_ephemeris.py). Each point is rotated into the lunar body-fixed frame with
 *   the same IAU model as the Sun and the Earth, then compared with the site's terrain horizon.
 * - Gateway, Queqiao-2: approximate orbit MODELS (scripts/build_relay_models.py), flagged
 *   `kind: "model"`; Gateway's NRHO is given directly in the body-fixed frame (`frame_kind`).
 */
import { altAz, bodiesFixed, daysJ2000, moonRotation, R_MOON_KM, type Site, type Vec3 } from "./ephemeris";
import { horizonAt, type HorizonMask } from "./horizon";

/** Minimum elevation for a usable link (antenna mask), in addition to the terrain. */
export const RELAY_MIN_ELEV_DEG = 5;
const DELTA_T_S = 69.2; // TDB ≈ TT = UTC + 69.2 s

export interface RelayMeta {
  id: string; satellite: string; start_jd_tdb: number; step_seconds: number; count: number; file: string;
  altitude_km: { min: number; max: number }; note: string;
  /** "ephemeris" (real, JPL Horizons; default) or "model" (hypothetical / approximate orbit). */
  kind?: "ephemeris" | "model";
  /** Frame of the positions: "icrf" (default, rotated with the IAU model) or "body-fixed". */
  frame_kind?: "icrf" | "body-fixed";
}
export interface RelayData { meta: RelayMeta; xyz: Float32Array; startUtcMs: number; endUtcMs: number }

/** Builds a RelayData from its metadata and raw positions (also used by Node scripts). */
export function makeRelay(meta: RelayMeta, xyz: Float32Array): RelayData {
  const startUtcMs = (meta.start_jd_tdb - 2440587.5) * 86_400_000 - DELTA_T_S * 1000;
  return { meta, xyz, startUtcMs, endUtcMs: startUtcMs + (meta.count - 1) * meta.step_seconds * 1000 };
}

async function fetchRelay(entry: string): Promise<RelayData> {
  const meta: RelayMeta = await (await fetch(`data/relays/${entry}`, { cache: "no-cache" })).json();
  return makeRelay(meta, new Float32Array(await (await fetch(`data/relays/${meta.file}`)).arrayBuffer()));
}

async function relayIndex(): Promise<string[]> {
  return (await fetch("data/relays/index.json", { cache: "no-cache" })).json();
}

/** The default relay: the real LRO ephemeris (first non-model entry of the index). */
export async function loadRelay(): Promise<RelayData> {
  const index = await relayIndex();
  const entry = index.find((e) => e.startsWith("lro")) ?? index[0];
  return fetchRelay(entry);
}

/** All relays of the index (real ephemerides first, then models). */
export async function loadRelays(): Promise<RelayData[]> {
  const all = await Promise.all((await relayIndex()).map(fetchRelay));
  return all.sort((a, b) => Number(a.meta.kind === "model") - Number(b.meta.kind === "model"));
}

/** Rotation from the stored frame to the body-fixed frame at time t. */
function toFixed(r: RelayData, t: number, v: Vec3): Vec3 {
  return r.meta.frame_kind === "body-fixed" ? v : rotate(moonRotation(daysJ2000(new Date(t))), v);
}

function rotate(m: number[][], v: Vec3): Vec3 {
  return [0, 1, 2].map((i) => m[i][0] * v[0] + m[i][1] * v[1] + m[i][2] * v[2]) as Vec3;
}

/** Relay position (km, body-fixed) at sample index i. */
export function relayFixed(r: RelayData, i: number): Vec3 {
  const t = r.startUtcMs + i * r.meta.step_seconds * 1000;
  return toFixed(r, t, [r.xyz[3 * i], r.xyz[3 * i + 1], r.xyz[3 * i + 2]]);
}

/** Relay position (km, body-fixed) at any UTC time, by linear interpolation between samples. */
export function relayFixedAt(r: RelayData, tUtcMs: number): Vec3 | null {
  const f = (tUtcMs - r.startUtcMs) / (r.meta.step_seconds * 1000);
  const i = Math.floor(f);
  if (i < 0 || i >= r.meta.count - 1) return null;
  const a = f - i;
  const p: Vec3 = [0, 1, 2].map((k) => r.xyz[3 * i + k] * (1 - a) + r.xyz[3 * (i + 1) + k] * a) as Vec3;
  return toFixed(r, tUtcMs, p);
}

export interface RelayPass { start: number; end: number; minutes: number; maxElev: number; minRangeKm: number }

export interface RelayResult {
  available: boolean;            // period fully covered by the downloaded orbit
  coveredFrom: number; coveredTo: number;
  passes: RelayPass[];
  passesPerDay: number;
  relayPct: number;              // % of time the relay is usable
  earthPct: number;              // % of time Earth is visible (1-min resolution)
  linkPct: number;               // % of time Earth OR relay
  outageCoveredPct: number;      // share of Earth outages during which the relay is usable
  longestNoLinkH: number;        // longest period with neither Earth nor relay
  longestNoEarthH: number;
  windows: { start: number; end: number }[]; // relay windows (for the timeline)
}

export function relayAnalysis(site: Site, mask: HorizonMask, r: RelayData, start: number, hours: number): RelayResult {
  const step = r.meta.step_seconds * 1000;
  const end = start + hours * 3_600_000;
  const i0 = Math.max(0, Math.ceil((start - r.startUtcMs) / step));
  const i1 = Math.min(r.meta.count - 1, Math.floor((end - r.startUtcMs) / step));
  const available = start >= r.startUtcMs && end <= r.endUtcMs;
  const passes: RelayPass[] = [];
  let relayN = 0, earthN = 0, linkN = 0, outageN = 0, outageRelayN = 0, n = 0;
  let noLink = 0, maxNoLink = 0, noEarth = 0, maxNoEarth = 0;
  let cur: RelayPass | null = null;
  const la = (site.lat * Math.PI) / 180, lo = (site.lon * Math.PI) / 180;
  const rs = R_MOON_KM + (site.elevation_m ?? 0) / 1000;
  const sitePos: Vec3 = [rs * Math.cos(la) * Math.cos(lo), rs * Math.cos(la) * Math.sin(lo), rs * Math.sin(la)];
  for (let i = i0; i <= i1; i++) {
    const t = r.startUtcMs + i * step;
    const date = new Date(t);
    const v = toFixed(r, t, [r.xyz[3 * i], r.xyz[3 * i + 1], r.xyz[3 * i + 2]]);
    const p = altAz(site, v);
    const relayUp = p.alt > Math.max(horizonAt(mask, p.az), RELAY_MIN_ELEV_DEG);
    const e = altAz(site, bodiesFixed(date).earth);
    const earthUp = e.alt > horizonAt(mask, e.az);
    n++;
    if (relayUp) relayN++;
    if (earthUp) earthN++;
    if (earthUp || relayUp) { linkN++; noLink = 0; } else if (++noLink > maxNoLink) maxNoLink = noLink;
    if (!earthUp) { outageN++; if (relayUp) outageRelayN++; if (++noEarth > maxNoEarth) maxNoEarth = noEarth; } else noEarth = 0;
    if (relayUp) {
      const range = Math.hypot(v[0] - sitePos[0], v[1] - sitePos[1], v[2] - sitePos[2]);
      if (!cur) cur = { start: t, end: t, minutes: 0, maxElev: p.alt, minRangeKm: range };
      cur.end = t; cur.minutes += step / 60_000;
      cur.maxElev = Math.max(cur.maxElev, p.alt);
      cur.minRangeKm = Math.min(cur.minRangeKm, range);
    } else if (cur) { passes.push(cur); cur = null; }
  }
  if (cur) passes.push(cur);
  const days = Math.max(1e-9, (n * step) / 86_400_000);
  const stepH = step / 3_600_000;
  return {
    available, coveredFrom: r.startUtcMs, coveredTo: r.endUtcMs, passes,
    passesPerDay: passes.length / days,
    relayPct: n ? (100 * relayN) / n : 0,
    earthPct: n ? (100 * earthN) / n : 0,
    linkPct: n ? (100 * linkN) / n : 0,
    outageCoveredPct: outageN ? (100 * outageRelayN) / outageN : 100,
    longestNoLinkH: maxNoLink * stepH,
    longestNoEarthH: maxNoEarth * stepH,
    windows: passes.map((p) => ({ start: p.start, end: p.end })),
  };
}
