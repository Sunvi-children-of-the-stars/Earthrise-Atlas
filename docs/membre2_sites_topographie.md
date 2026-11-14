# Membre 2 — Sites candidats et caractéristiques topographiques

> Question : *à quoi ressemble le terrain des emplacements que nous voulons étudier ?*

## 1. Données utilisées

| Donnée | Source | Usage |
|---|---|---|
| MNT LOLA `LDEM_85S_20M` (20 m/px, du pôle Sud à 85°S, 460 Mo) | [PDS Geosciences Node](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/) | position des sommets et crêtes, altitude, pentes fines, relief proche des horizons (< 25 km) |
| MNT LOLA `LDEM_75S_120M` (120 m/px, du pôle Sud à 75°S, ~116 Mo) | PDS (même dossier) | relief lointain des horizons (> 25 km), sites entre 75°S et 85°S, statistiques à 1–20 km |
| Coordonnées publiées des atterrissages | NASA / LROC / USGS (liens dans `sites.json` → `refs`) | sites de référence |
| Régions candidates Artemis III | NASA (listes 2022 et 2024) | choix des sites candidats |

Les altitudes sont données par rapport à la sphère de référence de 1 737,4 km.
Contrôle : le MNT donne **2 592 m** au site d'IM-1 ; la NASA publie 2 579 m.

QuickMap et Moon Trek ont servi à explorer visuellement les régions. Toutes les valeurs
chiffrées sont recalculées à partir du MNT par `scripts/build_sites.py`, ce qui rend le
résultat reproductible.

## 2. Les trois sites candidats

| | Crête de liaison | Massif de Malapert | Mons Mouton (IM-2) |
|---|---|---|---|
| Coordonnées | 89,4390°S, 137,1440°O | 85,9880°S, 2,0577°E | 84,7906°S, 29,1957°E |
| Distance au pôle | 17 km | 122 km | 158 km |
| Altitude (20 m) | 1 959 m | 5 173 m | 5 322 m |
| Pente à 20 m : locale / moyenne 100 m / max 500 m | 1,0° / 3,0° / 18,8° | 1,6° / 2,4° / 29,4° | 2,3° / 2,8° / 15,0° |
| Surface > 10° dans un rayon de 500 m | 8,7 % | 6,2 % | 0,3 % |
| Pente moyenne 1 km (120 m) | 8,1° | 6,0° | 3,1° |
| Horizon le plus haut | −0,59° | −0,07° | **+4,07°** (az 117°, sommet de Mons Mouton à 16,5 km) |
| Soleil max (pré-indicateur) | 2,1° | 5,6° | 6,8° |
| Éclairement*, avec relief / sol lisse | **88 %** / 54 % | 66 % / 50 % | 44 % / 49 % |
| Terre visible*, avec relief / sol lisse | 52 % / 46 % | **80 %** / 69 % | **81 %** / 73 % |
| Direction de la Terre | az 129–145° | az 350–6° (nord) | az 322–339° (nord-ouest) |

Les points de la crête et de Malapert sont recalés sur le relief à 20 m : le sommet le plus
haut dans le même rayon de recherche qu'avant. La crête se déplace de 131 m et Malapert de
15 m. Les anciens points à 120 m restent dans `sites.json` (`previous_point_120m`).

\* Pré-indicateurs calculés avec un modèle orbital **simplifié**, uniquement pour valider
les masques. Les valeurs de référence viendront des éphémérides JPL Horizons (membre 1)
et de l'analyse du membre 4.

**À retenir**
- **Crête de liaison** : le meilleur éclairement (le Soleil rase l'horizon sans être caché),
  mais la Terre n'y est visible qu'environ la moitié du temps, parce que la libration la fait
  passer sous l'horizon. Pour ce site, un relais de communication est à prévoir.
- **Malapert** : un sommet qui domine tout son environnement (aucun relief au-dessus de
  l'horizontale). Il est tourné vers la Terre, ce qui en fait le meilleur compromis entre
  énergie et communication directe.
- **Mons Mouton** : un plateau large et peu pentu, favorable à l'atterrissage. En revanche,
  le sommet voisin masque le Soleil sur tout le secteur est–sud (63°–240°). Résultat :
  l'éclairement est *inférieur* à celui d'un sol lisse, alors que la Terre reste bien visible.

## 3. Sites de référence (comparaison, pédagogie)

IM-1 Odysseus (cratère dégradé, pente de 12°, horizon à +11° : un contre-exemple),
Chandrayaan-3, Chang'e-6 (face cachée, Terre jamais visible) et Apollo 11 (équateur).
Les trois derniers se trouvent hors de l'emprise du MNT polaire : leur horizon est
modélisé par un sol lisse.

## 4. Fichiers livrés

| Fichier | Contenu |
|---|---|
| `data/sites/sites.json` | base complète : coordonnées, méthode, terrain, horizon, obstacles, secteurs, pré-indicateurs |
| `data/sites/sites_summary.csv` | tableau récapitulatif (séparateur `;`, s'ouvre dans Excel) |
| `data/horizons/<id>.csv` | masque d'horizon tous les 0,5° : élévation, distance, position et altitude de l'obstacle |
| `data/horizons/<id>.json` | même masque, format compact pour l'application React |
| `data/dem/preview/south_pole_dem_1200m.*` | MNT réduit à 1,2 km/px (int16) et ses métadonnées, pour la carte de l'application |

Conventions : latitude négative = sud ; longitude Est dans [−180, 180] ; azimut en degrés
depuis le nord local, dans le sens horaire ; capteur placé à 2 m au-dessus du sol.

### Champs clés de `sites.json`
- `obstacles` : secteurs où le relief dépasse +0,5° au-dessus de l'horizontale, avec la part
  du temps où ce relief cache le Soleil (`sun_blocked_pct_time`) ou la Terre
  (`earth_blocked_pct_time`) alors qu'ils seraient visibles sur un sol lisse.
- `horizon_sectors` : 12 secteurs de 30° donnant l'obstacle dominant, la part du temps où le
  Soleil ou la Terre se trouvent dans le secteur, et la part du temps où ils y sont cachés.

## 5. Pour les autres membres

- **Membre 1 (JPL Horizons)** : utiliser `lat`, `lon` et `elevation_m` de `sites.json`.
  Dans Horizons : `CENTER='coord@301'`, `COORD_TYPE='GEODETIC'`,
  `SITE_COORD='<lon>,<lat>,<alt_km>'` (longitude Est en premier, altitude en km).
- **Membres 1 et 4** : l'astre est visible quand son élévation dépasse l'élévation de l'horizon
  à son azimut. Il suffit d'interpoler `data/horizons/<id>.csv` sur l'azimut fourni par Horizons.
- **Membre 3 (React)** : `sites.json`, `horizons/<id>.json` (diagramme polaire de l'horizon)
  et l'aperçu du MNT pour la carte.

## 6. Limites connues

- Les horizons sont multi-résolution : relief proche (< 25 km) à 20 m, relief lointain à
  120 m (voir [pyramide_tuiles.md](pyramide_tuiles.md)). Les sites situés entre 75°S et 85°S,
  comme IM-1, restent à 120 m, faute de MNT à 20 m téléchargé pour cette zone
  (`LDEM_80S_20M`, 1,85 Go).
- Les rochers et les cratères de moins de ~40 m ne sont pas résolus, même à 20 m.
- Validation contre les ombres QuickMap à 20 m : 4 accords, 1 cas qui relève d'une
  définition différente (éclairement du sol, et non d'un capteur à 2 m) et 1 cas ouvert
  (question de courbure). Détails dans [validation_quickmap.md](validation_quickmap.md).
- Le Soleil est traité comme un point. Son disque mesure 0,53° : il peut donc être
  partiellement visible quand son centre est juste sous l'horizon.
- Les points « crête » et « sommet » sont les plus hauts du MNT dans un rayon donné. Ce sont
  des points d'étude, pas des sites certifiés par la NASA.
