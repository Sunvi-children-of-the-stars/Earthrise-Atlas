# Decision: source of the ephemerides

**Decision (14 Nov 2026, revised the same day): the positions of the Sun and the Earth come from
a precomputed JPL Horizons table (`data/ephemeris/`, DE440, one-hour step, 2026 to 2030).
Outside this period, the application uses its built-in series (`app/src/astro/ephemeris.ts`).**

The first version of this decision made the built-in computation the official source. The
Horizons table, produced by `scripts/fetch_ephemeris.py` and validated by
`npm run validate-ephemeris`, replaced it. It showed that the series, accurate to 0.19°,
**shift Earth rise and set times by about 1 h, and up to 2.5 h**. Yet the tool displays exactly
the time left before the Earth sets.

## Why a table rather than a computation per site

| Criterion | Horizons table (seen from the Moon's centre) | Horizons queries per site | Series only |
|---|---|---|---|
| Accuracy (elevation) | **≤ 0.003°** | reference | Sun ≤ 0.005°, Earth ≤ 0.19° |
| Earth rise and set times | exact to a few minutes | exact | up to 2.5 h off |
| Custom sites and optimizer | ✅ the table gives directions, the application adds the site parallax | ❌ one query per point | ✅ |
| Period covered | 2026 to 2030 (1 MB) | downloaded | unlimited |

The table holds the Sun and Earth vectors seen from the **centre** of the Moon. The application
rotates them into the lunar frame (IAU model) and adds the site parallax, which reaches 0.26°
for the Earth. It therefore works for any point, including the 160,000 pixels of an optimizer
region.

## Validation

`npm run validate-ephemeris`, in `app/`: comparison with Horizons in observer (topocentric)
mode at the candidate sites, from 1 Nov 2026 to 31 Dec 2028, every 12 h, i.e. 1,583 points per
site.

| Site | Body | Series: RMS / max | Table: RMS / max |
|---|---|---|---|
| Connecting Ridge | Sun | 0.002° / 0.005° | 0.001° / 0.002° |
| Connecting Ridge | Earth | 0.061° / 0.188° | 0.001° / 0.003° |
| Malapert | Earth | 0.061° / 0.184° | 0.001° / 0.003° |
| Mons Mouton | Earth | 0.059° / 0.172° | 0.001° / 0.003° |

Impact on one year of results, series versus table: the percentages change by less than
0.05 point, but Earth rise and set times shift by about 1 h (2.5 h at most). Details:
[member1_ephemeris.md](member1_ephemeris.md).

## Limits

- Outside 2026 to 2030, the application falls back to the series, and the badge at the top of
  the page shows the source in use. To extend the period, run `scripts/fetch_ephemeris.py`
  again.
- No refraction: the Moon has no atmosphere. The horizon is the one made by the relief and the
  lunar curvature.
