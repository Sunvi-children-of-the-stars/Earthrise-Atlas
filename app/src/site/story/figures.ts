/** Figures quoted by the Story chapters, computed on a fixed reference period (spec 6.1). */
import { metrics, simulate } from "../../astro/analysis";
import type { Site } from "../../astro/ephemeris";
import type { HorizonMask } from "../../astro/horizon";
import { relayAnalysis, type RelayData } from "../../astro/relay";

/** Lunar day starting 14/11/2026 16:00 UTC: the period of the reference values (tests, docs). */
export const STORY_START = Date.UTC(2026, 10, 14, 16);
export const STORY_HOURS = 708.7;

export interface StoryFigures {
  sunMaxAlt: number;
  sunPct: number;
  earthPct: number;
  longestNoEarthH: number;
  longestNoLinkH: number | null;
  passesPerDay: number | null;
}

export function storyFigures(ridge: Site, ridgeMask: HorizonMask, lro: RelayData | null): StoryFigures {
  const m = metrics(simulate(ridge, ridgeMask, STORY_START, STORY_HOURS, 30));
  const r = lro ? relayAnalysis(ridge, ridgeMask, lro, STORY_START, STORY_HOURS) : null;
  const ok = r && r.available ? r : null;
  return {
    sunMaxAlt: m.sunMaxAlt, sunPct: m.sunPct, earthPct: m.earthPct, longestNoEarthH: m.longestNoEarthH,
    longestNoLinkH: ok ? ok.longestNoLinkH : null, passesPerDay: ok ? ok.passesPerDay : null,
  };
}
