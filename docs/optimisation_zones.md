# Outil d'optimisation de zones

> La date d'atterrissage a glissé : **où se poser maintenant ?** L'outil évalue chaque point
> d'une région sur la période choisie, puis propose les meilleures zones selon un profil de
> mission.

## Fonctionnement

1. **Précalcul, une seule fois** (`scripts/build_horizon_maps.py`) : pour chaque pixel de
   200 m d'une région, on calcule la hauteur de l'horizon dans **72 directions** (tous les 5°).
   On stocke aussi l'altitude et la pente moyenne et maximale de la cellule, mesurées sur le
   relief à 20 m.
2. **Simulation sur la période** (navigateur, Web Worker `optim/optim.worker.ts`) : à chaque
   pas de temps, le Soleil et la Terre sont placés dans le ciel de chaque pixel, puis comparés
   à son horizon. Les règles sont les mêmes que pour un site isolé : Soleil visible si plus de
   la moitié de son disque dépasse l'horizon, Terre visible si son centre le dépasse. Le pas
   de temps est ajusté pour faire environ 360 étapes, soit 2 h pour un jour lunaire. La
   simulation est **valable pour n'importe quelle date future**, car le relief est fixe et
   les éphémérides sont calculées.
3. **Score et zones** (instantané, recalculé à chaque réglage) :
   - les pixels qui ne respectent pas les **contraintes** sont exclus ;
   - les autres reçoivent un **score** de 0 à 100, moyenne pondérée des critères normalisés ;
   - une **zone** est un groupe de pixels voisins dont le score est à moins de N points du
     meilleur (réglage « Tolérance »).
4. **Analyser** : un clic sur une zone, ou sur un point de la carte, lance le calcul fin
   (720 directions, relief 20 m) et ouvre le point comme site personnalisé. On peut ensuite
   l'ajouter au tableau comparatif.

## Critères (normalisés de 0 à 1)

| Critère | Mesure | Meilleur quand |
|---|---|---|
| Ensoleillement | % du temps au Soleil | élevé |
| Nuit courte | 1 − plus longue nuit / durée de la période | nuit courte |
| Flux solaire | flux moyen sur un panneau vertical orientable / 1 361 W/m² | élevé |
| Terre visible | % du temps avec la Terre visible | élevé |
| Coupure courte | 1 − plus longue coupure / durée de la période | coupure courte |
| Soleil + Terre | % du temps avec les deux à la fois | élevé |
| Proximité glace | 1 − distance à l'ombre permanente la plus proche / 10 km | proche |

**Contraintes :** pente moyenne de la cellule ≤ X°, plus longue nuit ≤ X h, Terre visible
≥ X %, Soleil ≥ X %.

## Profils prédéfinis

| Profil | Poids | Contraintes |
|---|---|---|
| Atterrisseur solaire | Soleil 3, Soleil + Terre 2, Terre 1, nuit courte 1 | pente ≤ 8° |
| Survie à la nuit | nuit courte 4, Soleil 2, flux 1 | pente ≤ 15° |
| Liaison directe Terre | Terre 3, coupure courte 2, Soleil + Terre 1 | pente ≤ 10°, Terre ≥ 60 % |
| Liaison avec relais | coupure totale courte 3, Terre ou relais 2, Soleil 2 | pente ≤ 10° |
| Science : glace d'eau | proximité glace 3, Soleil 2, Terre 1, nuit courte 1 | pente ≤ 10°, Soleil ≥ 30 %, ombre permanente ≤ 5 km |
| Personnalisé | tous les réglages sont libres | |

Les poids et les profils sont définis dans `app/src/optim/score.ts`. Ce fichier est fait pour
que le **membre 5** (aide à la décision) ajuste les critères sans toucher au reste.

## Régions précalculées

| Région | Emprise | Pixels | Taille (horizons) |
|---|---|---|---|
| Massif de Malapert | 50 × 50 km autour du sommet | 250 × 250 | 9 Mo |
| Mons Mouton (IM-2) | 50 × 50 km autour du site | 250 × 250 | 9 Mo |
| Pôle Sud (Shackleton, crête, de Gerlache) | 80 × 80 km centrés sur le pôle | 400 × 400 | 23 Mo |

Les fichiers sont dans `data/horizon_maps/` (non versionnés) et sont servis directement par
le serveur de l'application. Pour regénérer (~5 min par région de 250 × 250 pixels) :

```bash
.venv/Scripts/python scripts/build_horizon_maps.py
```

On peut aussi ne regénérer que certaines régions :

```bash
.venv/Scripts/python scripts/build_horizon_maps.py malapert pole
```

Une nouvelle région s'ajoute dans la liste `REGIONS` du script.

## Précision

**Cartes d'horizon**, comparées au calcul exact à 720 directions (12 pixels pris au hasard par
région, × 72 directions) :

| Région | Écart RMS | 95 % des écarts sous | Écart max |
|---|---|---|---|
| Malapert | 0,09° | 0,24° | 0,49° |
| Pôle Sud | 0,10° | 0,24° | 1,03° |
| Mons Mouton | 0,15° | 0,24° | 1,31° |

Les rares écarts d'environ 1° apparaissent probablement en terrain très accidenté, par
exemple au fond d'un cratère à côté de son rempart. Ils viennent de la simplification du
relief lointain : calcul sur une grille de 2 km, puis correction au premier ordre de
l'altitude du pixel. D'où la règle : **toujours confirmer une zone avec « Analyser »**.

**Temps de calcul dans le navigateur** pour un jour lunaire (360 pas de 2 h) :
- ~11 s pour Malapert et Mons Mouton (62 500 points) ;
- ~50 s pour le Pôle Sud (160 000 points).

**Dépistage puis calcul fin.** Le meilleur point trouvé pour le jour lunaire du 14/11/2026 sur
Malapert est situé à 85,965°S, 2,294°O : 100 % de Soleil et 100 % de Terre selon le dépistage.
Le calcul fin confirme exactement ces valeurs (100 % / 100 %, 1 352 W/m²). Sur la même période,
le sommet étudié jusqu'ici n'atteint que 89 % / 82 %.

## Exemples de résultats (région Malapert)

| Période | Profil | Meilleure zone |
|---|---|---|
| 14/11/2026, jour lunaire | Atterrisseur solaire | 85,965°S 2,294°O : Soleil 100 %, Terre 100 %, pente 3,9° |
| 14/11/2026 | Survie à la nuit | versant sud (86,04°S) : Soleil 100 %, mais Terre seulement 43 à 54 % |
| 10/03/2027 (hiver austral) | Atterrisseur solaire | 85,932°S 3,950°O : Soleil 56 %, nuits de 8 jours, Terre 100 % |
| 14/11/2026, région Pôle Sud | Atterrisseur solaire | rempart de de Gerlache (88,68°S 68,1°O) : Soleil 100 %, Terre 52 % ; autres zones près du rempart de Shackleton (89,78°S) |

Dans la région du pôle, les meilleures zones « Soleil » tombent sur les remparts de de
Gerlache et de Shackleton. La région candidate Artemis III « de Gerlache Rim 2 » se trouve
justement sur l'un d'eux. En revanche, la Terre n'y est visible qu'environ la moitié du temps.

On voit la même logique que dans l'énoncé : un petit déplacement, ou un changement de date,
transforme complètement la faisabilité d'une mission.

## Limites

- Les pixels font 200 m : le dépistage repère des zones, et le point exact doit être
  confirmé par « Analyser ».
- La pente est la moyenne de la cellule à 20 m : les rochers et cratères de moins de ~40 m
  ne sont pas vus.
- Seule la visibilité du centre de la Terre est prise en compte, pas la qualité du lien
  radio (distance, antenne).
- Les ombres permanentes sont calculées à partir des cartes d'horizon à 200 m : les très
  petits pièges froids (moins de quelques centaines de mètres) ne sont pas vus.

## Régions candidates officielles Artemis III

**Source :** la couche Moon Trek « Artemis III Candidate Landing Regions » (NASA, liste
d'**août 2022**, 13 régions), téléchargée en GeoJSON depuis le service ArcGIS de Moon Trek.
Elle est enregistrée dans `data/sites/artemis3_regions_2022.geojson`, avec sa source et une
note. Une coquille a été corrigée au passage : « Shakleton » devient « Shackleton ».

> En octobre 2024, la NASA a réduit la liste à 9 régions. Elle y a ajouté Mons Mouton,
> Mons Mouton Plateau, Peak near Cabeus B et Slater Plain, dont **les contours ne sont pas
> publiés** dans Moon Trek. L'application le signale quand un site est hors des contours de
> 2022, comme Mons Mouton.

**Dans l'application** (`app/src/astro/regions.ts`) :
- les polygones sont définis en latitude/longitude ; leurs côtés sont densifiés avant la
  projection polaire, pour garder leur vraie forme courbe ;
- **carte du pôle** : contours en pointillés cyan et noms des régions, avec une case pour les
  masquer ;
- **fiche du site** : région officielle qui contient le site, ou la plus proche avec sa
  distance ;
- **optimiseur** : contours sur la carte de chaleur, colonne « Région Artemis III » dans la
  liste des zones, et contrainte **« Seulement dans les régions Artemis III »**. Les régions
  sont rasterisées une seule fois sur la grille de la région, en testant uniquement les pixels
  de leur rectangle englobant.

**Recoupements :**

| Site ou zone | Région officielle |
|---|---|
| Crête de liaison (89,439°S 137,144°O) | **Connecting Ridge** |
| Sommet de Malapert (85,988°S 2,058°E) | **Malapert Massif** |
| Mons Mouton (IM-2) | hors des contours 2022, à 11,8 km de Leibnitz Beta Plateau ; région candidate dans la liste 2024 |
| IM-1 Odysseus | hors des régions, à 168 km de Malapert Massif |

**Optimiseur**, région Pôle Sud, 14/11/2026, profil Atterrisseur solaire :
- **sans contrainte**, 3 des 5 meilleures zones tombent déjà dans une région officielle :
  de Gerlache Rim (2 zones) et Peak Near Shackleton ;
- **avec la contrainte**, les 5 zones sont dans des régions officielles : de Gerlache Rim,
  Peak Near Shackleton et Connecting Ridge. Elles ont 99 à 100 % de Soleil et 48 à 52 % de
  Terre. Les régions couvrent 1 073 km² de la région Pôle Sud.

Notre méthode indépendante retrouve donc, d'elle-même, les zones retenues par la NASA.

## Zones d'ombre permanente (glace d'eau)

**Définition** (`scripts/build_psr.py`) : un point est en ombre permanente si le Soleil ne
dépasse **jamais** son horizon, à aucune date. Vue de la Lune, la déclinaison du Soleil ne
dépasse pas ±1,543°. Pour un site de l'hémisphère sud, le cas le plus favorable est donc
une latitude subsolaire de −1,543°. On balaie la longitude subsolaire sur 360° à cette
latitude. Si, dans toutes les directions, le bord supérieur du disque (+0,267°) reste sous
l'horizon, le point est en ombre permanente. Le calcul est géométrique : il est valable pour
toutes les dates, sans simulation dans le temps, et prend ~10 s pour les 3 régions.

```bash
.venv/Scripts/python scripts/build_psr.py
```

**Résultats :**

| Région | Surface en ombre permanente |
|---|---|
| Pôle Sud (80 × 80 km) | 1 121 km² (17,5 %) |
| Mons Mouton | 61,5 km² (2,5 %) |
| Malapert | 34,6 km² (1,4 %) |

| Site | Ombre permanente la plus proche |
|---|---|
| Malapert (sommet) | 0,7 km |
| Crête de liaison | 1,4 km |
| Mons Mouton | 2,2 km |

**Validation :**
- **Fond du cratère Shackleton** : 100 % en ombre permanente à ±3 km du centre. Même à la
  date la plus favorable, le Soleil reste 17,8° sous l'horizon.
- **Crête de liaison et pôle** : pas en ombre permanente (le Soleil peut monter jusqu'à
  +4,9° et +3,7° au-dessus de l'horizon), ce qui est cohérent avec leur réputation de points
  très éclairés.
- **Carte vs calcul exact** (720 directions) : **12 pixels sur 12 en accord**, dont 8 pris à
  la limite de l'ombre (marge < 1°).

**Dans l'outil :**
- couche **« Ombre permanente »** : zones d'ombre en bleu, distance de 0 à 10 km pour le
  reste. Ces zones apparaissent aussi en bleu sur toutes les couches ;
- critère **« Proximité glace »** : 1 sur place, 0 à 10 km ou plus ;
- contrainte **« Ombre perm. max »** : distance maximale à une ombre permanente ;
- profil **« Science : glace d'eau »** : proximité glace 3, Soleil 2, Terre 1, nuit courte 1,
  avec pente ≤ 10°, Soleil ≥ 30 % et ombre permanente à ≤ 5 km ;
- colonne **« Ombre perm. »** dans la liste des zones, et ligne « Ombre permanente la plus
  proche » dans la fiche des sites étudiés.

**Exemple :** région Pôle Sud, jour lunaire du 14/11/2026, profil Science. Les meilleures
zones sont **à 0,2–0,6 km d'une ombre permanente avec 97 à 100 % de Soleil**, sur le rempart
de de Gerlache (88,7°S, 68°O) et vers celui de Shackleton (89,4°S, 105°E). Le calcul fin du
point 88,705°S, 68,334°O confirme 100 % de Soleil et 50 % de Terre. Le résultat est jugé
« fragile », car une partie de la visibilité dépend de reliefs situés à plus de 100 km.

**À ne pas confondre :** une ombre permanente indique où la glace **peut** subsister (piège
froid). Elle ne garantit pas sa présence : il faudrait des données de spectrométrie
(LRO LEND, LAMP, M³). C'est une piste pour la suite.

## Relais LRO dans la recherche de zones

Deux critères s'ajoutent : **Terre ou relais** (part du temps avec la Terre, ou LRO au-dessus du
relief et à plus de 5°) et **Coupure totale courte** (plus longue période sans l'un ni
l'autre). Le profil **Liaison avec relais** les met en avant. Les calques « Terre ou relais % »
et « Coupure totale » s'affichent sur la carte. Deux colonnes s'ajoutent au tableau des zones.

**Calcul** (`app/src/optim/evaluate.ts`) :
- LRO tourne en moins de 2 h, donc on suit ses passages **toutes les 2 minutes**. Calculer
  chaque pixel à ce pas serait trop lent. Vu de 100 km d'altitude, la position de LRO change peu
  d'un kilomètre à l'autre : on la calcule sur une **grille d'un point par km**, soit un pixel
  sur 5.
- La visibilité de la Terre, elle, peut changer en 200 m sur un sommet : elle reste **calculée
  pixel par pixel**.
- Les deux sont combinées pixel par pixel. Pour chaque pas de l'évaluation principale, on garde
  le temps couvert par LRO et les durées sans LRO au début, au milieu et à la fin du pas. Les
  coupures totales sont ainsi mesurées à 2 min près.
- Ces critères n'existent que si l'orbite de LRO couvre la période (novembre 2026 à avril
  2027). Sinon, ils valent « Terre visible » et « Coupure courte ».

**Contrôle :** au sommet de Malapert, sur le jour lunaire du 14/11/2026, l'optimiseur donne
83,2 % de liaison et 1 h 50 de coupure totale maximale. Le calcul détaillé du site donne
83,4 % et 1 h 50. Durée : environ 9 s pour la région Malapert et 25 s pour la région du pôle.

**Résultat (pôle, 14/11/2026, profil « Liaison avec relais ») :** les meilleures zones sont sur
le bord de de Gerlache, dans la région Artemis III « de Gerlache Rim ». Elles ont 100 % de
Soleil, 52 % de Terre, et ne restent jamais plus de **1 h 50** sans liaison, contre 12,5 jours
avec la Terre seule.
