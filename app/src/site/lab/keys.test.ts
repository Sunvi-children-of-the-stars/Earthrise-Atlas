import { expect, test } from "vitest";
import { VEHICLES } from "../../astro/budget";
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
