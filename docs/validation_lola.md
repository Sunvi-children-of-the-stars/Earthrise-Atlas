# Validation contre les cartes officielles d'éclairement LOLA

*14/11/2026. Troisième source indépendante, après JPL Horizons pour les éphémérides et
QuickMap pour les ombres à un instant donné.*

## Les cartes officielles

L'équipe LOLA de la NASA (Goddard Space Flight Center) publie des cartes d'éclairement du pôle
Sud, décrites par **Mazarico et al. (2011)** et calculées heure par heure sur un **cycle de
nutation complet de 18,6 ans**. Source : https://pgda.gsfc.nasa.gov/products/69.

| Fichier (85°S–90°S, 60 m/pixel) | Contenu | Taille |
|---|---|---|
| `LPSR_85S_060M_201608.TIF` | Ombres permanentes | 0,7 Mo |
| `AVGVISIB_85S_060M_201608.TIF` | Fraction moyenne du disque solaire visible | 34 Mo |
| `AVGVISIB_85S_060M_201608_EARTH.TIF` | Fraction moyenne du temps où la Terre est visible | 25 Mo |

Les fichiers sont dans `data/validation_lola/`, exclus de Git. Un même script les télécharge
et les compare.

## Méthode

1. `npm run validate-lola` (dossier `app/`) calcule, avec **le même code que l'application**,
   l'ensoleillement et la visibilité de la Terre moyens sur 18,6 ans :
   - pour chaque pixel des trois régions de l'optimiseur, soit 285 000 pixels de 200 m ;
   - pour chaque site, avec un horizon à 720 directions.
   Il utilise 2 400 instants répartis sur 18,6 ans.
2. `.venv/Scripts/python scripts/validate_lola.py` ramène les cartes officielles sur nos
   pixels de 200 m (moyenne des pixels de 60 m), puis compare.

Deux différences de définition sont à garder en tête :
- nos calculs sont faits pour un **capteur à 2 m** du sol, ceux de la NASA **au niveau du sol** ;
- pour la Terre, nous exigeons que son **centre** soit visible. La NASA compte la Terre visible
  dès qu'**un morceau** de son disque dépasse : voir plus bas.

## Résultats

### Ombres permanentes

| Région | Notre surface | Surface officielle | Recouvrement (IoU) | Pixels en accord |
|---|---|---|---|---|
| Pôle (Shackleton, crête, de Gerlache) | 1 121 km² | 1 110 km² | **0,93** | 98,8 % |
| Malapert | 34,6 km² | 35,5 km² | 0,80 | 99,7 % |
| Mons Mouton (partie couverte, 78 %) | 50,7 km² | 54,1 km² | 0,88 | 99,7 % |

Les surfaces concordent à **1 à 6 %** près. Les désaccords se limitent aux bords des zones
d'ombre, sur un pixel de 200 m.

### Ensoleillement moyen sur 18,6 ans

| Région | Biais | RMS | 95 % des écarts sous | Corrélation |
|---|---|---|---|---|
| Pôle | −1,0 pt | **2,5 pts** | 4,0 pts | **0,985** |
| Malapert | −1,3 pt | 2,1 pts | 3,9 pts | 0,992 |
| Mons Mouton | −0,5 pt | 2,5 pts | 4,3 pts | 0,984 |

Un point vaut 1 % du temps. L'accord est très bon. Le léger biais négatif pourrait venir de
notre horizon à 72 directions, moins fin, ou de la résolution de 200 m. Nous ne l'avons pas
isolé.

### Visibilité de la Terre : la définition

| Région | Biais (centre de la Terre) | RMS | Corrélation |
|---|---|---|---|
| Pôle | −2,5 pts | 4,5 pts | 0,988 |
| Malapert | −4,4 pts | 6,3 pts | 0,994 |
| Mons Mouton | −3,7 pts | 5,8 pts | 0,989 |

La corrélation est excellente, mais nous voyons systématiquement la Terre un peu moins souvent.
Le calcul aux sites avec plusieurs définitions en donne la raison :

| Site | Centre visible (notre règle) | Un morceau visible | Carte officielle (max à 60 m près) |
|---|---|---|---|
| Crête de liaison | 53,7 % | **58,3 %** | **58,2 %** |
| Mons Mouton | 81,0 % | **93,4 %** | **93,2 %** |

**La carte officielle compte la Terre visible dès que son bord supérieur dépasse le relief.**
Notre règle, le centre, est plus prudente. Elle convient mieux à une antenne qui vise le centre
de la Terre. L'écart vient donc de la définition, pas d'une erreur.

### Aux sites : l'éclairement change d'un mètre à l'autre

| Site | Nous (capteur à 2 m) | Officiel au même point | Officiel, maximum à moins de 240 m |
|---|---|---|---|
| Crête de liaison | 87,7 % | 57,0 % | **86,4 %** |
| Malapert | 67,3 % | 56,8 % | **70,4 %** |
| Mons Mouton | 45,1 % | 46,0 % | 47,0 % |

Nos sites sont placés **au sommet le plus haut**, repéré sur le relief à 20 m. Sur une crête,
l'ensoleillement chute de 30 points en 200 m. Le pixel officiel de 60 m qui contient le site
mélange le sommet et ses flancs, alors que son maximum local correspond à notre sommet. Le plus
grand ensoleillement de toute la carte officielle est 88,4 %, contre 87,7 % pour notre crête.

## La courbure lunaire : le cas QuickMap du 24/11 est tranché

Le désaccord restant avec QuickMap (crête, 24/11/2026, voir
[validation_quickmap.md](validation_quickmap.md)) ne s'expliquait qu'en **supprimant la
courbure** de la Lune. Les cartes officielles permettent de trancher.

`scripts/validate_curvature.py` tire 80 points au hasard autour du pôle, à ±40 km. Il calcule
leur ensoleillement sur 18,6 ans avec deux horizons, l'un avec courbure, l'autre sans, puis
compare à la carte officielle :

| Horizon | Biais | RMS | Corrélation |
|---|---|---|---|
| **Avec courbure (notre méthode)** | −1,7 pt | **3,1 pts** | **0,968** |
| Sans courbure | −9,9 pts | 11,0 pts | 0,873 |

**La NASA tient compte de la courbure, comme nous.** Sans courbure, les reliefs lointains
paraissent plus hauts et volent environ 10 points d'ensoleillement : c'est très loin de la
carte officielle. Le 24/11, notre prédiction (« éclairé ») est donc la plus probable, et
l'écart vient de la façon dont QuickMap traite le relief très lointain. L'application marque
toujours ces cas « à confirmer » : obstacle à plus de 100 km et marge inférieure à 2,5°.

## Bilan

| Contrôle | Résultat |
|---|---|
| Éphémérides (Horizons) | ≤ 0,003° avec la table du membre 1 |
| Ombres à un instant (QuickMap) | 4 accords, 1 écart expliqué (sol ou capteur), 1 écart tranché en notre faveur (courbure) |
| Ombres permanentes (LOLA) | Surfaces à 1–6 % près, IoU 0,80 à 0,93 |
| Ensoleillement moyen (LOLA) | RMS 2,1 à 2,5 points, corrélation ≥ 0,98 |
| Terre visible (LOLA) | Corrélation ≥ 0,99. Écart dû à la définition (centre ou bord) |
