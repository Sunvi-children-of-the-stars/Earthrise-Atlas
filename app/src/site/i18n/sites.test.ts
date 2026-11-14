import { describe, expect, test } from "vitest";
import { sites } from "../../test/data";
import { makeCustomSite } from "../data/store";
import { siteText } from "./sites";

describe("textes des sites", () => {
  test("chaque site de sites.json a ses textes en anglais et en français, conformes à la charte", () => {
    const all = sites();
    expect(all.length).toBe(14);
    for (const s of all) for (const lang of ["en", "fr"] as const) {
      const x = siteText(s, lang);
      expect(x.short.length, `${s.id} ${lang}`).toBeGreaterThan(0);
      expect(x.name.length, `${s.id} ${lang}`).toBeGreaterThan(0);
      expect(x.region.length, `${s.id} ${lang}`).toBeGreaterThan(0);
      expect(x.context.length, `${s.id} ${lang}`).toBeGreaterThan(20);
      for (const v of Object.values(x)) expect(v).not.toMatch(/—/);
    }
  });

  test("l'anglais n'est pas une copie du français", () => {
    const s = sites().find((x) => x.id === "change-6")!;
    expect(siteText(s, "en").context).not.toBe(siteText(s, "fr").context);
  });

  test("site personnalisé : textes génériques traduits", () => {
    expect(siteText(makeCustomSite(-85.5, 15, null), "en").name).toBe("Custom site");
    expect(siteText(makeCustomSite(-85.5, 15, null), "fr").name).toBe("Site personnalisé");
  });

  test("le texte d'un point personnalisé dit d'où vient son horizon", () => {
    const s = makeCustomSite(0.67, 23.47, null);
    expect(siteText(s, "en", "flat").context).toMatch(/smooth|no relief/i);
    expect(siteText(s, "en", "tiles").context).toMatch(/relief/i);
    expect(siteText(s, "en", "flat").context).not.toBe(siteText(s, "en", "tiles").context);
    expect(siteText(s, "fr", "preview").context).not.toBe(siteText(s, "fr", "tiles").context);
  });
});
