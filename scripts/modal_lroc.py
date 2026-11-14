"""Fond d'image LROC (photo réelle) pour les cartes, préparé sur Modal.

Source : mosaïque LROC WAC du pôle Sud, 100 m/pixel, stéréographique polaire (même projection
et même sphère que LOLA), de 60°S au pôle, réflectance en float32 (1,39 Go) :
  WAC_GLOBAL_P900S0000_100M, LROC RDR (Arizona State University / NASA, PDS)
  https://pds.lroc.asu.edu/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/DATA/BDR/WAC_GLOBAL/
La mosaïque est téléchargée une fois dans le volume Modal « lunar-dem ». Seuls les produits
réduits reviennent sur le poste :
  data/lroc/south_pole_wac_400m.jpg + .json  fond de la carte du pôle : même emprise que le MNT
                                            réduit (±457 km, jusqu'à 75°S), 3 × plus fin (400 m)
  data/horizon_maps/<id>.wac.u8            image 8 bits sur la grille 200 m de chaque région
                                            (métadonnées <id>.json complétées : files.wac)

Usage (racine du dépôt) :  modal run scripts/modal_lroc.py
"""
import json
from pathlib import Path

import modal

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
URL = ("https://pds.lroc.asu.edu/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/DATA/BDR/WAC_GLOBAL/"
       "WAC_GLOBAL_P900S0000_100M.IMG")
SIZE = 1_387_190_024
N, OFFSET, RES, HEADER = 18622, 9310.5, 100.0, 74488   # label : 1 enregistrement de 74 488 octets

image = modal.Image.debian_slim(python_version="3.13").apt_install("curl", "ca-certificates") \
    .pip_install("numpy==2.5.4", "pillow==11.3.0")
vol = modal.Volume.from_name("lunar-dem", create_if_missing=True)
app = modal.App("lunar-lroc", image=image)
MNT = "/data"


@app.function(volumes={MNT: vol}, cpu=4.0, memory=16384, timeout=3600)
def prepare(regions: list[dict]) -> dict:
    import io
    import os
    import subprocess
    import numpy as np
    from PIL import Image

    path = f"{MNT}/WAC_GLOBAL_P900S0000_100M.IMG"
    if not (os.path.exists(path) and os.path.getsize(path) == SIZE):
        subprocess.run(["curl", "-fsSL", "--retry", "10", "-C", "-", "-o", path + ".part", URL], check=True)
        os.replace(path + ".part", path)
        vol.commit()
    img = np.memmap(path, dtype="<f4", mode="r", offset=HEADER, shape=(N, N))

    def sample(x, y):
        """Réflectance bilinéaire en x, y (m) ; NaN sans donnée."""
        c = x / RES + OFFSET
        r = OFFSET - y / RES
        c0 = np.clip(np.floor(c).astype(np.int64), 0, N - 2)
        r0 = np.clip(np.floor(r).astype(np.int64), 0, N - 2)
        a, b = c - c0, r - r0
        v = [img[r0, c0], img[r0, c0 + 1], img[r0 + 1, c0], img[r0 + 1, c0 + 1]]
        v = [np.where(q < -1e30, np.nan, q).astype(np.float64) for q in v]
        return v[0] * (1 - a) * (1 - b) + v[1] * a * (1 - b) + v[2] * (1 - a) * b + v[3] * a * b

    def render(x_min, y_max, pixel, w, h, sub):
        """Moyenne de sub×sub échantillons par pixel (anti-crénelage), traitée par bandes de lignes."""
        out = np.empty((h, w))
        offs = (np.arange(sub) + 0.5) / sub * pixel
        xs = x_min + np.arange(w)[:, None] * pixel + offs[None, :]
        for r0 in range(0, h, 128):
            rows = np.arange(r0, min(h, r0 + 128))
            ys = y_max - rows[:, None] * pixel - offs[None, :]
            X = np.broadcast_to(xs.reshape(1, 1, w, sub), (len(rows), sub, w, sub))
            Y = np.broadcast_to(ys.reshape(len(rows), sub, 1, 1), (len(rows), sub, w, sub))
            with np.errstate(all="ignore"):
                out[rows] = np.nanmean(sample(X, Y), axis=(1, 3))
        return out

    def to_u8(a):
        ok = np.isfinite(a)
        lo, hi = np.percentile(a[ok], [1.0, 99.5])
        g = np.clip((a - lo) / (hi - lo), 0, 1) ** (1 / 1.6)   # gamma : déboucher les ombres
        return np.where(ok, np.round(g * 254) + 1, 0).astype(np.uint8), float(lo), float(hi)

    res = {}
    # Fond de carte : grille du MNT réduit (762 × 1200 m) subdivisée par 3
    W = 762 * 3
    base = render(-457380.0, 457380.0, 400.0, W, W, sub=4)
    u8, lo, hi = to_u8(base)
    buf = io.BytesIO()
    Image.fromarray(u8).save(buf, format="JPEG", quality=88, optimize=True)
    res["lroc/south_pole_wac_400m.jpg"] = buf.getvalue()
    res["lroc/south_pole_wac_400m.json"] = json.dumps({
        "file": "south_pole_wac_400m.jpg", "rows": W, "cols": W, "pixel_m": 400.0,
        "x_m_of_col": "(col + 0.5) * 400.0 - 457380.0", "y_m_of_row": "457380.0 - (row + 0.5) * 400.0",
        "projection": "stéréographique polaire sud, sphère R=1737400 m, lon 0° vers le haut (comme le MNT réduit)",
        "encoding": "JPEG niveaux de gris ; 0 = pas de donnée ; étirement 1–99,5 % et gamma 1/1,6",
        "reflectance_range": [lo, hi],
        "source": "LROC WAC_GLOBAL_P900S0000_100M (NASA/GSFC/Arizona State University), moyenne de 16 échantillons par pixel",
    }, indent=2, ensure_ascii=False).encode()
    # Images par région (grille 200 m des cartes d'horizon)
    for m in regions:
        a = render(m["x_min_m"], m["y_max_m"], m["pixel_m"], m["width"], m["height"], sub=2)
        u8, lo, hi = to_u8(a)
        res[f"horizon_maps/{m['id']}.wac.u8"] = u8.tobytes()
        res[f"horizon_maps/{m['id']}.wac.range"] = json.dumps([lo, hi]).encode()
    return res


@app.local_entrypoint()
def main():
    maps = ROOT / "data" / "horizon_maps"
    index = json.loads((maps / "index.json").read_text(encoding="utf-8"))
    metas = [json.loads((maps / e["file"]).read_text(encoding="utf-8")) for e in index]
    res = prepare.remote([{k: m[k] for k in ("id", "x_min_m", "y_max_m", "pixel_m", "width", "height")} for m in metas])
    for name, data in res.items():
        if name.endswith(".range"):
            continue
        p = ROOT / "data" / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)
        print(f"{name} : {len(data) / 1e6:.2f} Mo")
    for m in metas:
        rid = m["id"]
        lo, hi = json.loads(res[f"horizon_maps/{rid}.wac.range"])
        m["files"]["wac"] = f"{rid}.wac.u8"
        m.setdefault("encoding", {})["wac"] = (
            f"uint8, image LROC WAC (0 = pas de donnée ; 1–255 = réflectance {lo:.4f}–{hi:.4f}, gamma 1/1,6)")
        (maps / f"{rid}.json").write_text(json.dumps(m, indent=2, ensure_ascii=False), encoding="utf-8")
