/** Play page state: what the URL hash (shareable link) says, with safe defaults. */
import { readShareState, writeShareState, type ShareState } from "../../share";

export interface PlayState {
  siteId: string;
  custom?: { lat: number; lon: number };
  start: number;
  hours: number;
  cursor: number;
}

export const DEFAULT_SITE = "connecting-ridge";
export const DEFAULT_HOURS = 708.7;
const MAX_HOURS = 2160;

export function initialPlayState(hash: string, siteIds: string[], now: number): PlayState {
  const s = readShareState(hash);
  const state: PlayState = {
    siteId: s.siteId && siteIds.includes(s.siteId) ? s.siteId : DEFAULT_SITE,
    start: s.start ?? Math.floor(now / 3_600_000) * 3_600_000,
    hours: s.hours !== undefined && s.hours >= 1 && s.hours <= MAX_HOURS ? s.hours : DEFAULT_HOURS,
    cursor: s.cursor ?? 0,
  };
  if (s.lat !== undefined && s.lon !== undefined) state.custom = { lat: s.lat, lon: s.lon };
  return state;
}

/** Simulation step (min): about 1 500 samples per period, as in the former interface. */
export function stepFor(hours: number): number {
  return Math.max(10, Math.round((hours * 60) / 1500 / 5) * 5);
}

/** Shareable state of a Play view (no cursor: the link opens at the start of the period). */
export function playShare(st: PlayState): ShareState {
  return st.custom ? { lat: st.custom.lat, lon: st.custom.lon, start: st.start, hours: st.hours }
    : { siteId: st.siteId, start: st.start, hours: st.hours };
}

/** Address of a Play view: current path + share hash. A bare "#..." would resolve against <base href="/">. */
export function playHref(pathname: string, st: PlayState): string {
  return pathname + writeShareState(playShare(st));
}
