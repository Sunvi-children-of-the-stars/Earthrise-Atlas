import { describe, expect, test } from "vitest";
import { en } from "./en";
import { fr } from "./fr";
import { interpolate, makeFmt } from "./index";

describe("langues", () => {
  test("mêmes clés en anglais et en français", () => {
    expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
  });

  test("charte : pas de tiret cadratin, pas d'italique, pas de « membre », pas de texte vide", () => {
    for (const s of [...Object.values(en), ...Object.values(fr)] as string[]) {
      expect(s).not.toMatch(/—/);
      expect(s).not.toMatch(/<\/?(i|em)>/);
      expect(s.toLowerCase()).not.toContain("membre");
      expect(s.trim().length).toBeGreaterThan(0);
    }
  });

  test("les emplacements {x} sont les mêmes dans les deux langues", () => {
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const k of Object.keys(en) as (keyof typeof en)[]) expect(vars(fr[k])).toEqual(vars(en[k]));
  });

  test("format des nombres selon la langue", () => {
    expect(makeFmt("fr").pct(52.43)).toBe("52,4 %");
    expect(makeFmt("en").pct(52.43)).toBe("52.4%");
    expect(makeFmt("fr").num(1234.5, 1)).toBe("1 234,5");
    expect(makeFmt("en").num(1234.5, 1)).toBe("1,234.5");
  });

  test("durées lisibles", () => {
    expect(makeFmt("en").hours(0)).toBe("0 h");
    expect(makeFmt("en").hours(1.82)).toBe("1 h 49");
    expect(makeFmt("en").hours(321.5)).toBe("13.4 days");
    expect(makeFmt("fr").hours(321.5)).toBe("13,4 jours");
  });

  test("interpolation", () => {
    expect(interpolate("Sun {pct} of the time", { pct: "88%" })).toBe("Sun 88% of the time");
    expect(interpolate("no vars", {})).toBe("no vars");
  });
});
