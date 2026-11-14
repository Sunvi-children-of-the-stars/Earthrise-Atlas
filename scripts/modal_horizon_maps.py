"""Calcul des cartes d'horizon sur Modal (une région par conteneur, en parallèle).

Même code que le calcul local (scripts/build_horizon_maps.py), exécuté dans le cloud :
* les MNT LOLA (LDEM_80S_20M, 1,85 Go ; LDEM_75S_120M, 116 Mo) sont téléchargés une seule fois
  depuis le PDS dans un volume Modal persistant (« lunar-dem ») ;
* chaque région est calculée dans son propre conteneur ; les fichiers reviennent dans
  data/horizon_maps/, puis l'index est réécrit localement.

Usage (depuis la racine du dépôt, compte Modal configuré) :
    modal run scripts/modal_horizon_maps.py                       # toutes les régions
    modal run scripts/modal_horizon_maps.py --regions mons-mouton,haworth
Ensuite : .venv/Scripts/python scripts/build_psr.py   (ombres permanentes, ~10 s par région)
"""
from pathlib import Path

import modal

HERE = Path(__file__).resolve().parent
PDS = ("https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/"
       "data/lola_gdr/polar/img/")
DEM_FILES = {"ldem_80s_20m.img": 1_848_320_000, "ldem_75s_120m.img": 116_250_752,
             "ldem_80s_20m.lbl": None, "ldem_75s_120m.lbl": None}

image = (
    modal.Image.debian_slim(python_version="3.13")
    .apt_install("curl", "ca-certificates")
    .pip_install("numpy==2.5.4")
    .add_local_file(HERE / "lunar_dem.py", "/root/scripts/lunar_dem.py")
    .add_local_file(HERE / "tiled_dem.py", "/root/scripts/tiled_dem.py")
    .add_local_file(HERE / "build_horizon_maps.py", "/root/scripts/build_horizon_maps.py")
)
dem = modal.Volume.from_name("lunar-dem", create_if_missing=True)
app = modal.App("lunar-horizon-maps", image=image)
DEM_MOUNT = "/root/data/dem"   # = DEM_DIR des scripts (racine du dépôt = /root)


@app.function(volumes={DEM_MOUNT: dem}, timeout=3600)
def fetch_dem() -> dict:
    """Télécharge les MNT manquants dans le volume (vérification TLS normale, reprise possible)."""
    import os
    import subprocess
    sizes = {}
    for name, expected in DEM_FILES.items():
        dst = f"{DEM_MOUNT}/{name}"
        if not (os.path.exists(dst) and (expected is None or os.path.getsize(dst) == expected)):
            subprocess.run(["curl", "-fsSL", "--retry", "10", "-C", "-", "-o", dst + ".part", PDS + name], check=True)
            os.replace(dst + ".part", dst)
        sizes[name] = os.path.getsize(dst)
        if expected is not None and sizes[name] != expected:
            raise RuntimeError(f"{name} : {sizes[name]} octets au lieu de {expected}")
    dem.commit()
    return sizes


@app.function(volumes={DEM_MOUNT: dem}, cpu=2.0, memory=8192, timeout=3 * 3600)
def build_region(region_id: str) -> dict:
    import sys
    sys.path.insert(0, "/root/scripts")
    import build_horizon_maps as bhm
    from tiled_dem import RASTERS, Raster
    assert RASTERS[20][0] == "ldem_80s_20m.img", RASTERS[20]
    region = next(r for r in bhm.REGIONS if r["id"] == region_id)
    bhm.build(region, {20: Raster(20), 120: Raster(120)})
    return {p.name: p.read_bytes() for p in bhm.OUT.glob(f"{region_id}.*")}


@app.local_entrypoint()
def main(regions: str = ""):
    import json
    src = (HERE / "build_horizon_maps.py").read_text(encoding="utf-8")
    # liste des régions sans importer numpy localement
    ids = [line.split('"id": "')[1].split('"')[0] for line in src.splitlines() if '{"id": "' in line]
    wanted = [r for r in regions.split(",") if r] or ids
    unknown = set(wanted) - set(ids)
    if unknown:
        raise SystemExit(f"régions inconnues : {sorted(unknown)} (connues : {ids})")
    print("MNT dans le volume :", fetch_dem.remote())
    out = HERE.parent / "data" / "horizon_maps"
    out.mkdir(parents=True, exist_ok=True)
    for rid, files in zip(wanted, build_region.map(wanted)):
        for name, data in files.items():
            (out / name).write_bytes(data)
        meta = json.loads(files[f"{rid}.json"])
        print(f"{rid} : {meta['width']}×{meta['height']} px, {meta['seconds']} s, {meta['relief']}")
    print("Index : lancer  .venv/Scripts/python scripts/build_horizon_maps.py --index")
