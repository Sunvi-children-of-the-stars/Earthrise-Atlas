import type { RegionMetrics } from "./evaluate";

let worker: Worker | null = null;
let nextId = 1;

export function mapsBaseUrl(): string {
  return new URL("data/horizon_maps/", document.baseURI).href;
}

/** Runs the regional evaluation in the background; progress in [0, 1]. */
export function runRegion(file: string, start: number, hours: number,
  onProgress: (phase: "load" | "eval", f: number) => void): Promise<RegionMetrics> {
  if (!worker) worker = new Worker(new URL("./optim.worker.ts", import.meta.url), { type: "module" });
  const w = worker;
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data;
      if (d.id !== id) return;
      if (d.phase === "load") onProgress("load", 0);
      else if (d.phase === "eval") onProgress("eval", d.progress);
      else {
        w.removeEventListener("message", onMsg);
        if (d.phase === "done") resolve(d.metrics);
        else reject(new Error(d.error));
      }
    };
    w.addEventListener("message", onMsg);
    w.postMessage({ id, baseUrl: mapsBaseUrl(), file, start, hours });
  });
}
