"""Cartes d'horizon régionales pour l'outil d'optimisation de zones.

Pour chaque pixel (200 m) d'une région, on calcule la hauteur de l'horizon dans 72 directions
(tous les 5°, azimut local compté depuis le nord, sens horaire). L'application peut alors
évaluer n'importe quelle période en quelques secondes, en comparant les trajectoires du
Soleil et de la Terre à ces horizons.

Méthode (courbure lunaire incluse) :
  * relief proche (40 m – 25 km) : rayon tracé pour chaque pixel, relief 20 m jusqu'à 5 km
    (repli 120 m hors couverture), puis 120 m ;
  * relief lointain (25 – 300 km) : rayon tracé sur une grille grossière (un nœud tous les
    2 km), puis corrigé au premier ordre de la différence d'altitude entre le pixel et le nœud
    (Δangle = −Δh / d_obstacle) et interpolé bilinéairement ;
  * dans le plan stéréographique, un rayon est une droite (écart négligeable à 300 km du pôle
    pour des secteurs de 5°) ; les distances sont corrigées du facteur d'échelle local.

Sorties (data/horizon_maps/) : <id>.json (métadonnées) et, en int16 little-endian :
  <id>.hz.i16      [ligne][colonne][azimut]  horizon en centièmes de degré
  <id>.elev.i16    altitude (m)
  <id>.slope_mean.i16 / <id>.slope_max.i16   pente moyenne / max dans la cellule (dixièmes de degré, relief 20 m)

Usage : .venv/Scripts/python scripts/build_horizon_maps.py [id ...]
"""
import json
import sys
import time
from pathlib import Path

import numpy as np

import lunar_dem as ld
from tiled_dem import RASTERS, Raster

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "horizon_maps"
R = ld.R_MOON
N_AZ = 72
PIXEL = 200.0
H_OBS = 2.0
NEAR = np.concatenate([np.arange(40.0, 5_000.0, 40.0), np.arange(5_000.0, 25_000.0, 200.0)])
FAR = np.concatenate([np.arange(25_000.0, 100_000.0, 240.0), np.arange(100_000.0, 300_000.0, 480.0)])
NODE_EVERY = 10  # pixels entre deux nœuds du relief lointain (2 km)


def snap(v, step=PIXEL):
    return float(np.round(v / step) * step)


REGIONS = [
    {"id": "pole", "name": "Pôle Sud — Shackleton, crête de liaison, de Gerlache",
     "center_xy": (0.0, 0.0), "half_m": 40_000.0},
    {"id": "malapert", "name": "Massif de Malapert",
     "center_latlon": (-85.98795, 2.05767), "half_m": 25_000.0},
    {"id": "mons-mouton", "name": "Mons Mouton (IM-2)",
     "center_latlon": (-84.7906, 29.1957), "half_m": 25_000.0},
    # Régions candidates Artemis III (liste NASA 2022) absentes des régions ci-dessus. Centres :
    # centroïdes des contours de data/sites/artemis3_regions_2022.geojson ; marge de ~5 km autour
    # des contours de 20 × 20 km. Entre 84 et 85°S, il faut LDEM_80S_20M pour le relief à 20 m.
    {"id": "nobile-amundsen", "name": "Nobile Rim 2 et Amundsen Rim (Artemis III)",
     "center_xy": (158_500.0, 80_000.0), "half_m": 30_000.0},
    {"id": "nobile-1", "name": "Nobile Rim 1 (Artemis III)",
     "center_xy": (82_000.0, 112_000.0), "half_m": 15_000.0},
    {"id": "haworth", "name": "Haworth (Artemis III)",
     "center_xy": (-41_000.0, 93_600.0), "half_m": 20_000.0},
    {"id": "faustini", "name": "Faustini Rim A (Artemis III)",
     "center_xy": (62_000.0, 2_000.0), "half_m": 15_000.0},
    {"id": "de-gerlache-2", "name": "de Gerlache Rim 2 (Artemis III)",
     "center_xy": (-50_600.0, 25_000.0), "half_m": 15_000.0},
    {"id": "gerlache-kocher", "name": "Massif de Gerlache-Kocher (Artemis III)",
     "center_xy": (-115_400.0, -54_200.0), "half_m": 15_000.0},
]


def scale_factor(x, y):
    """Facteur d'échelle de la stéréographique polaire (k0 = 1 au pôle)."""
    rho = np.hypot(x, y)
    return 1.0 + (rho / (2 * R)) ** 2


def local_frames(x, y):
    """Vecteurs unitaires nord et est locaux dans le plan (nord = s'éloigner du pôle)."""
    rho = np.hypot(x, y)
    nx = np.where(rho > 1, x / np.maximum(rho, 1e-9), 0.0)
    ny = np.where(rho > 1, y / np.maximum(rho, 1e-9), 1.0)
    return (nx, ny), (ny, -nx)


AZ = np.radians(np.arange(N_AZ) * 360.0 / N_AZ)


def rays(x, y, dist):
    """Positions (B, N_AZ, len(dist)) des points des rayons partant des pixels (x, y)."""
    (nx, ny), (ex, ey) = local_frames(x, y)
    dx = np.cos(AZ)[None, :] * nx[:, None] + np.sin(AZ)[None, :] * ex[:, None]
    dy = np.cos(AZ)[None, :] * ny[:, None] + np.sin(AZ)[None, :] * ey[:, None]
    t = dist[None, None, :] * scale_factor(x, y)[:, None, None]
    return x[:, None, None] + dx[:, :, None] * t, y[:, None, None] + dy[:, :, None] * t


def elevation_angle(h, h0, dist):
    th = dist / R
    r = R + h
    r0 = (R + h0 + H_OBS)[:, None, None]
    return np.degrees(np.arctan2(r * np.cos(th) - r0, r * np.sin(th)))


def sample_best(rasters, x, y):
    h = rasters[20].sample(x, y)
    bad = np.isnan(h)
    if bad.any():
        h[bad] = rasters[120].sample(x[bad], y[bad])
    return h


def near_horizon(rasters, x, y, h0):
    px, py = rays(x, y, NEAR)
    n5 = int(np.searchsorted(NEAR, 5_000.0))
    h = np.empty(px.shape)
    h[:, :, :n5] = sample_best(rasters, px[:, :, :n5], py[:, :, :n5])
    h[:, :, n5:] = rasters[120].sample(px[:, :, n5:], py[:, :, n5:])
    ang = elevation_angle(h, h0, NEAR[None, None, :])
    return np.nanmax(np.where(np.isnan(ang), -90.0, ang), axis=2)


def far_horizon(rasters, x, y, h0):
    px, py = rays(x, y, FAR)
    h = rasters[120].sample(px, py)
    ang = elevation_angle(h, h0, FAR[None, None, :])
    ang = np.where(np.isnan(ang), -90.0, ang)
    k = np.argmax(ang, axis=2)
    best = np.take_along_axis(ang, k[:, :, None], axis=2)[:, :, 0]
    return best, FAR[k]


def build(region, rasters):
    t0 = time.time()
    if "center_latlon" in region:
        cx, cy = ld.latlon_to_xy(*region["center_latlon"])
    else:
        cx, cy = region["center_xy"]
    cx, cy = snap(float(cx)), snap(float(cy))
    half = region["half_m"]
    W = int(round(2 * half / PIXEL))
    xmin, ymax = cx - half, cy + half
    xs = xmin + (np.arange(W) + 0.5) * PIXEL
    ys = ymax - (np.arange(W) + 0.5) * PIXEL
    X, Y = np.meshgrid(xs, ys)           # [ligne][colonne]
    H0 = sample_best(rasters, X, Y)

    # --- relief lointain sur la grille grossière -------------------------------------------
    nodes = np.arange(0, W + NODE_EVERY, NODE_EVERY)
    nodes = np.clip(nodes, 0, W - 1)
    nodes = np.unique(nodes)
    NX, NY = np.meshgrid(xmin + (nodes + 0.5) * PIXEL, ymax - (nodes + 0.5) * PIXEL)
    nh0 = sample_best(rasters, NX, NY)
    fa = np.empty((NX.size, N_AZ))
    fd = np.empty((NX.size, N_AZ))
    flat_x, flat_y, flat_h = NX.ravel(), NY.ravel(), nh0.ravel()
    for s in range(0, flat_x.size, 200):
        sl = slice(s, s + 200)
        fa[sl], fd[sl] = far_horizon(rasters, flat_x[sl], flat_y[sl], flat_h[sl])
    fa = fa.reshape(len(nodes), len(nodes), N_AZ)
    fd = fd.reshape(len(nodes), len(nodes), N_AZ)
    nh0 = nh0.reshape(len(nodes), len(nodes))
    print(f"  {region['id']}: relief lointain sur {nodes.size}² nœuds en {time.time() - t0:.0f} s")

    # interpolation bilinéaire des nœuds (avec correction d'altitude) pour chaque pixel
    idx = np.arange(W)
    k1 = np.clip(np.searchsorted(nodes, idx, side="right") - 1, 0, len(nodes) - 2)
    w1 = (idx - nodes[k1]) / (nodes[k1 + 1] - nodes[k1])

    hz = np.empty((W, W, N_AZ), dtype=np.int16)
    B = 400
    flatX, flatY, flatH = X.ravel(), Y.ravel(), H0.ravel()
    rows, cols = np.divmod(np.arange(W * W), W)
    for s in range(0, W * W, B):
        sl = slice(s, s + B)
        near = near_horizon(rasters, flatX[sl], flatY[sl], flatH[sl])
        r, c = rows[sl], cols[sl]
        far = np.zeros_like(near)
        for (dr, dc) in ((0, 0), (0, 1), (1, 0), (1, 1)):
            wr = np.where(dr, w1[r], 1 - w1[r])
            wc = np.where(dc, w1[c], 1 - w1[c])
            nr, nc = k1[r] + dr, k1[c] + dc
            corr = fa[nr, nc] - np.degrees((flatH[sl] - nh0[nr, nc])[:, None] / fd[nr, nc])
            far += (wr * wc)[:, None] * corr
        best = np.maximum(near, far)
        hz[r, c] = np.round(best * 100).astype(np.int16)
        if (s // B) % 50 == 0:
            print(f"  {region['id']}: {100 * (s + B) / (W * W):5.1f} %  ({time.time() - t0:.0f} s)")

    # --- pentes dans chaque cellule (relief 20 m, repli 120 m) -----------------------------
    sub = int(PIXEL / 20)
    slope_mean = np.full((W, W), np.nan)
    slope_max = np.full((W, W), np.nan)
    # pixel 20 m sous-jacents : centres de cellule ± 90 m
    offs = (np.arange(sub) + 0.5) * 20 - PIXEL / 2
    for j in range(W):
        sx = (xs[:, None] + offs[None, :]).ravel()
        hh =np.stack([rasters[20].sample(sx, np.full(sx.shape, ys[j] - oy)) for oy in offs])  # (sub, W*sub)
        hh = hh.reshape(sub, W, sub)  # [sous-ligne][cellule][sous-colonne]
        gy, gxx = np.gradient(hh, 20.0, axis=(0, 2))
        sl_ = np.degrees(np.arctan(np.hypot(gxx, gy)))
        with np.errstate(all="ignore"):
            slope_mean[j] = np.nanmean(sl_, axis=(0, 2))
            slope_max[j] = np.nanmax(sl_, axis=(0, 2))
    miss = np.isnan(slope_mean)
    if miss.any():  # hors couverture 20 m : pente au 120 m
        e = 120.0
        gx = (rasters[120].sample(X + e, Y) - rasters[120].sample(X - e, Y)) / (2 * e)
        gy = (rasters[120].sample(X, Y + e) - rasters[120].sample(X, Y - e)) / (2 * e)
        s120 = np.degrees(np.arctan(np.hypot(gx, gy)))
        slope_mean[miss] = s120[miss]
        slope_max[miss] = s120[miss]

    OUT.mkdir(parents=True, exist_ok=True)
    rid = region["id"]
    hz.astype("<i2").tofile(OUT / f"{rid}.hz.i16")
    np.round(H0).astype("<i2").tofile(OUT / f"{rid}.elev.i16")
    np.round(slope_mean * 10).astype("<i2").tofile(OUT / f"{rid}.slope_mean.i16")
    np.round(slope_max * 10).astype("<i2").tofile(OUT / f"{rid}.slope_max.i16")
    meta = {
        "id": rid, "name": region["name"], "pixel_m": PIXEL, "width": W, "height": W,
        "x_min_m": xmin, "y_max_m": ymax, "n_az": N_AZ, "az_step_deg": 360 / N_AZ,
        "observer_height_m": H_OBS,
        "pixel_center": "x = x_min + (col + 0.5)·pixel ; y = y_max − (row + 0.5)·pixel (stéréographique polaire sud)",
        "files": {"horizon": f"{rid}.hz.i16", "elevation": f"{rid}.elev.i16",
                  "slope_mean": f"{rid}.slope_mean.i16", "slope_max": f"{rid}.slope_max.i16"},
        "encoding": {"horizon": "int16, centièmes de degré, [ligne][colonne][azimut]",
                     "elevation": "int16, m", "slope": "int16, dixièmes de degré"},
        "relief": f"LOLA {RASTERS[20][0].split('.')[0].upper()} (proche, pentes) + LDEM_75S_120M (lointain)",
        "seconds": round(time.time() - t0),
    }
    (OUT / f"{rid}.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"  {rid}: terminé, {W}×{W} px, {time.time() - t0:.0f} s")
    return meta


def write_index():
    """index.json : régions déjà calculées, dans l'ordre de REGIONS."""
    index = [json.loads((OUT / f"{r['id']}.json").read_text(encoding="utf-8"))
             for r in REGIONS if (OUT / f"{r['id']}.json").exists()]
    (OUT / "index.json").write_text(json.dumps(
        [{"id": m["id"], "name": m["name"], "file": f"{m['id']}.json"} for m in index],
        indent=2, ensure_ascii=False), encoding="utf-8")
    return index


def main():
    if sys.argv[1:] == ["--index"]:  # après un calcul distant (scripts/modal_horizon_maps.py)
        print([m["id"] for m in write_index()])
        return
    wanted = set(sys.argv[1:])
    rasters = {20: Raster(20), 120: Raster(120)}
    index = []
    for reg in REGIONS:
        if wanted and reg["id"] not in wanted:
            meta_f = OUT / f"{reg['id']}.json"
            if meta_f.exists():
                index.append(json.loads(meta_f.read_text(encoding="utf-8")))
            continue
        index.append(build(reg, rasters))
    (OUT / "index.json").write_text(json.dumps(
        [{"id": m["id"], "name": m["name"], "file": f"{m['id']}.json"} for m in index],
        indent=2, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
