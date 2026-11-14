# Moon Trek et JPL Horizons : ce qu'ils peuvent apporter à notre outil

*Exploration du 14/11/2026. Tous les accès décrits sont publics et documentés, sans compte.*

## 1. JPL Horizons

**Accès :** API `https://ssd.jpl.nasa.gov/api/horizons.api`. Un observateur placé sur la Lune
se déclare avec `CENTER='coord@301'`, `COORD_TYPE='GEODETIC'` et
`SITE_COORD='lon,lat,alt_km'`. La recherche d'objets se fait avec
`https://ssd.jpl.nasa.gov/api/horizons_lookup.api?sstr=…&group=sct`.

### Ce que nous utilisons déjà
- Élévation et azimut du Soleil et de la Terre (`QUANTITIES='4'`), pour **valider** notre
  calculateur : écart ≤ 0,005° pour le Soleil et ≤ 0,18° pour la Terre sur 2026.

### Ce qui serait nouveau

| Donnée Horizons | Code | Testé | Apport pour notre outil |
|---|---|---|---|
| **Sondes en orbite lunaire, vues depuis un site** : LRO (−85), Danuri/KPLO (−155), Chandrayaan-2 (−152) | `COMMAND='-85'`, `QUANTITIES='4,20'` | oui, depuis Malapert | **Fenêtres de relais** : quand une sonde est au-dessus de l'horizon local, elle peut relayer les communications d'un site qui ne voit pas la Terre. C'est le complément exact de notre indicateur « Terre visible ». |
| Distance Terre–site (`delta`) | `20` | oui : 405 568 km le 14/11/2026 | **Bilan de liaison radio** : la puissance reçue varie de ~±10 % au cours du mois (périgée et apogée). |
| Fraction éclairée de la Terre (`Illu%`) | `10` | oui : 81 % le 14/11/2026 | **Clair de Terre** pendant la nuit lunaire (éclairage des caméras, apport thermique). |
| Diamètre apparent du Soleil et de la Terre | `13` | oui : Soleil 1 942″, Terre 6 488″ | Calcul exact de la fraction du disque visible, en remplacement de nos valeurs fixes (0,533° et 1,9°). |
| Distance au Soleil | `20` | oui | Flux solaire réel : ±3,4 % au cours de l'année, contre 1 361 W/m² fixe chez nous. |

**Points d'attention :**
- Les éphémérides des sondes sont des **prévisions** qui s'arrêtent à une date limite. LRO
  est prédit jusqu'au **16/04/2028**. Chandrayaan-2 s'arrête le **11/12/2026**. CAPSTONE,
  sur l'orbite prévue pour la station Gateway, s'arrête le **14/08/2026**.
- **La station Gateway et le relais chinois Queqiao-2 sont absents** d'Horizons.
- Une requête renvoie environ 60 lignes par seconde. Pour des fenêtres de relais sur des
  mois au pas d'une minute, il faut **précalculer en Python** (rôle du membre 1), pas
  interroger l'API depuis le navigateur.

## 2. Moon Trek (NASA / JPL)

**Accès :**
- Catalogue : `https://trek.nasa.gov/moon/TrekServices/ws/index/eq/searchItems`, environ
  9 400 entrées, dont 1 256 produits.
- Services d'une couche : `…/getLayerServices?uuid=<id>`.
- Images en tuiles **WMTS** : `https://trek.nasa.gov/tiles/Moon/EQ/<couche>/1.0.0/…`.
- Services **ArcGIS REST** : `https://trek.nasa.gov/moon/trekarcgis2/rest/services/…`,
  vecteurs en GeoJSON et rasters interrogeables en un point.

Sur les 1 256 produits, **171 couvrent le pôle Sud**. Voici les plus utiles pour nous :

| Produit Moon Trek | Accès | Apport pour notre outil |
|---|---|---|
| **Artemis III Candidate Landing Regions**, 13 polygones (liste NASA 2022) | ArcGIS → **GeoJSON**, testé | Liste de sites **officielle** et contours sur la carte. Recoupement : la crête, le sommet de Malapert et la meilleure zone de l'optimiseur (88,68°S 68,1°O) tombent **dans** les régions officielles Connecting Ridge, Malapert Massif et de Gerlache Rim. |
| **LOLA Permanently Shadowed Regions Southpole 240 m** | WMTS (PNG), testé : 8 niveaux | **Validation indépendante** de nos ombres permanentes, calculées par nous à 200 m. |
| **Lunar Anthropogenic Impacts and Spacecraft Sites** | ArcGIS (vecteurs) | Catalogue **officiel** des sites d'atterrissage et d'impact, pour enrichir notre liste de référence. |
| **Diviner** : températures min, max, minuit, midi, à 0,5 pixel par degré | WMTS et ArcGIS ImageServer (valeur en un point) | **Critère thermique** (pièges froids < 110 K, survie de l'électronique). Résolution grossière : ~2° de latitude par pixel. |
| **Lunar Prospector NS, abondance d'hydrogène** | WMTS | Indice de glace d'eau, à croiser avec nos ombres permanentes. Résolution très grossière. |
| **Mini-RF, rapport de polarisation circulaire (CPR)** | WMTS | Second indice radar de glace (à interpréter avec prudence). |
| **LROC NAC PSR Mosaic 20 m** et **NAC S Pole Mosaic** | WMTS | **Fond d'image** réel pour nos cartes, plus parlant que le relief ombré. |
| **LOLA Slope Southpole 120 m** | WMTS (image colorisée) | Recoupement de nos pentes. Nous calculons déjà les nôtres à 20 m. |
| **Endurance-A**, trajets et stations de rover (concept NASA) | ArcGIS (vecteurs) | Exemple de traversée réelle à afficher. Idée d'extension : évaluer l'éclairement **le long d'un trajet**. |
| **DEM LOLA 87,5° (5 m) et 75°** | ArcGIS ImageServer | Mêmes données que nos MNT PDS. Utile seulement en secours. |

**Points d'attention :**
- Les services **ArcGIS de Moon Trek étaient indisponibles par moments** (erreur HTTP 503)
  pendant l'exploration. Les **tuiles WMTS**, sur un autre serveur, répondaient. Il faut
  donc **télécharger une fois et stocker** les données dans `data/`, plutôt que d'interroger
  Moon Trek en direct depuis l'application.
- Les tuiles WMTS sont des **images colorisées** (PNG). Pour en tirer des valeurs, il faut
  décoder la palette, ou passer par l'ImageServer quand il existe (Diviner).
- Les produits « EQ » sont en projection équirectangulaire. Au pôle, une reprojection
  vers notre stéréographique est nécessaire.

## 3. Ce que cela changerait, par priorité

| Priorité | Ajout | Source | Effort | Valeur |
|---|---|---|---|---|
| 1 | **Régions officielles Artemis III** : contours sur les cartes et liste de sites | Moon Trek (GeoJSON déjà récupéré) | faible | crédibilité pour les juges, comparaison directe avec la NASA |
| 2 | **Fenêtres de relais LRO** : « si la Terre est cachée, LRO est-il visible ? » | Horizons (−85), précalcul Python | moyen | complète l'indicateur de communication, utile pour la crête et le pôle (Terre visible ~50 % du temps) |
| 3 | **Validation de nos ombres permanentes** contre la carte LOLA officielle | Moon Trek WMTS | moyen | preuve de qualité de notre critère « glace » |
| 4 | **Flux solaire réel** (distance au Soleil) et **diamètres apparents exacts** | Horizons, ou formule simple | faible | précision des chiffres d'énergie |
| 5 | **Critère thermique** Diviner (pièges froids, nuit) | Moon Trek | moyen | profil Science plus solide |
| 6 | **Fond d'image LROC NAC** | Moon Trek WMTS | moyen | rendu visuel de la présentation |

**Priorité 2 faite (14/11/2026)** : les fenêtres de relais LRO sont calculées dans
l'application, et validées à ≤ 0,05° près contre Horizons. Voir `docs/membre3_application.md`.

**Priorité 1 faite (14/11/2026)** : les 13 régions Artemis III sont intégrées
(`data/sites/artemis3_regions_2022.geojson`). On les retrouve sur la carte du pôle, dans la
fiche des sites et dans l'optimiseur (contours, colonne, contrainte). Détails dans
[optimisation_zones.md](optimisation_zones.md).
