/// <reference lib="webworker" />
// Evaluates a whole region over a period in the background.
import { evaluateRegion } from "./evaluate";
import { loadRegion, type RegionData } from "./region";

const regions = new Map<string, RegionData>();

self.onmessage = async (e: MessageEvent<{ id: number; baseUrl: string; file: string; start: number; hours: number }>) => {
  const { id, baseUrl, file, start, hours } = e.data;
  try {
    let region = regions.get(file);
    if (!region) {
      self.postMessage({ id, phase: "load" });
      region = await loadRegion(baseUrl, file);
      regions.set(file, region);
    }
    const m = evaluateRegion(region, start, hours, (f) => self.postMessage({ id, phase: "eval", progress: f }));
    self.postMessage({ id, phase: "done", metrics: m },
      [m.sunPct.buffer, m.nightH.buffer, m.earthPct.buffer, m.outageH.buffer, m.bothPct.buffer, m.flux.buffer]);
  } catch (err) {
    self.postMessage({ id, phase: "error", error: String(err) });
  }
};
