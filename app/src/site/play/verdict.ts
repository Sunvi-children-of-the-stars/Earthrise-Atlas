/** Plain-language verdict for the public, from the energy budget of a reference small lander. */
import type { Sample } from "../../astro/analysis";
import { budget, VEHICLES, type Vehicle } from "../../astro/budget";
import type { RelayResult } from "../../astro/relay";
import type { MessageKey } from "../i18n";

export interface Verdict { ok: boolean; key: MessageKey; vars: Record<string, number> }

export function missionVerdict(samples: Sample[], vehicle: Vehicle = VEHICLES.lander): Verdict {
  const r = budget(vehicle, samples);
  if (r.survives) return { ok: true, key: "verdict.survives", vars: { minSoc: Math.round(r.minSocPct) } };
  const dt = samples.length > 1 ? (samples[1].t - samples[0].t) / 3_600_000 : 0;
  const floor = 100 * (1 - vehicle.dod) + 1e-6;
  const i = r.socPct.findIndex((v) => v <= floor);
  return { ok: false, key: "verdict.brownout", vars: { afterH: Math.max(0, i) * dt, brownoutH: r.brownoutH } };
}

export function relaySummary(r: RelayResult | null): { linkPct: number; longestNoLinkH: number; passesPerDay: number } | null {
  if (!r || !r.available) return null;
  return { linkPct: r.linkPct, longestNoLinkH: r.longestNoLinkH, passesPerDay: r.passesPerDay };
}
