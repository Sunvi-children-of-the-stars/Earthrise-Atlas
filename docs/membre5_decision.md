# Membre 5 — Aide à la décision et présentation

> Question : *quel site, et quand se poser ?*

## 1. L'outil : « Choisir la date d'atterrissage »

Panneau de l'application. Code : `app/src/astro/landing.ts` et
`app/src/components/LandingPlanner.tsx`.

1. On règle le premier atterrissage possible, la fenêtre de recherche (3, 6 ou 12 mois), la
   durée de la mission (7 j, 14 j ou un jour lunaire), et combien de temps le Soleil et la
   Terre doivent être visibles après l'atterrissage.
2. Pour chaque site candidat, la fenêtre est simulée **une fois**, au pas de 30 min. Chaque
   date d'atterrissage possible, toutes les 12 h, est ensuite évaluée sur la mission qui suit.
   Le véhicule et la batterie sont ceux du membre 4.
3. Une date est **exclue** dans deux cas :
   - le Soleil (énergie) ou la Terre (télémétrie directe) manquent pendant les premières
     heures après l'atterrissage, 6 h par défaut ;
   - la batterie se vide pendant la mission.
4. Les dates restantes reçoivent une **note sur 100** :

| Critère | Poids | Mesure |
|---|---|---|
| Soleil | 25 % | Part du temps au Soleil |
| Terre | 20 % | Part du temps avec la Terre visible |
| Absence de longue nuit | 20 % | 1 − plus longue nuit / durée de la mission |
| **Tolérance au retard** | 15 % | Nombre de jours pendant lesquels les dates suivantes restent possibles (plein score à 15 jours, un demi-mois lunaire ; avec 5 jours, plusieurs fenêtres finissaient ex aequo à 100). Un lancement glisse souvent : une date isolée est risquée. |
| Données | 10 % | Volume transmissible, rapporté au meilleur |
| Réserve de batterie | 10 % | Charge minimale |

Les poids sont dans `WEIGHTS` (`landing.ts`). Ils sont faciles à ajuster après discussion
d'équipe.

5. Résultats :
   - un **bandeau** par site, où une case est une date (vert : bonne note, gris : exclue) ;
   - le **classement** des meilleures fenêtres, avec les « pour » et les « contre » écrits en
     clair ;
   - un bouton **Analyser** qui ouvre la date dans la vue détaillée.

## 2. Résultats pour 2027

Les 12 mois de 2027 ont été balayés, soit 731 dates par site. Commande `npm run mission-report`
dans `app/`, avec la table Horizons.

**Petit atterrisseur, mission de 14 jours** (Soleil et Terre exigés 6 h après l'atterrissage) :

| Site | Dates possibles | Meilleure date | Note | Retard toléré |
|---|---|---|---|---|
| **Malapert** | 172 / 731 (24 %) | **05/10/2027 12:00 UTC** | 100 | **22 jours** |
| Crête de liaison | 257 / 731 (35 %) | 16/08/2027 00:00 UTC | 99 | 14 jours |
| Mons Mouton | 24 / 731 (3 %) | 06/10/2027 12:00 UTC | 87,5 | — |

Notes recalculées le 14/11/2026 avec la tolérance au retard pleine à 15 jours : seule la
fenêtre de Malapert atteint 100, les fenêtres de la crête obtiennent 98,5 à 99. Les meilleures fenêtres réunissent 100 % de Soleil, 100 % de Terre, aucune nuit et environ
300 Go transmissibles. Pour la crête, elles reviennent à chaque mois lunaire d'août à novembre
2027 (16/08, 12/09, 09/10, 05/11), avec 14 jours de retard tolérés à chaque fois.

**Petit atterrisseur, mission d'un jour lunaire (29,5 j)** (notes calculées avec l'ancienne
échelle de tolérance, pleine à 5 jours ; le classement n'en dépend pas) :

| Site | Dates possibles | Meilleure date | Note | Soleil / Terre / plus longue nuit / plus longue coupure Terre |
|---|---|---|---|---|
| **Malapert** | 44 / 731 | **05/10/2027 12:00 UTC** | 93,6 | 92 % / 84 % / 38 h / 113 h |
| Crête de liaison | 223 / 731 | 12/09/2027 12:00 UTC | 88,1 | 100 % / 57 % / 0 h / **305 h** |
| Mons Mouton | **0** / 731 | — | — | batterie vide à toutes les dates |

Le rover donne le même classement.

## 3. Recommandation

**Site principal : massif de Malapert, atterrissage le 5 octobre 2027 vers 12:00 UTC.**

- Pendant 14 jours : Soleil et Terre visibles **100 % du temps**, sans aucune nuit. La batterie
  reste pleine et environ 300 Go sont transmissibles en direct.
- La fenêtre reste ouverte **22 jours** : le lancement peut glisser de trois semaines.
- C'est le seul site candidat qui voit la Terre presque en permanence. Son sommet domine
  l'horizon : 80 % du temps sur un an, 84 % sur la mission longue. Aucun relais n'est
  indispensable.
- Il est dans une région Artemis III officielle (Malapert Massif) et à **0,7 km** d'une zone
  d'ombre permanente, d'intérêt pour la glace d'eau.

**Alternative : crête de liaison, fenêtres d'août à novembre 2027.**

- C'est le meilleur site pour l'**énergie** : Soleil 100 % du temps, aucune nuit, même sur
  29,5 j. Une station longue durée y tient avec 7,5 m² de panneaux.
- En revanche, la Terre y est cachée **jusqu'à 13 jours d'affilée**. Il faut un **relais en
  orbite** : avec l'orbite de LRO, la coupure totale maximale tombe à 1 h 49.
- C'est le choix pour une base durable, à condition de prévoir un relais.

**À éviter : Mons Mouton.** Seulement 3 % des dates conviennent pour 14 jours, et aucune pour
un mois. Les nuits de 13 jours vident toute batterie raisonnable : il faudrait 31 kWh pour
l'atterrisseur.

**Ce qui pourrait changer la recommandation :**
- une mission plus longue que 14 jours sans relais : Malapert reste le meilleur ;
- une mission plus longue avec relais : la crête devient préférable ;
- les incertitudes. Le verdict de fiabilité de l'application signale les dates où le Soleil ou
  la Terre frôlent l'horizon. Il faut le consulter (bouton « Analyser ») avant de retenir une
  date.

## 4. Script de la démonstration (environ 2 minutes)

1. **Le problème (15 s).** Au pôle Sud, le Soleil et la Terre rasent l'horizon. Quelques mètres
   de relief décident de l'énergie et des communications.
2. **Un site (30 s).** Ouvrir Malapert. Montrer la vue du ciel (horizon réel), la chronologie
   et les cartes : « coucher de Terre dans… » et la plus longue nuit.
3. **L'énergie (20 s).** Le bilan énergie et télécom : courbe de la batterie, « Tient la
   période » ou « Panne », batterie nécessaire. Passer à Mons Mouton : la panne apparaît.
4. **Quand se poser (30 s).** Lancer « Chercher les meilleures dates » sur 12 mois 2027 : le
   bandeau vert et gris, le classement, puis cliquer **Analyser** sur Malapert le 05/10/2027.
5. **Où se poser (20 s).** La recherche de zones avec les contours Artemis III officiels, le
   profil « Liaison avec relais », et les meilleures zones du bord de de Gerlache.
6. **La confiance (15 s).** Les éphémérides JPL Horizons et la validation contre les cartes
   officielles LOLA : 93 % de recouvrement des ombres permanentes, 2,5 points d'écart sur
   l'ensoleillement moyen. Le verdict de fiabilité de chaque résultat.

## 5. Plan de la présentation (7 diapositives au plus)

1. Le défi et pourquoi le pôle Sud est difficile (Soleil et Terre rasants).
2. Les données : LOLA (relief à 20 m), JPL Horizons (Soleil, Terre, LRO), régions Artemis III.
3. La méthode : horizon de chaque site, puis visibilité, puis énergie et télécom.
4. La démonstration (vidéo).
5. Les résultats : tableau des 3 sites, puis recommandation Malapert le 05/10/2027.
6. La validation : Horizons, cartes LOLA officielles, QuickMap.
7. Les limites et la suite : relais réels (Lunar Pathfinder, Moonlight), modèle thermique,
   MNT à 5 m.
