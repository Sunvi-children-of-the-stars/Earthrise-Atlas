"""Orbites MODÈLES de relais lunaires absents de JPL Horizons : Gateway (NRHO) et Queqiao-2.

Ce ne sont pas des éphémérides réelles : ce sont des orbites képlériennes qui reproduisent la
géométrie publiée (altitudes, inclinaison, période, apolune au-dessus du pôle Sud). Elles
servent à comparer la couverture de ces relais avec celle de LRO, pas à prévoir un passage
à la minute près. Les fichiers portent `"kind": "model"`.

* Gateway, NRHO 9:2 sud (orbite de halo quasi rectiligne autour de L2) :
  - périlune à ~1 600 km d'altitude, apolune à ~70 000 km, période 6,56 j (NASA) ;
  - le plan de la NRHO reste fixe dans le repère Terre-Lune en rotation. La Lune étant en
    rotation synchrone, ce repère est, à peu près, le repère lunaire fixe : on décrit donc
    l'orbite directement dans ce repère (`frame_kind: "body-fixed"`) ;
  - plan perpendiculaire à la direction de la Terre (axe x), apolune au-dessus du pôle Sud,
    incliné de 15° vers la face cachée (côté L2). Gateway reste ainsi toujours visible de la
    Terre, comme la vraie NRHO ;
  - limite : une NRHO n'est pas képlérienne (perturbation de la Terre). On garde la forme
    d'une ellipse de mêmes périlune et apolune, parcourue avec la période réelle de 6,56 j.
* Queqiao-2, orbite elliptique gelée de 12 h (phase Chang'e-6, 2024) :
  - périlune à 300 km, apolune à 8 600 km, inclinaison 54,8° sur l'équateur lunaire ;
  - argument du périlune 90° : apolune au sud, au-dessus de la face cachée sud ;
  - orbite inertielle (repère ICRF). La longitude du nœud n'est pas publiée : on prend 0,
    ce qui fixe la phase des passages mais pas leur fréquence ni leur durée.

Sorties (data/relays/) : <id>.f32 (x y z en km, float32, un point toutes les 2 min) et
<id>.json. L'index garde LRO en premier.

Usage : .venv/Scripts/python scripts/build_relay_models.py [--start 2026-11-01] [--days 181]
"""
import argparse
import json
from datetime import date, datetime, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "relays"
R_MOON = 1737.4                  # km
GM_MOON = 4902.800               # km³/s²
STEP_S = 120
# Pôle nord lunaire dans l'ICRF (IAU 2009, termes constants ; les termes périodiques < 0,1°)
POLE_RA, POLE_DEC = np.radians(269.9949), np.radians(66.5392)


def kepler_E(M, e):
    E = M.copy()
    for _ in range(30):
        E -= (E - e * np.sin(E) - M) / (1 - e * np.cos(E))
    return E


def ellipse(t_s, rp, ra, period_s, P, Q, t_peri=0.0):
    """Positions (km) sur l'ellipse de périlune rp, apolune ra, dans le plan (P, Q)."""
    a, e = (rp + ra) / 2, (ra - rp) / (ra + rp)
    M = 2 * np.pi * ((t_s - t_peri) / period_s % 1.0)
    E = kepler_E(M, e)
    x, y = a * (np.cos(E) - e), a * np.sqrt(1 - e * e) * np.sin(E)
    return x[:, None] * P[None, :] + y[:, None] * Q[None, :]


def gateway(t_s):
    tilt = np.radians(15.0)
    apo = np.array([-np.sin(tilt), 0.0, -np.cos(tilt)])   # au-dessus du pôle Sud, vers la face cachée
    P = -apo                                             # périlune : au-dessus du pôle Nord
    Q = np.array([0.0, 1.0, 0.0])                         # plan perpendiculaire à la direction de la Terre
    return ellipse(t_s, R_MOON + 1600.0, R_MOON + 70000.0, 6.56 * 86400, P, Q)


def queqiao2(t_s):
    rp, ra = R_MOON + 300.0, R_MOON + 8600.0
    a = (rp + ra) / 2
    period = 2 * np.pi * np.sqrt(a ** 3 / GM_MOON)        # ≈ 12,1 h
    # Repère inertiel de l'équateur lunaire, exprimé dans l'ICRF
    z = np.array([np.cos(POLE_DEC) * np.cos(POLE_RA), np.cos(POLE_DEC) * np.sin(POLE_RA), np.sin(POLE_DEC)])
    x = np.array([np.cos(POLE_RA + np.pi / 2), np.sin(POLE_RA + np.pi / 2), 0.0])  # nœud ascendant
    y = np.cross(z, x)
    inc, raan, argp = np.radians(54.8), 0.0, np.radians(90.0)
    node = np.cos(raan) * x + np.sin(raan) * y
    h = np.cos(inc) * z - np.sin(inc) * (np.cos(raan) * y - np.sin(raan) * x)  # normale au plan
    m = np.cross(h, node)
    P = np.cos(argp) * node + np.sin(argp) * m
    Q = np.cross(h, P)
    return ellipse(t_s, rp, ra, period, P, Q), period


def write(rid, name, xyz, start_jd_tdb, frame, frame_kind, note):
    xyz.astype("<f4").tofile(OUT / f"{rid}.f32")
    r = np.linalg.norm(xyz, axis=1)
    meta = {
        "id": rid, "satellite": name, "kind": "model", "frame_kind": frame_kind, "frame": frame,
        "units": "km", "start_jd_tdb": start_jd_tdb, "step_seconds": STEP_S, "count": int(len(xyz)),
        "file": f"{rid}.f32", "layout": "float32 little-endian, x y z par point",
        "altitude_km": {"min": round(float(r.min() - R_MOON), 1), "max": round(float(r.max() - R_MOON), 1)},
        "generated": date.today().isoformat(), "note": note,
    }
    (OUT / f"{rid}.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"{rid} : {len(xyz)} points, altitude {meta['altitude_km']['min']}–{meta['altitude_km']['max']} km")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", default="2026-11-01")
    ap.add_argument("--days", type=int, default=181)
    a = ap.parse_args()
    d0 = datetime.fromisoformat(a.start).replace(tzinfo=timezone.utc)
    # Même convention que les fichiers Horizons : instants en TDB (≈ UTC + 69,2 s)
    start_jd_tdb = d0.timestamp() / 86400 + 2440587.5 + 69.2 / 86400
    t = np.arange(0, a.days * 86400 + 1, STEP_S, dtype=float)
    OUT.mkdir(parents=True, exist_ok=True)

    write(f"gateway-model_{a.start}_{a.days}d", "Gateway (modèle NRHO 9:2)", gateway(t), start_jd_tdb,
          "repère lunaire fixe (mean Earth), centre de la Lune", "body-fixed",
          "MODÈLE : ellipse de périlune 1 600 km et apolune 70 000 km, période 6,56 j, apolune au-dessus du pôle Sud. "
          "Géométrie de couverture représentative, pas une éphéméride.")
    xyz, period = queqiao2(t)
    write(f"queqiao2-model_{a.start}_{a.days}d", "Queqiao-2 (modèle, orbite de 12 h)", xyz, start_jd_tdb,
          "ICRF (équateur moyen J2000), centre de la Lune", "icrf",
          f"MODÈLE : orbite képlérienne 300 × 8 600 km, inclinaison 54,8°, apolune au sud, période {period / 3600:.1f} h. "
          "Nœud ascendant non publié (pris à 0) : la phase des passages est arbitraire.")

    entries = sorted(p.name for p in OUT.glob("*.json") if p.name != "index.json")
    entries.sort(key=lambda n: (not n.startswith("lro"), n))  # LRO (éphéméride réelle) en premier
    (OUT / "index.json").write_text(json.dumps(entries, indent=2), encoding="utf-8")
    print("index :", entries)


if __name__ == "__main__":
    main()
