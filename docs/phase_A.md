# Phase A (backend) : journal de ce qui a été fait

Suivi des tâches de [taches_equipe.md](taches_equipe.md), phase A. La tâche A4 (intégration
des livrables d'Elge) attend ces livrables.

**Bilan au 14/11/2026 : toutes les tâches de la phase A qui ne dépendent pas d'Elge sont faites.**
Le build de mise en ligne fait maintenant **87 Mo** (9 régions, Diviner, LROC, 3 relais),
contre 47 Mo au départ. Vérification finale dans le navigateur : relais LRO inchangé (53 %,
12,3 passages par jour), 9 régions et 7 profils disponibles, optimiseur sur Haworth avec le
profil Rover → 114 points faisables (même résultat que le test Node), aucune erreur dans la
console.

| Tâche | État |
|---|---|
| A1. Décision éphémérides | ✅ révisée : table JPL Horizons d'Elge |
| A2. Préparation mise en ligne | ✅ (publication : compte d'hébergement requis) |
| A3. Profils de l'optimiseur | ✅ (critère relais LRO : quand T7 sera livrée) |
| A5. Mission retardée | ✅ (logique) |
| A6. « 1 km plus loin » | ✅ (logique) |
| A7. Calendrier site × date | ✅ (logique et données précalculées) |
| A8. Lien partageable | ✅ (logique ; le bouton est en phase B) |
| A9. Données complémentaires | ✅ rover, relais modèles, relief 20 m jusqu'à 80°S, Diviner, LROC |

---

## A1. Décision sur les éphémérides ✅

- Décision écrite dans [decision_ephemerides.md](decision_ephemerides.md) : le calcul intégré
  est la **source officielle**. JPL Horizons ne sert que de référence de validation.
- `docs/membre3_application.md` : la section « Brancher les données du membre 1 (à faire) »
  est remplacée par un renvoi à la décision.
- `README.md`, en-tête de `app/src/astro/ephemeris.ts` et pied de page de l'application :
  plus de mention « en attendant les fichiers Horizons ».
- `data/ephemeris/` est réservé aux fichiers de référence du script de validation (tâche T5
  d'Elge). L'application ne les lit pas.

## A2. Préparation de la mise en ligne ✅

- Nouveau script **`npm run build:web`** (dans `app/`) : build de production **sans la pyramide
  de tuiles** (mode Vite `web`, équivalent de `NO_TILES=1`, qui marche aussi sous Windows).
- Résultat : **47 Mo**, dont 42 Mo de cartes d'horizon pour l'optimiseur. Tout hébergeur
  statique convient (Netlify, Vercel, Cloudflare Pages, GitHub Pages ; limite de 100 Mo par
  fichier, le plus gros fait 23 Mo).
- Testé avec un **serveur statique pur** (`python -m http.server`, sans le middleware Vite) :
  - les sites, horizons, relais LRO et cartes d'horizon se chargent ;
  - l'optimiseur a ses données ;
  - un site personnalisé se **rabat sur le MNT à 1,2 km**, et la fiche le signale
    (« tuiles indisponibles ») ;
  - aucune erreur bloquante.
- Fichiers ajoutés :
  - `app/public/_headers` : cache et type MIME des fichiers binaires (Netlify, Cloudflare) ;
  - `app/public/.nojekyll` : pour GitHub Pages ;
  - `app/netlify.toml`.
- `.gitignore` : ajout de `.playwright-mcp/`.

**Pourquoi un déploiement depuis le poste, et pas une intégration continue :** les cartes
d'horizon (`data/horizon_maps/`) ne sont pas versionnées et prennent 25 min à calculer. Un
build sur GitHub ne les aurait pas. On construit donc en local et on publie `dist/` :

```bash
cd app
npm run build:web
npx netlify-cli deploy --dir=dist          # aperçu
npx netlify-cli deploy --dir=dist --prod   # publication
```

La première commande `netlify-cli` demande de se connecter au compte Netlify de l'équipe et
de choisir un site. Autre option sans compte : glisser `app/dist` sur https://app.netlify.com/drop.

## A8. Lien partageable ✅ (logique)

- Nouveau module `app/src/share.ts`, sans dépendance à l'interface :
  - `readShareState(location.hash)` : lit l'état depuis l'URL ;
  - `writeShareState(state)` et `shareUrl(state, location.href)` : produisent le lien.
- Format lisible et stable : `#site=malapert-massif&t=2026-11-14T16:00Z&d=708.7`, ou
  `#lat=-85.5&lon=15&t=…&d=168&c=42` pour un site personnalisé. Paramètres optionnels de
  l'optimiseur : `region=pole&profile=artemis`.
- Robuste aux liens abîmés : un champ invalide est ignoré, sans erreur. Un site personnalisé
  l'emporte sur `site=`, et une latitude invalide fait revenir au site nommé.
- Vérifié : écriture, aller-retour, entrées invalides, construction de l'URL complète.
- **Phase B :** bouton « Copier le lien », et lecture du hash au démarrage dans `App.tsx`.

## A3. Profils de l'optimiseur ✅

- `app/src/optim/score.ts` : profils revus, et deux nouveaux, **Équipage (Artemis III)** et
  **Rover prospecteur (type VIPER)**. Détail et justification dans
  [optimisation_zones.md](optimisation_zones.md#profils-prédéfinis).
- Défauts corrigés, trouvés en simulant les 3 régions :
  - « Liaison directe Terre » : **0 zone** au pôle sur un jour lunaire, à cause de la
    contrainte « Terre ≥ 60 % », impossible près du pôle. Contrainte retirée ;
  - « Survie à la nuit » : retenait une zone **sans aucune liaison** (Terre 0 %). Ajout du
    poids « Terre 1 » ;
  - pentes harmonisées : 8° pour les atterrisseurs, 15° pour les rovers.
- Champs ajoutés aux profils : `basis` (justification) et `periodH` (durée de conception,
  156 h pour Artemis).
- Vérification : les 6 profils × 3 régions × 2 périodes (6,5 jours et jour lunaire du
  14/11/2026) ont tous des zones faisables.
- Reste à faire, à l'arrivée de T7 : régler le poids du critère « coupure totale, Terre ou
  LRO ».

## A6. « 1 km plus loin » ✅ (logique)

Nouveau module `app/src/optim/neighborhood.ts`. Il travaille sur le résultat d'une évaluation
de région (`evaluateRegion`), donc sans calcul supplémentaire :
- `pointMetrics(region, metrics, lat, lon)` : indicateurs de la cellule de 200 m qui contient
  le point ;
- `transect(…, azimut, demi-longueur, pas)` : indicateurs tous les 200 m le long d'une ligne ;
- `neighborhood(…, rayon, penteMax)` : pour chaque indicateur, la valeur au site, le min et le
  max dans le rayon, la part des cellules qui font mieux, le **plus grand écart à moins de
  1 km**, et la meilleure cellule proche ;
- `pixelOf` et `regionContains` : savoir si un point est dans une région.

**Résultat de démonstration** (Mons Mouton, 6,5 jours à partir du 14/11/2026) :
- à **200 m** à l'est du site, la Terre passe de **100 % à 71 %** de visibilité ;
- à 1 km, elle tombe à **65 %** ;
- dans un rayon de 1 km, la visibilité de la Terre peut changer de **75 points**, et la plus
  longue coupure de **117 h**.

C'est l'illustration chiffrée du « petit déplacement, gros impact » de l'énoncé.

## A5. Mission retardée ✅ (logique)

Nouveau module `app/src/optim/delay.ts` :
- `compareDelay(region, avant, après, lat, lon, poids, contraintes, rayon)` : score du site
  avant et après le décalage, avec un verdict (« toujours bon », « dégradé », « amélioré »,
  « devient infaisable »…, seuil de 3 points), et les **meilleures zones dans le rayon à la
  nouvelle date**, avec leur distance au site ;
- `planDelay(…)` : version qui lance aussi les deux évaluations de région. Elle est lourde,
  donc à appeler depuis le worker ;
- `shiftScan(site, masque, début, durée, décalages)` : pour un site, ses indicateurs pour une
  série de décalages, par défaut 0 à 12 mois lunaires. C'est rapide : **56 ms** pour 13
  décalages.

**Résultat de démonstration** (Mons Mouton, profil « Atterrisseur », 6,5 jours, décalage
d'un mois lunaire) :
- le site reste **« toujours bon »** (83,6 → 81,7) ;
- des zones à 9 ou 10 km font mieux (91 points) ;
- `shiftScan` montre surtout que **la saison compte** : la Terre est visible 100 % du temps de
  novembre 2026 à mai 2027, puis seulement **23 % en août 2027**, avec une coupure de 121 h.

## A7. Calendrier site × date ✅

- Nouveau module `app/src/astro/calendar.ts` :
  - `siteCalendar` et `calendar` : une case par site et par jour lunaire, avec Soleil, plus
    longue nuit, Terre, plus longue coupure, Soleil + Terre et flux. Les résultats sont mis en
    cache ;
  - `cellGrade(case, poids)` : note de 0 à 100 avec les **poids des profils de l'optimiseur**,
    pour colorer une carte de chaleur ;
  - `bestMonth(ligne, poids)` : le meilleur mois.
- Précalcul : `npm run calendar -- [AAAA-MM-JJ] [mois]` (dans `app/`) écrit
  `data/calendar/sites.json` (32 Ko, versionné). Ce fichier contient les indicateurs, les
  notes de chaque profil et le meilleur mois par site. `sync-data` le copie dans l'application.
- Calcul : 7 sites × 13 mois en **0,5 s**.
- Lecture rapide (note Artemis sur un jour lunaire, de novembre 2026 à novembre 2027) :
  - Malapert : 89 en novembre 2026, 57 en avril 2027 ;
  - crête de liaison : de 56 à 80 ;
  - Chang'e-6 (face cachée, jamais la Terre) : 27 toute l'année.
- Limite : une case couvre un jour lunaire entier. Pour un profil conçu sur 6,5 jours
  (Artemis), la note pénalise donc des nuits qui ne tombent pas forcément pendant le séjour.
  C'est `shiftScan` (A5) qui donne la réponse à durée exacte.

## A9. Données complémentaires

### A9a. Itinéraire de rover ✅ (logique)

Nouveau module `app/src/optim/rover.ts`, `roverRoute(région, lat, lon, cible, options)` :
- plus court chemin (Dijkstra, 8 voisins) sur la grille de 200 m de la région ;
- une cellule est praticable si sa pente moyenne est ≤ `maxSlope` (15° par défaut, comme
  VIPER) et, en option, si elle n'est pas en ombre permanente (un rover solaire ne peut pas
  s'y arrêter) ;
- coût : longueur 3D × (1 + pénalité × pente / pente max), donc les pentes raides sont
  évitées si un détour court existe ;
- résultat : tracé (lat, lon, km cumulés, altitude, pente), longueur, montée, descente, pente
  maximale et durée de route (0,2 km/h par défaut, vitesse moyenne de VIPER) ;
- cibles prêtes à l'emploi (`targets`) :
  - `shortNight(métriques, h)` : refuge où la nuit est courte ;
  - `sunAndEarth(métriques, %Soleil, %Terre)` ;
  - `nearIce(région, km)` : bord d'un piège froid.

**Résultats de démonstration** (jour lunaire du 10/05/2027, en hiver austral) :

| Départ | Cible | Trajet |
|---|---|---|
| Crête de liaison | refuge où la nuit est 2 fois plus courte (≤ 199 h) | **0,77 km**, pente max 3,3°, 3,8 h |
| Crête de liaison | bord de glace (≤ 0,3 km d'une ombre permanente) | 1,29 km, −115 m, 6,4 h |
| Malapert | bord de glace | **0,69 km**, pente max 13°, 3,4 h |
| Mons Mouton | bord de glace | 2,08 km, 10,4 h |

Calcul en 2 à 130 ms. Si aucune cible n'est atteignable, le module le dit (« aucune cible
atteignable, pente ≤ 15°, 50 km max ») au lieu de proposer un trajet impossible.

### A9b. Relais hypothétiques Gateway et Queqiao-2 ✅

- `scripts/build_relay_models.py` génère deux **orbites modèles**, au même format que LRO,
  avec `"kind": "model"` dans les métadonnées :
  - **Gateway, NRHO 9:2** : périlune 1 600 km, apolune 70 000 km au-dessus du pôle Sud,
    période 6,56 j (chiffres NASA). Orbite décrite dans le repère lunaire fixe, puisque le
    plan d'une NRHO suit la direction de la Terre ;
  - **Queqiao-2** : orbite gelée de 12 h, 300 × 8 600 km, inclinée de 54,8°, apolune au sud
    (phase Chang'e-6). Le nœud ascendant n'est pas publié : la phase des passages est donc
    arbitraire, mais leur fréquence et leur durée sont réalistes.
- `app/src/astro/relay.ts` :
  - `loadRelays()` charge tous les relais (réels d'abord) ;
  - `loadRelay()` renvoie toujours **LRO**, donc rien ne change dans l'application actuelle ;
  - nouveaux champs `kind` et `frame_kind` ;
  - correction : la durée d'un passage (`minutes`) supposait un pas d'une minute. Elle suit
    maintenant le pas réel du fichier.
- L'index garde LRO en premier (`fetch_relay_ephemeris.py` adapté aussi).
- Taille : 1,5 Mo par modèle (un point toutes les 2 min sur 181 jours).

**Couverture sur le jour lunaire du 14/11/2026 :**

| Site | LRO (réel) | Gateway (modèle) | Queqiao-2 (modèle) |
|---|---|---|---|
| Crête de liaison | relais 8 %, coupure max 1,8 h | relais **97 %**, coupure max 3,9 h | relais 79 %, coupure max 2,6 h |
| Malapert | 7 %, 1,8 h | 97 %, **aucune coupure** | 78 %, 2,7 h |
| Mons Mouton | 7 %, 1,8 h | 97 %, **aucune coupure** | 78 %, 2,7 h |
| Chang'e-6 (face cachée) | 2 %, 270 h | 97 %, 5 h | 57 %, 89 h |
| Apollo 11 (équateur) | 1 % | 1 % (Gateway sous l'horizon) | 31 % |

Sans relais, la plus longue coupure sur la crête est de 316 h. Ces résultats sont
cohérents avec la conception de ces orbites : la NRHO de Gateway a été choisie pour survoler
longuement le pôle Sud.

**Phase B :** afficher les relais modèles dans la carte « Liaison » et dans la chronologie,
marqués « modèle ».

### A9c. Relief à 20 m jusqu'à 80°S ✅

- Téléchargé : **`LDEM_80S_20M`** (1,85 Go, PDS LOLA), dans `data/dem/` (non versionné).
- **Contrôle :** sur la zone commune, il est identique à `LDEM_85S_20M` (écart RMS 0,05 m,
  maximum 0,5 m, soit une unité de quantification, sur 2 000 points).
- Les scripts le choisissent automatiquement quand il est présent :
  - `tiled_dem.py` (`RASTERS[20]`) ;
  - `build_tiles.py` (`SRC20`), dont la moyenne 2×2 est maintenant calculée par bandes pour
    borner la mémoire ;
  - `build_sites.py` et `build_horizon_maps.py`.
- **Pyramide reconstruite :** 20 m = 14 400 tuiles (contre 3 600), 40 m = 3 600, 80 m = 900,
  soit environ 2,5 Go au total. Les sites personnalisés entre 80 et 85°S ont donc le relief
  à 20 m, comme ceux du pôle.
- **Base des sites régénérée :**
  - **IM-1** passe du relief à 120 m au relief à **20 m** : son horizon change de 0,23° en
    moyenne (RMS), et jusqu'à 0,87° dans une direction ;
  - Mons Mouton change de 0,002°, Malapert ne change pas ;
  - libellés corrigés : source de relief réelle, plus de mention « à remplacer par JPL
    Horizons (membre 1) ».
- **6 nouvelles régions** dans l'optimiseur : Nobile Rim 1, Nobile Rim 2 et Amundsen Rim,
  Haworth, Faustini Rim A, de Gerlache Rim 2, Gerlache-Kocher. Mons Mouton a été recalculé
  avec le relief à 20 m. **Les 13 régions Artemis III de la liste NASA 2022 sont maintenant
  toutes couvertes** (9 régions de calcul).
- **Calcul sur Modal :** `scripts/modal_horizon_maps.py` lance une région par conteneur, avec
  le MNT téléchargé une fois dans un volume Modal. Les 7 régions ont été calculées en
  **2 min 12 s**, contre environ 40 min en local.
- Ombres permanentes recalculées pour les 9 régions : par exemple 370 km² à
  Nobile-Amundsen et 142 km² à Faustini.
- Le calendrier (`data/calendar/sites.json`) a été régénéré avec les nouveaux horizons.

### A9d. Critère thermique Diviner ✅

- Source : **Diviner Polar Resource Products** pôle Sud (LRO, Paige et al., PDS, 605 Mo,
  non versionné). Le fichier contient 2,88 millions de triangles d'environ 0,5 km, avec la
  température moyenne annuelle (à 2 cm), la température maximale annuelle et la **profondeur
  de stabilité de la glace d'eau**.
- `scripts/build_diviner.py` projette ces données sur la grille de 200 m de chaque région
  (`<id>.tavg.i16`, `.tmax.i16`, `.icedepth.i16`) et écrit les valeurs aux sites dans
  `data/sites/diviner.json`. Temps d'exécution : 11 s, la table étant mise en cache en `.npy`.
- `app/src/optim/region.ts` charge ces couches quand elles existent. Si elles manquent,
  l'application fonctionne comme avant.
- Deux **nouveaux critères** dans `app/src/optim/score.ts` :
  - **Température douce** : moyenne annuelle normalisée entre 50 et 200 K ;
  - **Glace peu profonde** : 1 si la glace est stable en surface, 0 au-delà de 100 cm ou si
    elle est instable.
- Profils : « Survie à la nuit » prend Température douce ×1 ; « Rover » et « Glace » prennent
  Glace peu profonde ×2. Les zones (`Zone`) portent `tAvgK` et `iceDepthCm`.
- **Résultats :**
  - températures moyennes de 28 K (fond des cratères) à 198 K (crêtes) ;
  - sites candidats autour de 120 K (−150 °C), avec un maximum de 210 à 220 K ;
  - glace stable à moins de 1 m sur 28 % (Mons Mouton) à 75 % (Faustini) des régions ;
  - le profil « Glace » trouve au pôle une zone au Soleil 81 % du temps, avec la glace
    stable à **2 cm** de profondeur, à 0,2 km d'une ombre permanente.
- **Vérification :** les 6 profils ont été testés sur les 9 régions sur un jour lunaire.
  Les seuls cas sans zone sont physiques :
  - **Artemis** sur 29,5 jours : la contrainte « nuit ≤ 6 h » est conçue pour 6,5 jours.
    Sur sa durée de conception, le profil fait apparaître des **fenêtres d'atterrissage** :
    Nobile-Amundsen est ouvert les 14 et 21/11/2026, fermé à partir du 28/11 ;
  - **Rover** à Nobile-Amundsen : la nuit la plus courte y dure 252 h, au-delà des 96 h de
    survie.

### A9e. Fond d'image LROC ✅ (données ; l'affichage est en phase B)

- Source : mosaïque **LROC WAC** du pôle Sud, `WAC_GLOBAL_P900S0000_100M` (100 m/pixel, de
  60°S au pôle, 1,39 Go, même projection que LOLA).
- **Traitée sur Modal** (`scripts/modal_lroc.py`) : la mosaïque est téléchargée dans le cloud
  et rééchantillonnée en moyennant 16 points par pixel. Seuls **1,7 Mo** reviennent sur le
  poste :
  - `data/lroc/south_pole_wac_400m.jpg` et `.json` : fond de la carte du pôle, 2 286 × 2 286
    pixels, exactement 3 fois plus fin que le MNT réduit (même emprise de ±457 km) ;
  - `data/horizon_maps/<id>.wac.u8` : image 8 bits sur la grille de chaque région, pour
    l'afficher sous la carte de chaleur de l'optimiseur.
- `sync-data` copie `data/lroc/`.
- **Contrôle visuel :**
  - la photo et le relief LOLA se superposent exactement
    ([img_lroc_vs_lola.png](img_lroc_vs_lola.png)) ;
  - nos ombres permanentes tombent dans les zones noires de la photo, Shackleton compris
    ([img_pole_lroc_psr.png](img_pole_lroc_psr.png)).
- **Limite :** la mosaïque NASA a des raccords visibles entre quadrants (éclairages
  différents). C'est inhérent au produit.

## A4. Intégration du travail d'Elge ✅ (branche `feat/horizons-energy-decision`)

**Relecture :** la branche compile, se construit, et ses résultats se reproduisent sur notre
machine (`npm run validate-ephemeris`, `npm run mission-report`).

| Tâche | Livré | Contrôle |
|---|---|---|
| T3. Flux selon la distance au Soleil | ✅ | Intégré aux sites et à l'optimiseur |
| T4. Bilan énergie et radio (`astro/budget.ts`) | ✅ | Bilan de liaison refait à la main (bande X, 20 W, antenne de 0,5 m, station de 12 m) : environ 47 Mbit/s possibles, plafonnés à 2 Mbit/s par la radio. Cohérent |
| T5. Table JPL Horizons 2026 à 2030 | ✅ | Écart **≤ 0,003°**, contre 0,19° pour les séries ; levers et couchers de Terre corrigés d'environ 1 h (2,5 h au maximum) |
| T6. Comparaison aux cartes officielles LOLA | ✅ | Ombres permanentes : recouvrement 0,80 à 0,93 ; ensoleillement : RMS 2,1 à 2,5 points |
| T7. Relais LRO dans l'optimiseur | ✅ | Recoupé avec le calcul par site : 83,2 % contre 83,4 % à Malapert, même coupure maximale (1,8 h) |
| T8. Crête au 24/11 | ✅ | Tranché en faveur du calcul avec courbure |
| En plus : choix de la date d'atterrissage (`astro/landing.ts`) | ✅ | |
| T1. Tests automatiques | ❌ | À faire |
| T2. Nouveaux sites de référence | ❌ | À faire |

**Fusion et corrections :**
- **Éphémérides :** la table Horizons d'Elge devient la **source officielle**, et les séries
  servent de secours hors de 2026 à 2030 ([decision_ephemerides.md](decision_ephemerides.md),
  réécrite).
- **Profils :** mes corrections de la phase A sont gardées. Les critères « Terre ou relais »
  et « Coupure totale courte » d'Elge sont ajoutés, ainsi que son profil « Liaison avec
  relais », aligné sur la pente des atterrisseurs (8°). Le calendrier traite les critères de
  relais comme la Terre seule, comme l'optimiseur quand il n'a pas d'orbite.
- **Dépendances :** `tifffile` et `imagecodecs` étaient épinglés sur des versions publiées 2 à
  3 jours plus tôt. Elles sont remplacées par `2026.10.15` et `2026.10.10`, publiées il y a
  un mois et compatibles avec Python 3.13.
- **Choix de la date :** la tolérance au retard était pleine dès 5 jours, et plusieurs
  fenêtres finissaient ex aequo à 100. Elle est maintenant pleine à 15 jours. Seule Malapert
  (05/10/2027) atteint 100 ; la crête obtient 98,5 à 99. La recommandation ne change pas.
- **Relais dans l'optimiseur :** il accepte maintenant les orbites décrites dans le repère
  lunaire (`bodyFixed`), ce qui permet d'y utiliser le modèle de Gateway. Vérifié : 100 %
  dans l'optimiseur comme dans le calcul par site.
- Mentions « membre 1 » retirées du code et du pied de page.
- **Vérifié dans le navigateur :** badge « JPL Horizons (DE440) », panneaux « Bilan » et
  « Choisir la date », relais LRO inchangé (53 %), aucune erreur dans la console.
