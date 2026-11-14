# Pyramide de tuiles du relief polaire sud

Base commune aux deux méthodes de calcul d'horizon :
- le **précalcul** des sites sélectionnés, en Python ;
- le **calcul à la demande** des sites personnalisés, dans le navigateur.

## Sources (NASA PDS, LRO LOLA)

| Fichier | Zone couverte | Résolution | Taille |
|---|---|---|---|
| `LDEM_80S_20M` | de 80°S au pôle (carré de ~608 km) | 20 m | 1,85 Go |
| `LDEM_85S_20M` | de 85°S au pôle (carré de ~303 km) | 20 m | 460 Mo |
| `LDEM_75S_120M` | de 75°S au pôle (carré de ~915 km) | 120 m | 116 Mo |

Les deux fichiers utilisent le même format : entiers 16 bits en unités de 0,5 m, altitude
mesurée par rapport à une sphère de 1 737,4 km. Ils ne sont pas versionnés.
`scripts/build_tiles.py` les télécharge s'ils manquent.

**Depuis le 14/11/2026, le niveau 20 m vient de `LDEM_80S_20M`** quand ce fichier est présent
dans `data/dem/` (sinon `LDEM_85S_20M`, comme avant). Sur leur zone commune, les deux fichiers
sont identiques : écart RMS de 0,05 m, maximum 0,5 m (une unité de quantification), mesuré
sur 2 000 points. Le relief à 20 m couvre donc maintenant IM-1 (80,1°S), Mons Mouton, Nobile
et Amundsen. `build_tiles.py`, `tiled_dem.py` (classe `Raster`), `build_sites.py` et
`build_horizon_maps.py` choisissent automatiquement le fichier le plus étendu.

## Niveaux

| Niveau | Source | Tuiles | Taille |
|---|---|---|---|
| 20 m | 80S_20M | 14 400 | 1,8 Go |
| 40 m | 80S_20M, moyenne 2×2 | 3 600 | 450 Mo |
| 80 m | 80S_20M, moyenne 4×4 | 900 | 113 Mo |
| 120 m | 75S_120M | 900 | 113 Mo |
| 240 m | 75S_120M, moyenne 2×2 | 256 | 33 Mo |
| 480 m | 75S_120M, moyenne 4×4 | 64 | 8 Mo |
| 960 m | 75S_120M, moyenne 8×8 | 16 | 2 Mo |

La pyramide totalise environ 2,5 Go dans `data/dem/tiles/` (non versionné ; ~750 Mo avec
LDEM_85S_20M seul). La moyenne 2×2 est calculée par bandes de lignes, ce qui borne la mémoire. Pour la regénérer :

```bash
.venv/Scripts/python scripts/build_tiles.py
```

## Format

**Projection :** stéréographique polaire sud, sphère R = 1 737 400 m, **origine au pôle**.
- x = 2R·tan(45° + lat/2)·sin(lon)
- y = 2R·tan(45° + lat/2)·cos(lon), avec la longitude 0° (face visible) vers le haut

**Grille**, pour une résolution s :
- la colonne `i` couvre x ∈ [i·s, (i+1)·s[ ;
- la ligne `r` couvre y ∈ ]−(r+1)·s, −r·s] (les lignes descendent).

Comme tous les niveaux partagent la même origine, ils sont alignés : le pixel `i` au niveau
2s regroupe exactement les pixels `2i` et `2i+1` du niveau s.

**Tuiles :**
- 256 × 256 pixels, nommées `tiles/{res}m/{ty}_{tx}.i16` ;
- elles couvrent les colonnes `tx·256 … tx·256+255` et les lignes `ty·256 … ty·256+255` ;
- `tx` et `ty` peuvent être négatifs ;
- valeurs en `int16` little-endian : altitude (m) = valeur × 0,5, et −32768 = pas de donnée.

`manifest.json` décrit les niveaux et leurs plages de tuiles. Le lecteur Python est
`scripts/tiled_dem.py` (classe `TiledDEM`).

## Validation

| Test | Résultat |
|---|---|
| Tuiles vs fichiers sources (2 000 points tirés au hasard par source) | écart **0 m** |
| Alignement 20 m ↔ 120 m (20 m moyenné par blocs 6×6, comparé au 120 m) | RMS **1,2 m** sans décalage, ~17 m avec un décalage d'un pixel : alignement exact |
| Altitude aux sites, de 20 m à 960 m | cohérente : crête 1 957 → 1 894 m, Malapert 5 174 → 5 141 m, Mons Mouton 5 322 → 5 316 m |

Le niveau le plus fin disponible est 20 m pour les trois sites candidats, et 120 m pour IM-1
(80,1°S).

## Utilisation pour l'horizon

**Précalcul Python** (sites sélectionnés, `scripts/build_sites.py`) : il lit directement les
fichiers source, plus rapides en Python que les tuiles. Le relief à moins de 25 km est lu à
20 m, au-delà à 120 m.

**Calcul à la demande** (sites personnalisés, `app/src/astro/horizonTiled.ts`, dans un Web
Worker) : il lit les tuiles. Chaque bande de distance a son niveau ; si un niveau manque à
un endroit, on passe au niveau plus grossier suivant.

| Distance au site | Niveaux, du préféré au repli | Pas |
|---|---|---|
| 40 m – 5 km | 20 → 40 → 80 → 120 m | 20 m |
| 5 – 25 km | 80 → 120 m | 80 m |
| 25 – 100 km | 240 m | 240 m |
| 100 – 300 km | 480 m | 480 m |

Un calcul charge environ 85 tuiles (~11 Mo) et prend 0,5 à 2 s. Le serveur Vite sert les
tuiles sous `data/tiles/` (plugin `dem-tiles` dans `app/vite.config.ts`), sans les copier dans
`public/`. `npm run build` les copie dans `dist/data/tiles/` ; `NO_TILES=1` désactive cette
copie.

**Validation** : même code, exécuté sous Node et comparé au précalcul Python.

| Site | Écart d'horizon RMS | Écart max |
|---|---|---|
| Crête de liaison | 0,003° | 0,013° |
| Malapert | 0,002° | 0,016° |
| Mons Mouton | 0,005° | 0,042° |
| IM-1 (120 m seulement) | 0,053° | 0,17° |

Dans l'application, un site personnalisé placé exactement sur le sommet de Malapert donne
les mêmes indicateurs que le site précalculé : 89 % de Soleil, 82 % de Terre et 1 205 W/m²
sur le jour lunaire du 14/11/2026.
