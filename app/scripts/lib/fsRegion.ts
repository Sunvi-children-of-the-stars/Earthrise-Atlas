/** Node helpers for the build scripts: read a region of data/horizon_maps and the Horizons table from disk. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { makeEphemerisTable, setEphemerisTable } from "../../src/astro/ephemeris";
import { distanceTransform, type RegionData, type RegionMeta } from "../../src/optim/region";

export function loadRegionFs(dataDir: string, id: string): RegionData {
  const dir = join(dataDir, "horizon_maps");
  const i16 = (f?: string) => {
    if (!f) return new Int16Array(0);
    const b = readFileSync(join(dir, f));
    return new Int16Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  };
  const meta: RegionMeta = JSON.parse(readFileSync(join(dir, `${id}.json`), "utf8"));
  const psr = meta.files.psr ? new Uint8Array(readFileSync(join(dir, meta.files.psr))) : new Uint8Array(0);
  return {
    meta, hz: i16(meta.files.horizon), elev: i16(meta.files.elevation), slopeMean: i16(meta.files.slope_mean),
    slopeMax: i16(meta.files.slope_max), psr, psrDistKm: distanceTransform(psr, meta.width, meta.height, meta.pixel_m / 1000),
    tAvg: i16(meta.files.tavg), tMax: i16(meta.files.tmax), iceDepth: i16(meta.files.icedepth),
  };
}

/** Activates the JPL Horizons table (as the app does at start-up). */
export function useHorizonsTableFs(dataDir: string): void {
  const dir = join(dataDir, "ephemeris");
  const meta = JSON.parse(readFileSync(join(dir, JSON.parse(readFileSync(join(dir, "index.json"), "utf8"))[0]), "utf8"));
  const b = readFileSync(join(dir, meta.file));
  setEphemerisTable(makeEphemerisTable(meta, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)));
}
