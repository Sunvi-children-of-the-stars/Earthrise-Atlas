/// <reference lib="webworker" />
// Evaluates a whole region over a period in the background.
import { setEphemerisTable, type EphemerisTable } from "../astro/ephemeris";
import { evaluateRegion, type RelayInput } from "./evaluate";
import { loadRegion, type RegionData } from "./region";

const regions = new Map<string, RegionData>();

self.onmessage = async (e: MessageEvent<{ id: number; baseUrl: string; file: string; start: number; hours: number; eph: EphemerisTable | null; relay: RelayInput | null }>) => {
  const { id, baseUrl, file, start, hours, eph, relay } = e.data;
  setEphemerisTable(eph); // same ephemeris as the main thread (Horizons table when loaded)
  try {
    let region = regions.get(file);
    if (!region) {
      self.postMessage({ id, phase: "load" });
      region = await loadRegion(baseUrl, file);
      regions.set(file, region);
    }
    const m = evaluateRegion(region, start, hours, (f) => self.postMessage({ id, phase: "eval", progress: f }), relay);
    self.postMessage({ id, phase: "done", metrics: m },
      [m.sunPct.buffer, m.nightH.buffer, m.earthPct.buffer, m.outageH.buffer, m.bothPct.buffer, m.flux.buffer, m.linkPct.buffer, m.noLinkH.buffer]);
  } catch (err) {
    self.postMessage({ id, phase: "error", error: String(err) });
  }
};
