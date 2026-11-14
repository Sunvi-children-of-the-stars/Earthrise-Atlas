# Membre 3 — Application web (React)

> Question : *comment présenter toutes ces informations dans un outil simple ?*

## Lancer l'application

```bash
cd app
```
```bash
npm install
```
```bash
npm run dev
```

L'application s'ouvre sur http://localhost:5173. Avant de démarrer, `npm run dev` et
`npm run build` copient `data/sites`, `data/horizons`, `data/dem/preview` et
`data/ephemeris` dans `app/public/data` (script `app/scripts/sync-data.mjs`). Après avoir
relancé le traitement Python, il suffit de redémarrer l'application.

Technologies : React 18, TypeScript et Vite. Aucune bibliothèque de graphiques : tous les
graphiques sont dessinés en SVG à la main, et la carte utilise un canvas.

## Fonctionnalités

| Besoin du défi | Dans l'application |
|---|---|
| Choisir un site dans une liste | 3 sites candidats et 4 sites de référence (colonne de gauche) |
| Coordonnées personnalisées | Champs lat/lon, ou clic sur la carte. Horizon, altitude et pentes **calculés à la demande** en arrière-plan (Web Worker) à partir du relief multi-résolution : 20 m près du site, 480 m au loin. Voir « Deux méthodes de calcul d'horizon » ci-dessous. |
| Choisir une date et une période | Date de début (UTC), 3 j / 7 j / 1 jour lunaire / 3 mois, boutons ◀ ▶ |
| Soleil et Terre par rapport à l'horizon | **Vue du ciel** : panorama 360° avec l'horizon réel, les trajectoires du Soleil et de la Terre et leur position actuelle |
| Temps avant coucher du Soleil / de la Terre | Cartes : élévation, azimut, horizon local, « coucher dans … », « coucher de Terre dans … » |
| Indicateurs d'énergie et de communication | % du temps ensoleillé, plus longue nuit, flux solaire moyen (panneau vertical et horizontal), % de visibilité de la Terre, plus longue coupure, % Soleil + Terre |
| Évolution dans le temps | **Chronologie** avec bandes de visibilité, curseur à faire glisser et animation (▶) |
| Saisons | **Mois lunaires** : % Soleil et % Terre sur 13 mois ; un clic sur un mois l'analyse |
| Comparaison | **Tableau comparatif** des scénarios (site × date × période), meilleure valeur en vert, enregistré dans le navigateur |
| Terrain | Fiche **Terrain du site** : altitude, pentes, relief, principaux obstacles (données du membre 2) |
| Énergie et télécom d'un véhicule | **Bilan énergie et télécom** : batterie, panneaux, débit, données (membre 4) |
| Quand se poser | **Choisir la date d'atterrissage** : chaque date notée, meilleures fenêtres justifiées (membre 5) |
| Trouver où se poser | **Recherche de zones optimales** : carte de chaleur d'une région sur la période choisie, profils de mission, poids et contraintes réglables, meilleures zones avec « Analyser ». Voir [optimisation_zones.md](optimisation_zones.md) |

## Relais de communication LRO

Quand la Terre est cachée, un satellite en orbite lunaire peut relayer les communications.
L'application calcule les passages de **LRO** (Lunar Reconnaissance Orbiter) au-dessus de
chaque site, y compris les sites personnalisés.

**Données :** `scripts/fetch_relay_ephemeris.py` télécharge depuis **JPL Horizons** la position
de LRO par rapport au centre de la Lune (ICRF/J2000), au pas d'une minute. La période couverte
va du 01/11/2026 au 01/05/2027, soit 260 641 points et 3,1 Mo dans `data/relays/`. L'altitude
de LRO varie de 63 à 118 km.

```bash
.venv/Scripts/python scripts/fetch_relay_ephemeris.py --start 2026-11-01 --days 181
```

**Calcul** (`app/src/astro/relay.ts`) :
- chaque position est tournée dans le repère lunaire avec le même modèle IAU que le Soleil
  et la Terre ;
- LRO est **utilisable** s'il dépasse l'horizon du relief **et** 5° d'élévation (masque
  d'antenne, valeur `RELAY_MIN_ELEV_DEG`) ;
- un jour lunaire se calcule en ~0,3 s.

**Validation contre Horizons** : azimut et élévation de LRO vus depuis le sommet de Malapert,
7 instants entre le 14/11 et le 15/12/2026 :
- écart **≤ 0,05° en élévation, 0,00° en azimut** ;
- une première version comparait des échantillons décalés de 9 s, car les vecteurs Horizons
  sont datés en TDB ; c'est corrigé par interpolation linéaire entre les minutes.

**Affichage :**
- carte « Liaison Terre ou relais LRO » : part du temps avec liaison, passages par jour, part
  des coupures Terre couvertes, plus longue coupure **totale**, comparée à la Terre seule ;
- bande violette « LRO » dans la chronologie ;
- colonnes « Terre ou LRO » et « Coupure totale max » dans le comparatif.

**Résultats** (jour lunaire du 14/11/2026, ~12,3 passages de LRO par jour) :

| Site | Liaison Terre ou LRO | Plus longue coupure, Terre seule | Plus longue coupure, avec LRO |
|---|---|---|---|
| Crête de liaison | 52 % | **13,3 jours** | **1 h 49** |
| Malapert (sommet) | 83 % | 5,3 jours | 1 h 50 |
| Mons Mouton | 84 % | 5,2 jours | 1 h 51 |

LRO ne couvre que 6 à 8 % du temps. Mais en passant toutes les ~2 h, il réduit la plus longue
coupure de communication **de plusieurs jours à moins de 2 heures**. C'est décisif pour les
sites très proches du pôle, où la Terre passe sous l'horizon pendant des jours.

**Limites :**
- l'orbite est une **prévision** Horizons ; la précision du minutage diminue loin dans le
  futur. Hors de la période téléchargée, la carte l'indique et invite à choisir une autre
  période ;
- LRO est une sonde scientifique, sans radio de relais pour des atterrisseurs. Il sert
  d'**exemple d'orbite de relais basse et polaire**, comme celle d'un futur relais (Lunar
  Pathfinder, Moonlight). Le calcul montre la **géométrie** possible, pas un service garanti ;
- la station Gateway et le relais Queqiao-2 ne sont pas disponibles dans Horizons ;
- l'optimiseur de zones en tient compte (profil « Liaison avec relais ») : voir
  [optimisation_zones.md](optimisation_zones.md).

## Signalement des cas fragiles

Chaque analyse indique si son résultat est **robuste**, **à confirmer** ou **fragile**
(`fragility()` dans `astro/analysis.ts`). Deux règles, tirées de la validation contre
QuickMap ([validation_quickmap.md](validation_quickmap.md)) :

1. **Zone grise (±0,5°)** : à moins de 0,5° de l'horizon, la réponse dépend du relief fin et
   de la définition retenue (capteur à 2 m ou sol). Nos erreurs mesurées sont de ≤ 0,2° pour
   les éphémérides et l'horizon à 20 m, et 0,5° les couvre avec de la marge. On recalcule
   donc l'ensoleillement et la visibilité de la Terre avec un horizon décalé de ±0,5°, ce qui
   donne une **fourchette**.
2. **Relief lointain** : si l'obstacle dans la direction de l'astre est à **plus de 100 km**
   et que la marge est inférieure à **2,5°**, la visibilité dépend de la façon de traiter la
   courbure lunaire, et les outils divergent (cas de la crête de liaison avec Malapert à
   135 km).

| Verdict | Condition |
|---|---|
| Robuste | fourchettes ≤ 5 points et relief lointain décisif < 2 % du temps |
| À confirmer | fourchettes ≤ 15 points et relief lointain < 10 % du temps |
| Fragile | au-delà |

**Où le voir dans l'application :**
- la carte « Fiabilité du résultat », avec ses raisons ;
- la fourchette sous « Ensoleillement » et sous « Terre visible » ;
- un ⚠ sur l'élévation du Soleil ou de la Terre à l'instant affiché ;
- une bande ⚠ orange dans la chronologie ;
- la colonne « Fiabilité » du tableau comparatif.

Exemples sur le jour lunaire du 14/11/2026 :

| Site | Verdict | Raison |
|---|---|---|
| Apollo 11 | robuste | Soleil haut, horizon plat |
| Mons Mouton | à confirmer | Terre visible entre 78 et 88 % |
| Sommet de Malapert | fragile | ensoleillement entre 78 et 100 % (le Soleil rase l'horizon) |
| Crête de liaison (24/11) | fragile | visibilité décidée par un relief à 135 km |

Un verdict « fragile » ne signifie pas que le site est mauvais. Il signale que le chiffre
doit être confirmé par une source indépendante (JPL Horizons, ombres QuickMap, MNT plus fin)
avant toute décision.

## Deux méthodes de calcul d'horizon, en parallèle

| | Sites sélectionnés (candidats, références) | Sites personnalisés |
|---|---|---|
| Méthode | **Précalcul** Python (`scripts/build_sites.py`) | **À la demande** dans le navigateur (`astro/horizonTiled.ts`, exécuté par `astro/horizon.worker.ts`) |
| Relief | 20 m jusqu'à 25 km, 120 m au-delà | 20 m jusqu'à 5 km, puis 80, 240 et 480 m |
| Chargé par l'application | `data/horizons/<id>.json` (~10 Ko) | ~85 tuiles (~11 Mo), en 0,5 à 2 s |
| Écart entre les deux | — | RMS ≤ 0,005° aux 3 sites candidats |

Les repères géographiques suivent cette logique :
- un site **entre 75°S et 80°S** est calculé à 120 m près du site, faute de relief à 20 m (entre 80°S et 85°S, le relief à 20 m vient de LDEM_80S_20M quand il est installé) ;
- un site **au nord de 75°S** reçoit un horizon de sol lisse ;
- si les tuiles sont indisponibles (version déployée sans la pyramide), l'application se
  rabat sur le MNT réduit à 1,2 km, et la fiche du site le signale.

## Éphémérides

Les positions du Soleil et de la Terre viennent de la **table JPL Horizons** (source officielle, voir
[decision_ephemerides.md](decision_ephemerides.md))
(2026–2030, une heure de pas, directions apparentes vues du centre de la Lune). L'application
les tourne dans le repère lunaire (modèle IAU, Archinal et al. 2011) et ajoute la parallaxe du
site, qui vaut jusqu'à 0,26° pour la Terre. Écart avec Horizons en mode observateur :
**≤ 0,003°**. En dehors de 2026–2030, l'application revient aux séries de l'*Astronomical
Almanac* : jusqu'à 0,19° d'écart sur la Terre, soit 1 h à 2,5 h sur ses levers et couchers.
Le badge en haut à droite indique la source utilisée.

Détails, validation et effet sur les résultats : [membre1_ephemerides.md](membre1_ephemerides.md).

## Bilan énergie et télécom (membre 4)

Panneau sous les cartes d'indicateurs. Pour un véhicule de référence (petit atterrisseur,
rover, station longue durée, ou réglages personnalisés), il donne :
- la courbe de charge de la batterie ;
- le verdict « Tient la période » ou « Panne d'énergie » ;
- la batterie et les panneaux nécessaires ;
- le débit vers la Terre et le volume de données sur la période.

Le choix du véhicule est mémorisé dans le navigateur et sert aussi à la recherche de dates.
Modèle et hypothèses : [membre4_energie_telecom.md](membre4_energie_telecom.md).

## Choisir la date d'atterrissage (membre 5)

Panneau avant la recherche de zones. Il note chaque date possible, toutes les 12 h sur 3 à
12 mois, pour les 3 sites candidats. Il exclut les dates sans Soleil ni Terre juste après
l'atterrissage, ou avec une panne de batterie, puis classe les meilleures fenêtres avec
leurs « pour » et « contre ». Méthode, poids et recommandation :
[membre5_decision.md](membre5_decision.md).

## Règles de visibilité
- Soleil : visible si plus de la moitié de son disque dépasse l'horizon à son azimut.
  Le flux solaire est pondéré par la fraction visible du disque.
- Terre : visible si son centre dépasse l'horizon.
- Horizon : masques du membre 2 (relief à 20 m près du site, 120 m au loin) ; relief
  multi-résolution à la demande pour les sites personnalisés ; sol lisse en dehors du MNT polaire.
- Les cartes officielles LOLA comptent la Terre visible dès que son bord dépasse : leurs
  pourcentages sont plus élevés de quelques points. Voir [validation_lola.md](validation_lola.md).

## Organisation du code
```
app/src/
  astro/ephemeris.ts   positions Soleil/Terre dans le repère lunaire, élévation/azimut
  astro/horizon.ts     masques d'horizon, MNT réduit (carte, solution de repli)
  astro/tiles.ts       lecture des tuiles de relief (cache, chargement en parallèle)
  astro/horizonTiled.ts  horizon multi-résolution à la demande (sites personnalisés)
  astro/horizon.worker.ts, astro/onDemand.ts  exécution en arrière-plan (Web Worker)
  astro/analysis.ts    simulation dans le temps, fenêtres, indicateurs, mois lunaires
  astro/relay.ts       passages du relais LRO
  astro/budget.ts      bilan énergie (batterie, panneaux) et télécom (débit, volume) — membre 4
  astro/landing.ts     notation des dates d'atterrissage — membre 5
  optim/               recherche de zones (Web Worker), scores, profils
  components/          SkyPanorama, Timeline, MetricCards, Seasonal, PoleMap, SiteDetails, Comparison,
                       BudgetPanel, LandingPlanner, Optimizer
app/scripts/           sync-data, validate-ephemeris, validate-lola, mission-report
  App.tsx              état (site, dates, curseur, scénarios) et mise en page
```
