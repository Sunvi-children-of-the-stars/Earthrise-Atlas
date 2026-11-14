# Tâches de l'équipe (hors Elge)

Règle : **on termine le backend (calculs, données, infrastructure) avant d'attaquer le front.**
Les tâches confiées à Elge (T1 à T8) sont rappelées là où elles bloquent les nôtres.

Légende : ⭐ prioritaire · 🔗 dépend d'une tâche d'Elge · 💤 optionnel (bonus hackathon)

---

## Phase A : backend (✅ sauf A4 et les points qui dépendent d'Elge ; détail dans [phase_A.md](phase_A.md))

### A1. Décision sur les éphémérides ⭐
- [x] Acter que le calcul intégré (`app/src/astro/ephemeris.ts`) est la source officielle : écart ≤ 0,18° face à JPL Horizons.
- [x] Réécrire la section « Brancher les données du membre 1 » de `docs/membre3_application.md` : il n'y a plus de « à faire ». `data/ephemeris/` sert uniquement aux **fichiers de référence de validation**.
- [x] Mettre à jour le README en conséquence.
- 🔗 La preuve reproductible viendra de T5 (script de validation Horizons).

### A2. Préparation de la mise en ligne ⭐
- [x] Vérifier que `NO_TILES=1 npm run build` passe et que `dist/` fonctionne avec `npm run preview`, en repli sur le relief à 1,2 km.
- [x] Mesurer le poids de `dist/` (cartes d'horizon comprises) et décider ce qu'on embarque.
- [x] Choisir l'hébergeur (Netlify, Vercel ou GitHub Pages) et écrire sa configuration (`netlify.toml` ou workflow GitHub Actions).
- [ ] Faire un premier déploiement « brut », avant le rebranding, pour valider la chaîne.

### A3. Réglage des profils de l'optimiseur ⭐
- [x] Revoir `PROFILES` dans `app/src/optim/score.ts` : poids et seuils éliminatoires réalistes pour les profils atterrisseur court, atterrisseur longue durée, rover et base.
- [x] Documenter les choix dans `docs/optimisation_zones.md`.
- 🔗 Quand T7 sera intégrée : régler le poids du critère « coupure totale, Terre ou LRO », livré à 0.

### A4. Intégration des livrables d'Elge ⭐
- [ ] Relire et fusionner les PR dans l'ordre T1, T4, T5, puis les autres.
- [ ] Après T4 : vérifier le verdict `budget()` sur les 3 sites candidats ; il doit être cohérent avec les chiffres de l'outil.
- [ ] Après T1 : lancer `npm test` avant chaque fusion.

### A5. Logique « mission retardée » 💤 (pour le bonus « Mission retardée »)
- [x] Fonction pure : un site, une date, un décalage (+1 mois, +3 mois…) en entrée ; les meilleurs sites voisins à la nouvelle date en sortie, en réutilisant `evaluateRegion()` et `scoreRegion()`.

### A6. Logique « 1 km plus loin » 💤
- [x] Fonction : indicateurs (ensoleillement, Terre, nuit max) le long d'un transect autour d'un site, par pas de 100 à 200 m, à partir des cartes d'horizon.

### A7. Calendrier site × date 💤
- [x] Calculer une grille « sites × mois lunaires » des indicateurs clés, à partir de `seasonal()`, avec mise en cache.

### A8. Lien partageable 💤
- [x] Encoder et décoder l'état (site, coordonnées, date, période) dans l'URL, avec une logique séparée de l'interface.

### A9. Données complémentaires 💤
- [x] **Fond LROC** : récupérer et tuiler une mosaïque photo du pôle Sud, alignée sur la grille stéréographique.
- [x] **Critère thermique Diviner** : récupérer les températures et les ajouter comme critère de l'optimiseur.
- [x] **MNT 20 m entre 75°S et 85°S** (`LDEM_80S_20M`, 1,85 Go) : relief fin pour IM-1 et sites voisins. **Accord de l'équipe requis avant le téléchargement.**
- [x] **Relais hypothétiques** (Gateway sur orbite NRHO, Queqiao-2) : orbites types, à comparer à LRO.
- [x] **Itinéraire de rover** vers une zone éclairée : plus court chemin sur les cartes d'horizon et de pente.

---

## Phase B : front (seulement quand la phase A est terminée)

### B1. Rebranding ⭐
- [ ] Nom, identité visuelle, couleurs, typographie.
- [ ] Interface en anglais (avec bascule FR/EN si possible).

### B2. Affichage du bilan énergie et radio ⭐ 🔗 T4
- [ ] Carte « Bilan » dans `MetricCards` : batterie, panneaux, débit et verdict « faisable / limite / non faisable ».
- [ ] Colonnes « Batterie » et « Verdict » dans `Comparison`.

### B3. Mode Découverte (grand public) ⭐
- [ ] 4 ou 5 écrans guidés : pourquoi le pôle, pourquoi le Soleil rase l'horizon, pourquoi la Terre disparaît, pourquoi 1 km change tout.
- [ ] Comparaison Terre / Lune (durée du jour, températures, hauteur du Soleil).

### B4. Interfaces des fonctions bonus
- [ ] Bouton « Mission retardée » (A5).
- [ ] Curseur « 1 km plus loin » avec jauges en direct (A6).
- [ ] Calendrier de chaleur site × date (A7).
- [ ] Bouton « Copier le lien » (A8).
- [ ] Comparaison côte à côte de deux scénarios (panoramas et chronologies).
- [ ] Export d'une fiche de mission en PDF.

### B5. Vue 3D du relief 💤
- [ ] Terrain en Three.js à partir des tuiles 20 m, avec le Soleil, la Terre et les ombres animées dans le temps.

### B6. Fond LROC sur les cartes 💤 (selon A9)

### B7. Mise en ligne finale ⭐
- [ ] Redéployer la version rebrandée avec la chaîne préparée en A2.
- [ ] Recette complète sur la version en ligne.

---

## Phase C : conclusions

- [ ] **Recommander un site et une date**, justifiés par les résultats de l'outil : indicateurs, bilan, fiabilité, captures.
- [ ] **Points ouverts** : intégrer les conclusions de T6 (ombres permanentes) et T8 (crête au 24/11) dans la doc. S'ils restent ouverts, les documenter comme limites connues.
- [ ] **Démonstration** : scénario de 2 min, par exemple « mission retardée → alternative trouvée », tourné sur la version en ligne.

---

## Rappel : tâches d'Elge

| # | Tâche | Débloque |
|---|---|---|
| T1 | Tests automatiques (Vitest) | A4, toutes les fusions |
| T2 | Nouveaux sites de référence | — |
| T3 | Flux solaire exact | — |
| T4 | Module bilan énergie et radio | B2 |
| T5 | Validation Horizons | A1 (preuve) |
| T6 | Validation des ombres permanentes | Phase C |
| T7 | Relais LRO dans l'optimiseur | A3 |
| T8 | Enquête crête 24/11 | Phase C |
