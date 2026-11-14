# Member 4: energy and telecommunications budget

> Question: *at this site and on these dates, does a given vehicle have enough energy, and how much
> data can it send to Earth?*

The visibilities of the Sun and the Earth (members 1 to 3) become mission figures: the battery
charge, the battery or panel size needed, the data rate and the data volume. Code:
`app/src/astro/budget.ts`. Interface: the **energy and telecom budget** panel of the application
(now Mission Lab > Power & radio).

These are **orders of magnitude** to compare sites and dates, not the design of a vehicle.

## 1. Energy

At each step of the simulation (same step as the timeline):

```
power (W)      = area × efficiency × solar flux × visible fraction of the disk × geometry
solar flux     = 1,361 W/m² / (Moon–Sun distance in AU)²     ← Horizons table (member 1)
geometry       = cos(elevation)  vertical panel facing the Sun
               = sin(elevation)  horizontal panel
consumption    = day consumption if the Sun is visible (≥ ½ disk), otherwise night (survival) consumption
```

The battery starts full. Surpluses recharge it, with a 95 % efficiency, and deficits drain it.
It does not go below its discharge **floor** (20 % for an 80 % depth of discharge). If the deficit
continues at the floor, the time spent is counted as an **energy failure**.

Results:

| Indicator | Computation |
|---|---|
| Holds the period / failure | Total time spent at the floor with a deficit |
| Lowest battery | Minimum charge, in % |
| **Battery needed** | Largest cumulative deficit from the full state, divided by the depth of discharge |
| **Panels needed** | Smallest area with no failure for the chosen battery, found by bisection. "Impossible" if even 1,000 m² is not enough, because the night is too long for the battery |

## 2. Telecom: direct link with the Earth

Classic link budget, computed at each step where the Earth is visible:

```
EIRP (dBW)  = 10·log(P_tx) + G_antenna − 1.5 dB (cables, pointing)
G_antenna   = 10·log(0.55 · (π·D·f/c)²)
path loss   = 20·log(4π·d·f/c)                       d = site–Earth distance (Horizons table)
C/N0 (dBHz) = EIRP − path loss − atmosphere + G/T_station + 228.6
data rate   = min(max radio rate, 10^((C/N0 − required Eb/N0 − margin) / 10))
```

| Assumption | Value |
|---|---|
| Required Eb/N0 | 2.5 dB (turbo or LDPC coding, implementation loss included) |
| Margin kept in reserve | 3 dB |
| Earth atmosphere | 0.3 dB (S), 0.5 dB (X), 2 dB (Ka) |
| G/T DSN 34 m | 41 dB/K (S), 53.5 (X), 61 (Ka) |
| G/T DSN 70 m | 50 dB/K (S), 61 (X) |
| G/T commercial 12 m station | 22 dB/K (S), 35 (X), 43 (Ka) |

These G/T are typical values at mid-elevation (DSN orders of magnitude, document 810-005). We
assume that a station always sees the Moon: a network of three sites 120° apart in longitude
covers it at all times. The **allocated station time** (hours per day) reduces the volume
proportionally. Without energy, that is battery at the floor and Sun hidden, the vehicle does not
transmit.

The LRO relay is not counted in the data volume: LRO has no relay radio for landers. It serves as
a geometric indicator for a **low polar relay orbit**. See
[member3_application.md](member3_application.md).

## 3. Reference vehicles

The three vehicles can be edited in the application, with the "Edit parameters" button:

| | Small lander (CLPS class) | Rover (VIPER class) | Long-duration station |
|---|---|---|---|
| Panels | 2.5 m², 28 %, vertical | 1.5 m², 28 %, vertical | 30 m², 28 %, vertical |
| Day / night consumption | 250 W / 80 W | 200 W / 50 W | 3,000 W / 1,500 W |
| Battery (depth) | 3 kWh (80 %) | 2 kWh (80 %) | 30 kWh (80 %) |
| Radio | X, 20 W, 0.5 m antenna | X, 15 W, 0.3 m antenna | Ka, 50 W, 1 m antenna |
| Ground station | commercial 12 m, 24 h/d | DSN 34 m, 8 h/d | DSN 34 m, 24 h/d |
| Max radio rate | 2 Mbit/s | 1 Mbit/s | 100 Mbit/s |

## 4. Results on the candidate sites

One lunar day (29.5 d) from 1 Jan 2027. Computed with `npm run mission-report` (in `app/`), the
same code as the application.

| Site | Sun | Longest night | Mean flux (vertical panel) |
|---|---|---|---|
| Connecting Ridge | 100 % | 0 h | 1,407 W/m² |
| Malapert | 78 % | 158 h | 1,091 W/m² |
| Mons Mouton | 48 % | 313 h | 669 W/m² |

The flux exceeds 1,361 W/m² in January, because the Earth and the Moon are then closest to the
Sun.

**Small lander (3 kWh battery):**

| Site | Budget | Battery needed | Panels needed with 3 kWh | Data (29.5 d) |
|---|---|---|---|---|
| Connecting Ridge | ✅ holds (battery at 100 %) | 0 kWh | 0.6 m² | 303 GB |
| Malapert | ❌ 103 h of failure | 13.3 kWh | impossible | 370 GB |
| Mons Mouton | ❌ 303 h of failure | 31.1 kWh | impossible | 292 GB |

**Rover:** ridge ✅; Malapert ❌ (8.3 kWh needed); Mons Mouton ❌ (19.4 kWh).

**Long-duration station:** ridge ✅ with only 7.5 m² of panels; Malapert and Mons Mouton would
need **251 kWh** and **583 kWh** of battery. A permanent base therefore needs a site with no long
night (the ridge) or another energy source: fuel cell or radioisotopes.

**What this shows:**
- **Energy makes the difference.** The data rate is capped by the radio: 2 Mbit/s with 17 dB of
  margin for the lander, 1 Mbit/s with 33 dB for the rover. The data volume therefore depends
  mostly on the time the Earth is visible.
- **The longest night sizes the battery.** A 158 h night at 80 W needs 12.6 kWh of usable energy.
  A 3 kWh battery gets through no night longer than about 30 h.
- **The date matters as much as the site.** This January lunar day is "winter" for Malapert. In
  October 2027, Malapert has no night at all over 14 days (see
  [member5_decision.md](member5_decision.md)).

## Limits

- No thermal model: the survival consumption is a fixed value.
- No degradation of the panels or the battery, and no dust.
- The vertical panel is assumed to rotate to follow the Sun. Fixed, it would produce less.
- The link assumes the centre of the Earth is above the relief. Diffraction and multipath near
  the horizon are not modelled.
