# Earthrise Atlas : conception du site public

*14/11/2026. Remplace entièrement l'interface actuelle de l'application (`app/src/App.tsx` et
`app/src/components/`). Le moteur de calcul (`app/src/astro/`, `app/src/optim/`, `share.ts`)
et les données (`data/`) sont conservés.*

## 1. Intention

Le projet répond au défi NASA Space Apps 2026 « Lunar Landing Site Navigator » : aider des
planificateurs de mission, des enseignants et le grand public à comparer des sites et des
dates d'atterrissage au pôle Sud de la Lune, en montrant le Soleil et la Terre par rapport à
l'horizon.

L'interface actuelle est un outil d'expert, dense et en français. L'équipe veut à la place un
**site grand public avec une direction artistique soignée**, sous le nom **Earthrise Atlas**.
Le visiteur doit **d'abord comprendre** pourquoi se poser au pôle Sud est si difficile (un
Soleil qui rase l'horizon, une Terre qui se cache des jours entiers), **puis pouvoir jouer**
avec les vraies données. La puissance de l'outil reste accessible au jury et aux curieux,
mais elle ne doit pas noyer le grand public.

## 2. Objectifs, non-objectifs, anti-objectifs

**Objectifs**
- Une page d'accueil qui donne envie, puis un récit court qui fait comprendre le problème en
  quelques minutes.
- Un mode « jouer » où l'on choisit un site et une date, et où l'on voit le ciel et les chiffres
  clés.
- Toutes les fonctions de calcul existantes restent accessibles, dans une page dédiée
  (Mission Lab).
- Anglais par défaut, français par un bouton.
- Un site statique, déployable sur Netlify avec `npm run build:web`.

**Non-objectifs**
- Pas de nouveau calcul scientifique : le moteur est figé, testé (50 tests) et validé.
- Pas de vue 3D du relief dans cette version.
- Pas de compte utilisateur ni de serveur.

**Anti-objectifs** (ce qui serait un échec même si tout fonctionne)
- Un visiteur non spécialiste qui arrive sur un tableau de bord rempli de chiffres sans
  explication.
- Un site qui contredit la charte : plus de deux couleurs, tirets cadratins, italique
  décorative.
- Des chiffres affichés qui diffèrent de ceux du moteur (aucun chiffre écrit en dur dans les
  textes s'il peut être calculé ; voir 9.3).
- Une perte de fonctionnalité de l'outil actuel sans décision explicite.

## 3. Contraintes de charte

| Élément | Règle |
|---|---|
| Nom | **Earthrise Atlas** |
| Police | **Poppins** (Google Fonts), graisses 300, 400, 500, 600. Titres en 300 ou 400, grands et aérés |
| Couleurs | Noir profond (fond, `#000` à `#0A0C12`), blanc (texte), **vert d'eau glacé `#9BF0D8`** (la Terre dans les graphiques, les actions, les liens, les accents), **or très pâle** (le Soleil, **uniquement dans les graphiques et les données**). Le bâtisseur choisit la valeur exacte de l'or pâle (ordre d'idée `#F3E2B3`), en vérifiant le contraste sur fond noir. Les gris sont des nuances du blanc par transparence, pas des couleurs en plus |
| Ponctuation | **Aucun tiret cadratin** (—) dans les textes, en anglais comme en français. Utiliser deux-points, virgules, parenthèses ou phrases courtes |
| Italique | Seulement pour un titre d'ouvrage cité, si besoin. Jamais pour l'emphase ni la décoration |
| Ambiance | Direction « Nuit polaire » validée sur maquette : très sombre, aérée, composition centrée sur l'accueil, typographie légère, arcs fins vert d'eau, relief en silhouette au ras du bas de l'écran |
| Logo | Un arc d'horizon vert d'eau et un petit disque blanc posé dessus (Terre se levant), comme sur la maquette C. Aussi utilisé en favicon |

La maquette validée est conservée dans `.superpowers/brainstorm/` (fichier
`style-directions.html`, option C).

## 4. Approches envisagées

| Approche | Avantages | Inconvénients | Décision |
|---|---|---|---|
| **A. Refaire l'interface dans l'application React + Vite actuelle** | Réutilise le moteur et ses tests tels quels ; une seule base de code ; presque aucune dépendance nouvelle ; hébergement statique inchangé | Il faut réécrire tous les composants visuels | **Retenue** par l'équipe |
| B. Vitrine statique séparée pour le récit, application actuelle pour le jeu | Récit un peu plus rapide à charger | Deux bases de code ; charte et traduction à synchroniser | Écartée |
| C. Migration vers Next.js ou équivalent | Rendu serveur, référencement | Migration complète pour des bénéfices inutiles à un site statique de démonstration | Écartée |

## 5. Architecture des pages

```
 /             Story (accueil + récit en 5 chapitres)
 /atlas        Atlas (carte du pôle Sud)
 /play         Play (expérience principale)      onglets : Sky · Timeline · Site
 /lab          Mission Lab (outils experts)      onglets : Zones · Landing dates · Power & radio · Compare
 /method       Method (données et validation)    onglets : Data · Validation · Team
```

- Navigation fixe en haut : logo et nom à gauche ; Story, Atlas, Play, Lab, Method ; bouton
  **EN | FR** à droite. Sur mobile, menu repliable.
- **Onglets** : partout où un écran deviendrait trop chargé (règle de l'équipe : « des onglets
  si nécessaire »). Ceux listés ci-dessus sont le point de départ ; le bâtisseur peut en
  ajouter ou en fusionner selon la densité réelle.
- **Routage par chemin** (`/play`, `/lab`…), pour laisser le **hash de l'URL au lien
  partageable** existant (`share.ts`, format `#site=…&t=…&d=…`). Il faut donc une règle de
  réécriture SPA côté hébergeur (`/* /index.html 200` dans `app/public/_redirects` pour
  Netlify) et un `base` compatible (aujourd'hui `./` dans `vite.config.ts`, à passer en `/`).
- Le lien partageable s'applique à Play et à Mission Lab : `/play#site=malapert-massif&t=…`.

## 6. Contenu page par page

### 6.1 Story (`/`)

**Accueil (premier écran)**, d'après la maquette C : surtitre « Lunar south pole », titre
« Where the Sun never sets, and the Earth hides for days. », une phrase d'introduction, deux
boutons (« Start the journey » qui fait défiler vers le récit, « Play with the map » vers
`/play`). Relief en silhouette au bas de l'écran, arcs fins vert d'eau, petit disque blanc
(la Terre) posé sur l'horizon. Animation lente et discrète, désactivée si le visiteur demande
moins de mouvement (`prefers-reduced-motion`).

**Récit**, 5 chapitres qui apparaissent au défilement. Chacun a un titre, 2 à 4 phrases et une
illustration **alimentée par les vraies données** :

| Chapitre | Message | Illustration et source |
|---|---|---|
| 1. Why the south pole | De la glace d'eau dort dans des cratères où le Soleil n'entre jamais | Photo LROC du pôle (`data/lroc/`) avec les ombres permanentes de la région « pole » en vert d'eau (`data/horizon_maps/pole.psr.u8`) |
| 2. A Sun that never climbs | Au pôle, le Soleil tourne autour de l'horizon sans jamais monter haut (moins de 2° à la crête de liaison) | Panorama 360° simplifié de la crête de liaison sur un jour lunaire : horizon réel, trajectoire du Soleil en or pâle |
| 3. An Earth that hides | La Terre bascule sous le relief et la liaison radio se coupe des jours entiers ; un satellite relais peut combler le trou | Bandeau temporel « Terre visible / cachée » sur un jour lunaire à la crête, avec la plus longue coupure, puis le même bandeau avec le relais LRO |
| 4. One kilometre changes everything | Déplacer le site de quelques centaines de mètres change tout | **Curseur** que le visiteur fait glisser le long d'un transect de 2 km à Mons Mouton : la visibilité de la Terre et l'ensoleillement se mettent à jour (module `optim/neighborhood.ts`, `transect()`) |
| 5. Your turn | Invitation à choisir son site et sa date | Bouton vers `/play`, et vers `/atlas` |

Les chiffres cités dans les textes sont calculés à l'ouverture de la page (voir 9.3).

**Période de référence du récit** *(choix du concepteur)* : les illustrations et les chiffres
du récit portent sur une période **fixe**, le jour lunaire qui commence le 14/11/2026 à
16:00 UTC, celle des valeurs de référence des tests et de la documentation. Ainsi, le récit
raconte toujours la même histoire, quel que soit le jour de la visite. Play, lui, s'ouvre sur
la date du jour.

### 6.2 Atlas (`/atlas`)

- Grande carte du pôle Sud : photo LROC (`data/lroc/south_pole_wac_400m.jpg`, même grille que
  le MNT réduit), contours des régions Artemis III (`data/sites/artemis3_regions_2022.geojson`),
  les **14 sites** (`data/sites/sites.json`), qui se distinguent en sites candidats et sites
  de référence.
- Un clic sur un site ouvre une **fiche** : nom, mission, contexte, coordonnées, altitude,
  ombre permanente la plus proche, température Diviner (`data/sites/diviner.json`) quand elle
  existe, et un bouton « Play this site ».
- Un clic ailleurs sur la carte propose « Play this point » (site personnalisé, calcul de
  l'horizon à la demande comme aujourd'hui).
- Les sites hors de la carte polaire (Apollo, Chang'e, SLIM, Blue Ghost) sont accessibles par
  une liste « Other landing sites » à côté de la carte.

### 6.3 Play (`/play`)

L'expérience principale, pour le grand public.

- **Choix** : site (liste des 14 sites, plus « custom » depuis l'Atlas), date de début, durée
  (3 jours, 7 jours, un jour lunaire). Valeurs par défaut : crête de liaison, aujourd'hui, un
  jour lunaire.
- **Chiffres clés** (3 ou 4 grandes cartes, langage simple) : part du temps au Soleil, part du
  temps avec la Terre visible, plus longue nuit, et un **verdict** compréhensible (par exemple
  « A small solar lander survives this mission » ou « Battery runs out after 3 days »), calculé
  avec `astro/budget.ts` pour le véhicule « lander » par défaut.
- **Onglet Sky** : panorama 360° avec l'horizon réel, les trajectoires du Soleil (or pâle) et
  de la Terre (vert d'eau), et leur position à l'instant du curseur. Bouton lecture pour animer.
- **Onglet Timeline** : chronologie de la période avec bandes Soleil, Terre, relais LRO,
  curseur à faire glisser ; « coucher du Soleil dans… », « coucher de la Terre dans… ».
- **Onglet Site** : fiche terrain (altitude, pentes, obstacles), fiabilité du résultat
  (robuste, à confirmer, fragile, avec sa raison en une phrase), mois lunaires sur un an.
- **Actions** : « Mission delayed by a month? » (compare la même durée un mois lunaire plus tard,
  `optim/delay.ts`, `shiftScan()`), « Share » (copie le lien, `share.ts`), « Open in Mission
  Lab ».

### 6.4 Mission Lab (`/lab`)

Pour le jury et les curieux. Réglages simplifiés par défaut, **options avancées repliées**
dans chaque onglet.

| Onglet | Contenu | Moteur |
|---|---|---|
| Zones | Recherche des meilleures zones dans une des 9 régions, par profil de mission (carte de chaleur sur la photo LROC de la région, `<id>.wac.u8`). Avancé : poids, contraintes, calques. Un clic sur une zone l'ouvre dans Play | `optim/` (worker), `score.ts`, `PROFILES` |
| Landing dates | Meilleures dates d'atterrissage pour les sites candidats, avec « pour » et « contre » en clair. Avancé : durée de mission, véhicule, pas | `astro/landing.ts` |
| Power & radio | Bilan énergie (courbe de charge, batterie et panneaux nécessaires) et radio (débit, volume) pour un véhicule de référence. Avancé : tous les paramètres du véhicule | `astro/budget.ts` |
| Compare | Tableau comparatif de scénarios (site × date × durée), meilleure valeur mise en avant, enregistré dans le navigateur | `astro/analysis.ts`, `relay.ts` |

Les fonctions de la phase A sans écran aujourd'hui y trouvent leur place quand c'est simple :
calendrier site × mois (`data/calendar/sites.json`) dans Landing dates, relais modèles
Gateway et Queqiao-2 (`loadRelays()`) comme option avancée de Power & radio ou de Compare,
itinéraire de rover (`optim/rover.ts`) comme option avancée de Zones. Le bâtisseur peut les
reporter s'ils alourdissent trop ; ce n'est pas bloquant.

### 6.5 Method (`/method`)

- **Data** : une carte par source (LOLA, JPL Horizons, LRO/LROC, Diviner, orbite LRO), ce
  qu'elle apporte, sa résolution, son lien.
- **Validation** : les validations déjà documentées, résumées en clair (Horizons ≤ 0,003°,
  ombres permanentes IoU 0,80 à 0,93 contre les cartes LOLA officielles, cas de la crête
  tranché par la courbure), avec liens vers les documents du dépôt.
- **Team** : l'équipe, le défi Space Apps 2026, le lien vers le code source
  (https://github.com/Topelus/Lunar-landing-site-visualization-tool). Les cinq membres, tous
  du **Bénin**, à afficher tels quels (pas de rôles : ils n'ont pas été fournis) :
  - IDOHOU Cyrus
  - Elge TOPANOU
  - Ezékias AGLOSSI
  - GBAGUIDI Ursus
  - Marguerite ASSOU

## 7. Langues

- Anglais par défaut, français par le bouton EN | FR. Le choix est mémorisé dans le navigateur
  (`localStorage`, avec repli silencieux si indisponible) et reflété dans `<html lang>`.
- Tous les textes de l'interface sont dans deux fichiers de dictionnaire (par exemple
  `app/src/i18n/en.ts` et `fr.ts`) avec les **mêmes clés**. Pas de bibliothèque
  d'internationalisation : un petit hook suffit.
- Les textes du **récit** sont écrits par le bâtisseur en anglais, puis traduits en français,
  en respectant la charte (pas de tiret cadratin, pas d'italique).
- Les **données** gardent leur langue d'origine quand elles viennent des fichiers (par exemple
  `sites.json`, en français) : le bâtisseur traduit à l'affichage les champs visibles (nom
  court, région, contexte) avec un dictionnaire des 14 sites, plutôt que de modifier les
  fichiers de données.
- Formats : nombres et dates selon la langue (`Intl`), heures toujours en UTC et marquées
  comme telles.

## 8. Ce qui existe et ce qui change

| Existant | Devenir |
|---|---|
| `astro/`, `optim/`, `share.ts`, `data.ts`, `format.ts` | **Conservés**. Pas de modification de comportement. Tout ajout passe par de nouvelles fonctions testées |
| `App.tsx`, `components/*.tsx`, `styles.css` | **Remplacés**. La logique d'état utile (chargement des sites, des masques, de la table Horizons, du relais, calcul à la demande des sites personnalisés) est reprise dans la nouvelle structure ; le visuel est réécrit |
| `scripts/sync-data.mjs`, `vite.config.ts` (servir tuiles et cartes d'horizon) | Conservés ; `base` passe à `/` pour le routage par chemin |
| 50 tests (`npm test`) | Doivent rester verts |
| `npm run build:web` | Reste la commande de déploiement |

Avant de supprimer un composant, vérifier que chaque fonction qu'il offrait a une place dans
le nouveau site (section 6), ou que son abandon a été décidé.

## 9. Exigences transverses

### 9.1 Accessibilité et confort
- Contraste suffisant du texte sur fond noir, y compris pour l'or pâle et le vert d'eau
  (WCAG AA pour le texte).
- Navigation au clavier, focus visible, onglets accessibles (rôles ARIA `tablist`, `tab`,
  `tabpanel`).
- Animations coupées avec `prefers-reduced-motion`.
- Graphiques : un texte alternatif résumant ce que montre le graphique.

### 9.2 Performance
- Les données lourdes ne se chargent que sur la page qui en a besoin : cartes d'horizon
  (jusqu'à 23 Mo) seulement dans Mission Lab > Zones, photo LROC (1,7 Mo) dans Atlas et Story.
- Mission Lab est découpé dans son propre paquet JavaScript (import dynamique).
- La page d'accueil s'affiche sans attendre les calculs ; les illustrations du récit se
  calculent au fur et à mesure.

### 9.3 Exactitude
- Les chiffres affichés viennent du moteur au moment de l'affichage. Les textes les
  contiennent par des emplacements (par exemple `{earthPct}`), pas en dur.
- Quand un résultat est « fragile » selon `fragility()`, le site le dit en une phrase.
- Les relais Gateway et Queqiao-2 sont toujours marqués « model » (orbites modèles, pas des
  éphémérides).

### 9.4 Écrans
- Ordinateur d'abord (démonstration au jury), mais Story, Atlas et Play doivent rester
  utilisables sur téléphone (pas de défilement horizontal de la page). Mission Lab peut être
  réservé aux grands écrans, avec un message sur mobile.

## 10. Critères de réussite

- Un visiteur qui ne connaît rien à la Lune comprend, après le récit, pourquoi le Soleil, la
  Terre et l'emplacement exact comptent au pôle Sud.
- Depuis l'accueil, on arrive dans Play en un clic, et l'on voit le ciel d'un site en quelques
  secondes.
- Toutes les fonctions de l'outil actuel sont présentes (Play ou Mission Lab).
- La charte est respectée partout, y compris en français.
- `npm test` et `npm run build:web` passent ; le site déployé fonctionne sans la pyramide de
  tuiles (repli sur le MNT réduit pour les sites personnalisés, comme aujourd'hui).

## 11. Laissé au bâtisseur

- La valeur exacte de l'or pâle et des nuances de gris, les espacements et la grille.
- Le choix du routeur (bibliothèque légère de version publiée depuis plus de deux semaines,
  ou routage maison).
- La rédaction des textes du récit et des pages, et leur traduction, dans le respect de la
  charte et de la section 6.
- Le découpage exact en onglets au-delà de ceux listés, selon la densité réelle.
- La forme des illustrations du récit, tant qu'elles utilisent les vraies données.
- L'ordre de construction des pages.
