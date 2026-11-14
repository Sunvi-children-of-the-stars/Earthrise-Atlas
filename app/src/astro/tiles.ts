/**
 * Reads the multi-resolution relief pyramid (scripts/build_tiles.py).
 *
 * Grid (identical at every level, origin at the pole): for resolution s, column i covers
 * x ∈ [i·s, (i+1)·s[ and row r covers y ∈ ]−(r+1)·s, −r·s]. Tiles are 256×256 int16 little-endian
 * (0.5 m units, −32768 = no data), path {res}m/{ty}_{tx}.i16.
 */
export const TILE = 256;
const NODATA = -32768;

export type TileLoader = (res: number, tx: number, ty: number) => Promise<Int16Array | null>;

/** Loader that fetches tiles over HTTP from baseUrl (e.g. ".../data/tiles/"). */
export function httpLoader(baseUrl: string): TileLoader {
  return async (res, tx, ty) => {
    const r = await fetch(`${baseUrl}${res}m/${ty}_${tx}.i16`);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`tuile ${res}m/${ty}_${tx} : HTTP ${r.status}`);
    return new Int16Array(await r.arrayBuffer());
  };
}

export class TileStore {
  private cache = new Map<string, Int16Array | null>();
  private pending = new Map<string, Promise<void>>();
  tilesFetched = 0;
  bytesFetched = 0;

  constructor(private loader: TileLoader, private maxTiles = 600) {}

  private key(res: number, tx: number, ty: number) { return `${res}/${tx}/${ty}`; }

  /** Loads (in parallel) every tile of a level that intersects the square [x0±half, y0±half]. */
  async prefetch(res: number, x0: number, y0: number, half: number, concurrency = 8): Promise<void> {
    const span = TILE * res;
    const tx0 = Math.floor((x0 - half) / span), tx1 = Math.floor((x0 + half) / span);
    // row r covers y ∈ ]−(r+1)s, −rs] → tile row ty covers y ∈ ]−(ty+1)·span, −ty·span]
    const ty0 = Math.floor(-(y0 + half) / span), ty1 = Math.floor(-(y0 - half) / span);
    const todo: [number, number][] = [];
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) todo.push([tx, ty]);
    let i = 0;
    const worker = async () => {
      while (i < todo.length) {
        const [tx, ty] = todo[i++];
        await this.ensure(res, tx, ty);
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, todo.length) }, worker));
  }

  async ensure(res: number, tx: number, ty: number): Promise<void> {
    const k = this.key(res, tx, ty);
    if (this.cache.has(k)) {
      const v = this.cache.get(k)!; // refresh LRU order
      this.cache.delete(k);
      this.cache.set(k, v);
      return;
    }
    let p = this.pending.get(k);
    if (!p) {
      p = this.loader(res, tx, ty).then((t) => {
        if (t) { this.tilesFetched++; this.bytesFetched += t.byteLength; }
        this.cache.set(k, t);
        this.pending.delete(k);
        while (this.cache.size > this.maxTiles) this.cache.delete(this.cache.keys().next().value!);
      });
      this.pending.set(k, p);
    }
    await p;
  }

  /** DN value at integer pixel (i, r); NODATA if the tile is missing or not loaded. */
  private px(res: number, i: number, r: number): number {
    const tx = Math.floor(i / TILE), ty = Math.floor(r / TILE);
    const t = this.cache.get(this.key(res, tx, ty));
    if (!t) return NODATA;
    return t[(r - ty * TILE) * TILE + (i - tx * TILE)];
  }

  /** Elevation (m) at x, y (m) on a level, bilinear interpolation; NaN without data. Tiles must be prefetched. */
  sample(res: number, x: number, y: number): number {
    const fc = x / res - 0.5, fr = -y / res - 0.5;
    const i = Math.floor(fc), r = Math.floor(fr);
    const a = fc - i, b = fr - r;
    const v00 = this.px(res, i, r), v10 = this.px(res, i + 1, r);
    const v01 = this.px(res, i, r + 1), v11 = this.px(res, i + 1, r + 1);
    if (v00 === NODATA || v10 === NODATA || v01 === NODATA || v11 === NODATA) return NaN;
    return 0.5 * (v00 * (1 - a) * (1 - b) + v10 * a * (1 - b) + v01 * (1 - a) * b + v11 * a * b);
  }
}
