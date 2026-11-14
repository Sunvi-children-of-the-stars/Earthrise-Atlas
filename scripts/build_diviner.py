"""Températures Diviner (LRO) sur les régions de l'optimiseur et aux sites.

Source : Diviner Lunar Radiometer, « Polar Resource Products » pôle Sud (Paige et al., PDS,
LRO-L-DLRE-5-PRP-V2.0) : 2,88 millions de triangles (~0,5 km) de 75°S au pôle, avec
  * temp_avg  : température moyenne annuelle à 2 cm sous la surface (K) ;
  * temp_max  : température maximale annuelle en surface (K) ;
  * ice_depth : profondeur (m) où la glace d'eau serait stable (sublimation < 1 kg/m² par
                milliard d'années) ; 0 = stable en surface ; −999 = instable jusqu'à 2,87 m.
https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_prp/

Méthode : les centres des triangles sont projetés en stéréographique polaire, moyennés sur une
grille de 400 m, les trous comblés par les voisins, puis la grille est échantillonnée
(bilinéaire) au centre de chaque pixel de 200 m des régions.

Sorties :
  data/horizon_maps/<id>.tavg.i16, <id>.tmax.i16  (dixièmes de kelvin)
  data/horizon_maps/<id>.icedepth.i16             (cm ; −1 = glace instable jusqu'à 2,87 m)
  les métadonnées <id>.json sont complétées (files.tavg, files.tmax, files.icedepth)
  data/sites/diviner.json                         (valeurs aux sites de sites.json)

Usage : .venv/Scripts/python scripts/build_diviner.py   (télécharge la table, 605 Mo, si absente)
"""
import json
import subprocess
import time
from pathlib import Path

import numpy as np

import lunar_dem as ld

ROOT = Path(__file__).resolve().parent.parent
DIV = ROOT / "data" / "diviner"
MAPS = ROOT / "data" / "horizon_maps"
URL = ("https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/"
       "data_derived_prp/dlre_prp_south.tab")
TAB = DIV / "dlre_prp_south.tab"
CACHE = DIV / "prp_south_centers.npy"
GRID = 400.0            # m
HALF = 480_000.0        # m : emprise de la grille (75°S ≈ 457 km du pôle)


def download():
    """Téléchargement (curl : sous Windows il utilise le magasin de certificats du système)."""
    if TAB.exists():
        return
    DIV.mkdir(parents=True, exist_ok=True)
    print("Téléchargement de dlre_prp_south.tab (605 Mo)…")
    part = TAB.with_suffix(".tab.part")
    subprocess.run(["curl", "-fsSL", "--retry", "10", "-C", "-", "-o", str(part), URL], check=True)
    part.replace(TAB)


def load_centers():
    """(lon, lat, temp_avg, temp_max, ice_depth) des triangles, mis en cache en .npy."""
    if CACHE.exists() and CACHE.stat().st_mtime > TAB.stat().st_mtime:
        return np.load(CACHE)
    t = time.time()
    a = np.loadtxt(TAB, delimiter=",", skiprows=1, usecols=(9, 10, 12, 13, 14), dtype=np.float64)
    np.save(CACHE, a)
    print(f"  {len(a)} triangles lus en {time.time() - t:.0f} s")
    return a


def to_grid(x, y, values):
    """Moyenne par case de GRID m ; trous comblés par diffusion depuis les cases voisines."""
    n = int(2 * HALF / GRID)
    col = np.floor((x + HALF) / GRID).astype(np.int64)
    row = np.floor((HALF - y) / GRID).astype(np.int64)
    ok = (col >= 0) & (col < n) & (row >= 0) & (row < n) & np.isfinite(values)
    idx = row[ok] * n + col[ok]
    s = np.bincount(idx, weights=values[ok], minlength=n * n)
    c = np.bincount(idx, minlength=n * n)
    g = np.full(n * n, np.nan)
    g[c > 0] = s[c > 0] / c[c > 0]
    g = g.reshape(n, n)
    for _ in range(4):  # quelques passes suffisent : les triangles (~0,5 km) couvrent presque tout
        hole = np.isnan(g)
        if not hole.any():
            break
        p = np.pad(g, 1, constant_values=np.nan)
        nb = np.stack([p[1:-1, :-2], p[1:-1, 2:], p[:-2, 1:-1], p[2:, 1:-1]])
        with np.errstate(all="ignore"):
            fill = np.nanmean(nb, axis=0)
        g[hole] = fill[hole]
    return g


def sample(g, x, y):
    n = g.shape[0]
    fc = (x + HALF) / GRID - 0.5
    fr = (HALF - y) / GRID - 0.5
    c0 = np.clip(np.floor(fc).astype(np.int64), 0, n - 2)
    r0 = np.clip(np.floor(fr).astype(np.int64), 0, n - 2)
    a, b = fc - c0, fr - r0
    v = (g[r0, c0] * (1 - a) * (1 - b) + g[r0, c0 + 1] * a * (1 - b)
         + g[r0 + 1, c0] * (1 - a) * b + g[r0 + 1, c0 + 1] * a * b)
    # près d'un trou : valeur de la case la plus proche
    near = g[np.clip(np.round(fr).astype(np.int64), 0, n - 1), np.clip(np.round(fc).astype(np.int64), 0, n - 1)]
    return np.where(np.isnan(v), near, v)


def main():
    download()
    a = load_centers()
    lon, lat, tavg, tmax, ice = a.T
    x, y = ld.latlon_to_xy(lat, lon)
    ice_cm = np.where(ice < 0, np.nan, ice * 100.0)      # moyenne sur les seuls triangles « glace stable »
    unstable = (ice < 0).astype(np.float64)               # part instable
    t = time.time()
    G = {"tavg": to_grid(x, y, tavg), "tmax": to_grid(x, y, tmax),
         "ice": to_grid(x, y, ice_cm), "unstable": to_grid(x, y, unstable)}
    print(f"  grilles {G['tavg'].shape} en {time.time() - t:.0f} s")

    def values(px, py):
        ice_v = sample(G["ice"], px, py)
        unst = sample(G["unstable"], px, py)
        ice_v = np.where((unst > 0.5) | np.isnan(ice_v), -1.0, ice_v)
        return sample(G["tavg"], px, py), sample(G["tmax"], px, py), ice_v

    index = json.loads((MAPS / "index.json").read_text(encoding="utf-8")) if (MAPS / "index.json").exists() else []
    for entry in index:
        mf = MAPS / entry["file"]
        meta = json.loads(mf.read_text(encoding="utf-8"))
        W, H, p = meta["width"], meta["height"], meta["pixel_m"]
        X, Y = np.meshgrid(meta["x_min_m"] + (np.arange(W) + 0.5) * p, meta["y_max_m"] - (np.arange(H) + 0.5) * p)
        ta, tm, ic = values(X.ravel(), Y.ravel())
        rid = meta["id"]
        np.round(ta * 10).astype("<i2").tofile(MAPS / f"{rid}.tavg.i16")
        np.round(tm * 10).astype("<i2").tofile(MAPS / f"{rid}.tmax.i16")
        np.round(ic).astype("<i2").tofile(MAPS / f"{rid}.icedepth.i16")
        meta["files"].update({"tavg": f"{rid}.tavg.i16", "tmax": f"{rid}.tmax.i16", "icedepth": f"{rid}.icedepth.i16"})
        meta.setdefault("encoding", {}).update({
            "tavg": "int16, dixièmes de K, moyenne annuelle à 2 cm (Diviner PRP)",
            "tmax": "int16, dixièmes de K, maximum annuel en surface (Diviner PRP)",
            "icedepth": "int16, cm, profondeur de stabilité de la glace ; −1 = instable jusqu'à 2,87 m"})
        mf.write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")
        stable = (ic >= 0) & (ic <= 100)
        print(f"  {rid:16s} T moy {np.nanmin(ta):5.0f}–{np.nanmax(ta):5.0f} K, T max {np.nanmin(tm):5.0f}–{np.nanmax(tm):5.0f} K, "
              f"glace stable à < 1 m : {100 * stable.mean():4.1f} % de la région")

    sites = json.loads((ROOT / "data" / "sites" / "sites.json").read_text(encoding="utf-8"))["sites"]
    out = {"source": "Diviner PRP pôle Sud (LRO-L-DLRE-5-PRP-V2.0), grille 400 m", "sites": {}}
    for s in sites:
        if s["lat"] > -75.5:
            continue  # hors emprise du produit polaire
        sx, sy = ld.latlon_to_xy(s["lat"], s["lon"])
        ta, tm, ic = (float(v[0]) for v in values(np.array([sx]), np.array([sy])))
        out["sites"][s["id"]] = {"temp_avg_k": round(ta, 1), "temp_max_k": round(tm, 1),
                                 "ice_depth_cm": None if ic < 0 else round(ic)}
        print(f"  {s['id']:18s} T moy {ta:5.1f} K ({ta - 273.15:6.1f} °C), T max {tm:5.1f} K, "
              f"glace : {'instable' if ic < 0 else f'stable sous {ic:.0f} cm'}")
    (ROOT / "data" / "sites" / "diviner.json").write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
