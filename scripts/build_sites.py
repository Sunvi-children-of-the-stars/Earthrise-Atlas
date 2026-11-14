"""Membre 2 — Base de données des sites et caractéristiques topographiques.

Pour chaque site :
  * altitude, pentes, relief environnant (MNT LOLA 20 m quand il existe, sinon 120 m) ;
  * masque d'horizon multi-résolution (relief proche à 20 m, lointain à 120 m, courbure lunaire) ;
  * obstacles principaux (secteurs où le relief masque le ciel) ;
  * pré-indicateurs d'éclairement / visibilité Terre calculés avec un modèle orbital
    SIMPLIFIÉ, destinés uniquement à valider les masques. Les valeurs de référence
    viendront des éphémérides JPL Horizons (membre 1) et de l'analyse du membre 4.

Usage :  .venv/Scripts/python scripts/build_sites.py
"""
import csv
import json
from datetime import date
from pathlib import Path

import numpy as np

import lunar_dem as ld
from tiled_dem import Raster

ROOT = Path(__file__).resolve().parent.parent
OUT_SITES = ROOT / "data" / "sites"
OUT_HZ = ROOT / "data" / "horizons"
OUT_PREVIEW = ROOT / "data" / "dem" / "preview"

N_AZ = 720            # pas de 0,5° en azimut
MAX_DIST = 300_000.0  # m ; au-delà, la courbure cache tout relief lunaire
H_OBS = 2.0           # m ; hauteur de l'antenne / du panneau au-dessus du sol

# ----------------------------------------------------------------------------
# Catalogue des sites
# ----------------------------------------------------------------------------
# "pick": point exact choisi automatiquement = point le plus haut du MNT dans
# un rayon donné autour de la position approximative (sommets / crêtes).
SITES = [
    {
        "id": "connecting-ridge",
        "name": "Crête de liaison Shackleton – de Gerlache",
        "short": "Connecting Ridge",
        "category": "candidat",
        "region": "Pôle Sud (< 15 km du pôle)",
        "context": "Région candidate Artemis III (liste NASA 2022). Crête étroite reliant les "
                   "remparts des cratères Shackleton et de Gerlache, réputée parmi les mieux "
                   "éclairées du pôle Sud ; voisine de régions en ombre permanente (glace d'eau).",
        "approx": (-89.45, -137.3), "pick_radius_km": 4.0,
        "refs": ["https://www.nasa.gov/news-release/nasa-identifies-candidate-regions-for-landing-next-americans-on-moon/"],
    },
    {
        "id": "malapert-massif",
        "name": "Massif de Malapert (sommet)",
        "short": "Malapert Massif",
        "category": "candidat",
        "region": "Pôle Sud (~120 km du pôle)",
        "context": "Région candidate Artemis III (liste NASA 2024). Massif de ~5 km de haut "
                   "tourné vers la face visible : excellente visibilité de la Terre et "
                   "éclairement prolongé.",
        "approx": (-86.0, 0.0), "pick_radius_km": 15.0,
        "refs": ["https://www.nasa.gov/missions/artemis/artemis-3/nasa-provides-update-on-artemis-iii-moon-landing-regions/"],
    },
    {
        "id": "mons-mouton",
        "name": "Mons Mouton – site d'Athena (IM-2)",
        "short": "Mons Mouton",
        "category": "candidat",
        "region": "Pôle Sud (~160 km du pôle)",
        "context": "Plateau sommital d'une montagne de ~6 km ; site d'atterrissage de la mission "
                   "CLPS IM-2 d'Intuitive Machines (6 mars 2025) et région candidate Artemis III.",
        "lat": -84.7906, "lon": 29.1957,
        "refs": ["https://www.lroc.asu.edu/images/1401", "https://en.wikipedia.org/wiki/IM-2"],
    },
    # ---- Sites de référence (comparaison / pédagogie) ----
    {
        "id": "im1-malapert-a",
        "name": "Près de Malapert A – site d'Odysseus (IM-1)",
        "short": "IM-1 Odysseus",
        "category": "reference",
        "region": "Région polaire sud (~300 km du pôle)",
        "context": "Premier atterrisseur CLPS (22 février 2024), Intuitive Machines.",
        "lat": -80.13, "lon": 1.44,
        "refs": ["https://www.nasa.gov/missions/lro/nasas-lro-images-intuitive-machines-odysseus-lander/"],
    },
    {
        "id": "chandrayaan-3",
        "name": "Statio Shiv Shakti – Chandrayaan-3",
        "short": "Chandrayaan-3",
        "category": "reference",
        "region": "Hautes latitudes sud (~600 km du pôle)",
        "context": "Atterrisseur Vikram de l'ISRO (23 août 2023).",
        "lat": -69.373, "lon": 32.319,
        "refs": ["https://planetarynames.wr.usgs.gov/Feature/16272"],
    },
    {
        "id": "change-6",
        "name": "Bassin Apollo – Chang'e-6",
        "short": "Chang'e-6",
        "category": "reference",
        "region": "Face cachée",
        "context": "Retour d'échantillons de la CNSA (juin 2024). Face cachée : la Terre n'y est "
                   "jamais visible, un satellite relais (Queqiao-2) est indispensable.",
        "lat": -41.6385, "lon": -153.9852,
        "refs": ["https://lroc.im-ldi.com/images/1374"],
    },
    {
        "id": "apollo-11",
        "name": "Mer de la Tranquillité – Apollo 11",
        "short": "Apollo 11",
        "category": "reference",
        "region": "Équateur, face visible",
        "context": "Premier alunissage habité (20 juillet 1969). Contraste équatorial : "
                   "Soleil haut, jours/nuits de ~14,8 jours, Terre quasi au zénith.",
        "lat": 0.67408, "lon": 23.47297,
        "refs": ["https://www.lpi.usra.edu/lunar/missions/apollo/apollo_11/landing_site/"],
    },
]


# ----------------------------------------------------------------------------
# Géométrie
# ----------------------------------------------------------------------------
def destination(lat, lon, az, dist):
    """Point atteint depuis (lat, lon) en suivant l'azimut az sur un grand cercle."""
    la, lo, a = np.radians(lat), np.radians(lon), np.radians(az)
    d = np.asarray(dist) / ld.R_MOON
    la2 = np.arcsin(np.sin(la) * np.cos(d) + np.cos(la) * np.sin(d) * np.cos(a))
    lo2 = lo + np.arctan2(np.sin(a) * np.sin(d) * np.cos(la),
                          np.cos(d) - np.sin(la) * np.sin(la2))
    return np.degrees(la2), (np.degrees(lo2) + 180) % 360 - 180


def best_raster(rasters, lat, lon):
    """Raster le plus fin couvrant le point (20 m si disponible, sinon 120 m)."""
    return rasters[20] if rasters[20].contains(lat, lon) else rasters[120]


def pick_highest(rasters, lat, lon, radius_km, res=None):
    """Point le plus haut du relief dans un disque (sommets, crêtes)."""
    R = rasters[res] if res else best_raster(rasters, lat, lon)
    w, c0, r0 = R.window(lat, lon, radius_km * 1000)
    rp = (w.shape[0] - 1) // 2
    yy, xx = np.mgrid[-rp:rp + 1, -rp:rp + 1]
    masked = np.where(xx ** 2 + yy ** 2 <= rp ** 2, w, -np.inf)
    i, j = np.unravel_index(np.argmax(masked), masked.shape)
    lat2, lon2 = ld.xy_to_latlon(*R.to_xy(c0 + j, r0 + i))
    return round(float(lat2), 5), round(float(lon2), 5)


def _slopes(w, res):
    gy, gx = np.gradient(w.astype(np.float64), res)
    return np.degrees(np.arctan(np.hypot(gx, gy)))


def _disc(w):
    rp = (w.shape[0] - 1) // 2
    yy, xx = np.mgrid[-rp:rp + 1, -rp:rp + 1]
    return xx ** 2 + yy ** 2 <= rp ** 2


def terrain_stats(rasters, lat, lon):
    lr = rasters[120]
    w, _, _ = lr.window(lat, lon, 120)
    out = {"slope_deg_local_240m": round(float(_slopes(w, 120)[1, 1]), 1)}
    for rad_km in (1, 5, 20):
        w, _, _ = lr.window(lat, lon, rad_km * 1000)
        m = _disc(w)
        if rad_km == 1:
            s = _slopes(w, 120)[m]
            out["slope_deg_mean_1km"] = round(float(s.mean()), 1)
            out["slope_deg_max_1km"] = round(float(s.max()), 1)
        v = w[m]
        out[f"relief_{rad_km}km"] = {"min_m": round(float(v.min())), "max_m": round(float(v.max())),
                                     "std_m": round(float(v.std()))}
    # Détail fin (20 m) : pertinent pour la sécurité d'atterrissage
    hr = rasters[20]
    if hr.contains(lat, lon):
        w, _, _ = hr.window(lat, lon, 20)
        hi = {"res_m": 20, "slope_deg_local_40m": round(float(_slopes(w, 20)[1, 1]), 1)}
        for rad in (100, 500):
            w, _, _ = hr.window(lat, lon, rad)
            s = _slopes(w, 20)[_disc(w)]
            hi[f"slope_deg_mean_{rad}m"] = round(float(s.mean()), 1)
            hi[f"slope_deg_max_{rad}m"] = round(float(s.max()), 1)
            hi[f"pct_area_slope_gt_10deg_{rad}m"] = round(100 * float((s > 10).mean()), 1)
        w, _, _ = hr.window(lat, lon, 1000)
        v = w[_disc(w)]
        hi["relief_1km"] = {"min_m": round(float(v.min())), "max_m": round(float(v.max())),
                            "std_m": round(float(v.std()))}
        out["hires"] = hi
    return out


NEAR_FIELD_M = 25_000.0  # en deçà : relief à 20 m (si disponible) ; au-delà : 120 m


def horizon_mask(rasters, lat, lon, h_site):
    """Masque d'horizon multi-résolution, avec courbure lunaire.

    Relief proche (< 25 km) lu à 20 m quand il existe, pas de 20 m à partir de 40 m
    (on évite le pixel même du site) ; relief lointain lu à 120 m, pas de 120 m puis 240 m.
    """
    hr, lr = rasters[20], rasters[120]
    fine = hr.contains(lat, lon)
    az = np.arange(N_AZ) * 360.0 / N_AZ
    near = np.arange(40.0, NEAR_FIELD_M, 20.0) if fine else np.arange(120.0, NEAR_FIELD_M, 120.0)
    far = np.concatenate([np.arange(NEAR_FIELD_M, 50_000, 120.0), np.arange(50_000, MAX_DIST, 240.0)])
    dist = np.concatenate([near, far])
    A, D = np.meshgrid(az, dist, indexing="ij")
    plat, plon = destination(lat, lon, A, D)
    x, y = ld.latlon_to_xy(plat, plon)
    h = lr.sample(x, y)
    res_used = np.full(h.shape, 120.0)
    if fine:
        nn = len(near)
        h20 = hr.sample(x[:, :nn], y[:, :nn])
        ok = ~np.isnan(h20)
        h[:, :nn] = np.where(ok, h20, h[:, :nn])
        res_used[:, :nn] = np.where(ok, 20.0, 120.0)
    theta = D / ld.R_MOON
    r0 = ld.R_MOON + h_site + H_OBS
    r = ld.R_MOON + h
    ang = np.degrees(np.arctan2(r * np.cos(theta) - r0, r * np.sin(theta)))
    ang = np.where(np.isnan(ang), -90.0, ang)
    k = np.argmax(ang, axis=1)
    i = np.arange(N_AZ)
    return {
        "azimuth_deg": az,
        "horizon_elev_deg": ang[i, k],
        "obstacle_dist_km": D[i, k] / 1000,
        "obstacle_lat": plat[i, k], "obstacle_lon": plon[i, k], "obstacle_elev_m": h[i, k],
        "obstacle_res_m": res_used[i, k],
        "coverage": float(np.mean(~np.isnan(h))),
    }


def sphere_horizon(h_site):
    """Horizon d'un sol parfaitement lisse à l'altitude du site (référence « sans relief ») :
    l'horizontale locale, abaissée de ~0,05° par la courbure pour un capteur à 2 m."""
    r = ld.R_MOON + (h_site or 0.0)
    dip = -np.degrees(np.arccos(r / (r + H_OBS)))
    az = np.arange(N_AZ) * 360.0 / N_AZ
    nan = np.full(N_AZ, np.nan)
    return {"azimuth_deg": az, "horizon_elev_deg": np.full(N_AZ, dip), "obstacle_dist_km": nan,
            "obstacle_lat": nan, "obstacle_lon": nan, "obstacle_elev_m": nan,
            "obstacle_res_m": nan, "coverage": 0.0}


def sectors(hz, tr, width=30):
    """Résumé de l'horizon par secteurs de `width`° : relief dominant et part du temps
    (sur l'année simulée) où le Soleil / la Terre se trouvent dans ce secteur mais cachés."""
    e = hz["horizon_elev_deg"]
    s_hidden = tr["s_alt"] <= _hz_interp(hz, tr["s_az"])
    e_hidden = tr["e_alt"] <= _hz_interp(hz, tr["e_az"])
    out = []
    for a0 in range(0, 360, width):
        m = (hz["azimuth_deg"] >= a0) & (hz["azimuth_deg"] < a0 + width)
        j = np.where(m)[0][np.argmax(e[m])]
        s_in = (tr["s_az"] >= a0) & (tr["s_az"] < a0 + width)
        e_in = (tr["e_az"] >= a0) & (tr["e_az"] < a0 + width)
        out.append({
            "az_from_deg": a0, "az_to_deg": a0 + width,
            "horizon_max_deg": round(float(e[j]), 2),
            "horizon_mean_deg": round(float(e[m].mean()), 2),
            "dominant_obstacle_dist_km": round(float(hz["obstacle_dist_km"][j]), 1),
            "dominant_obstacle_lat": round(float(hz["obstacle_lat"][j]), 3),
            "dominant_obstacle_lon": round(float(hz["obstacle_lon"][j]), 3),
            "dominant_obstacle_elev_m": round(float(hz["obstacle_elev_m"][j])),
            "sun_in_sector_pct_time": round(100 * float(s_in.mean()), 1),
            "sun_hidden_in_sector_pct_time": round(100 * float((s_in & s_hidden).mean()), 1),
            "earth_in_sector_pct_time": round(100 * float(e_in.mean()), 1),
            "earth_hidden_in_sector_pct_time": round(100 * float((e_in & e_hidden).mean()), 1),
        })
    return out


def obstacles(hz, dip, tr, threshold=0.5):
    """Secteurs d'azimut contigus où le relief s'élève à plus de `threshold`° au-dessus de
    l'horizontale locale, avec la part du temps où il masque le Soleil / la Terre alors
    qu'ils seraient visibles sur un sol lisse."""
    e = hz["horizon_elev_deg"]
    above = e > threshold
    step = 360.0 / N_AZ
    hz_s = _hz_interp(hz, tr["s_az"])
    hz_e = _hz_interp(hz, tr["e_az"])
    sun_blocked = (tr["s_alt"] > dip) & (tr["s_alt"] <= hz_s)
    earth_blocked = (tr["e_alt"] > dip) & (tr["e_alt"] <= hz_e)
    s_idx = (np.round(tr["s_az"] / step).astype(int)) % N_AZ
    e_idx = (np.round(tr["e_az"] / step).astype(int)) % N_AZ
    if not above.any():
        return []
    if above.all():
        starts = [0]
        ends = [N_AZ - 1]
    else:
        shift = int(np.argmin(above))  # démarre sur un point libre pour gérer 360→0
        idx = (np.arange(N_AZ) + shift) % N_AZ
        a = above[idx]
        edges = np.diff(np.concatenate([[0], a.astype(int), [0]]))
        starts = [idx[s] for s in np.where(edges == 1)[0]]
        ends = [idx[s - 1] for s in np.where(edges == -1)[0]]
    out = []
    for s, t in zip(starts, ends):
        sect = (np.arange(s, s + ((t - s) % N_AZ) + 1)) % N_AZ
        j = sect[np.argmax(e[sect])]
        in_sect = np.zeros(N_AZ, bool)
        in_sect[sect] = True
        out.append({
            "sun_blocked_pct_time": round(100 * float((sun_blocked & in_sect[s_idx]).mean()), 1),
            "earth_blocked_pct_time": round(100 * float((earth_blocked & in_sect[e_idx]).mean()), 1),
            "az_from_deg": round(s * step, 1), "az_to_deg": round(t * step, 1),
            "width_deg": round(len(sect) * step, 1),
            "peak_az_deg": round(j * step, 1), "peak_elev_deg": round(float(e[j]), 2),
            "peak_dist_km": round(float(hz["obstacle_dist_km"][j]), 1),
            "peak_lat": round(float(hz["obstacle_lat"][j]), 3),
            "peak_lon": round(float(hz["obstacle_lon"][j]), 3),
            "peak_terrain_elev_m": round(float(hz["obstacle_elev_m"][j])),
            "peak_dem_res_m": int(hz["obstacle_res_m"][j]),
        })
    return sorted(out, key=lambda o: (-(o["sun_blocked_pct_time"] + o["earth_blocked_pct_time"]),
                                      -o["peak_elev_deg"]))


# ----------------------------------------------------------------------------
# Modèle orbital simplifié (validation uniquement)
# ----------------------------------------------------------------------------
def _enu(lat, lon):
    la, lo = np.radians(lat), np.radians(lon)
    up = np.array([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)])
    east = np.array([-np.sin(lo), np.cos(lo), 0.0])
    north = np.cross(up, east)
    return east, north, up


def _alt_az(site_lat, site_lon, site_h, sub_lat, sub_lon, dist_m):
    e, n, u = _enu(site_lat, site_lon)
    sla, slo = np.radians(sub_lat), np.radians(sub_lon)
    body = dist_m[:, None] * np.stack([np.cos(sla) * np.cos(slo), np.cos(sla) * np.sin(slo),
                                       np.sin(sla)], axis=1)
    v = body - (ld.R_MOON + site_h) * u          # parallaxe incluse (importante pour la Terre)
    v /= np.linalg.norm(v, axis=1)[:, None]
    alt = np.degrees(np.arcsin(v @ u))
    az = np.degrees(np.arctan2(v @ e, v @ n)) % 360
    return alt, az


def tracks(lat, lon, h_site):
    """Trajectoires simplifiées du Soleil et de la Terre sur une année draconitique (pas 1 h)."""
    t = np.arange(0, 346.62, 1 / 24)
    # Soleil : latitude subsolaire ±1,54°, longitude subsolaire tourne en 29,53 j
    s_alt, s_az = _alt_az(lat, lon, h_site, 1.543 * np.sin(2 * np.pi * t / 346.62),
                          -360 * t / 29.5306, np.full(t.size, 1.496e11))
    # Terre : librations optiques ~ ±6,7° (lat, 27,21 j) et ~ ±7,9° (lon, 27,55 j)
    e_alt, e_az = _alt_az(lat, lon, h_site, 6.68 * np.sin(2 * np.pi * t / 27.2122),
                          7.9 * np.sin(2 * np.pi * t / 27.5545), np.full(t.size, 3.844e8))
    return {"s_alt": s_alt, "s_az": s_az, "e_alt": e_alt, "e_az": e_az}


def _hz_interp(hz, a):
    az, el = hz["azimuth_deg"], hz["horizon_elev_deg"]
    return np.interp(a, np.append(az, 360.0), np.append(el, el[0]))


def _circular_range(a):
    """Plage d'azimuts [début, fin] (sens horaire) couverte par a, en gérant 360→0."""
    c = np.degrees(np.arctan2(np.sin(np.radians(a)).mean(), np.cos(np.radians(a)).mean()))
    rel = (a - c + 180) % 360 - 180
    if np.ptp(rel) > 340:
        return [0.0, 360.0]
    return [round(float((c + np.percentile(rel, 0.5)) % 360), 1),
            round(float((c + np.percentile(rel, 99.5)) % 360), 1)]


def pre_indicators(h_site, hz, tr):
    s_alt, s_az, e_alt, e_az = tr["s_alt"], tr["s_az"], tr["e_alt"], tr["e_az"]
    dip = sphere_horizon(h_site)["horizon_elev_deg"][0]
    sun_vis = s_alt > _hz_interp(hz, s_az)
    earth_vis = e_alt > _hz_interp(hz, e_az)
    return {
        "_note": "Modèle orbital simplifié (Soleil et Terre ponctuels, librations sinusoïdales). "
                 "Sert à valider les masques d'horizon ; à remplacer par JPL Horizons (membre 1).",
        "sun_elev_max_deg": round(float(s_alt.max()), 2),
        "sun_illumination_pct_terrain": round(100 * float(sun_vis.mean()), 1),
        "sun_illumination_pct_no_terrain": round(100 * float((s_alt > dip).mean()), 1),
        "earth_elev_min_deg": round(float(e_alt.min()), 2),
        "earth_elev_max_deg": round(float(e_alt.max()), 2),
        "earth_az_range_deg": _circular_range(e_az),
        "earth_visibility_pct_terrain": round(100 * float(earth_vis.mean()), 1),
        "earth_visibility_pct_no_terrain": round(100 * float((e_alt > dip).mean()), 1),
    }


# ----------------------------------------------------------------------------
def export_preview(dem, factor=10):
    """MNT sous-échantillonné (1,2 km/px) pour la carte de l'application React."""
    OUT_PREVIEW.mkdir(parents=True, exist_ok=True)
    n = ld.N // factor
    small = dem[:n * factor, :n * factor].reshape(n, factor, n, factor).mean(axis=(1, 3))
    np.round(small).astype("<i2").tofile(OUT_PREVIEW / "south_pole_dem_1200m.i16")
    meta = {
        "file": "south_pole_dem_1200m.i16", "dtype": "int16 little-endian", "unit": "m",
        "rows": n, "cols": n, "pixel_m": ld.SCALE * factor,
        "projection": "stéréographique polaire sud, sphère R=1737400 m, lon 0° vers le haut",
        "x_m_of_col": f"(col + 0.5) * {ld.SCALE * factor} - {ld.CENTER * ld.SCALE}",
        "y_m_of_row": f"{ld.CENTER * ld.SCALE} - (row + 0.5) * {ld.SCALE * factor}",
        "lat_lon_from_xy": "rho=hypot(x,y); lat=2*atan(rho/(2R))-90°; lon=atan2(x,y)",
        "min_m": int(small.min()), "max_m": int(small.max()),
        "source": "LOLA LDEM_75S_120M (PDS), moyenne par blocs 10x10",
    }
    (OUT_PREVIEW / "south_pole_dem_1200m.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False),
                                                           encoding="utf-8")


def main():
    OUT_SITES.mkdir(parents=True, exist_ok=True)
    OUT_HZ.mkdir(parents=True, exist_ok=True)
    dem = ld.load()  # 120 m en float, pour l'aperçu de carte
    rasters = {20: Raster(20), 120: Raster(120)}
    db = []
    for s in SITES:
        site = {k: v for k, v in s.items() if k not in ("approx", "pick_radius_km")}
        if "approx" in s:
            site["lat"], site["lon"] = pick_highest(rasters, *s["approx"], s["pick_radius_km"])
            res = best_raster(rasters, site["lat"], site["lon"]).res
            site["coord_method"] = (f"Point le plus haut du MNT LOLA à {res} m dans un rayon de "
                                    f"{s['pick_radius_km']} km autour de {s['approx']}")
            old = pick_highest(rasters, *s["approx"], s["pick_radius_km"], res=120)
            site["previous_point_120m"] = {"lat": old[0], "lon": old[1]}
        else:
            site["coord_method"] = "Coordonnées publiées (voir refs)"
        lat, lon = site["lat"], site["lon"]
        site["in_dem"] = ld.in_dem(lat, lon)
        site["dist_to_pole_km"] = round(np.radians(90 + lat) * ld.R_MOON / 1000, 1)
        if site["in_dem"]:
            R = best_raster(rasters, lat, lon)
            h = float(R.sample(*ld.latlon_to_xy(lat, lon)))
            site["elevation_m"] = round(h)
            site["elevation_res_m"] = R.res
            site["terrain"] = terrain_stats(rasters, lat, lon)
            hz = horizon_mask(rasters, lat, lon, h)
            site["horizon_source"] = ("LOLA LDEM_85S_20M (< 25 km) + LDEM_75S_120M (au-delà)"
                                      if R.res == 20 else "LOLA LDEM_75S_120M")
        else:
            h = 0.0
            site["elevation_m"] = None
            site["terrain"] = None
            hz = sphere_horizon(h)
            site["horizon_source"] = "sphère lisse (site hors de l'emprise du MNT polaire)"
        e = hz["horizon_elev_deg"]
        site["horizon"] = {
            "file": f"horizons/{site['id']}.json",
            "max_elev_deg": round(float(e.max()), 2),
            "max_elev_az_deg": round(float(hz["azimuth_deg"][np.argmax(e)]), 1),
            "mean_elev_deg": round(float(e.mean()), 2),
            "pct_azimuths_above_1deg": round(100 * float((e > 1).mean()), 1),
            "dem_coverage_pct": round(100 * hz["coverage"], 1),
        }
        tr = tracks(lat, lon, h)
        dip = float(sphere_horizon(h)["horizon_elev_deg"][0])
        site["horizon"]["flat_ground_horizon_deg"] = round(dip, 3)
        site["obstacles"] = obstacles(hz, dip, tr)[:6] if site["in_dem"] else []
        site["horizon_sectors"] = sectors(hz, tr) if site["in_dem"] else []
        site["pre_indicators"] = pre_indicators(h, hz, tr)
        db.append(site)

        # Masque d'horizon : CSV (lisible) + JSON (application React)
        with open(OUT_HZ / f"{site['id']}.csv", "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["azimuth_deg", "horizon_elev_deg", "obstacle_dist_km",
                        "obstacle_lat", "obstacle_lon", "obstacle_elev_m", "obstacle_res_m"])
            for row in zip(*(hz[k] for k in ("azimuth_deg", "horizon_elev_deg", "obstacle_dist_km",
                                             "obstacle_lat", "obstacle_lon", "obstacle_elev_m",
                                             "obstacle_res_m"))):
                w.writerow(["" if np.isnan(v) else round(float(v), 4) for v in row])
        (OUT_HZ / f"{site['id']}.json").write_text(json.dumps({
            "site_id": site["id"], "observer_height_m": H_OBS, "azimuth_convention":
                "degrés depuis le nord local, sens horaire (90 = est)",
            "azimuth_deg": [round(float(a), 2) for a in hz["azimuth_deg"]],
            "horizon_elev_deg": [round(float(v), 3) for v in e],
            # distance de l'obstacle qui forme l'horizon (km) : sert à signaler les cas fragiles
            "obstacle_dist_km": [None if np.isnan(v) else round(float(v), 1) for v in hz["obstacle_dist_km"]],
        }), encoding="utf-8")
        print(f"{site['short']:<18} {lat:9.4f} {lon:9.4f}  h={site['elevation_m']}  "
              f"hz_max={site['horizon']['max_elev_deg']:.2f}°  "
              f"soleil={site['pre_indicators']['sun_illumination_pct_terrain']}%  "
              f"terre={site['pre_indicators']['earth_visibility_pct_terrain']}%")

    out = {
        "generated": date.today().isoformat(),
        "dem": {"products": ["LOLA LDEM_85S_20M (relief proche < 25 km, sites au sud de ~85°S)",
                             "LOLA LDEM_75S_120M (relief lointain et sites jusqu'à 75°S)"],
                "url": "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/",
                "height_reference": "rayon - 1 737 400 m"},
        "conventions": {"lat": "degrés, négatif = sud", "lon": "degrés Est, [-180, 180]",
                        "azimuth": "degrés depuis le nord local, sens horaire",
                        "observer_height_m": H_OBS},
        "sites": db,
    }
    (OUT_SITES / "sites.json").write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")

    # Tableau récapitulatif (Excel / pandas / membre 5)
    with open(OUT_SITES / "sites_summary.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["id", "nom", "categorie", "lat", "lon", "dist_pole_km", "altitude_m",
                    "pente_locale_deg", "pente_moy_1km_deg", "relief_std_5km_m",
                    "horizon_max_deg", "horizon_max_az_deg", "horizon_moyen_deg",
                    "obstacle_principal", "soleil_max_deg", "eclairement_pct_relief",
                    "eclairement_pct_sol_lisse", "terre_az_min_deg", "terre_az_max_deg",
                    "terre_visible_pct_relief", "terre_visible_pct_sol_lisse"])
        for s in db:
            t, hz, p = s["terrain"] or {}, s["horizon"], s["pre_indicators"]
            o = s["obstacles"][0] if s["obstacles"] else None
            w.writerow([
                s["id"], s["name"], s["category"], s["lat"], s["lon"], s["dist_to_pole_km"],
                s["elevation_m"], t.get("slope_deg_local_240m"), t.get("slope_deg_mean_1km"),
                (t.get("relief_5km") or {}).get("std_m"),
                hz["max_elev_deg"], hz["max_elev_az_deg"], hz["mean_elev_deg"],
                (f"{o['peak_elev_deg']}° az {o['peak_az_deg']}° à {o['peak_dist_km']} km"
                 if o else ""),
                p["sun_elev_max_deg"], p["sun_illumination_pct_terrain"],
                p["sun_illumination_pct_no_terrain"], *p["earth_az_range_deg"],
                p["earth_visibility_pct_terrain"], p["earth_visibility_pct_no_terrain"]])
    export_preview(dem)


if __name__ == "__main__":
    main()
