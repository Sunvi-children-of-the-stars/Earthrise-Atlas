"""Zones d'ombre permanente (PSR) des régions de l'optimiseur.

Un point est en ombre permanente si le Soleil ne dépasse JAMAIS son horizon, quelle que soit la
date. Vu de la Lune, la déclinaison du Soleil ne dépasse pas ±1,543° (inclinaison de l'axe lunaire
sur l'écliptique). Pour un site de l'hémisphère sud, l'élévation solaire est maximale quand la
latitude subsolaire vaut −1,543°. On balaie donc la longitude subsolaire sur 360° à cette
latitude, et le point est en ombre permanente si, dans toutes les directions, le bord
supérieur du disque solaire (+0,267°) reste sous l'horizon.

Entrées : cartes d'horizon (build_horizon_maps.py). Sorties (data/horizon_maps/) :
  <id>.psr.u8          1 = ombre permanente
  <id>.sunmax.i16      marge max du Soleil au-dessus de l'horizon sur toutes les dates (centièmes de degré)
  psr_summary.json     surfaces d'ombre permanente, et pour chaque site candidat l'ombre la plus proche

Usage : .venv/Scripts/python scripts/build_psr.py
"""
import json
from pathlib import Path

import numpy as np

import lunar_dem as ld

ROOT = Path(__file__).resolve().parent.parent
MAPS = ROOT / "data" / "horizon_maps"
DELTA_MAX = 1.543       # déclinaison solaire maximale vue de la Lune (°)
SUN_RADIUS = 0.267      # demi-diamètre apparent du Soleil (°)
LAMBDAS = np.radians(np.arange(0.0, 360.0, 1.0))


def region_psr(meta):
    W = meta["width"]
    hz = np.fromfile(MAPS / meta["files"]["horizon"], dtype="<i2").reshape(W * W, meta["n_az"]) / 100.0
    cols, rows = np.meshgrid(np.arange(W), np.arange(W))
    x = meta["x_min_m"] + (cols.ravel() + 0.5) * meta["pixel_m"]
    y = meta["y_max_m"] - (rows.ravel() + 0.5) * meta["pixel_m"]
    lat, lon = ld.xy_to_latlon(x, y)
    la, lo = np.radians(lat), np.radians(lon)
    up = np.stack([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)], 1)
    east = np.stack([-np.sin(lo), np.cos(lo), np.zeros_like(lo)], 1)
    north = np.stack([-np.sin(la) * np.cos(lo), -np.sin(la) * np.sin(lo), np.cos(la)], 1)
    d = np.radians(-DELTA_MAX)
    sun = np.stack([np.cos(d) * np.cos(LAMBDAS), np.cos(d) * np.sin(LAMBDAS), np.full(LAMBDAS.shape, np.sin(d))], 1)
    step = 360.0 / meta["n_az"]
    best = np.full(W * W, -90.0)
    for s in range(0, W * W, 20_000):
        sl = slice(s, s + 20_000)
        alt = np.degrees(np.arcsin(up[sl] @ sun.T))                       # (B, 360)
        az = (np.degrees(np.arctan2(east[sl] @ sun.T, north[sl] @ sun.T)) + 360) % 360
        f = az / step
        i0 = np.floor(f).astype(int) % meta["n_az"]
        t = f - np.floor(f)
        h = hz[sl]
        rows_idx = np.arange(h.shape[0])[:, None]
        hzv = h[rows_idx, i0] * (1 - t) + h[rows_idx, (i0 + 1) % meta["n_az"]] * t
        best[sl] = (alt + SUN_RADIUS - hzv).max(axis=1)
    psr = best <= 0
    return psr.reshape(W, W), best.reshape(W, W), x.reshape(W, W), y.reshape(W, W)


def main():
    index = json.loads((MAPS / "index.json").read_text(encoding="utf-8"))
    sites = json.loads((ROOT / "data" / "sites" / "sites.json").read_text(encoding="utf-8"))["sites"]
    summary = {"definition": __doc__.split("\n\n")[1].replace("\n", " "), "regions": {}, "sites": {}}
    all_psr = []
    for entry in index:
        meta_f = MAPS / entry["file"]
        meta = json.loads(meta_f.read_text(encoding="utf-8"))
        psr, best, X, Y = region_psr(meta)
        rid = meta["id"]
        psr.astype(np.uint8).tofile(MAPS / f"{rid}.psr.u8")
        np.round(np.clip(best, -300, 300) * 100).astype("<i2").tofile(MAPS / f"{rid}.sunmax.i16")
        meta["files"]["psr"] = f"{rid}.psr.u8"
        meta["files"]["sunmax"] = f"{rid}.sunmax.i16"
        meta["encoding"]["psr"] = "uint8, 1 = ombre permanente"
        meta["encoding"]["sunmax"] = "int16, centièmes de degré : marge max du bord du Soleil au-dessus de l'horizon, toutes dates"
        meta_f.write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")
        area = float(psr.sum()) * (meta["pixel_m"] / 1000) ** 2
        summary["regions"][rid] = {"psr_area_km2": round(area, 1), "psr_pct": round(100 * float(psr.mean()), 1)}
        all_psr.append((rid, X[psr], Y[psr], meta))
        print(f"{rid:12s} ombre permanente : {area:7.1f} km² ({100 * psr.mean():.1f} % de la région)")
    # ombre permanente la plus proche de chaque site situé dans une région
    for s in sites:
        if not s.get("in_dem"):
            continue
        sx, sy = ld.latlon_to_xy(s["lat"], s["lon"])
        for rid, px, py, meta in all_psr:
            half = meta["width"] * meta["pixel_m"] / 2
            cx, cy = meta["x_min_m"] + half, meta["y_max_m"] - half
            if abs(sx - cx) > half or abs(sy - cy) > half or px.size == 0:
                continue
            dd = np.hypot(px - sx, py - sy)
            k = int(np.argmin(dd))
            plat, plon = ld.xy_to_latlon(px[k], py[k])
            summary["sites"][s["id"]] = {"region": rid, "nearest_psr_km": round(float(dd[k]) / 1000, 2),
                                         "nearest_psr_lat": round(float(plat), 4), "nearest_psr_lon": round(float(plon), 4)}
            print(f"  {s['short']:16s} ombre permanente la plus proche : {dd[k] / 1000:5.2f} km (région {rid})")
            break
    (ROOT / "data" / "sites" / "psr_proximity.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
