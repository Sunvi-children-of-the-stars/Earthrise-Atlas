# Earthrise Atlas

**Compare landing sites and dates at the lunar South Pole, in seconds.**

Earthrise Atlas shows where the Sun and the Earth stand relative to the real terrain horizon of
any south polar site, and turns that into what a mission needs to know: solar power, length of
the nights, and windows for direct communication with Earth. Built for the NASA Space Apps
Challenge.

**Live site:** https://earthrise-atlas.vercel.app

---

## Contents

- [Features](#features)
- [Quick start](#quick-start)
- [Project structure](#project-structure)
- [Data pipeline](#data-pipeline)
- [Validation](#validation)
- [Deployment](#deployment)
- [Documentation](#documentation)
- [Data sources](#data-sources)

---

## Features

| Page | What it does |
|---|---|
| **Story** (`/`) | Guided tour in 6 chapters, computed on real data for the lunar day of 14 Nov 2026 |
| **Atlas** (`/atlas`) | Full screen map on the LROC image, site cards, custom coordinates |
| **Play** (`/play`) | Pick a site, a date and a duration: key figures, verdict, sky view, timeline, 3D terrain, delayed mission, shareable link, PDF mission sheet |
| **Mission Lab** (`/lab`) | Best zones (optimizer), best landing dates, power and radio budget, side by side comparison |
| **Method** (`/method`) | Data, validation and team |

Under the hood:

- **Terrain horizons** from NASA LOLA elevation models (20 m near the site, coarser far away),
  with lunar curvature.
- **Ephemerides** from JPL Horizons (Sun and Earth, 2026 to 2030), accurate to 0.003°.
- **Relay satellites:** LRO orbit from JPL Horizons, plus model orbits for Gateway (NRHO) and
  Queqiao-2.
- **Energy and telecom budget** for reference vehicles: battery state of charge, battery and
  panel sizing, data rate and data volume to Earth.
- **Permanent shadows, Diviner temperatures and official Artemis III candidate regions.**
- Everything runs **in the browser**: the site is fully static, with no server.

---

## Quick start

### Run the web app

Requires Node.js 18 or later.

```bash
cd app
```

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5173.

### Run the tests

105 automated tests of the computations (Vitest, a few seconds), from `app/`:

```bash
npm test
```

### Set up Python (data processing only)

Requires Python 3.11 or later (numpy 2.5 needs it). On Windows:

```bash
py -3.13 -m venv .venv
```

```bash
.venv/Scripts/python -m pip install -r requirements.txt
```

Each script then runs with `.venv/Scripts/python scripts/<name>.py`.

---

## Project structure

```
app/                  React + TypeScript web app (Vite)
  src/site/           public site: pages, theme, texts (EN/FR)
  src/astro/          ephemerides, horizons, relays, energy budget, landing dates
  src/optim/          zone optimizer (Web Worker), scores, profiles
  scripts/            data sync, validation and report scripts
data/
  dem/                LOLA elevation models (downloaded, not versioned) and preview map
  sites/              sites.json, Artemis III regions, nearest permanent shadow
  horizons/           precomputed horizon mask of each site (CSV + JSON)
  ephemeris/          Sun and Earth seen from the Moon (JPL Horizons, 2026 to 2030)
  relays/             LRO orbit (JPL Horizons) and model orbits (Gateway, Queqiao-2)
  calendar/           site × lunar month calendar
  lroc/               LROC image of the South Pole
  diviner/            Diviner temperatures (not versioned)
  validation_lola/    official LOLA maps and comparison results (maps not versioned)
docs/                 team notes and method documents
scripts/              Python data processing
```

---

## Data pipeline

Run the steps in this order. Missing LOLA elevation models are downloaded automatically.

| # | Command | Output | Time |
|---|---|---|---|
| 1 | `scripts/build_tiles.py` | Elevation tile pyramid, 20 m to 960 m, for on-demand horizons | minutes |
| 2 | `scripts/build_sites.py` | Site database and precomputed horizon masks (downloads the 116 MB LOLA model the first time) | ~1 min |
| 3 | `scripts/build_horizon_maps.py` | Horizon maps of the 9 optimizer regions | ~1 h locally, ~2 min on Modal |
| 4 | `scripts/build_psr.py` | Permanent shadows and distance of each site to the nearest one | ~10 s |
| 5 | `scripts/build_diviner.py` | Diviner temperatures and ice depth (downloads 605 MB the first time) | ~1 min |
| 6 | `scripts/fetch_ephemeris.py` | Sun and Earth from JPL Horizons, 2026 to 2030 | ~30 s |
| 7 | `scripts/fetch_relay_ephemeris.py` | LRO orbit from JPL Horizons | ~2 min for 6 months |
| 8 | `scripts/build_relay_models.py` | Model orbits of Gateway (NRHO) and Queqiao-2 | seconds |
| 9 | `npm run calendar` (in `app/`) | Site × lunar month calendar in `data/calendar/` | seconds |

> **Notes**
> - 20 m relief reaches 80°S if `LDEM_80S_20M` (1.85 GB) is in `data/dem/`. Otherwise it
>   stops at 85°S.
> - On Windows, if Python rejects the NASA server certificate (`CERTIFICATE_VERIFY_FAILED`),
>   download the file with Windows `curl.exe` into `data/dem/`, then run the script again.

### Heavy computations on Modal

Requires a configured Modal account (`modal setup`).

```bash
modal run scripts/modal_horizon_maps.py
```

Then, locally:

```bash
.venv/Scripts/python scripts/build_horizon_maps.py --index
```

```bash
.venv/Scripts/python scripts/build_psr.py
```

```bash
.venv/Scripts/python scripts/build_diviner.py
```

For the LROC background image (1.39 GB processed in the cloud):

```bash
modal run scripts/modal_lroc.py
```

---

## Validation

| Check | Command | Result |
|---|---|---|
| Ephemerides vs JPL Horizons | `npm run validate-ephemeris` (in `app/`) | ≤ 0.003° |
| Permanent shadows and mean illumination vs official LOLA maps | `npm run validate-lola` (in `app/`), then `scripts/validate_lola.py` | Shadow overlap (IoU) 0.80 to 0.93, illumination RMS 2.5 points |
| Lunar curvature, with or without | `scripts/validate_curvature.py` | With curvature RMS 3.1 points, without 11 points |
| Energy, telecom and best landing dates | `npm run mission-report` (in `app/`) | See the member 4 and member 5 notes |

The official LOLA maps (60 MB) come from https://pgda.gsfc.nasa.gov/products/69 and go into
`data/validation_lola/` (see the header of `scripts/validate_lola.py`).

---

## Deployment

The site is static. The horizon maps (78 MB) are not in git, so the production version is built
on a machine that has them, then the `dist` folder is uploaded as is.

**Vercel** (current host):

```bash
cd app
```

```bash
npm run build:web
```

```bash
cd dist && npx vercel link --yes --project earthrise-atlas && npx vercel deploy --prod --yes
```

`npm run build:web` builds a version without the tile pyramid. `app/public/vercel.json` sends
pages back to `index.html` (except `/data/` and `/assets/`) and sets cache headers for the data.

**Netlify** (alternative): after `npm run build:web`, run
`npx netlify-cli deploy --dir=dist --prod` from `app/`.

More details: [docs/public_site.md](docs/public_site.md).

---

## Documentation

| Topic | Document |
|---|---|
| Public site (pages, design, code, deployment) | [docs/public_site.md](docs/public_site.md) |
| Member 1: ephemerides (JPL Horizons) | [docs/member1_ephemeris.md](docs/member1_ephemeris.md) |
| Member 2: sites and topography | [docs/member2_sites_topography.md](docs/member2_sites_topography.md) |
| Member 3: application | [docs/member3_application.md](docs/member3_application.md) |
| Member 4: energy and telecom budget | [docs/member4_energy_telecom.md](docs/member4_energy_telecom.md) |
| Member 5: decision support and recommendation | [docs/member5_decision.md](docs/member5_decision.md) |
| Zone optimizer | [docs/zone_optimizer.md](docs/zone_optimizer.md) |
| Elevation tile pyramid | [docs/tile_pyramid.md](docs/tile_pyramid.md) |
| Validation vs official LOLA maps | [docs/validation_lola.md](docs/validation_lola.md) |
| Validation vs QuickMap | [docs/validation_quickmap.md](docs/validation_quickmap.md) |
| Moon Trek and Horizons resources | [docs/resources_moontrek_horizons.md](docs/resources_moontrek_horizons.md) |
| Ephemeris decision | [docs/ephemeris_decision.md](docs/ephemeris_decision.md) |

---

## Data sources

- **NASA LRO / LOLA:** polar elevation models (PDS) and illumination maps, Mazarico et al. (2011).
- **JPL Horizons:** Sun, Earth and LRO positions.
- **NASA LRO / LROC:** South Pole image mosaic.
- **NASA LRO / Diviner:** surface temperatures.
- **NASA Moon Trek:** Artemis III candidate landing regions (2022 list).
