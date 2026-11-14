# Zone optimizer

> The landing date slipped: **where should we land now?** The tool evaluates every point of a
> region over the chosen period, then proposes the best zones for a mission profile.

## How it works

1. **Precomputation, once** (`scripts/build_horizon_maps.py`): for every 200 m pixel of a region,
   we compute the horizon height in **72 directions** (every 5°). We also store the elevation and
   the mean and maximum slope of the cell, measured on the 20 m relief.
2. **Simulation over the period** (browser, Web Worker `optim/optim.worker.ts`): at each time step,
   the Sun and the Earth are placed in the sky of each pixel, then compared with its horizon. The
   rules are the same as for a single site: Sun visible if more than half of its disk rises above
   the horizon, Earth visible if its centre does. The time step is adjusted to make about 360
   steps, i.e. 2 h for a lunar day. The simulation is **valid for any future date**, because the
   relief is fixed and the ephemerides are computed.
3. **Score and zones** (instant, recomputed at each setting change):
   - pixels that break the **constraints** are excluded;
   - the others get a **score** from 0 to 100, a weighted mean of the normalized criteria;
   - a **zone** is a group of neighbouring pixels whose score is within N points of the best
     ("Tolerance" setting).
4. **Analyse**: a click on a zone, or on a point of the map, runs the fine computation (720
   directions, 20 m relief) and opens the point as a custom site. It can then be added to the
   comparison table.

## Criteria (normalized from 0 to 1)

| Criterion | Measure | Best when |
|---|---|---|
| Sunlight | % of time in sunlight | high |
| Short night | 1 − longest night / period length | short night |
| Solar flux | mean flux on a steerable vertical panel / 1,361 W/m² | high |
| Earth in view | % of time with the Earth visible | high |
| Short blackout | 1 − longest blackout / period length | short blackout |
| Sun + Earth | % of time with both at once | high |
| Ice proximity | 1 − distance to the nearest permanent shadow / 10 km | close |
| **Mild temperature** *(Diviner)* | (mean annual temperature − 50 K) / (200 − 50 K) | warm |
| **Shallow ice** *(Diviner)* | 1 − ice stability depth / 100 cm; 0 if unstable | ice at the surface |

**Constraints:** mean slope of the cell ≤ X°, longest night ≤ X h, Earth in view ≥ X %,
Sun ≥ X %.

## Predefined profiles

Tuned on 14 Nov 2026 and checked on the 3 regions, over 6.5 days and then over a lunar day.
**Principle:** constraints are only used for physical or safety limits (slope, survivable night
length). Preferences go through the weights. This way, a profile never ends up with no zone at all
when a reasonable compromise exists.

| Profile | Weights | Constraints | Rationale |
|---|---|---|---|
| Solar lander (CLPS) | Sun 3, Sun + Earth 3, Earth 2, short night 1 | slope ≤ 8°, Sun ≥ 50 % | Mission of one lunar day at most, direct link with no relay |
| **Crew (Artemis III)** *(new)* | Sun 3, short night 3, Sun + Earth 2, Earth 2, short blackout 1 | slope ≤ 8°, night ≤ 6 h | NASA 2022 criteria: continuous light over 6.5 days, direct link, safe landing |
| Night survival (station) | short night 4, Sun 2, flux 1, **Earth 1** | slope ≤ 8° | Without the "Earth" weight, the profile picked a zone at Malapert with no link at all |
| **Prospecting rover (VIPER type)** *(new)* | ice proximity 3, Sun 2, short night 2, Earth 1 | slope ≤ 15°, night ≤ 96 h, Sun ≥ 30 %, permanent shadow ≤ 5 km | VIPER's slopes and mission. 96 h night: assumption to refine with the energy budget |
| Direct Earth link | Earth 3, short blackout 3, Sun + Earth 1 | slope ≤ 8° | "Earth ≥ 60 %" constraint **removed**: impossible near the pole, it gave no zone over a lunar day |
| **Link with relay** *(added with the LRO relay in the optimizer)* | short total blackout 3, Earth or relay 2, Sun 2 | slope ≤ 8° | With LRO, the longest total blackout drops from several days to less than 2 h: that is what we minimize |
| Science: water ice (lander) | ice proximity 3, Sun 2, Earth 1, short night 1 | slope ≤ **8°** (previously 10°), Sun ≥ 30 %, permanent shadow ≤ 5 km | Same slope limit as the other landers |
| Custom | all settings are free | | |

Slope limits (constants `LANDER_SLOPE` and `ROVER_SLOPE`):
- **8° for landers**: the usual value in Artemis and CLPS site studies. IM-1 tipped over on a
  slope of about 12°.
- **15° for a rover**: VIPER's design slope.

Each profile has a `basis` field (rationale) and, for Artemis, `periodH = 156` (6.5 days), which
the interface can offer as a duration.

**Check (14 Nov 2026, lunar day):** every profile finds zones in the 3 regions. Examples:
- pole, Artemis profile: 19 feasible pixels, best zone at 88.68°S, 68.1°W (Sun 100 %, night 0 h,
  Earth 50 %);
- Malapert, "Direct link" profile: zone at 85.97°S with Earth 100 % and Sun 100 %.

## Precomputed regions

| Region | Extent | Pixels | Size (horizons) |
|---|---|---|---|
| Malapert Massif | 50 × 50 km around the summit | 250 × 250 | 9 MB |
| Mons Mouton (IM-2) | 50 × 50 km around the site | 250 × 250 | 9 MB |
| South Pole (Shackleton, ridge, de Gerlache) | 80 × 80 km centred on the pole | 400 × 400 | 23 MB |
| **Nobile Rim 2 and Amundsen Rim** | 60 × 60 km | 300 × 300 | 13 MB |
| **Nobile Rim 1** | 30 × 30 km | 150 × 150 | 3 MB |
| **Haworth** | 40 × 40 km | 200 × 200 | 6 MB |
| **Faustini Rim A** | 30 × 30 km | 150 × 150 | 3 MB |
| **de Gerlache Rim 2** | 30 × 30 km | 150 × 150 | 3 MB |
| **de Gerlache-Kocher Massif** | 30 × 30 km | 150 × 150 | 3 MB |

The 6 regions in bold were added on 14 Nov 2026. With them, **all 13 Artemis III candidate regions
of the NASA 2022 list are covered**. Their centres are the centroids of the outlines in
`data/sites/artemis3_regions_2022.geojson`. They are computed with the 20 m relief down to 80°S
(`LDEM_80S_20M`), and Mons Mouton was recomputed with the same relief: its slopes are now at 20 m
everywhere.

Since `scripts/build_diviner.py`, each region also carries the mean and maximum annual temperature
and the ice stability depth (Diviner, files `.tavg`, `.tmax`, `.icedepth`).

**Computation on Modal:** `modal run scripts/modal_horizon_maps.py [--regions a,b]` runs one region
per container, in parallel, with the same code. The 7 regions (6 new ones and Mons Mouton) were
computed in **2 min 12 s**, versus about 40 min locally. Then run, locally:

```bash
.venv/Scripts/python scripts/build_horizon_maps.py --index
.venv/Scripts/python scripts/build_psr.py
.venv/Scripts/python scripts/build_diviner.py
```

The files are in `data/horizon_maps/` (not versioned) and are served directly by the application
server. To regenerate them (~5 min per 250 × 250 pixel region):

```bash
.venv/Scripts/python scripts/build_horizon_maps.py
```

Only some regions can be regenerated:

```bash
.venv/Scripts/python scripts/build_horizon_maps.py malapert pole
```

A new region is added to the `REGIONS` list of the script.

## Accuracy

**Horizon maps**, compared with the exact computation in 720 directions (12 random pixels per
region, × 72 directions):

| Region | RMS difference | 95 % of differences below | Max difference |
|---|---|---|---|
| Malapert | 0.09° | 0.24° | 0.49° |
| South Pole | 0.10° | 0.24° | 1.03° |
| Mons Mouton | 0.15° | 0.24° | 1.31° |

The rare differences of about 1° probably appear in very rough terrain, for example at the bottom
of a crater next to its rim. They come from the simplification of the distant relief: computation
on a 2 km grid, then a first-order correction for the pixel's elevation. Hence the rule: **always
confirm a zone with "Analyse"**.

**Computation time in the browser** for a lunar day (360 steps of 2 h):
- ~11 s for Malapert and Mons Mouton (62,500 points);
- ~50 s for the South Pole (160,000 points).

**Screening, then fine computation.** The best point found for the lunar day of 14 Nov 2026 at
Malapert lies at 85.965°S, 2.294°W: 100 % Sun and 100 % Earth according to the screening. The fine
computation confirms exactly these values (100 % / 100 %, 1,352 W/m²). Over the same period, the
summit studied so far only reaches 89 % / 82 %.

## Example results (Malapert region)

| Period | Profile | Best zone |
|---|---|---|
| 14 Nov 2026, lunar day | Solar lander | 85.965°S 2.294°W: Sun 100 %, Earth 100 %, slope 3.9° |
| 14 Nov 2026 | Night survival | south slope (86.04°S): Sun 100 %, but Earth only 43 to 54 % |
| 10 Mar 2027 (southern winter) | Solar lander | 85.932°S 3.950°W: Sun 56 %, 8-day nights, Earth 100 % |
| 14 Nov 2026, South Pole region | Solar lander | rim of de Gerlache (88.68°S 68.1°W): Sun 100 %, Earth 52 %; other zones near the rim of Shackleton (89.78°S) |

In the pole region, the best "Sun" zones fall on the rims of de Gerlache and Shackleton. The
Artemis III candidate region "de Gerlache Rim 2" lies precisely on one of them. However, the Earth
is visible there only about half the time.

We see the same logic as in the challenge statement: a small move, or a change of date, completely
transforms the feasibility of a mission.

## Limits

- Pixels are 200 m: the screening finds zones, and the exact point must be confirmed with
  "Analyse".
- The slope is the mean of the cell at 20 m: boulders and craters smaller than ~40 m are not seen.
- Only the visibility of the centre of the Earth is taken into account, not the quality of the
  radio link (distance, antenna).
- Permanent shadows are computed from the 200 m horizon maps: very small cold traps (less than a
  few hundred metres) are not seen.

## Official Artemis III candidate regions

**Source:** the Moon Trek layer "Artemis III Candidate Landing Regions" (NASA, **August 2022**
list, 13 regions), downloaded as GeoJSON from the Moon Trek ArcGIS service. It is saved in
`data/sites/artemis3_regions_2022.geojson`, with its source and a note. A typo was fixed along the
way: "Shakleton" becomes "Shackleton".

> In October 2024, NASA reduced the list to 9 regions. It added Mons Mouton, Mons Mouton Plateau,
> Peak near Cabeus B and Slater Plain, whose **outlines are not published** in Moon Trek. The
> application says so when a site is outside the 2022 outlines, like Mons Mouton.

**In the application** (`app/src/astro/regions.ts`):
- the polygons are defined in latitude/longitude; their edges are densified before the polar
  projection, to keep their real curved shape;
- **pole map**: dashed outlines and region names, with a checkbox to hide them;
- **site card**: official region containing the site, or the nearest one with its distance;
- **optimizer**: outlines on the heat map, "Artemis III region" column in the zone list, and the
  constraint **"Only in Artemis III regions"**. The regions are rasterized once on the region
  grid, testing only the pixels of their bounding box.

**Cross-checks:**

| Site or zone | Official region |
|---|---|
| Connecting Ridge (89.439°S 137.144°W) | **Connecting Ridge** |
| Malapert summit (85.988°S 2.058°E) | **Malapert Massif** |
| Mons Mouton (IM-2) | outside the 2022 outlines, 11.8 km from Leibnitz Beta Plateau; candidate region in the 2024 list |
| IM-1 Odysseus | outside the regions, 168 km from Malapert Massif |

**Optimizer**, South Pole region, 14 Nov 2026, Solar lander profile:
- **without the constraint**, 3 of the 5 best zones already fall inside an official region:
  de Gerlache Rim (2 zones) and Peak Near Shackleton;
- **with the constraint**, all 5 zones are in official regions: de Gerlache Rim, Peak Near
  Shackleton and Connecting Ridge. They have 99 to 100 % Sun and 48 to 52 % Earth. The regions
  cover 1,073 km² of the South Pole region.

Our independent method therefore finds, on its own, the zones chosen by NASA.

## Permanently shadowed regions (water ice)

**Definition** (`scripts/build_psr.py`): a point is in permanent shadow if the Sun **never** rises
above its horizon, on any date. Seen from the Moon, the declination of the Sun does not exceed
±1.543°. For a site in the southern hemisphere, the most favourable case is therefore a subsolar
latitude of −1.543°. We sweep the subsolar longitude over 360° at this latitude. If, in every
direction, the upper edge of the disk (+0.267°) stays below the horizon, the point is in permanent
shadow. The computation is geometric: it is valid for all dates, with no simulation over time, and
takes ~10 s for the 3 regions.

```bash
.venv/Scripts/python scripts/build_psr.py
```

**Results:**

| Region | Permanently shadowed area |
|---|---|
| South Pole (80 × 80 km) | 1,121 km² (17.5 %) |
| Mons Mouton | 61.5 km² (2.5 %) |
| Malapert | 34.6 km² (1.4 %) |

| Site | Nearest permanent shadow |
|---|---|
| Malapert (summit) | 0.7 km |
| Connecting Ridge | 1.4 km |
| Mons Mouton | 2.2 km |

**Validation:**
- **Floor of Shackleton crater**: 100 % in permanent shadow within ±3 km of the centre. Even on the
  most favourable date, the Sun stays 17.8° below the horizon.
- **Connecting Ridge and the pole**: not in permanent shadow (the Sun can rise up to +4.9° and
  +3.7° above the horizon), which is consistent with their reputation as very well-lit spots.
- **Map vs exact computation** (720 directions): **12 pixels out of 12 in agreement**, including 8
  taken at the edge of the shadow (margin < 1°).

**In the tool:**
- **"Permanent shadow"** layer: shadow areas in blue, distance from 0 to 10 km for the rest. These
  areas also appear in blue on every layer;
- **"Ice proximity"** criterion: 1 on site, 0 at 10 km or more;
- **"Max permanent shadow"** constraint: maximum distance to a permanent shadow;
- **"Science: water ice"** profile: ice proximity 3, Sun 2, Earth 1, short night 1, with slope
  ≤ 10°, Sun ≥ 30 % and permanent shadow within ≤ 5 km;
- **"Perm. shadow"** column in the zone list, and a "Nearest permanent shadow" line in the cards of
  the studied sites.

**Example:** South Pole region, lunar day of 14 Nov 2026, Science profile. The best zones are
**0.2–0.6 km from a permanent shadow with 97 to 100 % Sun**, on the rim of de Gerlache (88.7°S,
68°W) and towards the rim of Shackleton (89.4°S, 105°E). The fine computation of the point
88.705°S, 68.334°W confirms 100 % Sun and 50 % Earth. The result is rated "fragile", because part
of the visibility depends on relief more than 100 km away.

**Not to be confused:** a permanent shadow shows where ice **can** survive (cold trap). It does not
guarantee its presence: that would require spectrometry data (LRO LEND, LAMP, M³). It is a lead for
future work.

## LRO relay in the zone search

Two criteria are added: **Earth or relay** (share of time with the Earth, or LRO above the relief
and above 5°) and **Short total blackout** (longest period with neither). The **Link with relay**
profile puts them first. The "Earth or relay %" and "Total blackout" layers are shown on the map.
Two columns are added to the zone table.

**Computation** (`app/src/optim/evaluate.ts`):
- LRO orbits in less than 2 h, so its passes are tracked **every 2 minutes**. Computing every pixel
  at this step would be too slow. Seen from 100 km of altitude, LRO's position changes little from
  one kilometre to the next: we compute it on a **grid of one point per km**, i.e. one pixel in 5.
- Earth visibility, however, can change within 200 m on a summit: it stays **computed pixel by
  pixel**.
- The two are combined pixel by pixel. For each step of the main evaluation, we keep the time
  covered by LRO and the durations without LRO at the start, middle and end of the step. Total
  blackouts are thus measured to within 2 min.
- These criteria only exist if LRO's orbit covers the period (November 2026 to April 2027).
  Otherwise, they equal "Earth in view" and "Short blackout".

**Check:** at the Malapert summit, over the lunar day of 14 Nov 2026, the optimizer gives 83.2 % of
link time and 1 h 50 of maximum total blackout. The detailed site computation gives 83.4 % and
1 h 50. Duration: about 9 s for the Malapert region and 25 s for the pole region.

**Result (pole, 14 Nov 2026, "Link with relay" profile):** the best zones are on the edge of de
Gerlache, in the Artemis III region "de Gerlache Rim". They have 100 % Sun, 52 % Earth, and never
stay more than **1 h 50** without a link, versus 12.5 days with the Earth alone.
