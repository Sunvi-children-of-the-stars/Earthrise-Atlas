/** Saved comparison scenarios (site × date × duration), kept in the visitor's browser. */
export interface Scenario {
  key: string;
  siteId: string;
  custom?: { lat: number; lon: number };
  start: number;
  hours: number;
}

const STORAGE_KEY = "earthrise.scenarios";

export function scenarioKey(s: Omit<Scenario, "key">): string {
  const id = s.custom ? `custom:${s.custom.lat.toFixed(4)},${s.custom.lon.toFixed(4)}` : s.siteId;
  return `${id}@${s.start}@${s.hours}`;
}

const valid = (x: unknown): x is Scenario => {
  const s = x as Scenario;
  return !!s && typeof s === "object" && typeof s.siteId === "string" && typeof s.key === "string"
    && Number.isFinite(s.start) && Number.isFinite(s.hours);
};

export function loadScenarios(storage: Pick<Storage, "getItem"> | null): Scenario[] {
  if (!storage) return [];
  try {
    const v = JSON.parse(storage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter(valid) : [];
  } catch {
    return [];
  }
}

export function saveScenarios(list: Scenario[], storage: Pick<Storage, "setItem"> | null): void {
  try { storage?.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* storage full or blocked */ }
}

/** The browser's localStorage, or null when unavailable (private mode, blocked). */
export function browserStorage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}
