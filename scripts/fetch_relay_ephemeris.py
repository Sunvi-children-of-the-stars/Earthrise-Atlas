"""Orbite d'un satellite relais lunaire (par défaut LRO) depuis JPL Horizons.

On télécharge la position du satellite par rapport au centre de la Lune (repère ICRF/J2000,
en km), au pas d'une minute. L'application la convertit dans le repère lunaire avec le même
modèle d'orientation que pour le Soleil et la Terre, puis calcule les passages au-dessus de
l'horizon de n'importe quel site.

Horizons limite la taille d'une réponse : la période est découpée en tranches de 30 jours.
Les dates des vecteurs Horizons sont en TDB (≈ TT = UTC + 69,2 s).

Sorties (data/relays/) :
  <id>.f32   positions x, y, z (km, float32 little-endian), une ligne par minute
  <id>.json  métadonnées (début en JD TDB, pas, nombre de points, source)

Usage : .venv/Scripts/python scripts/fetch_relay_ephemeris.py [--start 2026-11-01] [--days 181]
"""
import argparse
import json
import time
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "relays"
API = "https://ssd.jpl.nasa.gov/api/horizons.api"
SPACECRAFT = {"lro": {"command": "-85", "name": "LRO (Lunar Reconnaissance Orbiter)"}}


def fetch_chunk(command, start, stop, step="1m"):
    params = {
        "format": "json", "COMMAND": f"'{command}'", "EPHEM_TYPE": "'VECTORS'", "CENTER": "'500@301'",
        "REF_SYSTEM": "'ICRF'", "REF_PLANE": "'FRAME'", "VEC_TABLE": "'1'", "OUT_UNITS": "'KM-S'",
        "CSV_FORMAT": "'YES'", "VEC_LABELS": "'NO'", "START_TIME": f"'{start}'", "STOP_TIME": f"'{stop}'",
        "STEP_SIZE": f"'{step}'",
    }
    url = API + "?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=300) as r:
        res = json.loads(r.read().decode())["result"]
    if "$$SOE" not in res:
        raise RuntimeError(res[-600:])
    body = res.split("$$SOE")[1].split("$$EOE")[0].strip().splitlines()
    rows = []
    for line in body:
        p = [v.strip() for v in line.split(",")]
        rows.append((float(p[0]), float(p[2]), float(p[3]), float(p[4])))  # JD TDB, x, y, z
    return np.array(rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sat", default="lro")
    ap.add_argument("--start", default="2026-11-01")
    ap.add_argument("--days", type=int, default=181)
    a = ap.parse_args()
    sc = SPACECRAFT[a.sat]
    d0 = datetime.fromisoformat(a.start)
    chunks = []
    for k in range(0, a.days, 30):
        s = d0 + timedelta(days=k)
        e = d0 + timedelta(days=min(k + 30, a.days))
        t = time.time()
        arr = fetch_chunk(sc["command"], s.strftime("%Y-%m-%d %H:%M"), e.strftime("%Y-%m-%d %H:%M"))
        if chunks:  # la borne de début répète la dernière ligne de la tranche précédente
            arr = arr[1:]
        chunks.append(arr)
        print(f"  {s:%Y-%m-%d} → {e:%Y-%m-%d} : {len(arr)} points en {time.time() - t:.0f} s")
    data = np.vstack(chunks)
    step_days = float(np.median(np.diff(data[:, 0])))
    if np.abs(np.diff(data[:, 0]) - step_days).max() > 1e-6:
        raise RuntimeError("pas de temps irrégulier")
    OUT.mkdir(parents=True, exist_ok=True)
    rid = f"{a.sat}_{a.start}_{a.days}d"
    data[:, 1:].astype("<f4").tofile(OUT / f"{rid}.f32")
    r = np.linalg.norm(data[:, 1:], axis=1)
    meta = {
        "id": rid, "satellite": sc["name"], "horizons_command": sc["command"],
        "frame": "ICRF (équateur moyen J2000), centre de la Lune (500@301)", "units": "km",
        "start_jd_tdb": float(data[0, 0]), "step_seconds": round(step_days * 86400), "count": int(len(data)),
        "file": f"{rid}.f32", "layout": "float32 little-endian, x y z par point",
        "altitude_km": {"min": round(float(r.min() - 1737.4), 1), "max": round(float(r.max() - 1737.4), 1)},
        "retrieved": date.today().isoformat(),
        "note": "Éphéméride de prévision (Horizons) : la précision du minutage diminue loin dans le futur.",
    }
    (OUT / f"{rid}.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")
    index = sorted(p.name for p in OUT.glob("*.json") if p.name != "index.json")
    index.sort(key=lambda n: (not n.startswith("lro"), n))  # éphéméride réelle LRO en premier, modèles ensuite
    (OUT / "index.json").write_text(json.dumps(index, indent=2), encoding="utf-8")
    print(f"{rid} : {len(data)} points, altitude {meta['altitude_km']['min']}–{meta['altitude_km']['max']} km")


if __name__ == "__main__":
    main()
