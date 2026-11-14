"""Pyramide de tuiles multi-résolution du relief polaire sud (LOLA).

Grille commune à tous les niveaux (stéréographique polaire sud, sphère R = 1 737 400 m) :
  * origine exactement au pôle, x = 2R·tan(45° + lat/2)·sin(lon), y = 2R·tan(45° + lat/2)·cos(lon) ;
  * pour une résolution s, la colonne i couvre x ∈ [i·s, (i+1)·s[ ;
    la ligne r couvre y ∈ ]−(r+1)·s, −r·s]  (les lignes descendent, comme dans une image) ;
  * tuile (tx, ty) = colonnes tx·256 … tx·256+255, lignes ty·256 … ty·256+255 (tx, ty peuvent être < 0).
Les niveaux sont donc alignés : le pixel i au niveau 2s regroupe les pixels 2i et 2i+1 au niveau s.

Valeurs : int16 little-endian, unité 0,5 m (comme LOLA), altitude = DN × 0,5 par rapport à la
sphère de 1 737,4 km ; -32768 = pas de donnée.

Niveaux produits :
  20, 40, 80 m   ← LDEM_85S_20M  (85°S → pôle)
  120, 240, 480, 960 m ← LDEM_75S_120M (75°S → pôle)

Usage : .venv/Scripts/python scripts/build_tiles.py
"""
import json
from pathlib import Path
import urllib.request

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
DEM_DIR = ROOT / "data" / "dem"
OUT = DEM_DIR / "tiles"
PDS = ("https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/"
       "data/lola_gdr/polar/img/")
TILE = 256
NODATA = -32768

SOURCES = {
    "ldem_85s_20m": {"res": 20, "n": 15168, "offset": 7583.5, "max_lat": -85},
    "ldem_75s_120m": {"res": 120, "n": 7624, "offset": 3811.5, "max_lat": -75},
}
# niveau -> (source, facteur de réduction)
LEVELS = {20: ("ldem_85s_20m", 1), 40: ("ldem_85s_20m", 2), 80: ("ldem_85s_20m", 4),
          120: ("ldem_75s_120m", 1), 240: ("ldem_75s_120m", 2),
          480: ("ldem_75s_120m", 4), 960: ("ldem_75s_120m", 8)}


def load_source(name):
    meta = SOURCES[name]
    img = DEM_DIR / f"{name}.img"
    if not img.exists():
        print(f"Téléchargement de {img.name} …")
        urllib.request.urlretrieve(PDS + img.name, img)
    arr = np.fromfile(img, dtype="<i2").reshape(meta["n"], meta["n"])
    # indice de grille du premier pixel : le pixel c a son centre en (c - offset)·res,
    # donc il couvre [(c - offset - 0.5)·res, …[  →  i = c - (offset + 0.5)
    i0 = -int(meta["offset"] + 0.5)
    return arr, i0


def pad_to_tiles(arr, i0):
    """Place le raster (origine i0 en colonnes et en lignes) dans une mosaïque alignée sur les tuiles."""
    t0 = int(np.floor(i0 / TILE))
    start = t0 * TILE
    end = int(np.ceil((i0 + arr.shape[0]) / TILE)) * TILE
    out = np.full((end - start, end - start), NODATA, dtype=np.int16)
    a = i0 - start
    out[a:a + arr.shape[0], a:a + arr.shape[1]] = arr
    return out, t0


def reduce2(mos, t0):
    """Moyenne 2×2 en ignorant les pixels sans donnée ; renvoie une mosaïque re-alignée."""
    n = mos.shape[0] // 2
    valid = (mos != NODATA)
    v = np.where(valid, mos, 0).astype(np.int32).reshape(n, 2, n, 2)
    cnt = valid.reshape(n, 2, n, 2).sum(axis=(1, 3))
    s = v.sum(axis=(1, 3))
    red = np.full((n, n), NODATA, dtype=np.int16)
    ok = cnt > 0
    red[ok] = np.round(s[ok] / cnt[ok]).astype(np.int16)
    return pad_to_tiles(red, t0 * TILE // 2)


def write_tiles(mos, t0, res):
    d = OUT / f"{res}m"
    d.mkdir(parents=True, exist_ok=True)
    nt = mos.shape[0] // TILE
    written = []
    for j in range(nt):
        for i in range(nt):
            tile = mos[j * TILE:(j + 1) * TILE, i * TILE:(i + 1) * TILE]
            if (tile == NODATA).all():
                continue
            tx, ty = t0 + i, t0 + j
            tile.astype("<i2").tofile(d / f"{ty}_{tx}.i16")
            written.append([tx, ty])
    return written


def main():
    manifest = {
        "projection": "stéréographique polaire sud, sphère R = 1737400 m, origine au pôle",
        "xy": "x = 2R·tan(45°+lat/2)·sin(lon) ; y = 2R·tan(45°+lat/2)·cos(lon)",
        "grid": "colonne i : x ∈ [i·s,(i+1)·s[ ; ligne r : y ∈ ]-(r+1)·s, -r·s]",
        "tile_px": TILE, "dtype": "int16 little-endian", "dn_to_m": 0.5, "nodata": NODATA,
        "path": "tiles/{res}m/{ty}_{tx}.i16", "levels": [],
    }
    cache = {}
    for res in sorted(LEVELS):
        src, factor = LEVELS[res]
        if factor == 1:
            arr, i0 = load_source(src)
            mos, t0 = pad_to_tiles(arr, i0)
            del arr
        else:
            prev_mos, prev_t0 = cache[src]
            mos, t0 = reduce2(prev_mos, prev_t0)
        cache[src] = (mos, t0)
        tiles = write_tiles(mos, t0, res)
        txs = [t[0] for t in tiles]
        tys = [t[1] for t in tiles]
        manifest["levels"].append({
            "res_m": res, "source": src.upper(), "max_lat": SOURCES[src]["max_lat"],
            "tiles": len(tiles), "tx_range": [min(txs), max(txs)], "ty_range": [min(tys), max(tys)],
        })
        print(f"{res:4d} m : {len(tiles):5d} tuiles  (source {src}, ×{factor})")
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False),
                                       encoding="utf-8")


if __name__ == "__main__":
    main()
