import { expect, test } from "vitest";
import { BANDS, STATIONS, VEHICLES } from "../../astro/budget";
import { CRITERIA, PROFILES } from "../../optim/score";
import { en } from "../i18n/en";

test("chaque profil, critère et véhicule de l'optimiseur a ses textes", () => {
  const keys = new Set(Object.keys(en));
  for (const p of PROFILES) {
    expect(keys.has(`profile.${p.id}`), p.id).toBe(true);
    expect(keys.has(`profile.${p.id}.desc`), p.id).toBe(true);
  }
  for (const c of CRITERIA) expect(keys.has(`crit.${c.id}`), c.id).toBe(true);
  for (const v of Object.keys(VEHICLES)) expect(keys.has(`vehicle.${v}`), v).toBe(true);
});

/** Region ids of scripts/build_horizon_maps.py REGIONS (their data names are French, with an em dash). */
const REGION_IDS = ["pole", "malapert", "mons-mouton", "nobile-amundsen", "nobile-1", "haworth", "faustini", "de-gerlache-2", "gerlache-kocher"];

test("régions de l'optimiseur, bandes radio et stations au sol ont leurs textes", () => {
  const keys = new Set(Object.keys(en));
  for (const r of REGION_IDS) expect(keys.has(`zone.region.${r}`), r).toBe(true);
  for (const b of Object.keys(BANDS)) expect(keys.has(`band.${b}`), b).toBe(true);
  for (const s of Object.keys(STATIONS)) expect(keys.has(`station.${s}`), s).toBe(true);
});
