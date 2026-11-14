> **November 2026:** the interface described here was replaced by the public site Earthrise Atlas.
> See [public_site.md](public_site.md). The computations described below are unchanged.

# Member 3: web application (React)

> Question: *how do we present all this information in a simple tool?*

## Running the application

```bash
cd app
```
```bash
npm install
```
```bash
npm run dev
```

The application opens on http://localhost:5173. Before starting, `npm run dev` and
`npm run build` copy `data/sites`, `data/horizons`, `data/dem/preview` and `data/ephemeris` into
`app/public/data` (script `app/scripts/sync-data.mjs`). After running the Python processing again,
just restart the application.

Technologies: React 18, TypeScript and Vite. No chart library: all charts are drawn by hand in
SVG, and the map uses a canvas.

## Features

| Challenge need | In the application |
|---|---|
| Choose a site from a list | 3 candidate sites and 4 reference sites (left column) |
| Custom coordinates | Lat/lon fields, or a click on the map. Horizon, elevation and slopes **computed on demand** in the background (Web Worker) from the multi-resolution relief: 20 m near the site, 480 m far away. See "Two horizon computation methods" below. |
| Choose a date and a period | Start date (UTC), 3 d / 7 d / 1 lunar day / 3 months, ◀ ▶ buttons |
| Sun and Earth relative to the horizon | **Sky view**: 360° panorama with the real horizon, the paths of the Sun and the Earth and their current position |
| Time until sunset / Earth set | Cards: elevation, azimuth, local horizon, "sets in …", "Earth sets in …" |
| Energy and communication indicators | % of time in sunlight, longest night, mean solar flux (vertical and horizontal panel), % of Earth visibility, longest blackout, % Sun + Earth |
| Change over time | **Timeline** with visibility bands, a draggable cursor and animation (▶) |
| Seasons | **Lunar months**: % Sun and % Earth over 13 months; clicking a month analyses it |
| Comparison | **Comparison table** of scenarios (site × date × period), best value in green, saved in the browser |
| Terrain | **Site terrain** card: elevation, slopes, relief, main obstacles (member 2's data) |
| Energy and telecom of a vehicle | **Energy and telecom budget**: battery, panels, data rate, data (member 4) |
| When to land | **Choose the landing date**: each date scored, best windows justified (member 5) |
| Find where to land | **Search for optimal zones**: heat map of a region over the chosen period, mission profiles, adjustable weights and constraints, best zones with "Analyse". See [zone_optimizer.md](zone_optimizer.md) |

## LRO communication relay

When the Earth is hidden, a satellite in lunar orbit can relay communications. The application
computes the passes of **LRO** (Lunar Reconnaissance Orbiter) above each site, including custom
sites.

**Data:** `scripts/fetch_relay_ephemeris.py` downloads from **JPL Horizons** the position of LRO
relative to the centre of the Moon (ICRF/J2000), with a one-minute step. The period covered runs
from 1 Nov 2026 to 1 May 2027, i.e. 260,641 points and 3.1 MB in `data/relays/`. LRO's altitude
varies from 63 to 118 km.

```bash
.venv/Scripts/python scripts/fetch_relay_ephemeris.py --start 2026-11-01 --days 181
```

**Computation** (`app/src/astro/relay.ts`):
- each position is rotated into the lunar frame with the same IAU model as the Sun and the Earth;
- LRO is **usable** if it rises above the relief horizon **and** above 5° of elevation (antenna
  mask, value `RELAY_MIN_ELEV_DEG`);
- one lunar day is computed in ~0.3 s.

**Validation against Horizons**: azimuth and elevation of LRO seen from the Malapert summit, 7
instants between 14 Nov and 15 Dec 2026:
- difference **≤ 0.05° in elevation, 0.00° in azimuth**;
- a first version compared samples offset by 9 s, because Horizons vectors are dated in TDB;
  this is fixed by linear interpolation between minutes.

**Display:**
- "Earth or LRO relay link" card: share of time with a link, passes per day, share of Earth
  blackouts covered, longest **total** blackout, compared with the Earth alone;
- purple "LRO" band in the timeline;
- "Earth or LRO" and "Max total blackout" columns in the comparison.

**Results** (lunar day of 14 Nov 2026, ~12.3 LRO passes per day):

| Site | Earth or LRO link | Longest blackout, Earth alone | Longest blackout, with LRO |
|---|---|---|---|
| Connecting Ridge | 52 % | **13.3 days** | **1 h 49** |
| Malapert (summit) | 83 % | 5.3 days | 1 h 50 |
| Mons Mouton | 84 % | 5.2 days | 1 h 51 |

LRO covers only 6 to 8 % of the time. But by passing every ~2 h, it cuts the longest
communication blackout **from several days to less than 2 hours**. This is decisive for sites very
close to the pole, where the Earth goes below the horizon for days.

**Limits:**
- the orbit is a Horizons **prediction**; timing accuracy decreases far in the future. Outside
  the downloaded period, the card says so and suggests choosing another period;
- LRO is a science spacecraft, with no relay radio for landers. It serves as an **example of a
  low polar relay orbit**, like that of a future relay (Lunar Pathfinder, Moonlight). The
  computation shows the possible **geometry**, not a guaranteed service;
- the Gateway station and the Queqiao-2 relay are not available in Horizons;
- the zone optimizer takes it into account ("Link with relay" profile): see
  [zone_optimizer.md](zone_optimizer.md).

## Flagging fragile cases

Each analysis states whether its result is **robust**, **to be confirmed** or **fragile**
(`fragility()` in `astro/analysis.ts`). Two rules, drawn from the validation against QuickMap
([validation_quickmap.md](validation_quickmap.md)):

1. **Grey zone (±0.5°)**: within 0.5° of the horizon, the answer depends on the fine relief and on
   the chosen definition (sensor at 2 m or ground). Our measured errors are ≤ 0.2° for the
   ephemerides and the 20 m horizon, and 0.5° covers them with a margin. We therefore recompute
   sunlight and Earth visibility with a horizon shifted by ±0.5°, which gives a **range**.
2. **Distant relief**: if the obstacle in the body's direction is **more than 100 km** away and
   the margin is below **2.5°**, visibility depends on how lunar curvature is handled, and the
   tools diverge (case of Connecting Ridge with Malapert 135 km away).

| Verdict | Condition |
|---|---|
| Robust | ranges ≤ 5 points and decisive distant relief < 2 % of the time |
| To be confirmed | ranges ≤ 15 points and distant relief < 10 % of the time |
| Fragile | beyond |

**Where to see it in the application:**
- the "Reliability of the result" card, with its reasons;
- the range under "Sunlight" and under "Earth in view";
- a ⚠ on the Sun or Earth elevation at the displayed instant;
- an orange ⚠ band in the timeline;
- the "Reliability" column of the comparison table.

Examples on the lunar day of 14 Nov 2026:

| Site | Verdict | Reason |
|---|---|---|
| Apollo 11 | robust | high Sun, flat horizon |
| Mons Mouton | to be confirmed | Earth in view between 78 and 88 % |
| Malapert summit | fragile | sunlight between 78 and 100 % (the Sun skims the horizon) |
| Connecting Ridge (24 Nov) | fragile | visibility decided by relief 135 km away |

A "fragile" verdict does not mean the site is bad. It signals that the figure must be confirmed by
an independent source (JPL Horizons, QuickMap shadows, finer DEM) before any decision.

## Two horizon computation methods, side by side

| | Selected sites (candidates, references) | Custom sites |
|---|---|---|
| Method | Python **precomputation** (`scripts/build_sites.py`) | **On demand** in the browser (`astro/horizonTiled.ts`, run by `astro/horizon.worker.ts`) |
| Relief | 20 m up to 25 km, 120 m beyond | 20 m up to 5 km, then 80, 240 and 480 m |
| Loaded by the application | `data/horizons/<id>.json` (~10 KB) | ~85 tiles (~11 MB), in 0.5 to 2 s |
| Difference between the two | — | RMS ≤ 0.005° at the 3 candidate sites |

The geographic limits follow this logic:
- a site **between 75°S and 80°S** is computed at 120 m near the site, for lack of 20 m relief
  (between 80°S and 85°S, the 20 m relief comes from LDEM_80S_20M when it is installed);
- a site **north of 75°S** gets a smooth-ground horizon;
- if the tiles are unavailable (deployed version without the pyramid), the application falls back
  on the 1.2 km reduced DEM, and the site card says so.

## Ephemerides

The positions of the Sun and the Earth come from the **JPL Horizons table** (official source, see
[ephemeris_decision.md](ephemeris_decision.md)) (2026–2030, one-hour step, apparent directions
seen from the centre of the Moon). The application rotates them into the lunar frame (IAU model,
Archinal et al. 2011) and adds the site parallax, which reaches 0.26° for the Earth. Difference
with Horizons in observer mode: **≤ 0.003°**. Outside 2026–2030, the application falls back to the
*Astronomical Almanac* series: up to 0.19° of difference on the Earth, i.e. 1 h to 2.5 h on its
rise and set times. The badge at the top right shows the source in use.

Details, validation and effect on the results: [member1_ephemeris.md](member1_ephemeris.md).

## Energy and telecom budget (member 4)

Panel below the indicator cards. For a reference vehicle (small lander, rover, long-duration
station, or custom settings), it gives:
- the battery charge curve;
- the "Holds the period" or "Energy failure" verdict;
- the battery and panels needed;
- the data rate to Earth and the data volume over the period.

The choice of vehicle is saved in the browser and is also used by the date search. Model and
assumptions: [member4_energy_telecom.md](member4_energy_telecom.md).

## Choose the landing date (member 5)

Panel before the zone search. It scores each possible date, every 12 h over 3 to 12 months, for
the 3 candidate sites. It excludes dates with no Sun or no Earth just after landing, or with a
battery failure, then ranks the best windows with their "pros" and "cons". Method, weights and
recommendation: [member5_decision.md](member5_decision.md).

## Visibility rules
- Sun: visible if more than half of its disk rises above the horizon at its azimuth. The solar
  flux is weighted by the visible fraction of the disk.
- Earth: visible if its centre rises above the horizon.
- Horizon: member 2's masks (20 m relief near the site, 120 m far away); multi-resolution relief on
  demand for custom sites; smooth ground outside the polar DEM.
- The official LOLA maps count the Earth as visible as soon as its edge shows: their percentages
  are a few points higher. See [validation_lola.md](validation_lola.md).

## Code organization
```
app/src/
  astro/ephemeris.ts   Sun/Earth positions in the lunar frame, elevation/azimuth
  astro/horizon.ts     horizon masks, reduced DEM (map, fallback)
  astro/tiles.ts       reading of the relief tiles (cache, parallel loading)
  astro/horizonTiled.ts  multi-resolution horizon on demand (custom sites)
  astro/horizon.worker.ts, astro/onDemand.ts  background execution (Web Worker)
  astro/analysis.ts    simulation over time, windows, indicators, lunar months
  astro/relay.ts       LRO relay passes
  astro/budget.ts      energy budget (battery, panels) and telecom (data rate, volume), member 4
  astro/landing.ts     scoring of landing dates, member 5
  optim/               zone search (Web Worker), scores, profiles
  site/                public site Earthrise Atlas (replaces the old components/ and App.tsx)
app/scripts/           sync-data, validate-ephemeris, validate-lola, mission-report
```
