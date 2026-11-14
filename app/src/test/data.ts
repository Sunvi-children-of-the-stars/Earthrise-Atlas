/**
 * Test helpers: load the project's real data from disk (data/ at the repository root), the same
 * files the app fetches over HTTP. Only used by *.test.ts (Node), excluded from the app build.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { makeEphemerisTable, setEphemerisTable, type EphemerisTable } from "../astro/ephemeris";
import type { HorizonMask } from "../astro/horizon";
import { makeRelay, type RelayData } from "../astro/relay";
import type { SiteRecord } from "../data";

export const DATA = join(process.cwd(), "..", "data");
const json = (p: string) => JSON.parse(readFileSync(join(DATA, p), "utf8"));
const f32 = (p: string) => { const b = readFileSync(join(DATA, p)); return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4); };

export function sites(): SiteRecord[] { return json("sites/sites.json").sites; }
export function site(id: string): SiteRecord {
  const s = sites().find((x) => x.id === id);
  if (!s) throw new Error(`site ${id} absent de sites.json`);
  return s;
}
export function mask(id: string): HorizonMask {
  const j = json(`horizons/${id}.json`);
  return { az: j.azimuth_deg, el: j.horizon_elev_deg, dist: j.obstacle_dist_km, source: "test" };
}
/** Loads the JPL Horizons table and activates it (as the app does at start-up). */
export function useHorizonsTable(): EphemerisTable {
  const meta = json(`ephemeris/${json("ephemeris/index.json")[0]}`);
  const b = readFileSync(join(DATA, "ephemeris", meta.file));
  const t = makeEphemerisTable(meta, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  setEphemerisTable(t);
  return t;
}
export function relay(prefix: string): RelayData {
  const entry = (json("relays/index.json") as string[]).find((e) => e.startsWith(prefix));
  if (!entry) throw new Error(`relais ${prefix} absent`);
  const meta = json(`relays/${entry}`);
  return makeRelay(meta, f32(`relays/${meta.file}`));
}
export const hasData = (p: string) => existsSync(join(DATA, p));
