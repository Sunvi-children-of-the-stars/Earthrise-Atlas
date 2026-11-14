# Décision : source des éphémérides

**Décision (14/11/2026) : les positions du Soleil et de la Terre viennent du calcul intégré à
l'application (`app/src/astro/ephemeris.ts`). Aucun fichier d'éphémérides externe n'est
nécessaire au fonctionnement de l'outil.** JPL Horizons sert de **référence de validation**,
pas de source de données.

## Pourquoi

| Critère | Calcul intégré | Fichiers JPL Horizons précalculés |
|---|---|---|
| Précision (élévation) | Soleil ≤ 0,012°, Terre ≤ 0,18° près du pôle (RMS ≈ 0,06°) | référence |
| Sites personnalisés | ✅ n'importe quel point, instantanément | ❌ une requête Horizons par site |
| Dates | ✅ n'importe quelle date | ❌ seulement les périodes téléchargées |
| Optimiseur (160 000 pixels) | ✅ | ❌ impossible pixel par pixel |
| Hors ligne, version en ligne | ✅ aucun téléchargement | ❌ des Mo de fichiers par site |

Les écarts mesurés sont **3 à 10 fois plus petits** que le diamètre apparent du Soleil (0,53°)
et de la Terre (1,9°). Ils restent aussi sous la « zone grise » de ±0,5° que l'application
signale déjà comme résultat fragile. Pour comparer des sites et des dates, ce qui est le
but de l'outil, des fichiers Horizons n'apporteraient rien de visible. En revanche, ils
priveraient l'outil des sites personnalisés et de l'optimiseur.

## Ce que fait le modèle intégré

- Soleil et Lune géocentriques : séries basse précision de l'*Astronomical Almanac*.
- Orientation de la Lune : modèle IAU (Archinal et al. 2011), dans le repère « mean Earth »
  de LOLA. Les **librations** de la Lune (le « balancement » vu de la Terre) sont donc incluses.
- Parallaxe topocentrique : jusqu'à 0,26° pour la Terre.
- Pas de réfraction, puisque la Lune n'a pas d'atmosphère. L'horizon est celui du relief et
  de la courbure lunaire.

## Validation contre JPL Horizons

Année 2026, un point par jour, `APPARENT='AIRLESS'` :

| Site | Soleil : écart max | Terre : écart RMS | Terre : écart max |
|---|---|---|---|
| Crête de liaison | 0,005° | 0,057° | 0,18° |
| Malapert | 0,005° | 0,056° | 0,18° |
| Mons Mouton | 0,005° | 0,056° | 0,17° |
| Apollo 11 | 0,012° | 0,093° | 0,35° |

Le même modèle d'orientation sert au relais LRO, dont les positions viennent, elles, de
Horizons. Écart validé : ≤ 0,05° en élévation (voir `membre3_application.md`).

## Rôle du dossier `data/ephemeris/`

Il est réservé aux **fichiers de référence de validation** (`data/ephemeris/reference/`),
produits par un script de validation reproductible qui interroge Horizons et compare les
résultats au calcul intégré. Format :

```json
{ "site_id": "malapert-massif", "step_min": 1440,
  "t_utc": ["2026-01-01T00:00Z", "..."],
  "sun":   { "az_deg": [ ], "elev_deg": [ ] },
  "earth": { "az_deg": [ ], "elev_deg": [ ] } }
```

L'application ne lit pas ces fichiers.

## Limite assumée

Pour des **horaires définitifs à la minute près** (planification opérationnelle d'une vraie
mission), il faut repasser par JPL Horizons. L'outil sert à comparer et à présélectionner ;
il ne remplace pas la planification de vol.
