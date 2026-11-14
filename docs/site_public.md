# Earthrise Atlas : le site public

Le site public **Earthrise Atlas** remplace l'ancienne interface experte. Conception :
[superpowers/specs/2026-11-14-earthrise-atlas-design.md](superpowers/specs/2026-11-14-earthrise-atlas-design.md) ;
plan : [superpowers/plans/2026-11-14-earthrise-atlas.md](superpowers/plans/2026-11-14-earthrise-atlas.md).

## Pages

| Adresse | Page | Contenu |
|---|---|---|
| `/` | Story | Accueil (direction « Nuit polaire ») puis récit en 6 chapitres, calculé sur le jour lunaire du 14/11/2026, dont « Not like home » (Terre contre Lune) |
| `/atlas` | Atlas | Carte plein écran sur la photo LROC, fiche flottante du site, pastilles des sites polaires, saisie de coordonnées, autres sites |
| `/play` | Play | Site, date et durée ; 4 chiffres clés et verdict ; onglets Sky, Timeline, 3D, Site ; mission retardée avec recherche d'endroits voisins ; lien partageable ; fiche de mission imprimable (PDF) |
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
npm test            # 102 tests
npm run build:web   # version en ligne (~89 Mo, sans tuiles)
npm run dev         # http://localhost:5173
```

## Bonus (14/11/2026)

| Bonus | Où | Comment |
|---|---|---|
| Mission retardée complète | Play > « Mission delayed by a month? » > « Find better spots nearby » | `play/nearby.ts` : région de calcul du site, deux évaluations dans le worker (date prévue et date décalée), `compareDelay()` ; meilleurs endroits à moins de 10 km |
| Terre contre Lune | Story, chapitre 4 « Not like home » | `story/home.ts` : durée du jour, Soleil au plus haut (Paris contre crête de liaison), température (Diviner), ciel, délai radio |
| Fiche de mission (PDF) | Play > « Mission sheet (PDF) » | `play/MissionSheet.tsx` : page A4 visible seulement à l'impression ; « Enregistrer en PDF » du navigateur |
| Vue 3D | Play > onglet 3D | `play/Terrain3D.tsx` (Three.js 0.169.0, chargé à la demande, 124 Ko compressés) : 20 × 20 km de relief réel autour du site (carte de région à 200 m, courbure lunaire), le Soleil comme seule lumière avec ombres portées, la Terre dans le ciel ; masqués quand ils sont sous l'horizon réel du site. Disponible pour les sites des régions polaires |

Le panorama du ciel est maintenant centré sur la direction moyenne de la Terre : elle reste d'un
seul tenant au milieu du graphique, quel que soit le site.

## Relecture finale

Une relecture indépendante de la branche a conclu « prêt après corrections ». Les cinq points
importants sont corrigés, chacun avec un test (cache de l'horizon d'un point personnalisé partagé
par lien, noms de régions et libellés radio traduits, texte honnête d'un point personnalisé,
carte qui ne capte plus le défilement). Points mineurs reportés : voir le registre de l'exécution.
