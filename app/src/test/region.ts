/** Synthetic regions for the optimizer tests (small grids, values chosen by hand). */
import type { RegionMetrics } from "../optim/evaluate";
import type { RegionData, RegionMeta } from "../optim/region";

export function fakeRegion(W: number, H: number, opts: { slope?: (c: number, r: number) => number; psr?: (c: number, r: number) => boolean;
  x0?: number; y0?: number; hz?: number } = {}): RegionData {
  const N = W * H;
  const meta: RegionMeta = {
    id: "test", name: "test", pixel_m: 200, width: W, height: H, x_min_m: opts.x0 ?? 0, y_max_m: opts.y0 ?? -100_000,
    n_az: 72, az_step_deg: 5, observer_height_m: 2,
    files: { horizon: "", elevation: "", slope_mean: "", slope_max: "" },
  };
  const at = (f: (c: number, r: number) => number) => { const a = new Int16Array(N); for (let p = 0; p < N; p++) a[p] = f(p % W, Math.floor(p / W)); return a; };
  const psr = new Uint8Array(N);
  if (opts.psr) for (let p = 0; p < N; p++) psr[p] = opts.psr(p % W, Math.floor(p / W)) ? 1 : 0;
  return {
    meta, hz: new Int16Array(N * 72).fill(Math.round((opts.hz ?? 0) * 100)), elev: new Int16Array(N),
    slopeMean: at((c, r) => Math.round((opts.slope?.(c, r) ?? 2) * 10)), slopeMax: new Int16Array(N),
    psr, psrDistKm: new Float32Array(N).fill(Infinity), tAvg: new Int16Array(0), tMax: new Int16Array(0), iceDepth: new Int16Array(0),
  };
}

export function fakeMetrics(W: number, H: number, f: (c: number, r: number) => Partial<Record<"sunPct" | "nightH" | "earthPct" | "outageH" | "bothPct" | "flux", number>>, hours = 100): RegionMetrics {
  const N = W * H;
  const arr = () => new Float32Array(N);
  const m: RegionMetrics = { width: W, height: H, hours, stepMin: 60, steps: hours, sunPct: arr(), nightH: arr(), earthPct: arr(), outageH: arr(), bothPct: arr(), flux: arr(), linkPct: new Float32Array(0), noLinkH: new Float32Array(0), relayName: "", ms: 0 };
  for (let p = 0; p < N; p++) {
    const v = f(p % W, Math.floor(p / W));
    m.sunPct[p] = v.sunPct ?? 50; m.nightH[p] = v.nightH ?? 50; m.earthPct[p] = v.earthPct ?? 50;
    m.outageH[p] = v.outageH ?? 50; m.bothPct[p] = v.bothPct ?? 25; m.flux[p] = v.flux ?? 600;
  }
  return m;
}
