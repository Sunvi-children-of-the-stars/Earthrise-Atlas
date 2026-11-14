# Earthrise Atlas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer l'interface experte actuelle par le site public Earthrise Atlas (Story, Atlas, Play, Mission Lab, Method), en anglais avec bouton FR, dans la direction « Nuit polaire ».

**Architecture:** Nouvelle interface dans `app/src/site/`, montée par `main.tsx` dès la tâche 1 ; l'ancienne (`App.tsx`, `components/`, `styles.css`) reste compilable comme référence et n'est supprimée qu'à la dernière tâche. Le moteur (`astro/`, `optim/`, `share.ts`, `data.ts`) n'est pas modifié. Routage maison par chemin (le hash reste au lien partageable), dictionnaires EN/FR à clés identiques, un fournisseur de données React qui reprend la logique de chargement de l'ancien `App.tsx`.

**Tech Stack:** React 18.3, Vite 5.4, TypeScript 5.6, Vitest 3.2.4 (environnement node). Aucune nouvelle dépendance npm. Police Poppins via Google Fonts.

**Spec:** `docs/superpowers/specs/2026-11-14-earthrise-atlas-design.md`

## Global Constraints

- Nom affiché : **Earthrise Atlas**. Titre de page `Earthrise Atlas`.
- Police : **Poppins**, graisses 300, 400, 500, 600 ; titres en 300 ou 400.
- Couleurs : noir (`#000` à `#0A0C12`), blanc, **vert d'eau `#9BF0D8`** (Terre, actions, liens, accents), **or pâle** (Soleil, **uniquement dans les graphiques et données**, valeur au choix vers `#F3E2B3`, contraste AA sur noir). Gris = blanc avec transparence. Aucune autre teinte.
- **Aucun tiret cadratin (—)** dans les textes EN et FR. **Pas d'italique** sauf titre d'ouvrage cité.
- Anglais par défaut, bouton **EN | FR**, choix mémorisé (`localStorage` clé `earthrise.lang`, repli silencieux), `<html lang>` à jour.
- Pages et chemins : `/` Story, `/atlas`, `/play`, `/lab`, `/method`. Le **hash** est réservé au lien partageable `share.ts` (`#site=…&t=…&d=…`).
- Récit sur période **fixe** : début `Date.UTC(2026, 10, 14, 16)`, durée **708,7 h**. Play s'ouvre sur l'heure courante arrondie à l'heure.
- Aucun chiffre écrit en dur dans un texte s'il peut être calculé : les textes contiennent des emplacements `{nom}`.
- Les relais Gateway et Queqiao-2 sont toujours libellés « model ».
- Le moteur (`app/src/astro/`, `app/src/optim/`, `app/src/share.ts`, `app/src/data.ts`) n'est **pas modifié** ; toute logique nouvelle va dans `app/src/site/` avec ses tests.
- `npm test`, `npx tsc --noEmit` et `npm run build:web` passent à la fin de **chaque** tâche (commandes dans `app/`).
- Animations coupées si `prefers-reduced-motion: reduce`. Story, Atlas, Play sans défilement horizontal à 375 px de large.

## Review Focus

1. **Passage en FR** : tout texte visible (noms et contextes des 14 sites compris) bascule, et les nombres s'écrivent à la française (`52,4 %`). Testé en tâche 1 (parité et charte des dictionnaires, format FR) et tâche 2 (couverture des 14 sites).
2. **Ouverture directe ou rechargement de `/play#site=…`** : la bonne page s'affiche avec le bon site et la bonne date, un hash abîmé retombe sur les valeurs par défaut. Testé en tâche 1 (`pageFromPath`) et tâche 4 (`initialPlayState`) ; règle `_redirects` en tâche 1.
3. **Site personnalisé sans tuiles** (version en ligne) ou hors du MNT polaire : l'horizon retombe sur le MNT réduit ou le sol lisse, la fiche le dit, rien ne casse. Testé en tâche 2 (`customMaskSource`).
4. **Période hors des données** (relais LRO après le 30/04/2027, table Horizons hors 2026 à 2030) : le site affiche « not available for this period » au lieu de chiffres faux. Testé en tâche 4 (`relaySummary` renvoie `null` si `!available`).
5. **Mouvement réduit et petit écran** sur Story : pas d'animation, pas de débordement horizontal. Vérifié par la liste de contrôle visuelle de la tâche 5.

---

## Structure des fichiers

```
app/src/site/
  App.tsx                 coquille : DataProvider, I18nProvider, Nav, page courante
  router.ts               Page, pageFromPath, pathOf, useRoute, navigate
  theme.css               variables, base typographique, utilitaires
  i18n/en.ts, fr.ts       dictionnaires (mêmes clés)
  i18n/index.tsx          I18nProvider, useI18n (t, lang, setLang, fmt)
  i18n/sites.ts           textes EN/FR des 14 sites, siteText()
  data/store.tsx          DataProvider, useData, useMask
  ui/Nav.tsx, Tabs.tsx, StatCard.tsx, Logo.tsx
  viz/SkyChart.tsx, TimelineChart.tsx, PolarMap.tsx, Silhouette.tsx, geometry.ts
  play/Play.tsx, verdict.ts, state.ts
  story/Story.tsx, Hero.tsx, chapters/*.tsx, figures.ts
  atlas/Atlas.tsx, SiteCard.tsx
  lab/Lab.tsx (chargée à la demande), ZonesTab.tsx, DatesTab.tsx, PowerTab.tsx, CompareTab.tsx
  method/Method.tsx
app/scripts/build-story.ts         précalcul du transect de Mons Mouton
app/scripts/lib/fsRegion.ts        lecture d'une région depuis le disque (Node)
data/story/mons-mouton-transect.json
```

---

### Task 1: Fondations (thème, routage, langues, coquille)

**Files:**
- Create: `app/src/site/App.tsx`, `router.ts`, `theme.css`, `i18n/en.ts`, `i18n/fr.ts`, `i18n/index.tsx`, `ui/Nav.tsx`, `ui/Logo.tsx`, `ui/Tabs.tsx`
- Create: `app/src/site/router.test.ts`, `app/src/site/i18n/i18n.test.ts`
- Create: `app/public/_redirects` (une ligne : `/*  /index.html  200`)
- Modify: `app/src/main.tsx` (monte `site/App`, importe `site/theme.css`), `app/index.html` (titre, `lang="en"`, favicon logo, lien Google Fonts Poppins 300;400;500;600), `app/vite.config.ts` (`base: "/"`)

**Interfaces:**
- Produces:
  - `type Page = "story" | "atlas" | "play" | "lab" | "method"`
  - `pageFromPath(pathname: string): Page` (chemin inconnu → `"story"`, insensible à la barre finale)
  - `pathOf(page: Page): string` (`story` → `/`)
  - `useRoute(): { page: Page; navigate: (page: Page, hash?: string) => void }` (History API, écoute `popstate`, remonte en haut de page)
  - `type MessageKey = keyof typeof en` ; `fr: Record<MessageKey, string>`
  - `useI18n(): { lang: "en" | "fr"; setLang(l): void; t(key: MessageKey, vars?: Record<string, string | number>): string; fmt: { num(x: number, digits?: number): string; pct(x: number): string; hours(h: number): string; date(ms: number): string } }`
  - `<Tabs tabs={{ id: string; label: string }[]} active={string} onChange={(id) => void} />` avec rôles ARIA `tablist`/`tab`/`tabpanel` et flèches gauche/droite
- Les pages sont des composants vides `<section>` avec leur titre traduit, remplis par les tâches suivantes.

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
test("mêmes clés en anglais et en français", () => expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort()));
test("charte : pas de tiret cadratin, pas d'italique, pas de « membre »", () => {
  for (const s of [...Object.values(en), ...Object.values(fr)]) {
    expect(s).not.toMatch(/—/); expect(s).not.toMatch(/<\/?(i|em)>/); expect(s.toLowerCase()).not.toContain("membre");
  }
});
test("format FR", () => { expect(makeFmt("fr").pct(52.43)).toBe("52,4 %"); expect(makeFmt("en").pct(52.43)).toBe("52.4%"); });
test("interpolation", () => expect(interpolate("Sun {pct} of the time", { pct: "88%" })).toBe("Sun 88% of the time"));
```
(`makeFmt(lang)` et `interpolate(template, vars)` sont exportés par `i18n/index.tsx` pour être testés hors React. Les espaces de `"52,4 %"` : `Intl` en `fr` met une espace insécable fine ; normaliser en espace insécable ` ` dans `pct` et adapter le test à la sortie réelle de `Intl.NumberFormat("fr", { style: "unit" })` ou d'un format maison, au choix, du moment que l'affichage est `52,4 %`.)

- [ ] **Step 2: Run, verify they fail** : `npx vitest run src/site` → FAIL (modules absents).
- [ ] **Step 3: Implement** router, i18n, thème (variables `--bg`, `--bg-2`, `--text`, `--muted`, `--line`, `--ice: #9BF0D8`, `--sun` or pâle, rayons, espacements ; `font-family: Poppins` ; `font-style: normal` partout), `Nav` (logo, 5 liens, bouton EN | FR, menu repliable sous 720 px), `Logo` (arc vert d'eau et disque blanc, SVG, aussi en favicon data-URI), `Tabs`, `App` (lit la page, rend la page, `document.title` = `Earthrise Atlas` ou `Page · Earthrise Atlas`, `document.documentElement.lang`).
- [ ] **Step 4: Verify** : `npx vitest run` (tous verts), `npx tsc --noEmit`, `npm run build:web`. Puis `npm run dev` et vérifier à l'œil : navigation entre les 5 pages, retour arrière du navigateur, rechargement direct de `http://localhost:5173/lab`, bascule EN/FR conservée après rechargement.
- [ ] **Step 5: Commit** : `git commit -m "feat(site): foundations: theme, routing, EN/FR, shell"`

---

### Task 2: Données et textes des sites

**Files:**
- Create: `app/src/site/data/store.tsx`, `app/src/site/i18n/sites.ts`
- Test: `app/src/site/data/store.test.ts`, `app/src/site/i18n/sites.test.ts`

**Interfaces:**
- Consumes: `loadSites`, `SiteRecord` (`data.ts`), `loadMask`, `loadDem`, `computeMask`, `flatMask`, `demElevation` (`astro/horizon.ts`), `requestTiledHorizon` (`astro/onDemand.ts`), `loadEphemerisTable`, `setEphemerisTable` (`astro/ephemeris.ts`), `loadRelays` (`astro/relay.ts`), `loadArtemisRegions` (`astro/regions.ts`). Logique de référence : ancien `App.tsx` lignes 56 à 135.
- Produces:
  - `<DataProvider>` ; `useData(): { sites: SiteRecord[]; dem: Dem | null; artemis: ArtemisRegionSet | null; lro: RelayData | null; relays: RelayData[]; ephReady: boolean; error: string | null }`. La table Horizons est chargée **avant** `ephReady = true` ; aucun calcul ne démarre avant.
  - `makeCustomSite(lat: number, lon: number, dem: Dem | null): SiteRecord` (reprend `makeCustom` de l'ancien `App.tsx`, id `custom:lat,lon` à 4 décimales)
  - `useMask(site: SiteRecord | null): { mask: HorizonMask | null; source: MaskSource }` avec `type MaskSource = "precomputed" | "tiles" | "preview" | "flat" | "loading"` ; cache par id ; site personnalisé : tuiles, sinon MNT réduit, sinon sol lisse.
  - `customMaskSource(inDem: boolean, tilesOk: boolean, demOk: boolean): MaskSource` (pure, utilisée par `useMask`)
  - `siteText(site: SiteRecord, lang: "en" | "fr"): { name: string; short: string; region: string; context: string }` ; `SITE_TEXT` couvre les 14 ids de `data/sites/sites.json` (traductions EN écrites par le bâtisseur, FR reprises des données) ; site personnalisé : textes génériques traduits.

- [ ] **Step 1: Write the failing tests**

```ts
// sites.test.ts : chaque site de data/sites/sites.json a ses textes EN et FR non vides, sans tiret cadratin
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
(`sites()` vient de `src/test/data.ts`.)

- [ ] **Step 2: Run, verify they fail.**
- [ ] **Step 3: Implement** `store.tsx` et `sites.ts`.
- [ ] **Step 4: Verify** : `npx vitest run`, `npx tsc --noEmit`, `npm run build:web`.
- [ ] **Step 5: Commit** : `feat(site): data provider, masks, site texts EN/FR`

---

### Task 3: Graphiques (ciel, chronologie, carte polaire, silhouette)

**Files:**
- Create: `app/src/site/viz/geometry.ts`, `SkyChart.tsx`, `TimelineChart.tsx`, `PolarMap.tsx`, `Silhouette.tsx`
- Test: `app/src/site/viz/geometry.test.ts`

**Interfaces:**
- Consumes: `Sample`, `Window`, `windows`, `sunUp`, `earthUp` (`astro/analysis.ts`) ; `latLonToXY`, `xyToLatLon` (`astro/horizon.ts`) ; `RelayResult` ; fichiers `data/lroc/south_pole_wac_400m.{jpg,json}` (servis sous `data/lroc/`).
- Produces:
  - `azToX(az: number, width: number, centerAz = 180): number` (0 ≤ x < width, panorama centré sur le sud)
  - `lrocPixel(x_m: number, y_m: number): [col: number, row: number]` et `lrocXY(col, row): [x_m, y_m]` pour la grille LROC (`x = (col + 0.5) * 400 - 457380`, `y = 457380 - (row + 0.5) * 400`)
  - `<SkyChart samples cursor mask compact? />` : horizon réel (relief gris clair), trajectoire Soleil en `--sun`, Terre en `--ice`, positions au curseur, axes N E S O traduits ; `role="img"` et `aria-label` résumant le contenu.
  - `<TimelineChart samples cursor onCursor relay? fragility? />` : bandes Soleil, Terre, relais, zone incertaine ; curseur déplaçable au clavier.
  - `<PolarMap sites selectedId onSelectSite onPickPoint artemis overlay? />` : canvas, fond LROC, contours Artemis en traits fins vert d'eau, sites (candidats pleins, référence en contour), zoom molette et boutons, clic → lat/lon.
  - `<Silhouette mask height />` : relief décoratif tiré d'un vrai masque d'horizon (tracé plein `--bg-2`, filet blanc à 30 %).
  Les anciens `SkyPanorama.tsx`, `Timeline.tsx`, `PoleMap.tsx` servent de référence de calcul ; le dessin suit la charte.

- [ ] **Step 1: Write the failing tests**

```ts
expect(azToX(180, 360)).toBeCloseTo(180); expect(azToX(0, 360)).toBeCloseTo(0); expect(azToX(359.9, 360)).toBeLessThan(360);
const [c, r] = lrocPixel(0, 0); expect(c).toBeCloseTo(1142.95, 2); expect(r).toBeCloseTo(1142.95, 2);
const [x, y] = lrocXY(...lrocPixel(12_345, -67_890)); expect(x).toBeCloseTo(12_345, 6); expect(y).toBeCloseTo(-67_890, 6);
```
- [ ] **Step 2: Run, verify they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Verify** tests, `tsc`, `build:web` ; afficher temporairement les 4 composants sur la page Method en dev et vérifier à l'œil : couleurs (or pâle seulement sur le Soleil), photo LROC alignée (Shackleton au centre), clic carte → coordonnées cohérentes avec un site connu.
- [ ] **Step 5: Commit** : `feat(site): charts and polar map in the Polar Night style`

---

### Task 4: Play

**Files:**
- Create: `app/src/site/play/Play.tsx`, `verdict.ts`, `state.ts`, `app/src/site/ui/StatCard.tsx`
- Test: `app/src/site/play/verdict.test.ts`, `app/src/site/play/state.test.ts`

**Interfaces:**
- Consumes: tâches 1 à 3 ; `simulate`, `metrics`, `fragility`, `seasonal` (`astro/analysis.ts`) ; `budget`, `VEHICLES` (`astro/budget.ts`) ; `relayAnalysis` ; `shiftScan`, `lunarMonthDelays` (`optim/delay.ts`) ; `readShareState`, `writeShareState`, `shareUrl` (`share.ts`) ; `DURATIONS` (`data.ts`).
- Produces:
  - `type PlayState = { siteId: string; custom?: { lat: number; lon: number }; start: number; hours: number; cursor: number }`
  - `initialPlayState(hash: string, siteIds: string[], now: number): PlayState` : défauts `connecting-ridge`, `start = floor(now / 3_600_000) * 3_600_000`, `hours = 708.7` ; un `siteId` absent de `siteIds` → défaut ; `hours` hors [1, 2160] → défaut.
  - `missionVerdict(samples: Sample[], vehicle = VEHICLES.lander): { ok: boolean; key: MessageKey; vars: Record<string, number> }` : `ok = budget().survives` ; clés `verdict.survives` (vars `minSoc`) ou `verdict.brownout` (vars `afterH` = heures avant la première panne, `brownoutH`).
  - `relaySummary(r: RelayResult | null): { linkPct: number; longestNoLinkH: number; passesPerDay: number } | null` (`null` si absent ou `!available`)
  - `stepFor(hours: number): number` (pas de simulation, identique à l'ancien `App.tsx` : `max(10, round(hours * 60 / 1500 / 5) * 5)`)
- Page : sélecteurs site, date, durée ; 4 `StatCard` (Soleil, Terre, plus longue nuit, verdict) ; onglets **Sky** (SkyChart + lecture), **Timeline** (TimelineChart, « Sunset in … », « Earthset in … », relais LRO ou « not available for this period »), **Site** (terrain, fiabilité en une phrase, 13 mois lunaires) ; actions « Mission delayed by a month? » (shiftScan sur `[0, lunarMonthDelays(1)[1]]`, affichage avant/après), « Share » (copie `shareUrl`, message de confirmation), « Open in Mission Lab ». Le hash est réécrit (`history.replaceState`) à chaque changement de site, date ou durée.

- [ ] **Step 1: Write the failing tests**

```ts
// state.test.ts
const ids = ["connecting-ridge", "malapert-massif"]; const now = Date.UTC(2026, 10, 14, 16, 25);
expect(initialPlayState("", ids, now)).toEqual({ siteId: "connecting-ridge", start: Date.UTC(2026, 10, 14, 16), hours: 708.7, cursor: 0 });
expect(initialPlayState("#site=malapert-massif&t=2027-01-02T00:00Z&d=168", ids, now)).toMatchObject({ siteId: "malapert-massif", start: Date.UTC(2027, 0, 2), hours: 168 });
expect(initialPlayState("#site=unknown&d=99999", ids, now)).toMatchObject({ siteId: "connecting-ridge", hours: 708.7 });
expect(initialPlayState("#lat=-85.5&lon=15", ids, now).custom).toEqual({ lat: -85.5, lon: 15 });

// verdict.test.ts (échantillons synthétiques, comme src/astro/budget.test.ts)
expect(missionVerdict(allSun(48)).ok).toBe(true);
const v = missionVerdict(longNight(200)); expect(v.ok).toBe(false); expect(v.key).toBe("verdict.brownout"); expect(v.vars.afterH).toBeGreaterThan(0);
expect(relaySummary(null)).toBeNull(); expect(relaySummary({ ...someRelayResult, available: false })).toBeNull();
```
- [ ] **Step 2: Run, verify they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Verify** tests, `tsc`, `build:web` ; en dev, vérifier : crête de liaison au 14/11/2026 16:00 sur un jour lunaire → Terre ≈ 48 %, liaison avec LRO ≈ 52 % (mêmes valeurs que `src/astro/relay.test.ts`) ; rechargement de `/play#site=malapert-massif&t=2026-11-14T16:00Z&d=708.7` ; bouton Share ; FR ; date en juin 2027 → relais « not available » ; à 375 px de large, pas de défilement horizontal.
- [ ] **Step 5: Commit** : `feat(site): Play page`

---

### Task 5: Story (accueil et récit)

**Files:**
- Create: `app/scripts/lib/fsRegion.ts`, `app/scripts/build-story.ts`, `data/story/mons-mouton-transect.json` (généré)
- Create: `app/src/site/story/Story.tsx`, `Hero.tsx`, `figures.ts`, `chapters/WhyPole.tsx`, `SunNeverClimbs.tsx`, `EarthHides.tsx`, `OneKilometre.tsx`, `YourTurn.tsx`
- Modify: `app/package.json` (script `story` sur le modèle de `calendar`), `app/scripts/sync-data.mjs` (copier `story`)
- Test: `app/src/site/story/figures.test.ts`

**Interfaces:**
- Consumes: `evaluateRegion` (`optim/evaluate.ts`), `transect` (`optim/neighborhood.ts`), `distanceTransform`, `RegionData` (`optim/region.ts`) dans le script Node ; `simulate`, `metrics`, `relayAnalysis` dans `figures.ts` ; `SkyChart`, `TimelineChart`, `Silhouette`, `PolarMap` (tâche 3).
- Produces:
  - `STORY_START = Date.UTC(2026, 10, 14, 16)`, `STORY_HOURS = 708.7`
  - `storyFigures(ridge: SiteRecord, ridgeMask: HorizonMask, lro: RelayData | null): { sunMaxAlt: number; sunPct: number; earthPct: number; longestNoEarthH: number; longestNoLinkH: number | null; passesPerDay: number | null }` (pas de 30 min, période fixe)
  - `data/story/mons-mouton-transect.json` : `{ site: "mons-mouton", start, hours: 156, azimuthDeg: 90, stepKm: 0.1, points: { distKm, sunPct, earthPct, nightH, outageH }[] }` sur −2 à +2 km. Script : `npm run story` (lit `data/horizon_maps/mons-mouton.*` via `fsRegion.ts`, `evaluateRegion` sur la période fixe de 156 h à partir de `STORY_START`, puis `transect`).
- Page : Hero (texte exact de la spec : surtitre « Lunar south pole », titre « Where the Sun never sets, and the Earth hides for days. », boutons « Start the journey » et « Play with the map », silhouette tirée du masque de la crête, arcs fins vert d'eau, petit disque blanc) puis 5 chapitres apparaissant au défilement (`IntersectionObserver`, sans animation si mouvement réduit). Chapitre 1 : photo LROC + ombres permanentes de `pole` (fichier `pole.psr.u8`, servi en développement par le middleware et inclus par `build:web`) ; chapitre 2 : SkyChart compact de la crête ; chapitre 3 : TimelineChart sans puis avec relais ; chapitre 4 : curseur sur le transect (valeurs du JSON, Terre et Soleil en grand) ; chapitre 5 : liens vers Play et Atlas. Tous les chiffres des textes viennent de `storyFigures` ou du JSON.

- [ ] **Step 1: Write the failing tests**

```ts
useHorizonsTable();
const f = storyFigures(site("connecting-ridge"), mask("connecting-ridge"), relay("lro"));
expect(f.sunMaxAlt).toBeLessThan(2.2); expect(f.sunPct).toBeCloseTo(100, 0); expect(f.earthPct).toBeCloseTo(48.3, 0);
expect(Math.abs(f.longestNoEarthH - 321.5)).toBeLessThanOrEqual(1); expect(f.longestNoLinkH!).toBeLessThan(2);
expect(storyFigures(site("connecting-ridge"), mask("connecting-ridge"), null).longestNoLinkH).toBeNull();
// transect versionné
const tr = JSON.parse(readFileSync(join(DATA, "story/mons-mouton-transect.json"), "utf8"));
const at0 = tr.points.find((p) => p.distKm === 0); expect(at0.earthPct).toBeGreaterThan(95);
expect(Math.min(...tr.points.filter((p) => Math.abs(p.distKm) <= 1).map((p) => p.earthPct))).toBeLessThan(80);
```
- [ ] **Step 2: Run, verify they fail.**
- [ ] **Step 3: Implement** `fsRegion.ts`, `build-story.ts`, lancer `npm run story`, puis `figures.ts` et la page.
- [ ] **Step 4: Verify** tests, `tsc`, `build:web` ; en dev, **liste de contrôle visuelle** : rendu fidèle à la maquette C ; défilement des 5 chapitres ; curseur du chapitre 4 réactif ; avec « réduire les animations » activé dans le système, aucune animation ; à 375 px de large (outil responsive du navigateur), aucun défilement horizontal ; FR complet.
- [ ] **Step 5: Commit** : `feat(site): Story page with real-data chapters`

---

### Task 6: Atlas

**Files:**
- Create: `app/src/site/atlas/Atlas.tsx`, `SiteCard.tsx`

**Interfaces:**
- Consumes: `PolarMap` (tâche 3), `useData`, `siteText`, `makeCustomSite` (tâche 2), `distanceToArtemisKm` (`astro/regions.ts`), `data/sites/diviner.json` (charger dans la page, facultatif : absent → ligne masquée), `navigate` (tâche 1), `writeShareState`.
- Produces : page Atlas. Carte des sites polaires (latitude ≤ −75°) ; liste « Other landing sites » pour les autres ; `SiteCard` : nom, mission, contexte, coordonnées, altitude, ombre permanente la plus proche, température moyenne Diviner, bouton « Play this site » → `navigate("play", writeShareState({ siteId }))`. Clic hors site : « Play this point » → `navigate("play", writeShareState({ lat, lon }))`.

- [ ] **Step 1: Implement** (logique pure déjà testée en tâches 2 et 3 ; pas de nouvelle fonction pure).
- [ ] **Step 2: Verify** `npm test`, `tsc`, `build:web` ; en dev : les 7 sites polaires sur la carte au bon endroit (Shackleton et la crête près du centre), les 7 autres dans la liste, « Play this site » ouvre Play sur le bon site, « Play this point » crée un site personnalisé, FR ; à 375 px de large, carte et liste utilisables sans défilement horizontal.
- [ ] **Step 3: Commit** : `feat(site): Atlas page`

---

### Task 7: Mission Lab

**Files:**
- Create: `app/src/site/lab/Lab.tsx`, `ZonesTab.tsx`, `DatesTab.tsx`, `PowerTab.tsx`, `CompareTab.tsx`, `app/src/site/lab/scenarios.ts`
- Modify: `app/src/site/App.tsx` (charger `Lab` avec `React.lazy` et `Suspense`)
- Test: `app/src/site/lab/scenarios.test.ts`

**Interfaces:**
- Consumes: anciens `components/Optimizer.tsx`, `LandingPlanner.tsx`, `BudgetPanel.tsx`, `Comparison.tsx` comme **référence de logique** (pas d'import) ; `runRegion` (`optim/client.ts`), `PROFILES`, `CRITERIA`, `scoreRegion`, `extractZones`, `loadRegion`, `loadRegionIndex`, `mapsBaseUrl` ; `scanSite`, `scoreScans`, `topCandidates`, `explain` (`astro/landing.ts`) ; `budget`, `VEHICLES` ; `loadRelays` via `useData().relays` ; `roverRoute`, `targets` ; `data/calendar/sites.json` ; `cellGrade`.
- Produces:
  - `type Scenario = { key: string; siteId: string; custom?: { lat: number; lon: number }; start: number; hours: number }`
  - `loadScenarios(storage: Pick<Storage, "getItem"> | null): Scenario[]` (clé `earthrise.scenarios` ; JSON invalide ou stockage absent → `[]`) ; `saveScenarios(list, storage)` ; `scenarioKey(s): string` (`siteId|custom@start@hours`).
- Onglets (réglages simples visibles, avancés dans un bloc repliable `<details>`) :
  - **Zones** : région, profil, bouton d'analyse, carte de chaleur sur l'image `<id>.wac.u8`, meilleures zones (ouvrir dans Play). Avancé : poids, contraintes, calques, relais (LRO ou modèles marqués « model »), itinéraire de rover vers une cible (`targets.shortNight` ou `targets.nearIce`).
  - **Landing dates** : meilleures dates pour les sites candidats avec pour et contre (`explain`), calendrier site × mois coloré par `cellGrade` du profil choisi. Avancé : véhicule, durée de mission, pas.
  - **Power & radio** : véhicule de référence, courbe de charge, batterie et panneaux nécessaires, débit et volume. Avancé : tous les paramètres du véhicule.
  - **Compare** : scénarios (ajout depuis Play ou ici), tableau avec meilleure valeur en vert d'eau, suppression, ouverture dans Play.
  - Sous 900 px : message « Mission Lab is designed for larger screens » et lien vers Play.

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
- [ ] **Step 4: Verify** tests, `tsc`, `build:web` (vérifier dans la sortie que Lab est un fichier JavaScript séparé) ; en dev : Zones sur Haworth avec le profil Rover → 114 points faisables au 14/11/2026 16:00 sur un jour lunaire (valeur déjà vérifiée en phase A) ; Landing dates → Malapert 05/10/2027 en tête pour un atterrisseur de 14 jours sur 2027 (voir `docs/membre5_decision.md`) ; Power & radio ; Compare avec 2 scénarios ; FR.
- [ ] **Step 5: Commit** : `feat(site): Mission Lab with tabs`

---

### Task 8: Method

**Files:**
- Create: `app/src/site/method/Method.tsx`

**Interfaces:**
- Consumes: `Tabs`, `useI18n`.
- Produces : onglets **Data** (une carte par source : LOLA, JPL Horizons, LROC, Diviner, orbite LRO, modèles de relais ; apport, résolution, lien), **Validation** (Horizons ≤ 0,003° ; ombres permanentes IoU 0,80 à 0,93 et ensoleillement RMS 2,1 à 2,5 points contre les cartes LOLA ; crête du 24/11 tranchée par la courbure ; 50 tests ; liens vers `docs/` sur GitHub), **Team** (les 5 membres, tous du Bénin, tels qu'écrits dans la spec section 6.5, défi Space Apps 2026, lien vers https://github.com/Topelus/Lunar-landing-site-visualization-tool).

- [ ] **Step 1: Implement** (textes dans les dictionnaires ; les chiffres de validation sont des résultats publiés, donc des emplacements remplis par des constantes nommées dans `Method.tsx`, pas écrits dans le texte).
- [ ] **Step 2: Verify** `npm test` (le test de charte couvre les nouveaux textes), `tsc`, `build:web`, lecture en EN et FR.
- [ ] **Step 3: Commit** : `feat(site): Method page`

---

### Task 9: Nettoyage, finitions, déploiement

**Files:**
- Delete: `app/src/App.tsx`, `app/src/components/` (10 fichiers), `app/src/styles.css`, `app/src/format.ts` si plus utilisé
- Modify: `README.md` (section « Lancer l'application » : nouveau site, pages), `docs/membre3_application.md` (renvoi vers la spec et le nouveau site), `docs/phase_A.md` ou nouveau `docs/site_public.md` (ce qui a été fait)

- [ ] **Step 1: Inventaire** : pour chaque fichier de `components/`, noter où sa fonction vit dans le nouveau site (Play, Lab, Atlas). Aucun manque, ou un manque décidé et noté dans `docs/site_public.md`.
- [ ] **Step 2: Supprimer** l'ancienne interface ; `npx tsc --noEmit` et `npm test` verts (rien n'importait encore ces fichiers depuis `site/`).
- [ ] **Step 3: Contrôle de charte automatique** : `grep -rn $'—' app/src/site app/index.html` ne renvoie rien ; aucune couleur hexadécimale hors `theme.css` dans `app/src/site` (`grep -rnE "#[0-9a-fA-F]{3,6}\b" app/src/site --include=*.tsx`, toute occurrence est remplacée par une variable).
- [ ] **Step 4: Vérifier la version en ligne** : `npm run build:web`, puis servir `dist/` avec un serveur statique qui applique `_redirects` (par exemple `npx netlify-cli dev --dir dist` ou, à défaut, vérifier `/`, `/play`, `/lab` sur un serveur statique avec repli SPA) ; site personnalisé depuis l'Atlas → horizon « MNT réduit » annoncé ; Zones fonctionne ; aucune erreur dans la console.
- [ ] **Step 5: Commit** : `chore(site): remove the old interface, docs, deploy check`

---

## Notes d'exécution

- Ordre : 1 → 2 → 3 → 4, puis 5, 6, 7, 8 dans n'importe quel ordre, puis 9.
- Le serveur de développement (`npm run dev` dans `app/`) recopie les données au démarrage : le redémarrer après `npm run story` ou `npm run calendar`.
- Les tests qui lisent des données (`src/test/data.ts`) supposent les fichiers versionnés de `data/` ; `data/horizon_maps/` (non versionné) n'est nécessaire que pour `npm run story` et pour Zones en développement.
