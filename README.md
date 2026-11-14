# Earthrise Atlas (Lunar South Pole Planner)

Outil de comparaison rapide de sites et de dates d'atterrissage au pôle Sud lunaire :
positions du Soleil et de la Terre par rapport à l'horizon, potentiel énergétique et
fenêtres de communication directe avec la Terre (défi NASA Space Apps).

## Structure

```
data/
  dem/          MNT LOLA (téléchargé, non versionné) + preview/ (carte réduite pour l'app)
  sites/        sites.json, sites_summary.csv        ← membre 2
  horizons/     masques d'horizon par site (CSV + JSON) ← membre 2
  ephemeris/    Soleil et Terre vus de la Lune (JPL Horizons, 2026 à 2030), source officielle
  relays/       orbite du relais LRO (JPL Horizons) et orbites modèles (Gateway, Queqiao-2)
  calendar/     calendrier site × mois lunaire
  lroc/         fond d'image LROC du pôle Sud
  diviner/      températures Diviner (non versionné)
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

Puis ouvrir http://localhost:5173 : c'est le site public **Earthrise Atlas** (Story, Atlas, Play,
Mission Lab, Method). Détails : [docs/site_public.md](docs/site_public.md).

Tests automatiques des calculs (50 tests, ~2 s), dans `app/` :

```bash
npm test
```
 Détails : [docs/membre3_application.md](docs/membre3_application.md).

## Ordre complet des traitements (données)

1. `scripts/build_tiles.py` : pyramide de relief 20 m → 960 m (calcul à la demande dans
   l'application). Le relief à 20 m va jusqu'à 80°S si `LDEM_80S_20M` (1,85 Go) est dans
   `data/dem/`, sinon jusqu'à 85°S.
2. `scripts/build_sites.py` : base des sites et masques d'horizon précalculés.
3. `scripts/build_horizon_maps.py` : cartes d'horizon des 9 régions de l'optimiseur. En
   local, ~1 h ; sur Modal, ~2 min, voir plus bas.
4. `scripts/build_psr.py` : zones d'ombre permanente et distance des sites aux ombres (~10 s).
5. `scripts/build_diviner.py` : températures et profondeur de la glace (Diviner) sur les
   régions et aux sites (~1 min ; télécharge 605 Mo la première fois).
6. `scripts/fetch_ephemeris.py` : Soleil et Terre vus du centre de la Lune, JPL Horizons
   2026 à 2030 (~30 s). C'est la source officielle des éphémérides.
7. `scripts/fetch_relay_ephemeris.py` : orbite du relais LRO depuis JPL Horizons (~2 min pour
   6 mois).
8. `scripts/build_relay_models.py` : orbites modèles de Gateway (NRHO) et Queqiao-2.
9. `cd app && npm run calendar` : calendrier site × mois lunaire (`data/calendar/`).

## Validations

| Commande | Contrôle | Résultat |
|---|---|---|
| `npm run validate-ephemeris` (dans `app/`) | Éphémérides vs JPL Horizons | ≤ 0,003° ([membre1_ephemerides.md](docs/membre1_ephemerides.md)) |
| `npm run validate-lola` puis `.venv/Scripts/python scripts/validate_lola.py` | Ombres permanentes et éclairement moyen vs cartes officielles LOLA | IoU 0,80–0,93, RMS 2,5 pts ([validation_lola.md](docs/validation_lola.md)) |
| `.venv/Scripts/python scripts/validate_curvature.py` | Courbure lunaire : avec ou sans | avec courbure RMS 3,1 pts, sans 11 pts |
| `npm run mission-report` (dans `app/`) | Bilan énergie et télécom, meilleures dates  | [membre4](docs/membre4_energie_telecom.md), [membre5](docs/membre5_decision.md) |

Les cartes officielles LOLA (60 Mo) se téléchargent depuis https://pgda.gsfc.nasa.gov/products/69
dans `data/validation_lola/` (voir l'en-tête de `scripts/validate_lola.py`). Il faut aussi
`tifffile` et `imagecodecs` dans l'environnement Python.

Chaque script Python se lance avec `.venv/Scripts/python scripts/<nom>.py`. Utiliser
Python ≥ 3.11 pour créer le venv, car numpy 2.5 le demande :

```bash
py -3.13 -m venv .venv
```

Les MNT LOLA manquants sont téléchargés automatiquement. Sous Windows, si Python refuse le
certificat du serveur de la NASA (`CERTIFICATE_VERIFY_FAILED`), télécharger le fichier avec
le `curl.exe` de Windows dans `data/dem/`, puis relancer le script.

### Calculs lourds sur Modal

Il faut un compte Modal configuré (`modal setup`).

```bash
modal run scripts/modal_horizon_maps.py                        # cartes d'horizon, une région par conteneur
.venv/Scripts/python scripts/build_horizon_maps.py --index      # puis, en local :
.venv/Scripts/python scripts/build_psr.py
.venv/Scripts/python scripts/build_diviner.py
modal run scripts/modal_lroc.py                                 # fond d'image LROC (1,39 Go traités dans le cloud)
```

## Mise en ligne

```bash
cd app
npm run build:web
npx netlify-cli deploy --dir=dist --prod
```

La première commande produit une version sans la pyramide de tuiles (87 Mo : 9 régions de
l'optimiseur, Diviner, LROC, 3 relais). Détails dans
[docs/phase_A.md](docs/phase_A.md#a2-préparation-de-la-mise-en-ligne-).

## Avancement

- Tâches de l'équipe : [docs/taches_equipe.md](docs/taches_equipe.md)
- Ce qui a été fait en phase A (backend) : [docs/phase_A.md](docs/phase_A.md)
- Décision sur les éphémérides : [docs/decision_ephemerides.md](docs/decision_ephemerides.md)
