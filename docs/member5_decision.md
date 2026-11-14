# Member 5: decision support and presentation

> Question: *which site, and when to land?*

## 1. The tool: "Choose the landing date"

Application panel. Code: `app/src/astro/landing.ts` and `app/src/components/LandingPlanner.tsx`
(now Mission Lab > Landing dates).

1. Set the earliest possible landing, the search window (3, 6 or 12 months), the mission
   duration (7 d, 14 d or one lunar day), and how long the Sun and the Earth must be visible
   after landing.
2. For each candidate site, the window is simulated **once**, with a 30 min step. Each possible
   landing date, every 12 h, is then evaluated over the mission that follows. The vehicle and
   battery are member 4's.
3. A date is **excluded** in two cases:
   - the Sun (energy) or the Earth (direct telemetry) is missing during the first hours after
     landing, 6 h by default;
   - the battery runs flat during the mission.
4. The remaining dates get a **score out of 100**:

| Criterion | Weight | Measure |
|---|---|---|
| Sun | 25 % | Share of time in sunlight |
| Earth | 20 % | Share of time with the Earth in view |
| No long night | 20 % | 1 − longest night / mission duration |
| **Delay tolerance** | 15 % | Number of days during which the following dates remain possible (full score at 15 days, half a lunar month; with 5 days, several windows tied at 100). A launch often slips: an isolated date is risky. |
| Data | 10 % | Volume that can be transmitted, relative to the best |
| Battery reserve | 10 % | Minimum charge |

The weights are in `WEIGHTS` (`landing.ts`). They are easy to adjust after a team discussion.

5. Results:
   - a **strip** per site, where each cell is a date (green: good score, grey: excluded);
   - the **ranking** of the best windows, with the "pros" and "cons" written in plain words;
   - an **Analyse** button that opens the date in the detailed view.

## 2. Results for 2027

The 12 months of 2027 were scanned, i.e. 731 dates per site. Command `npm run mission-report` in
`app/`, with the Horizons table.

**Small lander, 14-day mission** (Sun and Earth required 6 h after landing):

| Site | Possible dates | Best date | Score | Delay tolerated |
|---|---|---|---|---|
| **Malapert** | 172 / 731 (24 %) | **5 Oct 2027 12:00 UTC** | 100 | **22 days** |
| Connecting Ridge | 257 / 731 (35 %) | 16 Aug 2027 00:00 UTC | 99 | 14 days |
| Mons Mouton | 24 / 731 (3 %) | 6 Oct 2027 12:00 UTC | 87.5 | — |

Scores recomputed on 14 Nov 2026 with the delay tolerance full at 15 days: only the Malapert
window reaches 100, the ridge windows score 98.5 to 99. The best windows combine 100 % Sun,
100 % Earth, no night and about 300 GB that can be transmitted. For the ridge, they come back
every lunar month from August to November 2027 (16 Aug, 12 Sep, 9 Oct, 5 Nov), with 14 days of
delay tolerated each time.

**Small lander, one lunar day mission (29.5 d)** (scores computed with the old tolerance scale,
full at 5 days; the ranking does not depend on it):

| Site | Possible dates | Best date | Score | Sun / Earth / longest night / longest Earth blackout |
|---|---|---|---|---|
| **Malapert** | 44 / 731 | **5 Oct 2027 12:00 UTC** | 93.6 | 92 % / 84 % / 38 h / 113 h |
| Connecting Ridge | 223 / 731 | 12 Sep 2027 12:00 UTC | 88.1 | 100 % / 57 % / 0 h / **305 h** |
| Mons Mouton | **0** / 731 | — | — | battery flat on every date |

The rover gives the same ranking.

## 3. Recommendation

**Main site: Malapert Massif, landing on 5 October 2027 around 12:00 UTC.**

- For 14 days: Sun and Earth visible **100 % of the time**, with no night at all. The battery
  stays full and about 300 GB can be transmitted directly.
- The window stays open for **22 days**: the launch can slip by three weeks.
- It is the only candidate site that sees the Earth almost all the time. Its summit dominates the
  horizon: 80 % of the time over a year, 84 % over the long mission. No relay is required.
- It lies in an official Artemis III region (Malapert Massif) and **0.7 km** from a permanently
  shadowed area, of interest for water ice.

**Alternative: Connecting Ridge, windows from August to November 2027.**

- It is the best site for **energy**: Sun 100 % of the time, no night, even over 29.5 d. A
  long-duration station holds with 7.5 m² of panels.
- However, the Earth is hidden there **for up to 13 days in a row**. An **orbiting relay** is
  needed: with the LRO orbit, the longest total blackout drops to 1 h 49.
- It is the choice for a lasting base, provided a relay is planned.

**To avoid: Mons Mouton.** Only 3 % of the dates suit 14 days, and none suit a month. The
13-day nights drain any reasonable battery: the lander would need 31 kWh.

**What could change the recommendation:**
- a mission longer than 14 days without a relay: Malapert remains the best;
- a longer mission with a relay: the ridge becomes preferable;
- the uncertainties. The application's reliability verdict flags dates where the Sun or the
  Earth graze the horizon. It should be checked (Analyse button) before choosing a date.

## 4. Demo script (about 2 minutes)

1. **The problem (15 s).** At the South Pole, the Sun and the Earth skim the horizon. A few
   metres of relief decide energy and communications.
2. **A site (30 s).** Open Malapert. Show the sky view (real horizon), the timeline and the
   cards: "Earth sets in…" and the longest night.
3. **Energy (20 s).** The energy and telecom budget: battery curve, "Holds the period" or
   "Failure", battery needed. Switch to Mons Mouton: the failure appears.
4. **When to land (30 s).** Run "Find the best dates" over 12 months of 2027: the green and grey
   strip, the ranking, then click **Analyse** on Malapert on 5 Oct 2027.
5. **Where to land (20 s).** The zone search with the official Artemis III outlines, the "Link
   with relay" profile, and the best zones on the rim of de Gerlache.
6. **Confidence (15 s).** The JPL Horizons ephemerides and the validation against the official
   LOLA maps: 93 % overlap of the permanent shadows, 2.5 points of difference on mean sunlight.
   The reliability verdict of each result.

## 5. Presentation outline (7 slides at most)

1. The challenge and why the South Pole is hard (grazing Sun and Earth).
2. The data: LOLA (20 m relief), JPL Horizons (Sun, Earth, LRO), Artemis III regions.
3. The method: horizon of each site, then visibility, then energy and telecom.
4. The demo (video).
5. The results: table of the 3 sites, then the recommendation Malapert on 5 Oct 2027.
6. The validation: Horizons, official LOLA maps, QuickMap.
7. Limits and next steps: real relays (Lunar Pathfinder, Moonlight), thermal model, 5 m DEM.
