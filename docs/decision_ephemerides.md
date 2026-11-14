# Décision : source des éphémérides

**Décision (14/11/2026, révisée le même jour) : les positions du Soleil et de la Terre viennent
d'une table JPL Horizons précalculée (`data/ephemeris/`, DE440, une heure de pas, de 2026 à
2030). Hors de cette période, l'application utilise ses séries intégrées
(`app/src/astro/ephemeris.ts`).**

La première version de cette décision faisait du calcul intégré la source officielle. La table
Horizons, produite par `scripts/fetch_ephemeris.py` et validée par `npm run validate-ephemeris`,
l'a remplacée. Elle a montré que les séries, précises à 0,19° près, **décalent les levers et
couchers de Terre d'environ 1 h, et jusqu'à 2,5 h**. Or l'outil affiche justement le temps
restant avant le coucher de la Terre.

## Pourquoi une table plutôt qu'un calcul par site

| Critère | Table Horizons (vue du centre de la Lune) | Requêtes Horizons par site | Séries seules |
|---|---|---|---|
| Précision (élévation) | **≤ 0,003°** | référence | Soleil ≤ 0,005°, Terre ≤ 0,19° |
| Levers et couchers de Terre | exacts à quelques minutes | exacts | jusqu'à 2,5 h d'écart |
| Sites personnalisés et optimiseur | ✅ la table donne des directions, l'application ajoute la parallaxe du site | ❌ une requête par point | ✅ |
| Période couverte | 2026 à 2030 (1 Mo) | téléchargée | illimitée |

La table contient les vecteurs Soleil et Terre vus du **centre** de la Lune. L'application les
tourne dans le repère lunaire (modèle IAU) et ajoute la parallaxe du site, qui vaut jusqu'à
0,26° pour la Terre. Elle sert donc pour n'importe quel point, y compris les 160 000 pixels
d'une région de l'optimiseur.

## Validation

`npm run validate-ephemeris`, dans `app/` : comparaison avec Horizons en mode observateur
(topocentrique) aux sites candidats, du 01/11/2026 au 31/12/2028, toutes les 12 h, soit 1 583
points par site.

| Site | Astre | Séries : RMS / max | Table : RMS / max |
|---|---|---|---|
| Crête de liaison | Soleil | 0,002° / 0,005° | 0,001° / 0,002° |
| Crête de liaison | Terre | 0,061° / 0,188° | 0,001° / 0,003° |
| Malapert | Terre | 0,061° / 0,184° | 0,001° / 0,003° |
| Mons Mouton | Terre | 0,059° / 0,172° | 0,001° / 0,003° |

Impact sur les résultats d'un an, entre séries et table : les pourcentages changent de moins
de 0,05 point, mais les levers et couchers de Terre se décalent d'environ 1 h (2,5 h au
maximum). Détails : [membre1_ephemerides.md](membre1_ephemerides.md).

## Limites

- Hors de 2026 à 2030, l'application revient aux séries, et le badge en haut de page indique la
  source utilisée. Pour étendre la période, relancer `scripts/fetch_ephemeris.py`.
- Pas de réfraction : la Lune n'a pas d'atmosphère. L'horizon est celui du relief et de la
  courbure lunaire.
