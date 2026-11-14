# Earthrise Atlas: the public site

The public site **Earthrise Atlas** replaces the old expert interface. Design:
[superpowers/specs/2026-11-14-earthrise-atlas-design.md](superpowers/specs/2026-11-14-earthrise-atlas-design.md);
plan: [superpowers/plans/2026-11-14-earthrise-atlas.md](superpowers/plans/2026-11-14-earthrise-atlas.md).

## Pages

| Address | Page | Content |
|---|---|---|
| `/` | Story | Home page ("Polar night" direction) then a story in 6 chapters, computed on the lunar day of 14 Nov 2026, including "Not like home" (Earth versus Moon) |
| `/atlas` | Atlas | Full-screen map on the LROC photo, floating site card, chips for the polar sites, coordinate input, other sites |
| `/play` | Play | Site, date and duration; 4 key figures and a verdict; Sky, Timeline, 3D and Site tabs; delayed mission with a search for nearby spots; shareable link; PDF mission sheet |
| `/lab` | Mission Lab | Zones, Landing dates, Power & radio and Compare tabs; advanced settings folded; loaded on demand; large screens |
| `/method` | Method | Data, Validation and Team tabs |

The shareable link lives in the address: `/play#site=malapert-massif&t=2026-11-14T16:00Z&d=708.7`.

## Design rules

Poppins font; black, white, ice green `#9bf0d8` (Earth, actions) and pale gold `#f3e2b3` (Sun,
only in the data); no em dash; no italics. All colours are variables in
`app/src/site/theme.css`. Tests check the texts: same keys in English and French, no em dash, no
forgotten `{x}` placeholder.

## Code

```
app/src/site/
  App.tsx, router.ts, theme.css     shell, path routing, theme
  i18n/                             EN and FR dictionaries, texts of the 14 sites
  data/store.tsx                    data loading, horizon masks
  viz/                              sky, timeline, polar map, silhouette
  story/ atlas/ play/ lab/ method/  the pages
```

The computation engine (`app/src/astro/`, `app/src/optim/`) did not change. The old interface
(`App.tsx`, `components/`, `styles.css`) was removed; each feature has its place:

| Old component | New place |
|---|---|
| SkyPanorama, Timeline | Play (Sky and Timeline tabs), Story (chapters 2 and 3) |
| MetricCards, SiteDetails, Seasonal | Play (key figures, Site tab, 13 lunar months) |
| PoleMap, coordinate input | Atlas |
| Optimizer | Mission Lab > Zones (Score, Sun, Earth and Slope layers; rover route) |
| LandingPlanner | Mission Lab > Landing dates (with the site × month calendar) |
| BudgetPanel | Mission Lab > Power & radio (with the model relays) |
| Comparison | Mission Lab > Compare |

Changes compared with the old optimizer: the "night", "Sun and Earth", "Earth or relay", "total
blackout" and "distance to permanent shadows" layers are no longer shown as layers; the matching
criteria can still be tuned and the values stay in the zone table.

## Added data

- `data/story/mons-mouton-transect.json` (chapter 4): `npm run story` in `app/`, with the horizon
  maps installed.

## Check

```bash
cd app
npm test            # 105 tests
npm run build:web   # online version (~89 MB, without tiles)
npm run dev         # http://localhost:5173
```

## Bonuses (14 Nov 2026)

| Bonus | Where | How |
|---|---|---|
| Full delayed mission | Play > "Mission delayed by a month?" > "Find better spots nearby" | `play/nearby.ts`: computation region of the site, two evaluations in the worker (planned date and delayed date), `compareDelay()`; best spots within 10 km |
| Earth versus Moon | Story, chapter 4 "Not like home" | `story/home.ts`: length of the day, Sun at its highest (Paris versus Connecting Ridge), temperature (Diviner), sky, radio delay |
| Mission sheet (PDF) | Play > "Mission sheet (PDF)" | `play/MissionSheet.tsx` and `play/pdf.ts`: the button downloads `earthrise-atlas_<site>_<date>.pdf` directly (one A4 page, ~300 KB); the sheet is captured off-screen with html-to-image 1.11.11 and placed in the PDF with jsPDF 2.5.2, both loaded on click; the Poppins font is embedded in the capture. Ctrl+P still prints the same sheet |
| 3D view | Play > 3D tab | `play/Terrain3D.tsx` (Three.js 0.169.0, loaded on demand, 124 KB compressed): 20 × 20 km of real relief around the site (200 m region map, lunar curvature), the Sun as the only light with cast shadows, the Earth in the sky; hidden when they are below the site's real horizon. Available for sites in the polar regions |

The sky panorama is now centred on the mean direction of the Earth: it stays in one piece in the
middle of the chart, whatever the site.

## Final review

An independent review of the branch concluded "ready after fixes". The five important points are
fixed, each with a test (horizon cache of a custom point shared by link, translated region names
and radio labels, honest text for a custom point, map that no longer captures scrolling).

Minor points deferred, to handle if time allows:
- no notice when the period goes beyond the JPL Horizons table (2026 to 2030): the built-in
  series take over silently;
- the duration selector shows a wrong value when the duration is not 3 days, 7 days or one lunar
  day (for example 3 months coming from the Lab, or a 14-day window);
- the short name of a custom point keeps the decimal point and the E/W letters in French;
- two bluish greys (`--bg-3` and the home page gradient) slightly leave the black range;
- accessibility: lunar month bars (buttons inside an image) and `aria-controls` of the inactive
  tabs.

## Deployment (Vercel)

Address: https://earthrise-atlas.vercel.app (Vercel project `earthrise-atlas`).

The site is fully static: the computations run in the browser, there is no server. The horizon
maps (78 MB) are not in git; the online version is therefore built on a machine that has them,
then the `dist` folder is uploaded as is:

```bash
cd app
npm run build:web
cd dist && npx vercel link --yes --project earthrise-atlas && npx vercel deploy --prod --yes
```

`app/public/vercel.json` replaces `_redirects` and `_headers` (Netlify): pages fall back to
`index.html`, except `/data/` and `/assets/`, and the data get cache headers.
