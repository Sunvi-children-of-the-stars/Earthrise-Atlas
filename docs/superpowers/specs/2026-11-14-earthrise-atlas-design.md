# Earthrise Atlas: design of the public site

*14 Nov 2026. Fully replaces the current interface of the application (`app/src/App.tsx` and
`app/src/components/`). The computation engine (`app/src/astro/`, `app/src/optim/`, `share.ts`)
and the data (`data/`) are kept.*

## 1. Intent

The project answers the NASA Space Apps 2026 challenge "Lunar Landing Site Navigator": help mission
planners, teachers and the general public compare landing sites and dates at the Moon's South
Pole, by showing the Sun and the Earth relative to the horizon.

The current interface is an expert tool, dense and in French. Instead, the team wants a
**public-facing site with a polished art direction**, under the name **Earthrise Atlas**. Visitors
must **first understand** why landing at the South Pole is so hard (a Sun that skims the horizon,
an Earth that hides for whole days), **then be able to play** with the real data. The power of the
tool remains available to the jury and to curious visitors, but it must not overwhelm the general
public.

## 2. Goals, non-goals, anti-goals

**Goals**
- A home page that makes people want to explore, then a short story that explains the problem in
  a few minutes.
- A "play" mode where you choose a site and a date, and see the sky and the key figures.
- All existing computation features remain available, on a dedicated page (Mission Lab).
- English by default, French through a button.
- A static site, deployable on Netlify with `npm run build:web`.

**Non-goals**
- No new scientific computation: the engine is frozen, tested (50 tests) and validated.
- No 3D view of the relief in this version.
- No user account and no server.

**Anti-goals** (what would be a failure even if everything works)
- A non-specialist visitor landing on a dashboard full of numbers with no explanation.
- A site that breaks the design rules: more than two colours, em dashes, decorative italics.
- Displayed figures that differ from the engine's (no figure hard-coded in the texts if it can be
  computed; see 9.3).
- A loss of a feature of the current tool without an explicit decision.

## 3. Design constraints

| Element | Rule |
|---|---|
| Name | **Earthrise Atlas** |
| Font | **Poppins** (Google Fonts), weights 300, 400, 500, 600. Titles in 300 or 400, large and airy |
| Colours | Deep black (background, `#000` to `#0A0C12`), white (text), **icy ice green `#9BF0D8`** (the Earth in charts, actions, links, accents), **very pale gold** (the Sun, **only in charts and data**). The builder chooses the exact value of the pale gold (around `#F3E2B3`), checking the contrast on black. Greys are shades of white through transparency, not extra colours |
| Punctuation | **No em dash** (—) in the texts, in English or in French. Use colons, commas, brackets or short sentences |
| Italics | Only for the title of a cited work, if needed. Never for emphasis or decoration |
| Mood | "Polar night" direction approved on a mock-up: very dark, airy, centred composition on the home page, light typography, thin ice-green arcs, relief in silhouette at the very bottom of the screen |
| Logo | An ice-green horizon arc with a small white disk on it (the Earth rising), as on mock-up C. Also used as the favicon |

The approved mock-up is kept in `.superpowers/brainstorm/` (file `style-directions.html`,
option C).

## 4. Approaches considered

| Approach | Pros | Cons | Decision |
|---|---|---|---|
| **A. Rebuild the interface inside the current React + Vite application** | Reuses the engine and its tests as they are; a single code base; almost no new dependency; static hosting unchanged | All visual components must be rewritten | **Chosen** by the team |
| B. Separate static showcase for the story, current application for play | Story slightly faster to load | Two code bases; design and translation to keep in sync | Rejected |
| C. Migration to Next.js or similar | Server rendering, SEO | Full migration for benefits that a static demo site does not need | Rejected |

## 5. Page architecture

```
 /             Story (home + story in 5 chapters)
 /atlas        Atlas (map of the South Pole)
 /play         Play (main experience)           tabs: Sky · Timeline · Site
 /lab          Mission Lab (expert tools)       tabs: Zones · Landing dates · Power & radio · Compare
 /method       Method (data and validation)     tabs: Data · Validation · Team
```

- Fixed navigation at the top: logo and name on the left; Story, Atlas, Play, Lab, Method;
  **EN | FR** button on the right. On mobile, a collapsible menu.
- **Tabs**: wherever a screen would become too crowded (team rule: "tabs if needed"). Those listed
  above are the starting point; the builder can add or merge some depending on the real density.
- **Path routing** (`/play`, `/lab`…), to leave the **URL hash to the existing shareable link**
  (`share.ts`, format `#site=…&t=…&d=…`). This requires an SPA rewrite rule on the host
  (`/* /index.html 200` in `app/public/_redirects` for Netlify) and a compatible `base` (currently
  `./` in `vite.config.ts`, to switch to `/`).
- The shareable link applies to Play and Mission Lab: `/play#site=malapert-massif&t=…`.

## 6. Content, page by page

### 6.1 Story (`/`)

**Home (first screen)**, based on mock-up C: eyebrow "Lunar south pole", title "Where the Sun never
sets, and the Earth hides for days.", an introductory sentence, two buttons ("Start the journey",
which scrolls to the story, and "Play with the map", to `/play`). Relief in silhouette at the
bottom of the screen, thin ice-green arcs, a small white disk (the Earth) sitting on the horizon.
Slow, discreet animation, disabled if the visitor asks for less motion (`prefers-reduced-motion`).

**Story**, 5 chapters that appear on scroll. Each has a title, 2 to 4 sentences and an illustration
**fed by the real data**:

| Chapter | Message | Illustration and source |
|---|---|---|
| 1. Why the south pole | Water ice sleeps in craters the Sun never enters | LROC photo of the pole (`data/lroc/`) with the permanent shadows of the "pole" region in ice green (`data/horizon_maps/pole.psr.u8`) |
| 2. A Sun that never climbs | At the pole, the Sun circles the horizon without ever climbing high (less than 2° at Connecting Ridge) | Simplified 360° panorama of Connecting Ridge over a lunar day: real horizon, path of the Sun in pale gold |
| 3. An Earth that hides | The Earth tips below the relief and the radio link is cut for whole days; a relay satellite can fill the gap | "Earth visible / hidden" time strip over a lunar day at the ridge, with the longest blackout, then the same strip with the LRO relay |
| 4. One kilometre changes everything | Moving the site by a few hundred metres changes everything | A **slider** the visitor drags along a 2 km transect at Mons Mouton: Earth visibility and sunlight update (module `optim/neighborhood.ts`, `transect()`) |
| 5. Your turn | Invitation to choose a site and a date | Button to `/play`, and to `/atlas` |

The figures quoted in the texts are computed when the page opens (see 9.3).

**Reference period of the story** *(designer's choice)*: the illustrations and figures of the story
cover a **fixed** period, the lunar day starting on 14 Nov 2026 at 16:00 UTC, which is the period of
the reference values of the tests and documentation. This way, the story always tells the same
story, whatever the day of the visit. Play, on the other hand, opens on today's date.

### 6.2 Atlas (`/atlas`)

- Large map of the South Pole: LROC photo (`data/lroc/south_pole_wac_400m.jpg`, same grid as the
  reduced DEM), outlines of the Artemis III regions (`data/sites/artemis3_regions_2022.geojson`),
  the **14 sites** (`data/sites/sites.json`), split into candidate sites and reference sites.
- A click on a site opens a **card**: name, mission, context, coordinates, elevation, nearest
  permanent shadow, Diviner temperature (`data/sites/diviner.json`) when it exists, and a
  "Play this site" button.
- A click elsewhere on the map offers "Play this point" (custom site, on-demand horizon
  computation as today).
- Sites outside the polar map (Apollo, Chang'e, SLIM, Blue Ghost) are reachable through an "Other
  landing sites" list next to the map.

### 6.3 Play (`/play`)

The main experience, for the general public.

- **Choice**: site (list of the 14 sites, plus "custom" from the Atlas), start date, duration
  (3 days, 7 days, one lunar day). Defaults: Connecting Ridge, today, one lunar day.
- **Key figures** (3 or 4 large cards, plain language): share of time in sunlight, share of time
  with the Earth visible, longest night, and an understandable **verdict** (for example "A small
  solar lander survives this mission" or "Battery runs out after 3 days"), computed with
  `astro/budget.ts` for the default "lander" vehicle.
- **Sky tab**: 360° panorama with the real horizon, the paths of the Sun (pale gold) and the Earth
  (ice green), and their position at the cursor time. Play button to animate.
- **Timeline tab**: timeline of the period with Sun, Earth and LRO relay bands, draggable cursor;
  "sunset in…", "Earth sets in…".
- **Site tab**: terrain card (elevation, slopes, obstacles), reliability of the result (robust,
  to be confirmed, fragile, with its reason in one sentence), lunar months over a year.
- **Actions**: "Mission delayed by a month?" (compares the same duration one lunar month later,
  `optim/delay.ts`, `shiftScan()`), "Share" (copies the link, `share.ts`), "Open in Mission Lab".

### 6.4 Mission Lab (`/lab`)

For the jury and curious visitors. Simplified settings by default, **advanced options folded** in
each tab.

| Tab | Content | Engine |
|---|---|---|
| Zones | Search for the best zones in one of the 9 regions, by mission profile (heat map on the region's LROC photo, `<id>.wac.u8`). Advanced: weights, constraints, layers. A click on a zone opens it in Play | `optim/` (worker), `score.ts`, `PROFILES` |
| Landing dates | Best landing dates for the candidate sites, with "pros" and "cons" in plain words. Advanced: mission duration, vehicle, step | `astro/landing.ts` |
| Power & radio | Energy budget (charge curve, battery and panels needed) and radio budget (data rate, volume) for a reference vehicle. Advanced: all vehicle parameters | `astro/budget.ts` |
| Compare | Comparison table of scenarios (site × date × duration), best value highlighted, saved in the browser | `astro/analysis.ts`, `relay.ts` |

The phase A features that have no screen today find a place here when it is simple: site × month
calendar (`data/calendar/sites.json`) in Landing dates, model relays Gateway and Queqiao-2
(`loadRelays()`) as an advanced option of Power & radio or Compare, rover route (`optim/rover.ts`)
as an advanced option of Zones. The builder can postpone them if they make things too heavy; it is
not blocking.

### 6.5 Method (`/method`)

- **Data**: one card per source (LOLA, JPL Horizons, LRO/LROC, Diviner, LRO orbit), what it brings,
  its resolution, its link.
- **Validation**: the validations already documented, summarized in plain words (Horizons
  ≤ 0.003°, permanent shadows IoU 0.80 to 0.93 against the official LOLA maps, ridge case settled
  by curvature), with links to the repository documents.
- **Team**: the team, the Space Apps 2026 challenge, the link to the source code
  (https://github.com/Sunvi-children-of-the-stars/Earthrise-Atlas). The five members, all from
  **Benin**, shown as they are (no roles: none were provided):
  - IDOHOU Cyrus
  - Elge TOPANOU
  - Ezékias AGLOSSI
  - GBAGUIDI Ursus
  - Marguerite ASSOU

## 7. Languages

- English by default, French through the EN | FR button. The choice is saved in the browser
  (`localStorage`, with a silent fallback if unavailable) and reflected in `<html lang>`.
- All interface texts are in two dictionary files (for example `app/src/i18n/en.ts` and `fr.ts`)
  with the **same keys**. No internationalization library: a small hook is enough.
- The **story** texts are written by the builder in English, then translated into French,
  following the design rules (no em dash, no italics).
- The **data** keep their original language when they come from the files (for example
  `sites.json`, in French): the builder translates the visible fields (short name, region,
  context) at display time with a dictionary of the 14 sites, rather than changing the data files.
- Formats: numbers and dates according to the language (`Intl`), times always in UTC and marked as
  such.

## 8. What exists and what changes

| Existing | Becomes |
|---|---|
| `astro/`, `optim/`, `share.ts`, `data.ts`, `format.ts` | **Kept**. No change of behaviour. Any addition goes through new tested functions |
| `App.tsx`, `components/*.tsx`, `styles.css` | **Replaced**. The useful state logic (loading of the sites, masks, Horizons table, relay, on-demand computation of custom sites) is carried over into the new structure; the visuals are rewritten |
| `scripts/sync-data.mjs`, `vite.config.ts` (serving tiles and horizon maps) | Kept; `base` switches to `/` for path routing |
| 50 tests (`npm test`) | Must stay green |
| `npm run build:web` | Remains the deployment command |

Before removing a component, check that each feature it offered has a place in the new site
(section 6), or that dropping it has been decided.

## 9. Cross-cutting requirements

### 9.1 Accessibility and comfort
- Enough contrast for text on black, including the pale gold and the ice green (WCAG AA for text).
- Keyboard navigation, visible focus, accessible tabs (ARIA roles `tablist`, `tab`, `tabpanel`).
- Animations turned off with `prefers-reduced-motion`.
- Charts: an alternative text summarizing what the chart shows.

### 9.2 Performance
- Heavy data load only on the page that needs them: horizon maps (up to 23 MB) only in Mission Lab
  > Zones, LROC photo (1.7 MB) in Atlas and Story.
- Mission Lab is split into its own JavaScript bundle (dynamic import).
- The home page shows without waiting for the computations; the story illustrations are computed
  progressively.

### 9.3 Accuracy
- The displayed figures come from the engine at display time. The texts contain them through
  placeholders (for example `{earthPct}`), not hard-coded.
- When a result is "fragile" according to `fragility()`, the site says so in one sentence.
- The Gateway and Queqiao-2 relays are always marked "model" (model orbits, not ephemerides).

### 9.4 Screens
- Desktop first (demo to the jury), but Story, Atlas and Play must remain usable on a phone (no
  horizontal scrolling of the page). Mission Lab can be reserved for large screens, with a message
  on mobile.

## 10. Success criteria

- A visitor who knows nothing about the Moon understands, after the story, why the Sun, the Earth
  and the exact location matter at the South Pole.
- From the home page, Play is one click away, and the sky of a site appears in a few seconds.
- All features of the current tool are present (Play or Mission Lab).
- The design rules are respected everywhere, including in French.
- `npm test` and `npm run build:web` pass; the deployed site works without the tile pyramid
  (fallback to the reduced DEM for custom sites, as today).

## 11. Left to the builder

- The exact value of the pale gold and of the grey shades, the spacing and the grid.
- The choice of router (a lightweight library whose version was published more than two weeks
  ago, or home-made routing).
- The writing of the story and page texts, and their translation, following the design rules and
  section 6.
- The exact split into tabs beyond those listed, depending on the real density.
- The form of the story illustrations, as long as they use the real data.
- The order in which the pages are built.
