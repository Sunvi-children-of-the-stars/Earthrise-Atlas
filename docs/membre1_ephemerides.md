# Membre 1 — Éphémérides JPL Horizons

> Question : *où sont le Soleil et la Terre dans le ciel d'un site, à une date donnée ?*

## Ce qui a été fait

Au lieu de faire une requête Horizons par site, on télécharge **une seule table** : la position
du Soleil et de la Terre vus du **centre de la Lune**. L'application en déduit l'élévation et
l'azimut pour n'importe quel point de la surface, y compris un site personnalisé. Pour cela, elle
applique la rotation de la Lune (modèle IAU) et la parallaxe du site.

```bash
.venv/Scripts/python scripts/fetch_ephemeris.py --start 2026-01-01 --years 5 --step 1h
```

| Paramètre Horizons | Valeur |
|---|---|
| Mode | `EPHEM_TYPE='VECTORS'` |
| Centre | `CENTER='500@301'` (centre de la Lune) |
| Repère | `REF_SYSTEM='ICRF'`, `REF_PLANE='FRAME'` |
| Corrections | `VEC_CORR='LT+S'`, soit les directions **apparentes** (temps de lumière + aberration), comme `APPARENT='AIRLESS'` en mode observateur |
| Objets | Soleil (`10`) et Terre (`399`) |
| Période et pas | 01/01/2026 → 01/01/2031, une heure, soit 43 825 points (1 Mo) |

Sortie : `data/ephemeris/sun_earth_2026-01-01_5y.f32`, plus son `.json`. Les dates Horizons
sont en TDB, que l'application convertit en UTC (TDB ≈ UTC + 69,2 s).

**Dans l'application** (`app/src/astro/ephemeris.ts`) :
- l'application charge la table au démarrage (`loadEphemerisTable`), puis interpole entre
  deux heures. L'erreur d'interpolation est inférieure à 0,001° ;
- en dehors de 2026–2030, elle revient aux séries intégrées de l'*Astronomical Almanac* ;
- le badge en haut à droite indique la source utilisée pour la période affichée.
  L'optimiseur reçoit la même table dans son Web Worker.

La table donne aussi les **distances**, qu'utilise le membre 4 :
- Lune–Soleil : de 0,981 à 1,019 UA. Le flux solaire varie donc de 1 311 à 1 415 W/m², au
  lieu de 1 361 W/m² fixe ;
- Lune–Terre : de 356 653 à 406 677 km, pour le bilan de liaison radio.

## Le calcul intégré suffisait-il ?

Le script `npm run validate-ephemeris` (dossier `app/`) compare les deux méthodes à Horizons
en mode observateur (élévation et azimut topocentriques), un point toutes les 12 h du
01/11/2026 au 31/12/2028, soit 1 583 points par site et par astre.

**1. Écart d'élévation avec Horizons**

| Site | Astre | Séries intégrées : RMS / max | Table Horizons : RMS / max |
|---|---|---|---|
| Crête de liaison | Soleil | 0,002° / 0,005° | 0,001° / 0,002° |
| Crête de liaison | Terre | 0,061° / **0,188°** | 0,001° / 0,003° |
| Malapert | Soleil | 0,002° / 0,005° | 0,001° / 0,002° |
| Malapert | Terre | 0,061° / **0,184°** | 0,001° / 0,003° |
| Mons Mouton | Soleil | 0,002° / 0,005° | 0,001° / 0,002° |
| Mons Mouton | Terre | 0,059° / **0,172°** | 0,001° / 0,003° |

L'erreur des séries sur la Terre vient de la position de la Lune autour de la Terre, dont la
précision est d'environ 0,3° en longitude. Le Soleil était déjà très bon.

**2. Effet sur les résultats** : 12 mois lunaires à partir du 01/11/2026, au pas de 10 min,
sur les vrais horizons.

| Site | % Soleil | % Terre | Lever/coucher du Soleil décalé de | Lever/coucher de la Terre décalé de |
|---|---|---|---|---|
| Crête de liaison | 88,25 → 88,28 | 51,79 → 51,77 | médiane 0 h, max 0,5 h | médiane **1 h**, max **2,5 h** |
| Malapert | 67,89 → 67,87 | 80,26 → 80,22 | médiane 0 h, max 0,8 h | médiane **1,2 h**, max **2,2 h** |
| Mons Mouton | 45,18 → 45,18 | 80,82 → 80,80 | médiane 0 h, max 0,2 h | médiane **1,2 h**, max **2,2 h** |

**Conclusion :**
- **Pour comparer des sites et des dates, le calcul intégré suffisait.** Les pourcentages, les
  plus longues nuits et les coupures changent de moins de 0,05 point ou de quelques heures sur
  des périodes de plusieurs jours.
- **Pour les horaires de la Terre, il ne suffisait pas.** À cause de la libration, la Terre
  monte et descend lentement, d'environ 0,06° par heure au plus. Une erreur de 0,18° décale
  donc son lever ou son coucher de 1 h en moyenne, et jusqu'à 2,5 h. C'est trop pour planifier
  une fenêtre de communication.
- **Avec la table Horizons, l'écart tombe à 0,003°**, soit environ 1 min sur les horaires.
  C'est la méthode active par défaut de 2026 à 2030.

## Pour aller plus loin

- Prolonger la table : `--years 10` (2 Mo).
- `data/ephemeris/index.json` liste les tables, et l'application charge la première.
- Les relais (LRO) ont leur propre script : `scripts/fetch_relay_ephemeris.py`.
