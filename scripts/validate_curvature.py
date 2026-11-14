"""Courbure lunaire ou non ? Arbitrage du désaccord QuickMap (crête, 24/11/2026).

On tire des points au hasard dans la région du pôle (±40 km), on calcule l'ensoleillement moyen
sur 18,6 ans avec deux horizons : avec courbure (notre méthode) et sans courbure (relief « plat »),
et on compare à la carte officielle LOLA AVGVISIB_85S_060M (Mazarico et al. 2011).
Observateur à 0,5 m (la carte officielle décrit le sol).

Entrées : data/validation_lola/ (cartes officielles, sun_vectors.json de app/scripts/validate-lola.ts).
Usage : .venv/Scripts/python scripts/validate_curvature.py [nombre_de_points=80]
"""
import json, sys, time
import numpy as np, tifffile
from pathlib import Path
ROOT = str(Path(__file__).resolve().parent.parent)
sys.path.insert(0, ROOT + "/scripts")
import lunar_dem as ld
import build_sites as bs
from tiled_dem import Raster

sunv = np.array(json.load(open(ROOT + "/data/validation_lola/sun_vectors.json")))
off = tifffile.imread(ROOT + "/data/validation_lola/AVGVISIB_85S_060M_201608.TIF") * 4e-5
HALF, RES = 151740.0, 60.0
def official(x, y):
    c = (x + HALF) / RES - 0.5; r = (HALF - y) / RES - 0.5
    c0, r0 = int(c), int(r); fc, fr = c - c0, r - r0; w = off[r0:r0 + 2, c0:c0 + 2]
    return w[0,0]*(1-fc)*(1-fr)+w[0,1]*fc*(1-fr)+w[1,0]*(1-fc)*fr+w[1,1]*fc*fr
rasters = {20: Raster(20), 120: Raster(120)}

def masks(lat, lon, h_site, h_obs):
    hr, lr = rasters[20], rasters[120]
    az = np.arange(bs.N_AZ) * 360.0 / bs.N_AZ
    near = np.arange(40.0, bs.NEAR_FIELD_M, 20.0)
    far = np.concatenate([np.arange(bs.NEAR_FIELD_M, 50_000, 120.0), np.arange(50_000, bs.MAX_DIST, 240.0)])
    dist = np.concatenate([near, far])
    A, D = np.meshgrid(az, dist, indexing="ij")
    plat, plon = bs.destination(lat, lon, A, D)
    x, y = ld.latlon_to_xy(plat, plon)
    h = lr.sample(x, y)
    nn = len(near); h20 = hr.sample(x[:, :nn], y[:, :nn]); h[:, :nn] = np.where(np.isnan(h20), h[:, :nn], h20)
    th = D / ld.R_MOON; r0 = ld.R_MOON + h_site + h_obs; r = ld.R_MOON + h
    curv = np.nan_to_num(np.degrees(np.arctan2(r * np.cos(th) - r0, r * np.sin(th))), nan=-90).max(1)
    flat = np.nan_to_num(np.degrees(np.arctan2(h - h_site - h_obs, D)), nan=-90).max(1)
    return az, curv, flat

def visib(lat, lon, az, hz):
    la, lo = np.radians(lat), np.radians(lon)
    up = np.array([np.cos(la)*np.cos(lo), np.cos(la)*np.sin(lo), np.sin(la)])
    east = np.array([-np.sin(lo), np.cos(lo), 0]); north = np.array([-np.sin(la)*np.cos(lo), -np.sin(la)*np.sin(lo), np.cos(la)])
    alt = np.degrees(np.arcsin(sunv @ up)); a = (np.degrees(np.arctan2(sunv @ east, sunv @ north)) + 360) % 360
    hzv = np.interp(a, np.append(az, 360), np.append(hz, hz[0]))
    return np.clip((alt - hzv) / 0.533 + 0.5, 0, 1).mean()

rng = np.random.default_rng(1)
rows = []
t = time.time()
N_POINTS = int(sys.argv[1]) if len(sys.argv) > 1 else 80
while len(rows) < N_POINTS:
    x, y = rng.uniform(-40000, 40000, 2)
    o = official(x, y)
    if not (0.05 < o < 0.95): continue
    lat, lon = ld.xy_to_latlon(x, y)
    hs = rasters[20].sample(np.array([x]), np.array([y]))[0]
    az, c, f = masks(float(lat), float(lon), float(hs), 0.5)
    rows.append((o, visib(lat, lon, az, c), visib(lat, lon, az, f)))
r = np.array(rows) * 100
for k, lab in ((1, "avec courbure"), (2, "sans courbure")):
    d = r[:, k] - r[:, 0]
    print(f"{lab}: biais {d.mean():+.1f} pts, RMS {np.sqrt((d**2).mean()):.1f} pts, corr {np.corrcoef(r[:,k], r[:,0])[0,1]:.3f}")
print(f"{len(rows)} points, {time.time()-t:.0f} s")
