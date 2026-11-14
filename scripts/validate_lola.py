"""Comparaison avec les cartes officielles LOLA d'éclairement (Mazarico et al. 2011, NASA GSFC).

Cartes officielles (85°S–90°S, 60 m/pixel, moyennes horaires sur 18,6 ans, au niveau du sol) :
  LPSR_85S_060M_201608.TIF               ombres permanentes
  AVGVISIB_85S_060M_201608.TIF           fraction moyenne du disque solaire visible
  AVGVISIB_85S_060M_201608_EARTH.TIF     fraction moyenne du temps où la Terre est visible
Source : https://pgda.gsfc.nasa.gov/products/69  (téléchargées dans data/validation_lola/)

Nos valeurs : app/scripts/validate-lola.ts (même méthode que l'application, observateur à 2 m)
et scripts/build_psr.py (ombres permanentes, 200 m).

Les cartes officielles sont ré-échantillonnées sur nos pixels de 200 m (moyenne des pixels de
60 m dont le centre tombe dans le nôtre). Sorties : data/validation_lola/summary.json et un
rapport dans la console.

Usage : .venv/Scripts/python scripts/validate_lola.py
"""
import json
from pathlib import Path

import numpy as np
import tifffile

ROOT = Path(__file__).resolve().parent.parent
VAL = ROOT / "data" / "validation_lola"
MAPS = ROOT / "data" / "horizon_maps"
HALF = 151740.0   # demi-largeur des cartes 85S (m)
RES = 60.0
OFFICIAL_URL = "https://pgda.gsfc.nasa.gov/data/MoonIllumination/"


def load_official(name, scale, offset=0.0):
    p = VAL / name
    if not p.exists():
        raise SystemExit(f"Manque {p} : télécharger {OFFICIAL_URL}{name}")
    a = tifffile.imread(p).astype(np.float64)
    a[a == -32768] = np.nan
    return a * scale + offset


def block_mean(official, meta):
    """Moyenne des pixels officiels de 60 m dans chaque pixel de 200 m de la région."""
    W, px = meta["width"], meta["pixel_m"]
    x0, y0 = meta["x_min_m"], meta["y_max_m"]
    # centres des pixels officiels couverts par la région
    c0 = int(np.floor((x0 + HALF) / RES)); c1 = int(np.ceil((x0 + W * px + HALF) / RES))
    r0 = int(np.floor((HALF - y0) / RES)); r1 = int(np.ceil((HALF - (y0 - W * px)) / RES))
    c0, r0 = max(c0, 0), max(r0, 0)
    c1, r1 = min(c1, official.shape[1]), min(r1, official.shape[0])
    sub = official[r0:r1, c0:c1]
    xs = -HALF + (np.arange(c0, c1) + 0.5) * RES
    ys = HALF - (np.arange(r0, r1) + 0.5) * RES
    ci = np.floor((xs - x0) / px).astype(int)
    ri = np.floor((y0 - ys) / px).astype(int)
    R, Cc = np.meshgrid(ri, ci, indexing="ij")
    ok = (R >= 0) & (R < W) & (Cc >= 0) & (Cc < W) & np.isfinite(sub)
    idx = R[ok] * W + Cc[ok]
    s = np.bincount(idx, weights=sub[ok], minlength=W * W)
    n = np.bincount(idx, minlength=W * W)
    out = np.full(W * W, np.nan)
    out[n > 0] = s[n > 0] / n[n > 0]
    return out


def sample_point(official, x, y):
    c = (x + HALF) / RES - 0.5
    r = (HALF - y) / RES - 0.5
    c0, r0 = int(np.floor(c)), int(np.floor(r))
    fc, fr = c - c0, r - r0
    w = official[r0:r0 + 2, c0:c0 + 2]
    return float(w[0, 0] * (1 - fc) * (1 - fr) + w[0, 1] * fc * (1 - fr) + w[1, 0] * (1 - fc) * fr + w[1, 1] * fc * fr)


def stats(ours, ref):
    ok = np.isfinite(ours) & np.isfinite(ref)
    d = (ours[ok] - ref[ok]) * 100
    return {
        "pixels": int(ok.sum()),
        "bias_pts": round(float(d.mean()), 2),
        "rms_pts": round(float(np.sqrt((d ** 2).mean())), 2),
        "p95_abs_pts": round(float(np.percentile(np.abs(d), 95)), 1),
        "correlation": round(float(np.corrcoef(ours[ok], ref[ok])[0, 1]), 3),
    }


def main():
    import sys
    sys.path.insert(0, str(Path(__file__).parent))
    import lunar_dem as ld

    psr_off = load_official("LPSR_85S_060M_201608.TIF", 2.5e-5, 0.5)    # 1 = ombre permanente
    sun_off = load_official("AVGVISIB_85S_060M_201608.TIF", 4e-5)
    earth_off = load_official("AVGVISIB_85S_060M_201608_EARTH.TIF", 4e-5)
    summary = {"source": OFFICIAL_URL, "regions": {}, "sites": {}}

    for entry in json.loads((MAPS / "index.json").read_text(encoding="utf-8")):
        meta = json.loads((MAPS / entry["file"]).read_text(encoding="utf-8"))
        rid, W = meta["id"], meta["width"]
        area_px = (meta["pixel_m"] / 1000) ** 2
        ours_psr = np.fromfile(MAPS / meta["files"]["psr"], dtype=np.uint8).astype(bool)
        ours_sun = np.fromfile(VAL / f"ours_{rid}_sun.f32", dtype="<f4").astype(np.float64)
        ours_earth = np.fromfile(VAL / f"ours_{rid}_earth.f32", dtype="<f4").astype(np.float64)
        off_psr_frac = block_mean(psr_off, meta)
        covered = np.isfinite(off_psr_frac)
        off_psr = off_psr_frac >= 0.5
        both = ours_psr & off_psr & covered
        only_ours = ours_psr & ~off_psr & covered
        only_off = ~ours_psr & off_psr & covered
        union = both.sum() + only_ours.sum() + only_off.sum()
        # Surfaces au plus près : fraction des pixels de 60 m (officiel) vs nos pixels de 200 m
        r = {
            "covered_pct": round(100 * float(covered.mean()), 1),
            "psr": {
                "ours_km2": round(float(ours_psr[covered].sum()) * area_px, 1),
                "official_km2": round(float(np.nansum(off_psr_frac[covered])) * area_px, 1),
                "agreement_iou": round(float(both.sum() / union), 3) if union else None,
                "ours_only_km2": round(float(only_ours.sum()) * area_px, 1),
                "official_only_km2": round(float(only_off.sum()) * area_px, 1),
                "pixel_agreement_pct": round(100 * float(((ours_psr == off_psr) & covered).sum() / covered.sum()), 2),
            },
            "sun": stats(ours_sun, block_mean(sun_off, meta)),
            "earth": stats(ours_earth, block_mean(earth_off, meta)),
        }
        summary["regions"][rid] = r
        print(f"\n== {entry['name']} ({r['covered_pct']} % couvert par la carte officielle)")
        p = r["psr"]
        print(f"  Ombre permanente : nous {p['ours_km2']} km², officiel {p['official_km2']} km², "
              f"IoU {p['agreement_iou']}, pixels en accord {p['pixel_agreement_pct']} % "
              f"(seulement nous {p['ours_only_km2']} km², seulement officiel {p['official_only_km2']} km²)")
        for k, lab in (("sun", "Soleil"), ("earth", "Terre ")):
            s = r[k]
            print(f"  {lab} moyen 18,6 ans : biais {s['bias_pts']:+.2f} pts, RMS {s['rms_pts']} pts, "
                  f"95 % des écarts < {s['p95_abs_pts']} pts, corrélation {s['correlation']}")

    ours_sites = json.loads((VAL / "ours_sites.json").read_text(encoding="utf-8"))
    names = {s["id"]: s["short"] for s in json.loads((ROOT / "data" / "sites" / "sites.json").read_text(encoding="utf-8"))["sites"]}
    print("\n== Sites (horizon 720 directions, observateur à 2 m) vs carte officielle au même point (sol)")
    for sid, v in ours_sites.items():
        x, y = ld.latlon_to_xy(v["lat"], v["lon"])
        if abs(x) > HALF - RES or abs(y) > HALF - RES:
            continue
        so, eo = sample_point(sun_off, x, y), sample_point(earth_off, x, y)
        summary["sites"][sid] = {"ours_sun_pct": round(100 * v["sun"], 1), "official_sun_pct": round(100 * so, 1),
                                 "ours_earth_pct": round(100 * v["earth"], 1), "official_earth_pct": round(100 * eo, 1)}
        print(f"  {names.get(sid, sid):16s} Soleil {100 * v['sun']:5.1f} % (officiel {100 * so:5.1f} %)   "
              f"Terre {100 * v['earth']:5.1f} % (officiel {100 * eo:5.1f} %)")
    (VAL / "summary.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
