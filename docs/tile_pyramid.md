# Tile pyramid of the south polar relief

Common base for the two horizon computation methods:
- the **precomputation** of the selected sites, in Python;
- the **on-demand computation** of custom sites, in the browser.

## Sources (NASA PDS, LRO LOLA)

| File | Area covered | Resolution | Size |
|---|---|---|---|
| `LDEM_80S_20M` | from 80°S to the pole (square of ~608 km) | 20 m | 1.85 GB |
| `LDEM_85S_20M` | from 85°S to the pole (square of ~303 km) | 20 m | 460 MB |
| `LDEM_75S_120M` | from 75°S to the pole (square of ~915 km) | 120 m | 116 MB |

The files share the same format: 16-bit integers in units of 0.5 m, elevation measured relative
to a sphere of 1,737.4 km. They are not versioned. `scripts/build_tiles.py` downloads them if
they are missing.

**Since 14 Nov 2026, the 20 m level comes from `LDEM_80S_20M`** when this file is present in
`data/dem/` (otherwise `LDEM_85S_20M`, as before). Over their common area, the two files are
identical: RMS difference of 0.05 m, maximum 0.5 m (one quantization unit), measured on 2,000
points. The 20 m relief now covers IM-1 (80.1°S), Mons Mouton, Nobile and Amundsen.
`build_tiles.py`, `tiled_dem.py` (class `Raster`), `build_sites.py` and
`build_horizon_maps.py` automatically pick the widest file.

## Levels

| Level | Source | Tiles | Size |
|---|---|---|---|
| 20 m | 80S_20M | 14,400 | 1.8 GB |
| 40 m | 80S_20M, 2×2 mean | 3,600 | 450 MB |
| 80 m | 80S_20M, 4×4 mean | 900 | 113 MB |
| 120 m | 75S_120M | 900 | 113 MB |
| 240 m | 75S_120M, 2×2 mean | 256 | 33 MB |
| 480 m | 75S_120M, 4×4 mean | 64 | 8 MB |
| 960 m | 75S_120M, 8×8 mean | 16 | 2 MB |

The pyramid totals about 2.5 GB in `data/dem/tiles/` (not versioned; ~750 MB with
LDEM_85S_20M alone). The 2×2 mean is computed in bands of rows, which bounds the memory. To
regenerate it:

```bash
.venv/Scripts/python scripts/build_tiles.py
```

## Format

**Projection:** south polar stereographic, sphere R = 1,737,400 m, **origin at the pole**.
- x = 2R·tan(45° + lat/2)·sin(lon)
- y = 2R·tan(45° + lat/2)·cos(lon), with longitude 0° (near side) pointing up

**Grid**, for a resolution s:
- column `i` covers x ∈ [i·s, (i+1)·s[ ;
- row `r` covers y ∈ ]−(r+1)·s, −r·s] (rows go down).

Since all levels share the same origin, they are aligned: pixel `i` at level 2s groups exactly
pixels `2i` and `2i+1` of level s.

**Tiles:**
- 256 × 256 pixels, named `tiles/{res}m/{ty}_{tx}.i16`;
- they cover columns `tx·256 … tx·256+255` and rows `ty·256 … ty·256+255`;
- `tx` and `ty` can be negative;
- values in little-endian `int16`: elevation (m) = value × 0.5, and −32768 = no data.

`manifest.json` describes the levels and their tile ranges. The Python reader is
`scripts/tiled_dem.py` (class `TiledDEM`).

## Validation

| Test | Result |
|---|---|
| Tiles vs source files (2,000 random points per source) | difference **0 m** |
| 20 m ↔ 120 m alignment (20 m averaged over 6×6 blocks, compared with 120 m) | RMS **1.2 m** with no offset, ~17 m with a one-pixel offset: exact alignment |
| Elevation at the sites, from 20 m to 960 m | consistent: ridge 1,957 → 1,894 m, Malapert 5,174 → 5,141 m, Mons Mouton 5,322 → 5,316 m |

The finest available level is 20 m for the three candidate sites, and 120 m for IM-1 (80.1°S).

## Use for the horizon

**Python precomputation** (selected sites, `scripts/build_sites.py`): it reads the source files
directly, which is faster in Python than the tiles. Relief within 25 km is read at 20 m, beyond
that at 120 m.

**On-demand computation** (custom sites, `app/src/astro/horizonTiled.ts`, in a Web Worker): it
reads the tiles. Each distance band has its level; if a level is missing somewhere, the next
coarser level is used.

| Distance to the site | Levels, from preferred to fallback | Step |
|---|---|---|
| 40 m – 5 km | 20 → 40 → 80 → 120 m | 20 m |
| 5 – 25 km | 80 → 120 m | 80 m |
| 25 – 100 km | 240 m | 240 m |
| 100 – 300 km | 480 m | 480 m |

A computation loads about 85 tiles (~11 MB) and takes 0.5 to 2 s. The Vite server serves the
tiles under `data/tiles/` (`dem-tiles` plugin in `app/vite.config.ts`), without copying them to
`public/`. `npm run build` copies them into `dist/data/tiles/`; `NO_TILES=1` disables this copy.

**Validation**: the same code, run under Node and compared with the Python precomputation.

| Site | RMS horizon difference | Max difference |
|---|---|---|
| Connecting Ridge | 0.003° | 0.013° |
| Malapert | 0.002° | 0.016° |
| Mons Mouton | 0.005° | 0.042° |
| IM-1 (120 m only) | 0.053° | 0.17° |

In the application, a custom site placed exactly on the summit of Malapert gives the same
indicators as the precomputed site: 89 % Sun, 82 % Earth and 1,205 W/m² over the lunar day of
14 Nov 2026.
