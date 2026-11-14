"""Éphémérides du Soleil et de la Terre vus du centre de la Lune, depuis JPL Horizons (membre 1).

Une seule table sert à tous les sites : l'application calcule ensuite l'élévation et l'azimut
pour n'importe quel point de la surface (rotation de la Lune + parallaxe du site). On évite
ainsi une requête Horizons par site, et les sites personnalisés profitent de la même précision.

Vecteurs Horizons : centre 500@301 (centre de la Lune), repère ICRF, correction 'LT+S'
(temps de lumière + aberration), c'est-à-dire les directions apparentes, comme
APPARENT='AIRLESS' en mode observateur. Les dates des vecteurs sont en TDB (≈ UTC + 69,2 s).

Sorties (data/ephemeris/) :
  sun_earth_<début>_<années>y.f32   par point : Soleil x y z, Terre x y z (km, float32 LE)
  sun_earth_<début>_<années>y.json  métadonnées
  index.json

Usage : .venv/Scripts/python scripts/fetch_ephemeris.py [--start 2026-01-01] [--years 5] [--step 1h]
"""
import argparse
import json
import time
import urllib.parse
import urllib.request
from datetime import date, datetime
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "ephemeris"
API = "https://ssd.jpl.nasa.gov/api/horizons.api"
BODIES = {"sun": "10", "earth": "399"}


def fetch(command, start, stop, step):
    params = {
        "format": "json", "COMMAND": f"'{command}'", "EPHEM_TYPE": "'VECTORS'", "CENTER": "'500@301'",
        "REF_SYSTEM": "'ICRF'", "REF_PLANE": "'FRAME'", "VEC_TABLE": "'1'", "VEC_CORR": "'LT+S'",
        "OUT_UNITS": "'KM-S'", "CSV_FORMAT": "'YES'", "VEC_LABELS": "'NO'",
        "START_TIME": f"'{start}'", "STOP_TIME": f"'{stop}'", "STEP_SIZE": f"'{step}'",
    }
    url = API + "?" + urllib.parse.urlencode(params)
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=300) as r:
                res = json.loads(r.read().decode())["result"]
            break
        except OSError:
            if attempt == 2:
                raise
            time.sleep(5)
    if "$$SOE" not in res:
        raise RuntimeError(res[-600:])
    body = res.split("$$SOE")[1].split("$$EOE")[0].strip().splitlines()
    rows = []
    for line in body:
        p = [v.strip() for v in line.split(",")]
        rows.append((float(p[0]), float(p[2]), float(p[3]), float(p[4])))
    return np.array(rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", default="2026-01-01")
    ap.add_argument("--years", type=int, default=5)
    ap.add_argument("--step", default="1h")
    a = ap.parse_args()
    y0 = datetime.fromisoformat(a.start)
    series = {}
    for name, cmd in BODIES.items():
        chunks = []
        for k in range(a.years):
            s, e = y0.replace(year=y0.year + k), y0.replace(year=y0.year + k + 1)
            t = time.time()
            arr = fetch(cmd, s.strftime("%Y-%m-%d"), e.strftime("%Y-%m-%d"), a.step)
            if chunks:  # la première ligne répète la dernière de l'année précédente
                arr = arr[1:]
            chunks.append(arr)
            print(f"  {name} {s:%Y} : {len(arr)} points en {time.time() - t:.0f} s")
        series[name] = np.vstack(chunks)
    jd = series["sun"][:, 0]
    if not np.array_equal(jd, series["earth"][:, 0]):
        raise RuntimeError("dates différentes entre Soleil et Terre")
    step_days = float(np.median(np.diff(jd)))
    if np.abs(np.diff(jd) - step_days).max() > 1e-6:
        raise RuntimeError("pas de temps irrégulier")
    data = np.hstack([series["sun"][:, 1:], series["earth"][:, 1:]])
    OUT.mkdir(parents=True, exist_ok=True)
    eid = f"sun_earth_{a.start}_{a.years}y"
    data.astype("<f4").tofile(OUT / f"{eid}.f32")
    dsun = np.linalg.norm(data[:, 0:3], axis=1) / 149_597_870.7
    dearth = np.linalg.norm(data[:, 3:6], axis=1)
    meta = {
        "id": eid, "source": "JPL Horizons (DE440), vecteurs apparents (VEC_CORR='LT+S')",
        "frame": "ICRF (équateur moyen J2000), centre de la Lune (500@301)", "units": "km",
        "start_jd_tdb": float(jd[0]), "step_seconds": round(step_days * 86400), "count": int(len(jd)),
        "file": f"{eid}.f32", "layout": "float32 little-endian : soleil x y z, terre x y z, par point",
        "sun_distance_au": {"min": round(float(dsun.min()), 5), "max": round(float(dsun.max()), 5)},
        "earth_distance_km": {"min": round(float(dearth.min())), "max": round(float(dearth.max()))},
        "retrieved": date.today().isoformat(),
    }
    (OUT / f"{eid}.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")
    index = sorted(p.name for p in OUT.glob("*.json") if p.name != "index.json")
    (OUT / "index.json").write_text(json.dumps(index, indent=2), encoding="utf-8")
    print(f"{eid} : {len(jd)} points ; Soleil {meta['sun_distance_au']} UA ; Terre {meta['earth_distance_km']} km")


if __name__ == "__main__":
    main()
