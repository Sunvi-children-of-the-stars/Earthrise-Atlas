# Member 1: JPL Horizons ephemerides

> Question: *where are the Sun and the Earth in the sky of a site, on a given date?*

## What was done

Instead of one Horizons query per site, we download **a single table**: the position of the Sun
and the Earth seen from the **centre of the Moon**. The application derives the elevation and
azimuth for any point on the surface, including a custom site. To do so, it applies the Moon's
rotation (IAU model) and the site parallax.

```bash
.venv/Scripts/python scripts/fetch_ephemeris.py --start 2026-01-01 --years 5 --step 1h
```

| Horizons parameter | Value |
|---|---|
| Mode | `EPHEM_TYPE='VECTORS'` |
| Centre | `CENTER='500@301'` (centre of the Moon) |
| Frame | `REF_SYSTEM='ICRF'`, `REF_PLANE='FRAME'` |
| Corrections | `VEC_CORR='LT+S'`, i.e. **apparent** directions (light time + aberration), like `APPARENT='AIRLESS'` in observer mode |
| Bodies | Sun (`10`) and Earth (`399`) |
| Period and step | 1 Jan 2026 → 1 Jan 2031, one hour, i.e. 43,825 points (1 MB) |

Output: `data/ephemeris/sun_earth_2026-01-01_5y.f32`, plus its `.json`. Horizons times are in
TDB, which the application converts to UTC (TDB ≈ UTC + 69.2 s).

**In the application** (`app/src/astro/ephemeris.ts`):
- the application loads the table at startup (`loadEphemerisTable`), then interpolates
  between two hours. The interpolation error is below 0.001°;
- outside 2026–2030, it falls back to the built-in series of the *Astronomical Almanac*;
- the badge at the top right shows the source used for the displayed period.
  The optimizer receives the same table in its Web Worker.

The table also gives the **distances**, used by member 4:
- Moon–Sun: from 0.981 to 1.019 AU. The solar flux therefore varies from 1,311 to 1,415 W/m²,
  instead of a fixed 1,361 W/m²;
- Moon–Earth: from 356,653 to 406,677 km, for the radio link budget.

## Was the built-in computation good enough?

The `npm run validate-ephemeris` script (in `app/`) compares both methods with Horizons in
observer mode (topocentric elevation and azimuth), one point every 12 h from 1 Nov 2026 to
31 Dec 2028, i.e. 1,583 points per site and per body.

**1. Elevation difference with Horizons**

| Site | Body | Built-in series: RMS / max | Horizons table: RMS / max |
|---|---|---|---|
| Connecting Ridge | Sun | 0.002° / 0.005° | 0.001° / 0.002° |
| Connecting Ridge | Earth | 0.061° / **0.188°** | 0.001° / 0.003° |
| Malapert | Sun | 0.002° / 0.005° | 0.001° / 0.002° |
| Malapert | Earth | 0.061° / **0.184°** | 0.001° / 0.003° |
| Mons Mouton | Sun | 0.002° / 0.005° | 0.001° / 0.002° |
| Mons Mouton | Earth | 0.059° / **0.172°** | 0.001° / 0.003° |

The series error on the Earth comes from the position of the Moon around the Earth, which is
accurate to about 0.3° in longitude. The Sun was already very good.

**2. Effect on the results**: 12 lunar months from 1 Nov 2026, 10 min step, on the real
horizons.

| Site | % Sun | % Earth | Sunrise/sunset shifted by | Earth rise/set shifted by |
|---|---|---|---|---|
| Connecting Ridge | 88.25 → 88.28 | 51.79 → 51.77 | median 0 h, max 0.5 h | median **1 h**, max **2.5 h** |
| Malapert | 67.89 → 67.87 | 80.26 → 80.22 | median 0 h, max 0.8 h | median **1.2 h**, max **2.2 h** |
| Mons Mouton | 45.18 → 45.18 | 80.82 → 80.80 | median 0 h, max 0.2 h | median **1.2 h**, max **2.2 h** |

**Conclusion:**
- **To compare sites and dates, the built-in computation was enough.** Percentages, longest
  nights and blackouts change by less than 0.05 point, or by a few hours over periods of several
  days.
- **For Earth times, it was not enough.** Because of libration, the Earth rises and sets
  slowly, at most about 0.06° per hour. An error of 0.18° therefore shifts its rise or set by
  1 h on average, and up to 2.5 h. That is too much to plan a communication window.
- **With the Horizons table, the difference drops to 0.003°**, i.e. about 1 min on the times.
  It is the default method from 2026 to 2030.

## Going further

- Extend the table: `--years 10` (2 MB).
- `data/ephemeris/index.json` lists the tables, and the application loads the first one.
- The relays (LRO) have their own script: `scripts/fetch_relay_ephemeris.py`.
