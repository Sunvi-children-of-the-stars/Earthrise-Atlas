# Lunar South Pole Planner

Outil de comparaison rapide de sites et de dates d'atterrissage au pôle Sud lunaire :
positions du Soleil et de la Terre par rapport à l'horizon, potentiel énergétique et
fenêtres de communication directe avec la Terre (défi NASA Space Apps).

## Structure

```
data/
  dem/          MNT LOLA (téléchargé, non versionné) + preview/ (carte réduite pour l'app)
  sites/        sites.json, sites_summary.csv        ← membre 2
  horizons/     masques d'horizon par site (CSV + JSON) ← membre 2
  ephemeris/    Soleil et Terre vus de la Lune (JPL Horizons) ← membre 1
  relays/       orbite du relais LRO (JPL Horizons)
  validation_lola/  cartes officielles LOLA et comparaison (non versionnées)
docs/           notes de chaque membre
scripts/        traitements Python
app/            application web React                  ← membre 3
```

## Régénérer les données topographiques (membre 2)

```bash
python -m venv .venv
```
```bash
.venv/Scripts/python -m pip install -r requirements.txt
```
```bash
.venv/Scripts/python scripts/build_sites.py
```

Au premier lancement, le script télécharge le MNT LOLA (~116 Mo) depuis le PDS.
Méthode, résultats et limites : [docs/membre2_sites_topographie.md](docs/membre2_sites_topographie.md).

## Lancer l'application (membre 3)

```bash
cd app
```
```bash
npm install
```
```bash
npm run dev
```

Puis ouvrir http://localhost:5173. Détails : [docs/membre3_application.md](docs/membre3_application.md).

## Ordre complet des traitements (données)

1. `scripts/build_tiles.py` : pyramide de relief 20 m → 960 m (calcul à la demande dans l'application)
2. `scripts/build_sites.py` : base des sites et masques d'horizon précalculés
3. `scripts/build_horizon_maps.py` : cartes d'horizon des régions (outil d'optimisation, ~20 min)
4. `scripts/build_psr.py` : zones d'ombre permanente et distance des sites aux ombres (~10 s)
5. `scripts/fetch_relay_ephemeris.py` : orbite du relais LRO depuis JPL Horizons (~2 min pour 6 mois)
6. `scripts/fetch_ephemeris.py` : Soleil et Terre vus du centre de la Lune, JPL Horizons 2026–2030 (~30 s) — membre 1

## Validations

| Commande | Contrôle | Résultat |
|---|---|---|
| `npm run validate-ephemeris` (dans `app/`) | Éphémérides vs JPL Horizons | ≤ 0,003° ([membre1_ephemerides.md](docs/membre1_ephemerides.md)) |
| `npm run validate-lola` puis `.venv/Scripts/python scripts/validate_lola.py` | Ombres permanentes et éclairement moyen vs cartes officielles LOLA | IoU 0,80–0,93, RMS 2,5 pts ([validation_lola.md](docs/validation_lola.md)) |
| `.venv/Scripts/python scripts/validate_curvature.py` | Courbure lunaire : avec ou sans | avec courbure RMS 3,1 pts, sans 11 pts |
| `npm run mission-report` (dans `app/`) | Bilan énergie et télécom, meilleures dates (membres 4 et 5) | [membre4](docs/membre4_energie_telecom.md), [membre5](docs/membre5_decision.md) |

Les cartes officielles LOLA (60 Mo) se téléchargent depuis https://pgda.gsfc.nasa.gov/products/69
dans `data/validation_lola/` (voir l'en-tête de `scripts/validate_lola.py`). Il faut aussi
`tifffile` et `imagecodecs` dans l'environnement Python.

Chaque script se lance avec `.venv/Scripts/python scripts/<nom>.py`. Les MNT LOLA manquants
sont téléchargés automatiquement.
