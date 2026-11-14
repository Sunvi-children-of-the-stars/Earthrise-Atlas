"""Lecture de la pyramide de tuiles produite par build_tiles.py (voir son en-tête pour la grille)."""
import json
from functools import lru_cache
from pathlib import Path

import numpy as np

import lunar_dem as ld

TILES = Path(__file__).resolve().parent.parent / "data" / "dem" / "tiles"
TILE = 256
NODATA = -32768


DEM_DIR = Path(__file__).resolve().parent.parent / "data" / "dem"
RASTERS = {  # résolution -> (fichier, côté en pixels, offset de projection)
    20: ("ldem_85s_20m.img", 15168, 7583.5),
    120: ("ldem_75s_120m.img", 7624, 3811.5),
}
# Relief 20 m étendu jusqu'à 80°S (LDEM_80S_20M, 1,85 Go) : utilisé à la place de LDEM_85S_20M
# s'il a été téléchargé (mêmes données LOLA, même grille, emprise 4 fois plus grande).
if (DEM_DIR / "ldem_80s_20m.img").exists():
    RASTERS[20] = ("ldem_80s_20m.img", 30400, 15199.5)


class Raster:
    """Fichier LOLA polaire complet en mémoire (int16, 0,5 m) avec échantillonnage vectorisé.

    Plus rapide que les tuiles pour les calculs en masse en Python (même grille, même données).
    """

    def __init__(self, res):
        name, n, offset = RASTERS[res]
        self.res, self.n, self.offset = res, n, offset
        self.a = np.fromfile(DEM_DIR / name, dtype="<i2").reshape(n, n)

    def to_px(self, x, y):
        """x, y (m) -> (colonne, ligne) fractionnaires, centres de pixels sur les entiers."""
        return np.asarray(x) / self.res + self.offset, self.offset - np.asarray(y) / self.res

    def to_xy(self, col, row):
        return (np.asarray(col) - self.offset) * self.res, (self.offset - np.asarray(row)) * self.res

    def sample(self, x, y):
        """Altitude (m), interpolation bilinéaire ; NaN hors de l'emprise."""
        col, row = self.to_px(x, y)
        col = np.asarray(col, dtype=np.float64)
        row = np.asarray(row, dtype=np.float64)
        ok = (col >= 0) & (col < self.n - 1) & (row >= 0) & (row < self.n - 1)
        c = np.where(ok, col, 0.0)
        r = np.where(ok, row, 0.0)
        c0 = np.floor(c).astype(np.int64)
        r0 = np.floor(r).astype(np.int64)
        fc, fr = c - c0, r - r0
        a = self.a
        v = (a[r0, c0] * (1 - fc) * (1 - fr) + a[r0, c0 + 1] * fc * (1 - fr)
             + a[r0 + 1, c0] * (1 - fc) * fr + a[r0 + 1, c0 + 1] * fc * fr) * 0.5
        return np.where(ok, v, np.nan)

    def contains(self, lat, lon):
        c, r = self.to_px(*ld.latlon_to_xy(lat, lon))
        return bool(0 <= c < self.n - 1 and 0 <= r < self.n - 1)

    def window(self, lat, lon, radius_m):
        """Fenêtre carrée (mètres) centrée sur le point : (tableau m, col0, row0)."""
        c, r = self.to_px(*ld.latlon_to_xy(lat, lon))
        c, r = int(round(float(c))), int(round(float(r)))
        rp = int(radius_m / self.res)
        w = self.a[r - rp:r + rp + 1, c - rp:c + rp + 1].astype(np.float32) * 0.5
        return w, c - rp, r - rp


class TiledDEM:
    def __init__(self, root: Path = TILES):
        self.root = root
        self.manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
        self.levels = [lv["res_m"] for lv in self.manifest["levels"]]

    @lru_cache(maxsize=512)
    def _tile(self, res, tx, ty):
        f = self.root / f"{res}m" / f"{ty}_{tx}.i16"
        if not f.exists():
            return None
        return np.fromfile(f, dtype="<i2").reshape(TILE, TILE)

    def _px(self, res, i, r):
        """Valeur DN au pixel entier (i, r) d'un niveau, ou NODATA."""
        tx, ty = int(np.floor(i / TILE)), int(np.floor(r / TILE))
        t = self._tile(res, tx, ty)
        if t is None:
            return NODATA
        return int(t[r - ty * TILE, i - tx * TILE])

    def sample_xy(self, res, x, y):
        """Altitude (m) en x, y (m) au niveau res, interpolation bilinéaire ; NaN sans donnée."""
        fc = x / res - 0.5
        fr = -y / res - 0.5
        i, r = int(np.floor(fc)), int(np.floor(fr))
        a, b = fc - i, fr - r
        v = [self._px(res, i, r), self._px(res, i + 1, r),
             self._px(res, i, r + 1), self._px(res, i + 1, r + 1)]
        if NODATA in v:
            return float("nan")
        return 0.5 * (v[0] * (1 - a) * (1 - b) + v[1] * a * (1 - b) + v[2] * (1 - a) * b + v[3] * a * b)

    def elevation(self, lat, lon, res):
        return self.sample_xy(res, *ld.latlon_to_xy(lat, lon))

    def finest(self, lat, lon):
        """Niveau le plus fin disponible en ce point."""
        for res in self.levels:
            if not np.isnan(self.elevation(lat, lon, res)):
                return res
        return None
