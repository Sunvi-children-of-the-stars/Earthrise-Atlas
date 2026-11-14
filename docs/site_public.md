# Earthrise Atlas : le site public

Le site public **Earthrise Atlas** remplace l'ancienne interface experte. Conception :
[superpowers/specs/2026-11-14-earthrise-atlas-design.md](superpowers/specs/2026-11-14-earthrise-atlas-design.md) ;
plan : [superpowers/plans/2026-11-14-earthrise-atlas.md](superpowers/plans/2026-11-14-earthrise-atlas.md).

## Pages

| Adresse | Page | Contenu |
|---|---|---|
| `/` | Story | Accueil (direction « Nuit polaire ») puis récit en 5 chapitres, calculé sur le jour lunaire du 14/11/2026 |
| `/atlas` | Atlas | Carte plein écran sur la photo LROC, fiche flottante du site, pastilles des sites polaires, saisie de coordonnées, autres sites |
| `/play` | Play | Site, date et durée ; 4 chiffres clés et verdict ; onglets Sky, Timeline, Site ; mission retardée ; lien partageable |
| `/lab` | Mission Lab | Onglets Zones, Landing dates, Power & radio, Compare ; réglages avancés repliés ; chargé à la demande ; grands écrans |
| `/method` | Method | Onglets Data, Validation, Team |

Le lien partageable est dans l'adresse : `/play#site=malapert-massif&t=2026-11-14T16:00Z&d=708.7`.

## Charte

Police Poppins ; noir, blanc, vert d'eau `#9bf0d8` (Terre, actions) et or pâle `#f3e2b3`
(Soleil, uniquement dans les données) ; aucun tiret cadratin ; pas d'italique. Toutes les
couleurs sont des variables de `app/src/site/theme.css`. Des tests vérifient les textes : mêmes
clés en anglais et en français, aucun tiret cadratin, aucun emplacement `{x}` oublié.

## Code

```
app/src/site/
  App.tsx, router.ts, theme.css     coquille, routage par chemin, thème
  i18n/                             dictionnaires EN et FR, textes des 14 sites
  data/store.tsx                    chargement des données, masques d'horizon
  viz/                              ciel, chronologie, carte polaire, silhouette
  story/ atlas/ play/ lab/ method/  les pages
```

Le moteur de calcul (`app/src/astro/`, `app/src/optim/`) n'a pas changé. L'ancienne interface
(`App.tsx`, `components/`, `styles.css`) a été supprimée ; chaque fonction a sa place :

| Ancien composant | Nouveau lieu |
|---|---|
| SkyPanorama, Timeline | Play (onglets Sky, Timeline), Story (chapitres 2 et 3) |
| MetricCards, SiteDetails, Seasonal | Play (chiffres clés, onglet Site, 13 mois lunaires) |
| PoleMap, saisie de coordonnées | Atlas |
| Optimizer | Mission Lab > Zones (calques Score, Soleil, Terre, Pente ; itinéraire de rover) |
| LandingPlanner | Mission Lab > Landing dates (avec le calendrier site × mois) |
| BudgetPanel | Mission Lab > Power & radio (avec les relais modèles) |
| Comparison | Mission Lab > Compare |

Changements par rapport à l'ancien optimiseur : les calques « nuit », « Soleil et Terre »,
« Terre ou relais », « coupure totale » et « distance aux ombres permanentes » ne sont plus
affichés comme calques ; les critères correspondants restent réglables et les valeurs restent
dans le tableau des zones.

## Données ajoutées

- `data/story/mons-mouton-transect.json` (chapitre 4) : `npm run story` dans `app/`, avec les
  cartes d'horizon installées.

## Vérifier

```bash
cd app
npm test            # 89 tests
npm run build:web   # version en ligne (88 Mo, sans tuiles)
npm run dev         # http://localhost:5173
```
