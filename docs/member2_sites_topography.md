# Member 2: candidate sites and topographic characteristics

> Question: *what does the terrain look like at the places we want to study?*

## 1. Data used

| Data | Source | Use |
|---|---|---|
| LOLA DEM `LDEM_85S_20M` (20 m/px, from the South Pole to 85°S, 460 MB) | [PDS Geosciences Node](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/) | position of summits and ridges, elevation, fine slopes, near relief of the horizons (< 25 km) |
| LOLA DEM `LDEM_75S_120M` (120 m/px, from the South Pole to 75°S, ~116 MB) | PDS (same folder) | far relief of the horizons (> 25 km), sites between 75°S and 85°S, statistics at 1–20 km |
| Published landing coordinates | NASA / LROC / USGS (links in `sites.json` → `refs`) | reference sites |
| Artemis III candidate regions | NASA (2022 and 2024 lists) | choice of the candidate sites |

Elevations are given relative to the 1,737.4 km reference sphere.
Check: the DEM gives **2,592 m** at the IM-1 site; NASA publishes 2,579 m.

QuickMap and Moon Trek were used to explore the regions visually. All numeric values are
recomputed from the DEM by `scripts/build_sites.py`, which makes the result reproducible.

## 2. The three candidate sites

| | Connecting Ridge | Malapert Massif | Mons Mouton (IM-2) |
|---|---|---|---|
| Coordinates | 89.4390°S, 137.1440°W | 85.9880°S, 2.0577°E | 84.7906°S, 29.1957°E |
| Distance to the pole | 17 km | 122 km | 158 km |
| Elevation (20 m) | 1,959 m | 5,173 m | 5,322 m |
| Slope at 20 m: local / 100 m mean / 500 m max | 1.0° / 3.0° / 18.8° | 1.6° / 2.4° / 29.4° | 2.3° / 2.8° / 15.0° |
| Area > 10° within 500 m | 8.7 % | 6.2 % | 0.3 % |
| Mean slope over 1 km (120 m) | 8.1° | 6.0° | 3.1° |
| Highest horizon | −0.59° | −0.07° | **+4.07°** (az 117°, summit of Mons Mouton at 16.5 km) |
| Max Sun (pre-indicator) | 2.1° | 5.6° | 6.8° |
| Illumination*, with relief / smooth ground | **88 %** / 54 % | 66 % / 50 % | 44 % / 49 % |
| Earth in view*, with relief / smooth ground | 52 % / 46 % | **80 %** / 69 % | **81 %** / 73 % |
| Direction of the Earth | az 129–145° | az 350–6° (north) | az 322–339° (north-west) |

The ridge and Malapert points are snapped to the 20 m relief: the highest summit within the same
search radius as before. The ridge moves by 131 m and Malapert by 15 m. The old 120 m points
remain in `sites.json` (`previous_point_120m`).

\* Pre-indicators computed with a **simplified** orbital model, only to validate the masks. The
reference values come from the JPL Horizons ephemerides (member 1) and member 4's analysis.

**Key points**
- **Connecting Ridge**: the best illumination (the Sun skims the horizon without being hidden),
  but the Earth is visible only about half the time, because libration takes it below the
  horizon. For this site, a communication relay is needed.
- **Malapert**: a summit that dominates its surroundings (no relief above the horizontal). It
  faces the Earth, which makes it the best compromise between energy and direct communication.
- **Mons Mouton**: a wide, gently sloping plateau, good for landing. However, the nearby summit
  hides the Sun over the whole east–south sector (63°–240°). As a result, illumination is
  *lower* than on smooth ground, while the Earth stays well in view.

## 3. Reference sites (comparison, teaching)

IM-1 Odysseus (degraded crater, 12° slope, horizon at +11°: a counter-example), Chandrayaan-3,
Chang'e-6 (far side, Earth never visible) and Apollo 11 (equator). The last three are outside
the polar DEM: their horizon is modelled as smooth ground.

## 4. Delivered files

| File | Content |
|---|---|
| `data/sites/sites.json` | full database: coordinates, method, terrain, horizon, obstacles, sectors, pre-indicators |
| `data/sites/sites_summary.csv` | summary table (`;` separator, opens in Excel) |
| `data/horizons/<id>.csv` | horizon mask every 0.5°: elevation, distance, position and altitude of the obstacle |
| `data/horizons/<id>.json` | same mask, compact format for the React application |
| `data/dem/preview/south_pole_dem_1200m.*` | DEM reduced to 1.2 km/px (int16) and its metadata, for the application map |

Conventions: negative latitude = south; East longitude in [−180, 180]; azimuth in degrees from
local north, clockwise; sensor placed 2 m above the ground.

### Key fields of `sites.json`
- `obstacles`: sectors where the relief rises more than +0.5° above the horizontal, with the
  share of time this relief hides the Sun (`sun_blocked_pct_time`) or the Earth
  (`earth_blocked_pct_time`) while they would be visible on smooth ground.
- `horizon_sectors`: 12 sectors of 30° giving the dominant obstacle, the share of time the Sun
  or the Earth is in the sector, and the share of time they are hidden there.

## 5. For the other members

- **Member 1 (JPL Horizons)**: use `lat`, `lon` and `elevation_m` from `sites.json`.
  In Horizons: `CENTER='coord@301'`, `COORD_TYPE='GEODETIC'`,
  `SITE_COORD='<lon>,<lat>,<alt_km>'` (East longitude first, altitude in km).
- **Members 1 and 4**: a body is visible when its elevation exceeds the horizon elevation at its
  azimuth. Just interpolate `data/horizons/<id>.csv` at the azimuth given by Horizons.
- **Member 3 (React)**: `sites.json`, `horizons/<id>.json` (polar diagram of the horizon) and
  the DEM preview for the map.

## 6. Known limits

- The horizons are multi-resolution: near relief (< 25 km) at 20 m, far relief at 120 m (see
  [tile_pyramid.md](tile_pyramid.md)). Sites between 75°S and 85°S, such as IM-1, remain at
  120 m when the 20 m DEM for this area (`LDEM_80S_20M`, 1.85 GB) is not downloaded.
- Boulders and craters smaller than ~40 m are not resolved, even at 20 m.
- Validation against the 20 m QuickMap shadows: 4 agreements, 1 case due to a different
  definition (illumination of the ground, not of a sensor at 2 m) and 1 open case (a curvature
  question). Details in [validation_quickmap.md](validation_quickmap.md).
- The Sun is treated as a point. Its disk measures 0.53°: it can therefore be partly visible when
  its centre is just below the horizon.
- The "ridge" and "summit" points are the highest of the DEM within a given radius. They are
  study points, not sites certified by NASA.
