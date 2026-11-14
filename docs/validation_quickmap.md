# Validation des horizons contre les ombres QuickMap (20 m)

*Réalisée le 14/11/2026, dans l'interface web de QuickMap (lecture manuelle).*

## Objectif

Vérifier que nos masques d'horizon, calculés à 120 m/px (`data/horizons/`), prédisent
correctement si le Soleil est visible depuis nos trois sites candidats. La référence est la
couche QuickMap **« ACT: Temporal Illumination › Terrain Shadows @UTC (80S, 20mpp) »**, une
simulation d'ombres à 20 m/px. Elle a deux conventions :
- **1** = éclairé, **0** = ombre ;
- l'éclairement est calculé pour le **centre** du disque solaire, comme dans notre outil.

## Méthode

1. Dans QuickMap : projection *Stereographic (South Pole)*, puis ajout de la couche d'ombres.
2. Pour chaque site : « Go to » sur les coordonnées de `sites.json`, puis zoom maximal
   (12,8 m/px). On lit la *Value at Cursor* au point exact et à 4 points voisins (~160 m au
   nord, au sud, à l'est et à l'ouest).
3. L'instant utilisé est celui qu'affiche la couche (*Requested Time*). Notre point
   subsolaire concorde avec celui de QuickMap à **0,003° près** : les éphémérides ne sont
   donc pas en cause.
4. Notre prédiction pour le même instant : élévation du Soleil moins hauteur de l'horizon
   dans sa direction, appelée **marge**. Le site est éclairé si la marge est positive.

> ⚠️ La valeur affichée par QuickMap **dépend du zoom** : à 200 m/px, la crête apparaît « 0 »,
> alors qu'elle vaut « 1 » à 12,8 m/px. Il faut toujours lire au zoom maximal.

## Résultats

| Instant (UTC) | Site | Soleil (élév. / az.) | Notre horizon | Marge | Notre prédiction | QuickMap (point / 5 points) | Accord |
|---|---|---|---|---|---|---|---|
| 14/11/2026 10:00 | Crête de liaison | 1,45° / 259° | −2,49° | +3,94° | éclairé | 1 / 4 sur 5 éclairés | ✅ |
| 14/11/2026 10:00 | Malapert | −0,42° / 120° | −1,54° | +1,13° | éclairé | 0 / 5 sur 5 à l'ombre ; éclairé à ~75 m vers le Soleil | ⚠️ limite |
| 14/11/2026 10:00 | Mons Mouton | 1,34° / 93° | +2,96° | −1,62° | ombre | 0 / 5 sur 5 à l'ombre | ✅ |
| 24/11/2026 06:00 | Crête de liaison | 1,10° / 140° | −0,96° | +2,06° | éclairé | 0 / 4 sur 5 à l'ombre (bord d'ombre à ~160 m) | ❌ |
| 24/11/2026 06:00 | Malapert | 5,54° / 360° | −1,76° | +7,29° | éclairé | 1 / 5 sur 5 éclairés | ✅ |
| 24/11/2026 06:00 | Mons Mouton | 6,16° / 333° | −1,33° | +7,49° | éclairé | 1 / 5 sur 5 éclairés | ✅ |

**Bilan : 4 accords, 1 cas limite et 1 désaccord sur 6.**

- L'obstacle majeur de Mons Mouton (le sommet voisin, à +3° vers l'est) est confirmé : c'est
  bien lui qui plonge le site dans l'ombre le 14/11.
- Quand la marge dépasse 5°, l'accord est total.

## Analyse des deux écarts

### 1. Malapert, 14/11 : effet de la résolution près du site

Le Soleil est sous l'horizontale (−0,42°). Dans sa direction, notre horizon est formé par
l'épaulement du massif lui-même, à **2 km**. Avec 120 m/px, la position exacte de la crête
est incertaine d'un ou deux pixels. Or à 20 m/px, la zone éclairée commence **à ~75 m** de
notre point, du côté du Soleil.

**Conclusion :** à l'échelle de 120 m, le site est bien en bordure de lumière. Le point
précis devra être repositionné sur la vraie crête avec un MNT à 20 m.

### 2. Crête de liaison, 24/11 : la courbure lunaire

Dans la direction du Soleil (azimut 140°), l'obstacle de notre masque est le **massif de
Malapert, à 135 km**. À cette distance, la courbure de la Lune abaisse le relief d'environ
5,2 km, soit environ 2,2° :

| Calcul de l'horizon à l'azimut 140° | Hauteur de l'horizon | Soleil à 1,10° |
|---|---|---|
| Avec courbure (notre méthode) | −0,96° | éclairé |
| Sans courbure (terrain « plat ») | **+1,26°** | **ombre**, comme QuickMap |

J'ai refait les 5 cas sans ambiguïté avec un calcul **sans courbure** : tous coïncident
alors avec QuickMap. Avec courbure, la crête du 24/11 est le seul désaccord. Le bord d'ombre
rectiligne observé dans QuickMap correspond bien à une ombre portée par un relief lointain.

**C'est une hypothèse, pas une certitude.** Elle expliquerait l'écart si la couche
QuickMap négligeait la courbure pour les obstacles très lointains. D'un point de vue
physique, la courbure est réelle : notre calcul doit la garder.

Pour trancher, il faudrait :
- interroger l'équipe ACT, à qui QuickMap propose d'écrire (« Contact ACT ») ;
- ou comparer avec une troisième source, par exemple l'outil d'éclairement de Moon Trek ou
  les cartes d'éclairement moyen LOLA, publiées par Mazarico et al. (2011).

## Mise à jour du 14/11/2026 : horizons à 20 m (étape 2)

Les 6 cas ont été recalculés **aux mêmes points**, ceux où QuickMap a été lu, avec les
horizons multi-résolution : relief proche (< 25 km) à 20 m, relief lointain à 120 m.

| Cas | Soleil | Horizon 120 m | Horizon 20 m | Prédiction | QuickMap |
|---|---|---|---|---|---|
| 14/11 crête | 1,45° | −2,49° | −2,49° | éclairé | éclairé ✅ |
| 14/11 Malapert | −0,42° | −1,54° | −1,55° | éclairé | ombre ⚠️ |
| 14/11 Mons Mouton | 1,34° | +2,96° | +2,96° | ombre | ombre ✅ |
| 24/11 crête | 1,10° | −0,96° | −0,96° | éclairé | ombre ❌ |
| 24/11 Malapert | 5,54° | −1,76° | −1,82° | éclairé | éclairé ✅ |
| 24/11 Mons Mouton | 6,16° | −1,34° | −1,34° | éclairé | éclairé ✅ |

Le relief à 20 m **ne change aucune prédiction** : les obstacles en jeu sont à 2 km et plus,
où 120 m suffisait déjà. L'hypothèse d'un effet de résolution pour Malapert est donc
écartée. Deux explications distinctes restent :

**Malapert, 14/11 : une définition différente de « éclairé ».** QuickMap calcule
l'éclairement **de la surface du sol**. Pour que le sol soit éclairé, le Soleil doit être à
la fois au-dessus de l'horizon et au-dessus du **plan de la pente locale**. Au sommet,
la pente à 20 m (≈1°) descend vers l'ouest-sud-ouest (azimut ≈255°), à l'opposé du Soleil
(azimut 120°). Le Soleil, déjà sous l'horizontale (−0,42°), passe donc sous le plan du sol :
−0,58° sur une base de 40 m et −1,21° sur 100 m. Le sol est dans **sa propre ombre**. Un
capteur placé à 2 m du sol voit, lui, le Soleil au-dessus de l'horizon. Cela explique aussi
pourquoi le sol redevient éclairé à ~75 m, sur le versant tourné vers le Soleil. Les autres
cas ne contredisent pas cette règle.

> Notre outil évalue un **panneau solaire ou une antenne sur un mât** : c'est la bonne
> question pour l'énergie et les communications. QuickMap évalue le **sol** : c'est la bonne
> question pour la température de surface et la glace d'eau. Les deux ne sont pas
> contradictoires.

**Crête, 24/11 : tranché le 14/11/2026, voir [validation_lola.md](validation_lola.md).** Les
cartes officielles LOLA (Mazarico et al. 2011) sont reproduites avec courbure (RMS 3,1 points),
pas sans courbure (RMS 11 points). Notre prédiction est donc la plus probable.

*Analyse initiale :* l'obstacle est le massif de Malapert, à 135 km. Seul un
calcul sans courbure lunaire reproduit la prédiction de QuickMap (Malapert à +1,26° au
lieu de −0,96°). Le plan de la pente ne l'explique pas : le Soleil reste 0,5° à 0,9°
au-dessus.

**Bilan :** 4 accords, 1 écart expliqué par la définition et 1 écart tranché en faveur de
notre calcul avec courbure, par une troisième source (cartes LOLA officielles).

## Recommandations

1. **Garder la courbure** dans nos masques, mais signaler dans l'application les cas où
   l'obstacle est à plus de 100 km et la marge inférieure à 2,5°. Ce sont les cas où les
   outils divergent. **Fait** : verdict de fiabilité, voir `docs/membre3_application.md`.
2. ~~Refaire les trois points à 20 m/px.~~ **Fait le 14/11/2026** avec `LDEM_85S_20M` : la
   crête se déplace de 131 m, Malapert de 15 m, et les prédictions restent inchangées.
4. Ajouter dans l'application un indicateur « **éclairement du sol** » (Soleil au-dessus du
   plan de la pente locale), en plus de celui du capteur à 2 m. Il sert à la température et
   à la science de surface.
3. Afficher dans l'application une **marge de sécurité**. **Fait**, avec un seuil fixé à
   ±0,5° : une fois le relief à 20 m utilisé, nos erreurs mesurées sont ≤ 0,2°, et un seuil
   de ±1° classait tous les sites polaires comme « fragiles ».

## Limites de cette validation

- Seulement 2 instants × 3 sites, lus à la main. Il n'existe pas d'accès en masse aux tuiles
  QuickMap : leur serveur n'est pas une API publique, et l'accès direct a été refusé.
- La couche QuickMap annonce une précision de 0,5° en longitude subsolaire et de 0,1° en
  latitude subsolaire.
- Le pas de 160 m entre les 5 points est proche de notre pixel de 120 m : la comparaison est
  locale, pas statistique.
