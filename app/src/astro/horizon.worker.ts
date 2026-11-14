/// <reference lib="webworker" />
// Computes custom-site horizons in the background so the page never freezes.
import { computeHorizonTiled } from "./horizonTiled";
import { httpLoader, TileStore } from "./tiles";

let store: TileStore | null = null;
let base = "";

self.onmessage = async (e: MessageEvent<{ id: number; baseUrl: string; lat: number; lon: number }>) => {
  const { id, baseUrl, lat, lon } = e.data;
  try {
    if (!store || base !== baseUrl) { store = new TileStore(httpLoader(baseUrl)); base = baseUrl; }
    const result = await computeHorizonTiled(store, lat, lon);
    self.postMessage({ id, result });
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
