# Validation of the horizons against the QuickMap shadows (20 m)

*Done on 14 Nov 2026, in the QuickMap web interface (manual reading).*

## Goal

Check that our horizon masks, computed at 120 m/px (`data/horizons/`), correctly predict whether
the Sun is visible from our three candidate sites. The reference is the QuickMap layer
**"ACT: Temporal Illumination › Terrain Shadows @UTC (80S, 20mpp)"**, a shadow simulation at
20 m/px. It has two conventions:
- **1** = lit, **0** = shadow;
- illumination is computed for the **centre** of the solar disk, as in our tool.

## Method

1. In QuickMap: *Stereographic (South Pole)* projection, then add the shadow layer.
2. For each site: "Go to" the coordinates of `sites.json`, then maximum zoom (12.8 m/px). We read
   the *Value at Cursor* at the exact point and at 4 neighbouring points (~160 m north, south,
   east and west).
3. The instant used is the one shown by the layer (*Requested Time*). Our subsolar point agrees
   with QuickMap's to within **0.003°**: the ephemerides are therefore not in question.
4. Our prediction for the same instant: Sun elevation minus horizon height in its direction,
   called the **margin**. The site is lit if the margin is positive.

> ⚠️ The value shown by QuickMap **depends on the zoom**: at 200 m/px, the ridge shows "0", while
> it is "1" at 12.8 m/px. Always read at maximum zoom.

## Results

| Instant (UTC) | Site | Sun (elev. / az.) | Our horizon | Margin | Our prediction | QuickMap (point / 5 points) | Agreement |
|---|---|---|---|---|---|---|---|
| 14 Nov 2026 10:00 | Connecting Ridge | 1.45° / 259° | −2.49° | +3.94° | lit | 1 / 4 of 5 lit | ✅ |
| 14 Nov 2026 10:00 | Malapert | −0.42° / 120° | −1.54° | +1.13° | lit | 0 / 5 of 5 in shadow; lit ~75 m towards the Sun | ⚠️ borderline |
| 14 Nov 2026 10:00 | Mons Mouton | 1.34° / 93° | +2.96° | −1.62° | shadow | 0 / 5 of 5 in shadow | ✅ |
| 24 Nov 2026 06:00 | Connecting Ridge | 1.10° / 140° | −0.96° | +2.06° | lit | 0 / 4 of 5 in shadow (shadow edge at ~160 m) | ❌ |
| 24 Nov 2026 06:00 | Malapert | 5.54° / 360° | −1.76° | +7.29° | lit | 1 / 5 of 5 lit | ✅ |
| 24 Nov 2026 06:00 | Mons Mouton | 6.16° / 333° | −1.33° | +7.49° | lit | 1 / 5 of 5 lit | ✅ |

**Summary: 4 agreements, 1 borderline case and 1 disagreement out of 6.**

- The main obstacle of Mons Mouton (the nearby summit, at +3° towards the east) is confirmed: it is
  indeed what puts the site in shadow on 14 Nov.
- When the margin exceeds 5°, the agreement is total.

## Analysis of the two differences

### 1. Malapert, 14 Nov: effect of the resolution near the site

The Sun is below the horizontal (−0.42°). In its direction, our horizon is formed by the shoulder
of the massif itself, **2 km** away. At 120 m/px, the exact position of the crest is uncertain by
one or two pixels. Yet at 20 m/px, the lit area starts **~75 m** from our point, on the Sun's
side.

**Conclusion:** at the 120 m scale, the site is indeed at the edge of the light. The exact point
will have to be moved onto the real crest with a 20 m DEM.

### 2. Connecting Ridge, 24 Nov: lunar curvature

In the direction of the Sun (azimuth 140°), the obstacle in our mask is the **Malapert massif,
135 km away**. At this distance, the curvature of the Moon lowers the relief by about 5.2 km,
i.e. about 2.2°:

| Horizon computation at azimuth 140° | Horizon height | Sun at 1.10° |
|---|---|---|
| With curvature (our method) | −0.96° | lit |
| Without curvature ("flat" terrain) | **+1.26°** | **shadow**, like QuickMap |

We redid the 5 unambiguous cases with a computation **without curvature**: they then all match
QuickMap. With curvature, the ridge on 24 Nov is the only disagreement. The straight shadow edge
seen in QuickMap does match a shadow cast by distant relief.

**This is a hypothesis, not a certainty.** It would explain the difference if the QuickMap layer
ignored curvature for very distant obstacles. Physically, curvature is real: our computation must
keep it.

To decide, we would need to:
- ask the ACT team, whom QuickMap invites users to write to ("Contact ACT");
- or compare with a third source, for example the Moon Trek illumination tool or the LOLA mean
  illumination maps published by Mazarico et al. (2011).

## Update of 14 Nov 2026: 20 m horizons (step 2)

The 6 cases were recomputed **at the same points**, where QuickMap was read, with the
multi-resolution horizons: near relief (< 25 km) at 20 m, far relief at 120 m.

| Case | Sun | 120 m horizon | 20 m horizon | Prediction | QuickMap |
|---|---|---|---|---|---|
| 14 Nov ridge | 1.45° | −2.49° | −2.49° | lit | lit ✅ |
| 14 Nov Malapert | −0.42° | −1.54° | −1.55° | lit | shadow ⚠️ |
| 14 Nov Mons Mouton | 1.34° | +2.96° | +2.96° | shadow | shadow ✅ |
| 24 Nov ridge | 1.10° | −0.96° | −0.96° | lit | shadow ❌ |
| 24 Nov Malapert | 5.54° | −1.76° | −1.82° | lit | lit ✅ |
| 24 Nov Mons Mouton | 6.16° | −1.34° | −1.34° | lit | lit ✅ |

The 20 m relief **changes no prediction**: the obstacles involved are 2 km away or more, where
120 m was already enough. The resolution hypothesis for Malapert is therefore ruled out. Two
distinct explanations remain:

**Malapert, 14 Nov: a different definition of "lit".** QuickMap computes the illumination **of
the ground surface**. For the ground to be lit, the Sun must be both above the horizon and above
the **plane of the local slope**. At the summit, the 20 m slope (≈1°) goes down towards the
west-south-west (azimuth ≈255°), opposite the Sun (azimuth 120°). The Sun, already below the
horizontal (−0.42°), therefore passes below the ground plane: −0.58° over a 40 m base and −1.21°
over 100 m. The ground is in **its own shadow**. A sensor 2 m above the ground, however, sees the
Sun above the horizon. This also explains why the ground is lit again ~75 m away, on the slope
facing the Sun. The other cases do not contradict this rule.

> Our tool evaluates a **solar panel or an antenna on a mast**: that is the right question for
> energy and communications. QuickMap evaluates the **ground**: that is the right question for
> surface temperature and water ice. The two do not contradict each other.

**Ridge, 24 Nov: settled on 14 Nov 2026, see [validation_lola.md](validation_lola.md).** The
official LOLA maps (Mazarico et al. 2011) are reproduced with curvature (RMS 3.1 points), not
without curvature (RMS 11 points). Our prediction is therefore the most likely.

*Initial analysis:* the obstacle is the Malapert massif, 135 km away. Only a computation without
lunar curvature reproduces QuickMap's prediction (Malapert at +1.26° instead of −0.96°). The
slope plane does not explain it: the Sun stays 0.5° to 0.9° above.

**Summary:** 4 agreements, 1 difference explained by the definition and 1 difference settled in
favour of our computation with curvature, by a third source (official LOLA maps).

## Recommendations

1. **Keep the curvature** in our masks, but flag in the application the cases where the obstacle
   is more than 100 km away and the margin below 2.5°. These are the cases where the tools
   diverge. **Done**: reliability verdict, see `docs/member3_application.md`.
2. ~~Redo the three points at 20 m/px.~~ **Done on 14 Nov 2026** with `LDEM_85S_20M`: the ridge
   moves by 131 m, Malapert by 15 m, and the predictions are unchanged.
3. Show a **safety margin** in the application. **Done**, with a threshold set at ±0.5°: once the
   20 m relief is used, our measured errors are ≤ 0.2°, and a ±1° threshold classified all polar
   sites as "fragile".
4. Add a "**ground illumination**" indicator to the application (Sun above the plane of the local
   slope), in addition to the 2 m sensor one. It is useful for temperature and surface science.

## Limits of this validation

- Only 2 instants × 3 sites, read by hand. There is no bulk access to the QuickMap tiles: their
  server is not a public API, and direct access was refused.
- The QuickMap layer states an accuracy of 0.5° in subsolar longitude and 0.1° in subsolar
  latitude.
- The 160 m step between the 5 points is close to our 120 m pixel: the comparison is local, not
  statistical.
