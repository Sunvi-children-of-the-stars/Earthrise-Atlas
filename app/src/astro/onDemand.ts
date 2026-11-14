import type { TiledResult } from "./horizonTiled";

let worker: Worker | null = null;
let nextId = 1;
const waiting = new Map<number, { resolve: (r: TiledResult | null) => void; reject: (e: Error) => void }>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./horizon.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<{ id: number; result?: TiledResult | null; error?: string }>) => {
      const w = waiting.get(e.data.id);
      if (!w) return;
      waiting.delete(e.data.id);
      if (e.data.error) w.reject(new Error(e.data.error));
      else w.resolve(e.data.result ?? null);
    };
  }
  return worker;
}

/** Horizon of any polar site, computed in the background from the multi-resolution relief tiles. */
export function requestTiledHorizon(lat: number, lon: number): Promise<TiledResult | null> {
  const id = nextId++;
  const baseUrl = new URL("data/tiles/", document.baseURI).href;
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    getWorker().postMessage({ id, baseUrl, lat, lon });
  });
}
