/**
 * Shareable link: encodes the current scenario (site, date, period, cursor, optimizer settings)
 * in the URL hash and decodes it back. No dependency on the UI: App.tsx only has to call
 * `readShareState(location.hash)` at start-up and `shareUrl(state)` on the "copy link" button.
 *
 * Format (hash, human-readable, stable):
 *   #site=malapert-massif&t=2026-11-14T16:00Z&d=708.7
 *   #lat=-85.5&lon=15&t=2026-11-14T16:00Z&d=168&c=42
 *   #site=connecting-ridge&t=…&d=…&region=pole&profile=lander
 */

export interface ShareState {
  /** Curated site id (sites.json); ignored when lat/lon are given. */
  siteId?: string;
  /** Custom site (degrees; lat south negative, lon east −180…180). */
  lat?: number;
  lon?: number;
  /** Start of the period (ms UTC). */
  start?: number;
  /** Period length (h). */
  hours?: number;
  /** Cursor index in the time series. */
  cursor?: number;
  /** Optimizer: region id and profile id. */
  region?: string;
  profile?: string;
}

const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** "2026-11-14T16:00Z" (minute precision, UTC). */
export function formatShareTime(ms: number): string {
  return new Date(ms).toISOString().slice(0, 16) + "Z";
}

/** Parses "2026-11-14T16:00Z" (or any ISO date); NaN if invalid. */
export function parseShareTime(s: string): number {
  if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?)?Z?$/.test(s)) return NaN;
  return Date.parse(s.includes("T") ? (s.endsWith("Z") ? s : s + "Z") : s + "T00:00Z");
}

const num = (s: string | null, lo: number, hi: number): number | undefined => {
  if (s === null || s.trim() === "") return undefined;
  const v = Number(s.replace(",", "."));
  return Number.isFinite(v) && v >= lo && v <= hi ? v : undefined;
};
const id = (s: string | null): string | undefined => (s && ID_RE.test(s) ? s : undefined);

/** Hash (with or without "#") → state. Invalid or unknown fields are silently dropped. */
export function readShareState(hash: string): ShareState {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const out: ShareState = {};
  const lat = num(p.get("lat"), -90, 90), lon = num(p.get("lon"), -180, 180);
  if (lat !== undefined && lon !== undefined) { out.lat = lat; out.lon = lon; }
  else { const s = id(p.get("site")); if (s) out.siteId = s; }
  const t = p.get("t");
  if (t) { const v = parseShareTime(t); if (!Number.isNaN(v)) out.start = v; }
  const d = num(p.get("d"), 1, 24 * 400); if (d !== undefined) out.hours = d;
  const c = num(p.get("c"), 0, 1e6); if (c !== undefined) out.cursor = Math.floor(c);
  const r = id(p.get("region")); if (r) out.region = r;
  const pr = id(p.get("profile")); if (pr) out.profile = pr;
  return out;
}

/** State → hash string (starting with "#"); fields left undefined are omitted. */
export function writeShareState(s: ShareState): string {
  const p = new URLSearchParams();
  if (s.lat !== undefined && s.lon !== undefined) {
    p.set("lat", s.lat.toFixed(4)); p.set("lon", s.lon.toFixed(4));
  } else if (s.siteId) p.set("site", s.siteId);
  if (s.start !== undefined) p.set("t", formatShareTime(s.start));
  if (s.hours !== undefined) p.set("d", String(Math.round(s.hours * 10) / 10));
  if (s.cursor) p.set("c", String(s.cursor));
  if (s.region) p.set("region", s.region);
  if (s.profile) p.set("profile", s.profile);
  // URLSearchParams escapes ":" — keep the hash readable
  return "#" + p.toString().replace(/%3A/g, ":");
}

/** Full URL to share, built from the current page URL (keeps path and query, replaces the hash). */
export function shareUrl(s: ShareState, base: string): string {
  const u = new URL(base);
  u.hash = writeShareState(s).slice(1);
  return u.toString();
}
