# Validation against the official LOLA illumination maps

*14 Nov 2026. Third independent source, after JPL Horizons for the ephemerides and QuickMap for
the shadows at a given instant.*

## The official maps

NASA's LOLA team (Goddard Space Flight Center) publishes illumination maps of the South Pole,
described by **Mazarico et al. (2011)** and computed hour by hour over a **full 18.6-year
nutation cycle**. Source: https://pgda.gsfc.nasa.gov/products/69.

| File (85°S–90°S, 60 m/pixel) | Content | Size |
|---|---|---|
| `LPSR_85S_060M_201608.TIF` | Permanent shadows | 0.7 MB |
| `AVGVISIB_85S_060M_201608.TIF` | Mean visible fraction of the solar disk | 34 MB |
| `AVGVISIB_85S_060M_201608_EARTH.TIF` | Mean fraction of time the Earth is visible | 25 MB |

The files are in `data/validation_lola/`, excluded from Git. A single script downloads and
compares them.

## Method

1. `npm run validate-lola` (in `app/`) computes, with **the same code as the application**, the
   mean sunlight and Earth visibility over 18.6 years:
   - for every pixel of the three optimizer regions, i.e. 285,000 pixels of 200 m;
   - for every site, with a horizon in 720 directions.
   It uses 2,400 instants spread over 18.6 years.
2. `.venv/Scripts/python scripts/validate_lola.py` brings the official maps onto our 200 m pixels
   (mean of the 60 m pixels), then compares.

Two differences of definition must be kept in mind:
- our computations are made for a **sensor 2 m** above the ground, NASA's **at ground level**;
- for the Earth, we require its **centre** to be visible. NASA counts the Earth as visible as
  soon as **a piece** of its disk shows: see below.

## Results

### Permanent shadows

| Region | Our area | Official area | Overlap (IoU) | Pixels in agreement |
|---|---|---|---|---|
| Pole (Shackleton, ridge, de Gerlache) | 1,121 km² | 1,110 km² | **0.93** | 98.8 % |
| Malapert | 34.6 km² | 35.5 km² | 0.80 | 99.7 % |
| Mons Mouton (covered part, 78 %) | 50.7 km² | 54.1 km² | 0.88 | 99.7 % |

The areas agree to within **1 to 6 %**. Disagreements are limited to the edges of the shadow
areas, over one 200 m pixel.

### Mean sunlight over 18.6 years

| Region | Bias | RMS | 95 % of differences below | Correlation |
|---|---|---|---|---|
| Pole | −1.0 pt | **2.5 pts** | 4.0 pts | **0.985** |
| Malapert | −1.3 pt | 2.1 pts | 3.9 pts | 0.992 |
| Mons Mouton | −0.5 pt | 2.5 pts | 4.3 pts | 0.984 |

One point is 1 % of the time. The agreement is very good. The slight negative bias could come
from our horizon in 72 directions, which is coarser, or from the 200 m resolution. We have not
isolated it.

### Earth visibility: the definition

| Region | Bias (centre of the Earth) | RMS | Correlation |
|---|---|---|---|
| Pole | −2.5 pts | 4.5 pts | 0.988 |
| Malapert | −4.4 pts | 6.3 pts | 0.994 |
| Mons Mouton | −3.7 pts | 5.8 pts | 0.989 |

The correlation is excellent, but we systematically see the Earth a little less often. The
computation at the sites with several definitions gives the reason:

| Site | Centre visible (our rule) | A piece visible | Official map (max within 60 m) |
|---|---|---|---|
| Connecting Ridge | 53.7 % | **58.3 %** | **58.2 %** |
| Mons Mouton | 81.0 % | **93.4 %** | **93.2 %** |

**The official map counts the Earth as visible as soon as its upper edge rises above the
relief.** Our rule, the centre, is more cautious. It suits an antenna aimed at the centre of the
Earth better. The difference therefore comes from the definition, not from an error.

### At the sites: illumination changes from one metre to the next

| Site | Us (sensor at 2 m) | Official at the same point | Official, maximum within 240 m |
|---|---|---|---|
| Connecting Ridge | 87.7 % | 57.0 % | **86.4 %** |
| Malapert | 67.3 % | 56.8 % | **70.4 %** |
| Mons Mouton | 45.1 % | 46.0 % | 47.0 % |

Our sites are placed **at the highest summit**, found on the 20 m relief. On a ridge, sunlight
drops by 30 points within 200 m. The official 60 m pixel that contains the site mixes the summit
and its flanks, while its local maximum matches our summit. The highest sunlight on the whole
official map is 88.4 %, versus 87.7 % for our ridge.

## Lunar curvature: the QuickMap case of 24 Nov is settled

The remaining disagreement with QuickMap (ridge, 24 Nov 2026, see
[validation_quickmap.md](validation_quickmap.md)) could only be explained by **removing the
curvature** of the Moon. The official maps allow us to decide.

`scripts/validate_curvature.py` draws 80 random points around the pole, within ±40 km. It
computes their sunlight over 18.6 years with two horizons, one with curvature and one without,
then compares with the official map:

| Horizon | Bias | RMS | Correlation |
|---|---|---|---|
| **With curvature (our method)** | −1.7 pt | **3.1 pts** | **0.968** |
| Without curvature | −9.9 pts | 11.0 pts | 0.873 |

**NASA takes curvature into account, as we do.** Without curvature, distant relief looks higher
and steals about 10 points of sunlight: that is very far from the official map. On 24 Nov, our
prediction ("lit") is therefore the most likely, and the difference comes from the way QuickMap
handles very distant relief. The application still flags these cases "to be confirmed": obstacle
more than 100 km away and margin below 2.5°.

## Summary

| Check | Result |
|---|---|
| Ephemerides (Horizons) | ≤ 0.003° with member 1's table |
| Shadows at an instant (QuickMap) | 4 agreements, 1 difference explained (ground or sensor), 1 difference settled in our favour (curvature) |
| Permanent shadows (LOLA) | Areas within 1–6 %, IoU 0.80 to 0.93 |
| Mean sunlight (LOLA) | RMS 2.1 to 2.5 points, correlation ≥ 0.98 |
| Earth visible (LOLA) | Correlation ≥ 0.99. Difference due to the definition (centre or edge) |
