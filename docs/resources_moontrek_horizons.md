# Moon Trek and JPL Horizons: what they can bring to our tool

*Exploration of 14 Nov 2026. All the access points described are public and documented, with no
account.*

## 1. JPL Horizons

**Access:** API `https://ssd.jpl.nasa.gov/api/horizons.api`. An observer on the Moon is declared
with `CENTER='coord@301'`, `COORD_TYPE='GEODETIC'` and `SITE_COORD='lon,lat,alt_km'`. Objects
are searched with `https://ssd.jpl.nasa.gov/api/horizons_lookup.api?sstr=…&group=sct`.

### What we already use
- Elevation and azimuth of the Sun and the Earth (`QUANTITIES='4'`), to **validate** our
  calculator: difference ≤ 0.005° for the Sun and ≤ 0.18° for the Earth over 2026.

### What would be new

| Horizons data | Code | Tested | Value for our tool |
|---|---|---|---|
| **Spacecraft in lunar orbit, seen from a site**: LRO (−85), Danuri/KPLO (−155), Chandrayaan-2 (−152) | `COMMAND='-85'`, `QUANTITIES='4,20'` | yes, from Malapert | **Relay windows**: when a spacecraft is above the local horizon, it can relay the communications of a site that cannot see the Earth. It is the exact complement of our "Earth in view" indicator. |
| Earth–site distance (`delta`) | `20` | yes: 405,568 km on 14 Nov 2026 | **Radio link budget**: the received power varies by about ±10 % over the month (perigee and apogee). |
| Illuminated fraction of the Earth (`Illu%`) | `10` | yes: 81 % on 14 Nov 2026 | **Earthshine** during the lunar night (camera lighting, heat input). |
| Apparent diameter of the Sun and the Earth | `13` | yes: Sun 1,942″, Earth 6,488″ | Exact computation of the visible fraction of the disk, replacing our fixed values (0.533° and 1.9°). |
| Distance to the Sun | `20` | yes | Real solar flux: ±3.4 % over the year, versus a fixed 1,361 W/m² in our tool. |

**Points to watch:**
- Spacecraft ephemerides are **predictions** that stop at a cut-off date. LRO is predicted until
  **16 Apr 2028**. Chandrayaan-2 stops on **11 Dec 2026**. CAPSTONE, on the orbit planned for
  the Gateway station, stops on **14 Aug 2026**.
- **The Gateway station and the Chinese relay Queqiao-2 are not in** Horizons.
- A query returns about 60 lines per second. For relay windows over months at a one-minute
  step, we must **precompute in Python** (member 1's role), not query the API from the browser.

## 2. Moon Trek (NASA / JPL)

**Access:**
- Catalogue: `https://trek.nasa.gov/moon/TrekServices/ws/index/eq/searchItems`, about 9,400
  entries, including 1,256 products.
- Services of a layer: `…/getLayerServices?uuid=<id>`.
- **WMTS** image tiles: `https://trek.nasa.gov/tiles/Moon/EQ/<layer>/1.0.0/…`.
- **ArcGIS REST** services: `https://trek.nasa.gov/moon/trekarcgis2/rest/services/…`, vectors
  as GeoJSON and rasters that can be queried at a point.

Of the 1,256 products, **171 cover the South Pole**. The most useful for us:

| Moon Trek product | Access | Value for our tool |
|---|---|---|
| **Artemis III Candidate Landing Regions**, 13 polygons (NASA 2022 list) | ArcGIS → **GeoJSON**, tested | **Official** list of sites and outlines on the map. Cross-check: the ridge, the Malapert summit and the best zone of the optimizer (88.68°S 68.1°W) fall **inside** the official regions Connecting Ridge, Malapert Massif and de Gerlache Rim. |
| **LOLA Permanently Shadowed Regions Southpole 240 m** | WMTS (PNG), tested: 8 levels | **Independent validation** of our permanent shadows, which we compute at 200 m. |
| **Lunar Anthropogenic Impacts and Spacecraft Sites** | ArcGIS (vectors) | **Official** catalogue of landing and impact sites, to enrich our reference list. |
| **Diviner**: min, max, midnight, noon temperatures, at 0.5 pixel per degree | WMTS and ArcGIS ImageServer (value at a point) | **Thermal criterion** (cold traps < 110 K, survival of the electronics). Coarse resolution: ~2° of latitude per pixel. |
| **Lunar Prospector NS, hydrogen abundance** | WMTS | Water ice index, to cross with our permanent shadows. Very coarse resolution. |
| **Mini-RF, circular polarization ratio (CPR)** | WMTS | Second radar ice index (to interpret with care). |
| **LROC NAC PSR Mosaic 20 m** and **NAC S Pole Mosaic** | WMTS | Real **background image** for our maps, more telling than shaded relief. |
| **LOLA Slope Southpole 120 m** | WMTS (coloured image) | Cross-check of our slopes. We already compute ours at 20 m. |
| **Endurance-A**, rover paths and stations (NASA concept) | ArcGIS (vectors) | Example of a real traverse to display. Extension idea: evaluate illumination **along a path**. |
| **LOLA DEM 87.5° (5 m) and 75°** | ArcGIS ImageServer | Same data as our PDS DEMs. Only useful as a backup. |

**Points to watch:**
- Moon Trek's **ArcGIS services were at times unavailable** (HTTP 503 error) during the
  exploration. The **WMTS tiles**, on another server, answered. So we must **download once and
  store** the data in `data/`, rather than query Moon Trek live from the application.
- WMTS tiles are **coloured images** (PNG). To get values, the palette must be decoded, or the
  ImageServer used when it exists (Diviner).
- "EQ" products are in equirectangular projection. At the pole, a reprojection to our
  stereographic grid is needed.

## 3. What this would change, by priority

| Priority | Addition | Source | Effort | Value |
|---|---|---|---|---|
| 1 | **Official Artemis III regions**: outlines on the maps and list of sites | Moon Trek (GeoJSON already retrieved) | low | credibility with the judges, direct comparison with NASA |
| 2 | **LRO relay windows**: "if the Earth is hidden, is LRO visible?" | Horizons (−85), Python precomputation | medium | completes the communication indicator, useful for the ridge and the pole (Earth visible ~50 % of the time) |
| 3 | **Validation of our permanent shadows** against the official LOLA map | Moon Trek WMTS | medium | proof of quality for our "ice" criterion |
| 4 | **Real solar flux** (distance to the Sun) and **exact apparent diameters** | Horizons, or a simple formula | low | accuracy of the energy figures |
| 5 | Diviner **thermal criterion** (cold traps, night) | Moon Trek | medium | stronger Science profile |
| 6 | **LROC NAC background image** | Moon Trek WMTS | medium | visual quality of the presentation |

**Priority 3 done (14 Nov 2026)**: our permanent shadows and our mean illumination agree with
the official LOLA maps. We used the PGDA source files rather than the Moon Trek tiles. See
[validation_lola.md](validation_lola.md).

**Priority 4 partly done (14 Nov 2026)**: the solar flux follows the real Moon–Sun distance
(member 1's Horizons table). The apparent diameters remain fixed.

**Priority 2 done (14 Nov 2026)**: the LRO relay windows are computed in the application, and
validated to within 0.05° against Horizons. See `docs/member3_application.md`.

**Priority 1 done (14 Nov 2026)**: the 13 Artemis III regions are integrated
(`data/sites/artemis3_regions_2022.geojson`). They appear on the pole map, in the site cards and
in the optimizer (outlines, column, constraint). Details in
[zone_optimizer.md](zone_optimizer.md).
