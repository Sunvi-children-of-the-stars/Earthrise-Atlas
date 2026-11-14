# Earthrise Atlas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current expert interface with the public site Earthrise Atlas (Story, Atlas, Play, Mission Lab, Method), in English with an FR button, in the "Polar night" direction.

**Architecture:** New interface in `app/src/site/`, mounted by `main.tsx` from task 1; the old one (`App.tsx`, `components/`, `styles.css`) stays compilable as a reference and is only removed in the last task. The engine (`astro/`, `optim/`, `share.ts`, `data.ts`) is not changed. Home-made path routing (the hash stays with the shareable link), EN/FR dictionaries with identical keys, a React data provider that takes over the loading logic of the old `App.tsx`.

**Tech Stack:** React 18.3, Vite 5.4, TypeScript 5.6, Vitest 3.2.4 (node environment). No new npm dependency. Poppins font via Google Fonts.

**Spec:** `docs/superpowers/specs/2026-11-14-earthrise-atlas-design.md`

## Global Constraints

- Displayed name: **Earthrise Atlas**. Page title `Earthrise Atlas`.
- Font: **Poppins**, weights 300, 400, 500, 600; titles in 300 or 400.
- Colours: black (`#000` to `#0A0C12`), white, **ice green `#9BF0D8`** (Earth, actions, links, accents), **pale gold** (Sun, **only in charts and data**, value of choice around `#F3E2B3`, AA contrast on black). Greys = white with transparency. No other hue.
- **No em dash (—)** in the EN and FR texts. **No italics** except for the title of a cited work.
- English by default, **EN | FR** button, choice saved (`localStorage` key `earthrise.lang`, silent fallback), `<html lang>` kept up to date.
- Pages and paths: `/` Story, `/atlas`, `/play`, `/lab`, `/method`. The **hash** is reserved for the `share.ts` shareable link (`#site=…&t=…&d=…`).
- Story over a **fixed** period: start `Date.UTC(2026, 10, 14, 16)`, duration **708.7 h**. Play opens on the current time rounded to the hour.
- No figure hard-coded in a text if it can be computed: texts contain `{name}` placeholders.
- The Gateway and Queqiao-2 relays are always labelled "model".
- The engine (`app/src/astro/`, `app/src/optim/`, `app/src/share.ts`, `app/src/data.ts`) is **not changed**; any new logic goes into `app/src/site/` with its tests.
- `npm test`, `npx tsc --noEmit` and `npm run build:web` pass at the end of **every** task (commands in `app/`).
- Animations turned off if `prefers-reduced-motion: reduce`. Story, Atlas, Play with no horizontal scrolling at 375 px width.

## Review Focus

1. **Switching to FR**: every visible text (names and contexts of the 14 sites included) switches, and numbers are written the French way (`52,4 %`). Tested in task 1 (parity and design rules of the dictionaries, FR format) and task 2 (coverage of the 14 sites).
2. **Opening or reloading `/play#site=…` directly**: the right page shows with the right site and the right date; a damaged hash falls back to the defaults. Tested in task 1 (`pageFromPath`) and task 4 (`initialPlayState`); `_redirects` rule in task 1.
3. **Custom site without tiles** (online version) or outside the polar DEM: the horizon falls back to the reduced DEM or smooth ground, the card says so, nothing breaks. Tested in task 2 (`customMaskSource`).
4. **Period outside the data** (LRO relay after 30 Apr 2027, Horizons table outside 2026 to 2030): the site shows "not available for this period" instead of wrong figures. Tested in task 4 (`relaySummary` returns `null` if `!available`).
5. **Reduced motion and small screen** on Story: no animation, no horizontal overflow. Checked by the visual checklist of task 5.

---

## File structure

```
app/src/site/
  App.tsx                 shell: DataProvider, I18nProvider, Nav, current page
  router.ts               Page, pageFromPath, pathOf, useRoute, navigate
  theme.css               variables, typographic base, utilities
  i18n/en.ts, fr.ts       dictionaries (same keys)
  i18n/index.tsx          I18nProvider, useI18n (t, lang, setLang, fmt)
  i18n/sites.ts           EN/FR texts of the 14 sites, siteText()
  data/store.tsx          DataProvider, useData, useMask
  ui/Nav.tsx, Tabs.tsx, StatCard.tsx, Logo.tsx
  viz/SkyChart.tsx, TimelineChart.tsx, PolarMap.tsx, Silhouette.tsx, geometry.ts
  play/Play.tsx, verdict.ts, state.ts
  story/Story.tsx, Hero.tsx, chapters/*.tsx, figures.ts
  atlas/Atlas.tsx, SiteCard.tsx
  lab/Lab.tsx (loaded on demand), ZonesTab.tsx, DatesTab.tsx, PowerTab.tsx, CompareTab.tsx
  method/Method.tsx
app/scripts/build-story.ts         precomputation of the Mons Mouton transect
app/scripts/lib/fsRegion.ts        reads a region from disk (Node)
data/story/mons-mouton-transect.json
```

---

### Task 1: Foundations (theme, routing, languages, shell)

**Files:**
- Create: `app/src/site/App.tsx`, `router.ts`, `theme.css`, `i18n/en.ts`, `i18n/fr.ts`, `i18n/index.tsx`, `ui/Nav.tsx`, `ui/Logo.tsx`, `ui/Tabs.tsx`
- Create: `app/src/site/router.test.ts`, `app/src/site/i18n/i18n.test.ts`
- Create: `app/public/_redirects` (one line: `/*  /index.html  200`)
- Modify: `app/src/main.tsx` (mounts `site/App`, imports `site/theme.css`), `app/index.html` (title, `lang="en"`, logo favicon, Google Fonts Poppins 300;400;500;600 link), `app/vite.config.ts` (`base: "/"`)

**Interfaces:**
- Produces:
  - `type Page = "story" | "atlas" | "play" | "lab" | "method"`
  - `pageFromPath(pathname: string): Page` (unknown path → `"story"`, insensitive to the trailing slash)
  - `pathOf(page: Page): string` (`story` → `/`)
  - `useRoute(): { page: Page; navigate: (page: Page, hash?: string) => void }` (History API, listens to `popstate`, scrolls back to the top)
  - `type MessageKey = keyof typeof en`; `fr: Record<MessageKey, string>`
  - `useI18n(): { lang: "en" | "fr"; setLang(l): void; t(key: MessageKey, vars?: Record<string, string | number>): string; fmt: { num(x: number, digits?: number): string; pct(x: number): string; hours(h: number): string; date(ms: number): string } }`
  - `<Tabs tabs={{ id: string; label: string }[]} active={string} onChange={(id) => void} />` with ARIA roles `tablist`/`tab`/`tabpanel` and left/right arrows
- The pages are empty `<section>` components with their translated title, filled in by the following tasks.

- [ ] **Step 1: Write the failing tests**

```ts
// router.test.ts
expect(pageFromPath("/")).toBe("story");
expect(pageFromPath("/play")).toBe("play");
expect(pageFromPath("/lab/")).toBe("lab");
expect(pageFromPath("/nope")).toBe("story");
expect(pathOf("story")).toBe("/");
expect(pathOf("method")).toBe("/method");

// i18n.test.ts
test("same keys in English and French", () => expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort()));
test("design rules: no em dash, no italics, no 'membre'", () => {
  for (const s of [...Object.values(en), ...Object.values(fr)]) {
    expect(s).not.toMatch(/—/); expect(s).not.toMatch(/<\/?(i|em)>/); expect(s.toLowerCase()).not.toContain("membre");
  }
});
test("FR format", () => { expect(makeFmt("fr").pct(52.43)).toBe("52,4 %"); expect(makeFmt("en").pct(52.43)).toBe("52.4%"); });
test("interpolation", () => expect(interpolate("Sun {pct} of the time", { pct: "88%" })).toBe("Sun 88% of the time"));
```
(`makeFmt(lang)` and `interpolate(template, vars)` are exported by `i18n/index.tsx` so they can be tested outside React. The spaces in `"52,4 %"`: `Intl` in `fr` uses a narrow no-break space; normalize to a no-break space in `pct` and adapt the test to the real output of `Intl.NumberFormat("fr", { style: "unit" })` or of a home-made format, as preferred, as long as the display is `52,4 %`.)

- [ ] **Step 2: Run, verify they fail**: `npx vitest run src/site` → FAIL (missing modules).
- [ ] **Step 3: Implement** router, i18n, theme (variables `--bg`, `--bg-2`, `--text`, `--muted`, `--line`, `--ice: #9BF0D8`, `--sun` pale gold, radii, spacing; `font-family: Poppins`; `font-style: normal` everywhere), `Nav` (logo, 5 links, EN | FR button, collapsible menu below 720 px), `Logo` (ice-green arc and white disk, SVG, also as a data-URI favicon), `Tabs`, `App` (reads the page, renders it, `document.title` = `Earthrise Atlas` or `Page · Earthrise Atlas`, `document.documentElement.lang`).
- [ ] **Step 4: Verify**: `npx vitest run` (all green), `npx tsc --noEmit`, `npm run build:web`. Then `npm run dev` and check by eye: navigation between the 5 pages, browser back button, direct reload of `http://localhost:5173/lab`, EN/FR switch kept after reload.
- [ ] **Step 5: Commit**: `git commit -m "feat(site): foundations: theme, routing, EN/FR, shell"`

---

### Task 2: Site data and texts

**Files:**
- Create: `app/src/site/data/store.tsx`, `app/src/site/i18n/sites.ts`
- Test: `app/src/site/data/store.test.ts`, `app/src/site/i18n/sites.test.ts`

**Interfaces:**
- Consumes: `loadSites`, `SiteRecord` (`data.ts`), `loadMask`, `loadDem`, `computeMask`, `flatMask`, `demElevation` (`astro/horizon.ts`), `requestTiledHorizon` (`astro/onDemand.ts`), `loadEphemerisTable`, `setEphemerisTable` (`astro/ephemeris.ts`), `loadRelays` (`astro/relay.ts`), `loadArtemisRegions` (`astro/regions.ts`). Reference logic: old `App.tsx` lines 56 to 135.
- Produces:
  - `<DataProvider>`; `useData(): { sites: SiteRecord[]; dem: Dem | null; artemis: ArtemisRegionSet | null; lro: RelayData | null; relays: RelayData[]; ephReady: boolean; error: string | null }`. The Horizons table is loaded **before** `ephReady = true`; no computation starts before that.
  - `makeCustomSite(lat: number, lon: number, dem: Dem | null): SiteRecord` (takes over `makeCustom` from the old `App.tsx`, id `custom:lat,lon` with 4 decimals)
  - `useMask(site: SiteRecord | null): { mask: HorizonMask | null; source: MaskSource }` with `type MaskSource = "precomputed" | "tiles" | "preview" | "flat" | "loading"`; cache by id; custom site: tiles, otherwise reduced DEM, otherwise smooth ground.
  - `customMaskSource(inDem: boolean, tilesOk: boolean, demOk: boolean): MaskSource` (pure, used by `useMask`)
  - `siteText(site: SiteRecord, lang: "en" | "fr"): { name: string; short: string; region: string; context: string }`; `SITE_TEXT` covers the 14 ids of `data/sites/sites.json` (EN translations written by the builder, FR taken from the data); custom site: generic translated texts.

- [ ] **Step 1: Write the failing tests**

```ts
// sites.test.ts: every site in data/sites/sites.json has non-empty EN and FR texts, with no em dash
for (const s of sites()) for (const lang of ["en", "fr"] as const) {
  const x = siteText(s, lang);
  expect(x.short.length).toBeGreaterThan(0); expect(x.context.length).toBeGreaterThan(20);
  expect(x.context).not.toMatch(/—/);
}
expect(siteText(makeCustomSite(-85.5, 15, null), "en").name).toBe("Custom site");

// store.test.ts
expect(customMaskSource(false, true, true)).toBe("flat");
expect(customMaskSource(true, true, true)).toBe("tiles");
expect(customMaskSource(true, false, true)).toBe("preview");
expect(customMaskSource(true, false, false)).toBe("flat");
expect(makeCustomSite(-85.5, 15, null).id).toBe("custom:-85.5000,15.0000");
```
(`sites()` comes from `src/test/data.ts`.)

- [ ] **Step 2: Run, verify they fail.**
- [ ] **Step 3: Implement** `store.tsx` and `sites.ts`.
- [ ] **Step 4: Verify**: `npx vitest run`, `npx tsc --noEmit`, `npm run build:web`.
- [ ] **Step 5: Commit**: `feat(site): data provider, masks, site texts EN/FR`

---

### Task 3: Charts (sky, timeline, polar map, silhouette)

**Files:**
- Create: `app/src/site/viz/geometry.ts`, `SkyChart.tsx`, `TimelineChart.tsx`, `PolarMap.tsx`, `Silhouette.tsx`
- Test: `app/src/site/viz/geometry.test.ts`

**Interfaces:**
- Consumes: `Sample`, `Window`, `windows`, `sunUp`, `earthUp` (`astro/analysis.ts`); `latLonToXY`, `xyToLatLon` (`astro/horizon.ts`); `RelayResult`; files `data/lroc/south_pole_wac_400m.{jpg,json}` (served under `data/lroc/`).
- Produces:
  - `azToX(az: number, width: number, centerAz = 180): number` (0 ≤ x < width, panorama centred on the south)
  - `lrocPixel(x_m: number, y_m: number): [col: number, row: number]` and `lrocXY(col, row): [x_m, y_m]` for the LROC grid (`x = (col + 0.5) * 400 - 457380`, `y = 457380 - (row + 0.5) * 400`)
  - `<SkyChart samples cursor mask compact? />`: real horizon (light grey relief), Sun path in `--sun`, Earth in `--ice`, positions at the cursor, translated N E S W axes; `role="img"` and an `aria-label` summarizing the content.
  - `<TimelineChart samples cursor onCursor relay? fragility? />`: Sun, Earth, relay and uncertain-zone bands; cursor movable with the keyboard.
  - `<PolarMap sites selectedId onSelectSite onPickPoint artemis overlay? />`: canvas, LROC background, Artemis outlines in thin ice-green lines, sites (candidates filled, references outlined), wheel and button zoom, click → lat/lon.
  - `<Silhouette mask height />`: decorative relief drawn from a real horizon mask (filled with `--bg-2`, white line at 30 %).
  The old `SkyPanorama.tsx`, `Timeline.tsx`, `PoleMap.tsx` serve as the computation reference; the drawing follows the design rules.

- [ ] **Step 1: Write the failing tests**

```ts
expect(azToX(180, 360)).toBeCloseTo(180); expect(azToX(0, 360)).toBeCloseTo(0); expect(azToX(359.9, 360)).toBeLessThan(360);
const [c, r] = lrocPixel(0, 0); expect(c).toBeCloseTo(1142.95, 2); expect(r).toBeCloseTo(1142.95, 2);
const [x, y] = lrocXY(...lrocPixel(12_345, -67_890)); expect(x).toBeCloseTo(12_345, 6); expect(y).toBeCloseTo(-67_890, 6);
```
- [ ] **Step 2: Run, verify they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Verify** tests, `tsc`, `build:web`; temporarily show the 4 components on the Method page in dev and check by eye: colours (pale gold only on the Sun), LROC photo aligned (Shackleton in the centre), map click → coordinates consistent with a known site.
- [ ] **Step 5: Commit**: `feat(site): charts and polar map in the Polar Night style`

---

### Task 4: Play

**Files:**
- Create: `app/src/site/play/Play.tsx`, `verdict.ts`, `state.ts`, `app/src/site/ui/StatCard.tsx`
- Test: `app/src/site/play/verdict.test.ts`, `app/src/site/play/state.test.ts`

**Interfaces:**
- Consumes: tasks 1 to 3; `simulate`, `metrics`, `fragility`, `seasonal` (`astro/analysis.ts`); `budget`, `VEHICLES` (`astro/budget.ts`); `relayAnalysis`; `shiftScan`, `lunarMonthDelays` (`optim/delay.ts`); `readShareState`, `writeShareState`, `shareUrl` (`share.ts`); `DURATIONS` (`data.ts`).
- Produces:
  - `type PlayState = { siteId: string; custom?: { lat: number; lon: number }; start: number; hours: number; cursor: number }`
  - `initialPlayState(hash: string, siteIds: string[], now: number): PlayState`: defaults `connecting-ridge`, `start = floor(now / 3_600_000) * 3_600_000`, `hours = 708.7`; a `siteId` missing from `siteIds` → default; `hours` outside [1, 2160] → default.
  - `missionVerdict(samples: Sample[], vehicle = VEHICLES.lander): { ok: boolean; key: MessageKey; vars: Record<string, number> }`: `ok = budget().survives`; keys `verdict.survives` (vars `minSoc`) or `verdict.brownout` (vars `afterH` = hours before the first failure, `brownoutH`).
  - `relaySummary(r: RelayResult | null): { linkPct: number; longestNoLinkH: number; passesPerDay: number } | null` (`null` if missing or `!available`)
  - `stepFor(hours: number): number` (simulation step, identical to the old `App.tsx`: `max(10, round(hours * 60 / 1500 / 5) * 5)`)
- Page: site, date and duration selectors; 4 `StatCard`s (Sun, Earth, longest night, verdict); tabs **Sky** (SkyChart + playback), **Timeline** (TimelineChart, "Sunset in …", "Earthset in …", LRO relay or "not available for this period"), **Site** (terrain, reliability in one sentence, 13 lunar months); actions "Mission delayed by a month?" (shiftScan over `[0, lunarMonthDelays(1)[1]]`, before/after display), "Share" (copies `shareUrl`, confirmation message), "Open in Mission Lab". The hash is rewritten (`history.replaceState`) at each change of site, date or duration.

- [ ] **Step 1: Write the failing tests**

```ts
// state.test.ts
const ids = ["connecting-ridge", "malapert-massif"]; const now = Date.UTC(2026, 10, 14, 16, 25);
expect(initialPlayState("", ids, now)).toEqual({ siteId: "connecting-ridge", start: Date.UTC(2026, 10, 14, 16), hours: 708.7, cursor: 0 });
expect(initialPlayState("#site=malapert-massif&t=2027-01-02T00:00Z&d=168", ids, now)).toMatchObject({ siteId: "malapert-massif", start: Date.UTC(2027, 0, 2), hours: 168 });
expect(initialPlayState("#site=unknown&d=99999", ids, now)).toMatchObject({ siteId: "connecting-ridge", hours: 708.7 });
expect(initialPlayState("#lat=-85.5&lon=15", ids, now).custom).toEqual({ lat: -85.5, lon: 15 });

// verdict.test.ts (synthetic samples, as in src/astro/budget.test.ts)
expect(missionVerdict(allSun(48)).ok).toBe(true);
const v = missionVerdict(longNight(200)); expect(v.ok).toBe(false); expect(v.key).toBe("verdict.brownout"); expect(v.vars.afterH).toBeGreaterThan(0);
expect(relaySummary(null)).toBeNull(); expect(relaySummary({ ...someRelayResult, available: false })).toBeNull();
```
- [ ] **Step 2: Run, verify they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Verify** tests, `tsc`, `build:web`; in dev, check: Connecting Ridge on 14 Nov 2026 16:00 over one lunar day → Earth ≈ 48 %, link with LRO ≈ 52 % (same values as `src/astro/relay.test.ts`); reload of `/play#site=malapert-massif&t=2026-11-14T16:00Z&d=708.7`; Share button; FR; a date in June 2027 → relay "not available"; at 375 px width, no horizontal scrolling.
- [ ] **Step 5: Commit**: `feat(site): Play page`

---

### Task 5: Story (home and story)

**Files:**
- Create: `app/scripts/lib/fsRegion.ts`, `app/scripts/build-story.ts`, `data/story/mons-mouton-transect.json` (generated)
- Create: `app/src/site/story/Story.tsx`, `Hero.tsx`, `figures.ts`, `chapters/WhyPole.tsx`, `SunNeverClimbs.tsx`, `EarthHides.tsx`, `OneKilometre.tsx`, `YourTurn.tsx`
- Modify: `app/package.json` (`story` script modelled on `calendar`), `app/scripts/sync-data.mjs` (copy `story`)
- Test: `app/src/site/story/figures.test.ts`

**Interfaces:**
- Consumes: `evaluateRegion` (`optim/evaluate.ts`), `transect` (`optim/neighborhood.ts`), `distanceTransform`, `RegionData` (`optim/region.ts`) in the Node script; `simulate`, `metrics`, `relayAnalysis` in `figures.ts`; `SkyChart`, `TimelineChart`, `Silhouette`, `PolarMap` (task 3).
- Produces:
  - `STORY_START = Date.UTC(2026, 10, 14, 16)`, `STORY_HOURS = 708.7`
  - `storyFigures(ridge: SiteRecord, ridgeMask: HorizonMask, lro: RelayData | null): { sunMaxAlt: number; sunPct: number; earthPct: number; longestNoEarthH: number; longestNoLinkH: number | null; passesPerDay: number | null }` (30 min step, fixed period)
  - `data/story/mons-mouton-transect.json`: `{ site: "mons-mouton", start, hours: 156, azimuthDeg: 90, stepKm: 0.1, points: { distKm, sunPct, earthPct, nightH, outageH }[] }` from −2 to +2 km. Script: `npm run story` (reads `data/horizon_maps/mons-mouton.*` through `fsRegion.ts`, `evaluateRegion` over the fixed 156 h period from `STORY_START`, then `transect`).
- Page: Hero (exact text of the spec: eyebrow "Lunar south pole", title "Where the Sun never sets, and the Earth hides for days.", buttons "Start the journey" and "Play with the map", silhouette drawn from the ridge mask, thin ice-green arcs, small white disk) then 5 chapters appearing on scroll (`IntersectionObserver`, no animation with reduced motion). Chapter 1: LROC photo + permanent shadows of `pole` (file `pole.psr.u8`, served in development by the middleware and included by `build:web`); chapter 2: compact SkyChart of the ridge; chapter 3: TimelineChart without then with the relay; chapter 4: slider on the transect (JSON values, Earth and Sun shown large); chapter 5: links to Play and Atlas. All figures in the texts come from `storyFigures` or the JSON.

- [ ] **Step 1: Write the failing tests**

```ts
useHorizonsTable();
const f = storyFigures(site("connecting-ridge"), mask("connecting-ridge"), relay("lro"));
expect(f.sunMaxAlt).toBeLessThan(2.2); expect(f.sunPct).toBeCloseTo(100, 0); expect(f.earthPct).toBeCloseTo(48.3, 0);
expect(Math.abs(f.longestNoEarthH - 321.5)).toBeLessThanOrEqual(1); expect(f.longestNoLinkH!).toBeLessThan(2);
expect(storyFigures(site("connecting-ridge"), mask("connecting-ridge"), null).longestNoLinkH).toBeNull();
// versioned transect
const tr = JSON.parse(readFileSync(join(DATA, "story/mons-mouton-transect.json"), "utf8"));
const at0 = tr.points.find((p) => p.distKm === 0); expect(at0.earthPct).toBeGreaterThan(95);
expect(Math.min(...tr.points.filter((p) => Math.abs(p.distKm) <= 1).map((p) => p.earthPct))).toBeLessThan(80);
```
- [ ] **Step 2: Run, verify they fail.**
- [ ] **Step 3: Implement** `fsRegion.ts`, `build-story.ts`, run `npm run story`, then `figures.ts` and the page.
- [ ] **Step 4: Verify** tests, `tsc`, `build:web`; in dev, **visual checklist**: faithful rendering of mock-up C; scrolling through the 5 chapters; chapter 4 slider responsive; with "reduce motion" enabled in the system, no animation; at 375 px width (browser responsive tool), no horizontal scrolling; full FR.
- [ ] **Step 5: Commit**: `feat(site): Story page with real-data chapters`

---

### Task 6: Atlas

**Files:**
- Create: `app/src/site/atlas/Atlas.tsx`, `SiteCard.tsx`

**Interfaces:**
- Consumes: `PolarMap` (task 3), `useData`, `siteText`, `makeCustomSite` (task 2), `distanceToArtemisKm` (`astro/regions.ts`), `data/sites/diviner.json` (loaded in the page, optional: missing → line hidden), `navigate` (task 1), `writeShareState`.
- Produces: Atlas page. Map of the polar sites (latitude ≤ −75°); "Other landing sites" list for the others; `SiteCard`: name, mission, context, coordinates, elevation, nearest permanent shadow, Diviner mean temperature, "Play this site" button → `navigate("play", writeShareState({ siteId }))`. Click outside a site: "Play this point" → `navigate("play", writeShareState({ lat, lon }))`.

- [ ] **Step 1: Implement** (pure logic already tested in tasks 2 and 3; no new pure function).
- [ ] **Step 2: Verify** `npm test`, `tsc`, `build:web`; in dev: the 7 polar sites on the map at the right place (Shackleton and the ridge near the centre), the 7 others in the list, "Play this site" opens Play on the right site, "Play this point" creates a custom site, FR; at 375 px width, map and list usable with no horizontal scrolling.
- [ ] **Step 3: Commit**: `feat(site): Atlas page`

---

### Task 7: Mission Lab

**Files:**
- Create: `app/src/site/lab/Lab.tsx`, `ZonesTab.tsx`, `DatesTab.tsx`, `PowerTab.tsx`, `CompareTab.tsx`, `app/src/site/lab/scenarios.ts`
- Modify: `app/src/site/App.tsx` (load `Lab` with `React.lazy` and `Suspense`)
- Test: `app/src/site/lab/scenarios.test.ts`

**Interfaces:**
- Consumes: old `components/Optimizer.tsx`, `LandingPlanner.tsx`, `BudgetPanel.tsx`, `Comparison.tsx` as the **logic reference** (no import); `runRegion` (`optim/client.ts`), `PROFILES`, `CRITERIA`, `scoreRegion`, `extractZones`, `loadRegion`, `loadRegionIndex`, `mapsBaseUrl`; `scanSite`, `scoreScans`, `topCandidates`, `explain` (`astro/landing.ts`); `budget`, `VEHICLES`; `loadRelays` through `useData().relays`; `roverRoute`, `targets`; `data/calendar/sites.json`; `cellGrade`.
- Produces:
  - `type Scenario = { key: string; siteId: string; custom?: { lat: number; lon: number }; start: number; hours: number }`
  - `loadScenarios(storage: Pick<Storage, "getItem"> | null): Scenario[]` (key `earthrise.scenarios`; invalid JSON or missing storage → `[]`); `saveScenarios(list, storage)`; `scenarioKey(s): string` (`siteId|custom@start@hours`).
- Tabs (simple settings visible, advanced ones in a collapsible `<details>` block):
  - **Zones**: region, profile, analyse button, heat map on the `<id>.wac.u8` image, best zones (open in Play). Advanced: weights, constraints, layers, relays (LRO or models labelled "model"), rover route to a target (`targets.shortNight` or `targets.nearIce`).
  - **Landing dates**: best dates for the candidate sites with pros and cons (`explain`), site × month calendar coloured by `cellGrade` of the chosen profile. Advanced: vehicle, mission duration, step.
  - **Power & radio**: reference vehicle, charge curve, battery and panels needed, data rate and volume. Advanced: all vehicle parameters.
  - **Compare**: scenarios (added from Play or here), table with the best value in ice green, deletion, opening in Play.
  - Below 900 px: message "Mission Lab is designed for larger screens" and a link to Play.

- [ ] **Step 1: Write the failing tests**

```ts
const store = { getItem: () => "not json" };
expect(loadScenarios(store)).toEqual([]); expect(loadScenarios(null)).toEqual([]);
const s = { key: "", siteId: "malapert-massif", start: 1, hours: 2 };
expect(scenarioKey(s)).toBe("malapert-massif@1@2");
const mem = new Map<string, string>(); const st = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
saveScenarios([s], st); expect(loadScenarios(st)).toEqual([s]);
```
- [ ] **Step 2: Run, verify they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Verify** tests, `tsc`, `build:web` (check in the output that Lab is a separate JavaScript file); in dev: Zones on Haworth with the Rover profile → 114 feasible points on 14 Nov 2026 16:00 over one lunar day (value already checked in phase A); Landing dates → Malapert 5 Oct 2027 first for a 14-day lander over 2027 (see `docs/member5_decision.md`); Power & radio; Compare with 2 scenarios; FR.
- [ ] **Step 5: Commit**: `feat(site): Mission Lab with tabs`

---

### Task 8: Method

**Files:**
- Create: `app/src/site/method/Method.tsx`

**Interfaces:**
- Consumes: `Tabs`, `useI18n`.
- Produces: tabs **Data** (one card per source: LOLA, JPL Horizons, LROC, Diviner, LRO orbit, relay models; contribution, resolution, link), **Validation** (Horizons ≤ 0.003°; permanent shadows IoU 0.80 to 0.93 and sunlight RMS 2.1 to 2.5 points against the LOLA maps; ridge on 24 Nov settled by curvature; 50 tests; links to `docs/` on GitHub), **Team** (the 5 members, all from Benin, as written in section 6.5 of the spec, Space Apps 2026 challenge, link to https://github.com/Sunvi-children-of-the-stars/Earthrise-Atlas).

- [ ] **Step 1: Implement** (texts in the dictionaries; the validation figures are published results, so placeholders filled by named constants in `Method.tsx`, not written in the text).
- [ ] **Step 2: Verify** `npm test` (the design-rules test covers the new texts), `tsc`, `build:web`, reading in EN and FR.
- [ ] **Step 3: Commit**: `feat(site): Method page`

---

### Task 9: Cleanup, finishing touches, deployment

**Files:**
- Delete: `app/src/App.tsx`, `app/src/components/` (10 files), `app/src/styles.css`, `app/src/format.ts` if no longer used
- Modify: `README.md` ("Run the application" section: new site, pages), `docs/member3_application.md` (pointer to the spec and the new site), `docs/phase_A.md` or a new `docs/public_site.md` (what was done)

- [ ] **Step 1: Inventory**: for each file in `components/`, note where its feature lives in the new site (Play, Lab, Atlas). No gap, or a decided gap noted in `docs/public_site.md`.
- [ ] **Step 2: Remove** the old interface; `npx tsc --noEmit` and `npm test` green (nothing imported these files from `site/` anymore).
- [ ] **Step 3: Automatic design-rules check**: `grep -rn $'—' app/src/site app/index.html` returns nothing; no hexadecimal colour outside `theme.css` in `app/src/site` (`grep -rnE "#[0-9a-fA-F]{3,6}\b" app/src/site --include=*.tsx`, any occurrence is replaced by a variable).
- [ ] **Step 4: Check the online version**: `npm run build:web`, then serve `dist/` with a static server that applies `_redirects` (for example `npx netlify-cli dev --dir dist` or, failing that, check `/`, `/play`, `/lab` on a static server with SPA fallback); custom site from the Atlas → "reduced DEM" horizon announced; Zones works; no error in the console.
- [ ] **Step 5: Commit**: `chore(site): remove the old interface, docs, deploy check`

---

## Execution notes

- Order: 1 → 2 → 3 → 4, then 5, 6, 7, 8 in any order, then 9.
- The development server (`npm run dev` in `app/`) copies the data again at startup: restart it after `npm run story` or `npm run calendar`.
- Tests that read data (`src/test/data.ts`) assume the versioned files of `data/`; `data/horizon_maps/` (not versioned) is only needed for `npm run story` and for Zones in development.
