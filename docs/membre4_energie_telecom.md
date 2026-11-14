# Membre 4 — Bilan énergie et télécommunications

> Question : *sur ce site et à ces dates, un véhicule donné a-t-il assez d'énergie, et combien de
> données peut-il envoyer vers la Terre ?*

Les visibilités du Soleil et de la Terre (membres 1 à 3) deviennent des chiffres de mission :
la charge de la batterie, la taille de batterie ou de panneaux nécessaire, le débit et le
volume de données. Code : `app/src/astro/budget.ts`. Interface : panneau **« Bilan énergie et
télécom »** de l'application.

Ce sont des **ordres de grandeur** pour comparer des sites et des dates, pas la conception
d'un véhicule.

## 1. Énergie

À chaque pas de la simulation (même pas que la chronologie) :

```
production (W) = surface × rendement × flux solaire × fraction visible du disque × géométrie
flux solaire   = 1 361 W/m² / (distance Lune–Soleil en UA)²     ← table Horizons (membre 1)
géométrie      = cos(élévation)  panneau vertical orienté vers le Soleil
               = sin(élévation)  panneau horizontal
consommation   = conso. de jour si le Soleil est visible (≥ ½ disque), sinon conso. de nuit (survie)
```

La batterie part pleine. Les excédents la rechargent, avec un rendement de 95 %, et les
déficits la vident. Elle ne descend pas sous son **plancher** de décharge (20 % pour une
profondeur de 80 %). Si le déficit continue au plancher, le temps passé est compté comme
**panne d'énergie**.

Résultats :

| Indicateur | Calcul |
|---|---|
| Tient la période / panne | Durée totale passée au plancher avec un déficit |
| Batterie au plus bas | Minimum de la charge, en % |
| **Batterie nécessaire** | Plus grand déficit cumulé à partir de l'état plein, divisé par la profondeur de décharge |
| **Panneaux nécessaires** | Plus petite surface sans panne avec la batterie choisie, trouvée par dichotomie. « Impossible » si même 1 000 m² ne suffisent pas, parce que la nuit est trop longue pour la batterie |

## 2. Télécom : liaison directe avec la Terre

Bilan de liaison classique, calculé à chaque pas où la Terre est visible :

```
PIRE (dBW)  = 10·log(P_émise) + G_antenne − 1,5 dB (câbles, pointage)
G_antenne   = 10·log(0,55 · (π·D·f/c)²)
pertes      = 20·log(4π·d·f/c)                       d = distance site–Terre (table Horizons)
C/N0 (dBHz) = PIRE − pertes − atmosphère + G/T_station + 228,6
débit       = min(débit max de la radio, 10^((C/N0 − Eb/N0 requis − marge) / 10))
```

| Hypothèse | Valeur |
|---|---|
| Eb/N0 requis | 2,5 dB (codage turbo ou LDPC, perte d'implémentation incluse) |
| Marge gardée en réserve | 3 dB |
| Atmosphère terrestre | 0,3 dB (S), 0,5 dB (X), 2 dB (Ka) |
| G/T DSN 34 m | 41 dB/K (S), 53,5 (X), 61 (Ka) |
| G/T DSN 70 m | 50 dB/K (S), 61 (X) |
| G/T station commerciale 12 m | 22 dB/K (S), 35 (X), 43 (Ka) |

Ces G/T sont des valeurs typiques à mi-élévation (ordres de grandeur du DSN, document 810-005).
On suppose qu'une station voit toujours la Lune : un réseau de trois sites espacés de 120° en
longitude la couvre en permanence. Le **temps de station alloué** (heures par jour) réduit le
volume en proportion. Sans énergie, c'est-à-dire batterie au plancher et Soleil caché, le
véhicule n'émet pas.

Le relais LRO n'est pas compté dans le volume de données : LRO n'a pas de radio de relais pour
des atterrisseurs. Il sert d'indicateur géométrique pour une **orbite de relais basse
polaire**. Voir [membre3_application.md](membre3_application.md).

## 3. Véhicules de référence

Les trois véhicules sont modifiables dans l'application, avec le bouton « Modifier les
paramètres » :

| | Petit atterrisseur (classe CLPS) | Rover (classe VIPER) | Station longue durée |
|---|---|---|---|
| Panneaux | 2,5 m², 28 %, verticaux | 1,5 m², 28 %, verticaux | 30 m², 28 %, verticaux |
| Consommation jour / nuit | 250 W / 80 W | 200 W / 50 W | 3 000 W / 1 500 W |
| Batterie (profondeur) | 3 kWh (80 %) | 2 kWh (80 %) | 30 kWh (80 %) |
| Radio | X, 20 W, antenne 0,5 m | X, 15 W, antenne 0,3 m | Ka, 50 W, antenne 1 m |
| Station au sol | commerciale 12 m, 24 h/j | DSN 34 m, 8 h/j | DSN 34 m, 24 h/j |
| Débit max de la radio | 2 Mbit/s | 1 Mbit/s | 100 Mbit/s |

## 4. Résultats sur les sites candidats

Un jour lunaire (29,5 j) à partir du 01/01/2027. Calculé avec `npm run mission-report`
(dossier `app/`), le même code que l'application.

| Site | Soleil | Plus longue nuit | Flux moyen (panneau vertical) |
|---|---|---|---|
| Crête de liaison | 100 % | 0 h | 1 407 W/m² |
| Malapert | 78 % | 158 h | 1 091 W/m² |
| Mons Mouton | 48 % | 313 h | 669 W/m² |

Le flux dépasse 1 361 W/m² en janvier, car la Terre et la Lune sont alors au plus près du
Soleil.

**Petit atterrisseur (batterie de 3 kWh) :**

| Site | Bilan | Batterie nécessaire | Panneaux nécessaires avec 3 kWh | Données (29,5 j) |
|---|---|---|---|---|
| Crête de liaison | ✅ tient (batterie à 100 %) | 0 kWh | 0,6 m² | 303 Go |
| Malapert | ❌ 103 h de panne | 13,3 kWh | impossible | 370 Go |
| Mons Mouton | ❌ 303 h de panne | 31,1 kWh | impossible | 292 Go |

**Rover :** crête ✅ ; Malapert ❌ (8,3 kWh nécessaires) ; Mons Mouton ❌ (19,4 kWh).

**Station longue durée :** crête ✅ avec seulement 7,5 m² de panneaux ; Malapert et Mons
Mouton demanderaient **251 kWh** et **583 kWh** de batterie. Pour une base permanente, il faut
donc un site sans longue nuit (la crête) ou une autre source d'énergie : pile à combustible ou
radio-isotopes.

**Ce que ça montre :**
- **L'énergie fait la différence.** Le débit est plafonné par la radio : 2 Mbit/s avec 17 dB de
  marge pour l'atterrisseur, 1 Mbit/s avec 33 dB pour le rover. Le volume de données dépend
  donc surtout du temps où la Terre est visible.
- **La nuit la plus longue dimensionne la batterie.** Une nuit de 158 h à 80 W demande
  12,6 kWh utiles. Une batterie de 3 kWh ne passe aucune nuit de plus d'environ 30 h.
- **La date compte autant que le site.** Ce jour lunaire de janvier est en « hiver » pour
  Malapert. En octobre 2027, Malapert ne connaît aucune nuit sur 14 jours (voir
  [membre5_decision.md](membre5_decision.md)).

## Limites

- Pas de modèle thermique : la consommation de survie est une valeur fixe.
- Pas de dégradation des panneaux ni de la batterie, ni de poussière.
- Le panneau vertical est supposé tourner pour suivre le Soleil. Fixe, il produirait moins.
- La liaison suppose le centre de la Terre au-dessus du relief. La diffraction et les trajets
  multiples près de l'horizon ne sont pas modélisés.
