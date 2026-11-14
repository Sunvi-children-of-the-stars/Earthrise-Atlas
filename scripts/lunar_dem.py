"""Accès au MNT LOLA polaire sud (LDEM_75S_120M, projection stéréographique polaire).

Source : PDS Geosciences Node, LRO LOLA GDR polaire
https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/

Hauteurs = rayon planétaire - 1 737 400 m (sphère de référence), en mètres.
"""
from pathlib import Path
import urllib.request

import numpy as np

R_MOON = 1_737_400.0          # m, sphère de référence LOLA
DEM_URL = ("https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/"
           "data/lola_gdr/polar/img/ldem_75s_120m")
DEM_DIR = Path(__file__).resolve().parent.parent / "data" / "dem"
SCALE = 120.0                 # m/pixel
N = 7624                      # lignes = colonnes
CENTER = 3811.5               # LINE/SAMPLE_PROJECTION_OFFSET (pixels)


def download(force: bool = False) -> Path:
    """Télécharge le MNT (~116 Mo) et son label s'ils sont absents."""
    DEM_DIR.mkdir(parents=True, exist_ok=True)
    for ext in (".lbl", ".img"):
        dst = DEM_DIR / f"ldem_75s_120m{ext}"
        if force or not dst.exists():
            print(f"Téléchargement {dst.name} ...")
            urllib.request.urlretrieve(DEM_URL + ext, dst)
    return DEM_DIR / "ldem_75s_120m.img"


def load() -> np.ndarray:
    """Retourne le MNT en mètres (float32, N x N). [ligne, colonne]."""
    img = download()
    return (np.fromfile(img, dtype="<i2").reshape(N, N) * 0.5).astype(np.float32)


def latlon_to_xy(lat, lon):
    """Lat/lon (deg, lon Est) -> coordonnées stéréographiques x, y (m).

    Convention vérifiée sur le MNT (Malapert, Shackleton, Haworth) :
    colonne = CENTER + x/SCALE ; ligne = CENTER - y/SCALE.
    """
    lat = np.radians(lat)
    lon = np.radians(lon)
    k = 2 * R_MOON * np.tan(np.pi / 4 + lat / 2)
    return k * np.sin(lon), k * np.cos(lon)


def xy_to_latlon(x, y):
    rho = np.hypot(x, y)
    lat = 2 * np.arctan(rho / (2 * R_MOON)) - np.pi / 2
    lon = np.arctan2(x, y)
    return np.degrees(lat), np.degrees(lon)


def xy_to_px(x, y):
    """-> (colonne, ligne) en pixels fractionnaires."""
    return CENTER + np.asarray(x) / SCALE, CENTER - np.asarray(y) / SCALE


def px_to_xy(col, row):
    return (np.asarray(col) - CENTER) * SCALE, (CENTER - np.asarray(row)) * SCALE


def sample(dem: np.ndarray, col, row):
    """Interpolation bilinéaire ; NaN hors de l'emprise."""
    col = np.asarray(col, dtype=np.float64)
    row = np.asarray(row, dtype=np.float64)
    ok = (col >= 0) & (col < N - 1) & (row >= 0) & (row < N - 1)
    c = np.where(ok, col, 0.0)
    r = np.where(ok, row, 0.0)
    c0 = np.floor(c).astype(np.int64)
    r0 = np.floor(r).astype(np.int64)
    fc, fr = c - c0, r - r0
    v = (dem[r0, c0] * (1 - fc) * (1 - fr) + dem[r0, c0 + 1] * fc * (1 - fr)
         + dem[r0 + 1, c0] * (1 - fc) * fr + dem[r0 + 1, c0 + 1] * fc * fr)
    return np.where(ok, v, np.nan)


def elevation_at(dem, lat, lon):
    return float(sample(dem, *xy_to_px(*latlon_to_xy(lat, lon))))


def in_dem(lat, lon) -> bool:
    c, r = xy_to_px(*latlon_to_xy(lat, lon))
    return bool(0 <= c < N - 1 and 0 <= r < N - 1)
