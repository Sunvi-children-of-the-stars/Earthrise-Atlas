import { describe, expect, test } from "vitest";
import { latinFontFaces, pageFit, sheetFileName } from "./pdf";

describe("export PDF de la fiche", () => {
  test("nom de fichier lisible, sans caractère gênant", () => {
    expect(sheetFileName("Malapert Massif", Date.UTC(2026, 10, 14, 16))).toBe("earthrise-atlas_malapert-massif_2026-11-14.pdf");
    expect(sheetFileName("Chang'e-6", Date.UTC(2027, 0, 2))).toBe("earthrise-atlas_chang-e-6_2027-01-02.pdf");
    expect(sheetFileName("85.50°S 15.00°E", Date.UTC(2026, 10, 14))).toBe("earthrise-atlas_85-50-s-15-00-e_2026-11-14.pdf");
  });

  test("l'image tient dans une page A4 en gardant ses proportions", () => {
    // A4 = 210 × 297 mm, 10 mm margins → 190 × 277 mm available
    expect(pageFit(800, 1000)).toEqual({ x: 10, y: 10, w: 190, h: 237.5 });   // limited by the width
    const tall = pageFit(800, 2000);                                           // limited by the height
    expect(tall.h).toBeCloseTo(277, 6); expect(tall.w).toBeCloseTo(110.8, 6); expect(tall.x).toBeCloseTo(49.6, 6);
  });

  test("seules les polices latines sont gardées pour la capture", () => {
    const css = [
      "/* devanagari */ @font-face { font-family: 'Poppins'; font-weight: 400; src: url(https://x/dev.woff2) format('woff2'); unicode-range: U+0900-097F; }",
      "/* latin-ext */ @font-face { font-family: 'Poppins'; font-weight: 400; src: url(https://x/ext.woff2) format('woff2'); unicode-range: U+0100-02BA; }",
      "/* latin */ @font-face { font-family: 'Poppins'; font-weight: 400; src: url(https://x/lat.woff2) format('woff2'); unicode-range: U+0000-00FF, U+0131; }",
      "@font-face { font-family: 'Poppins'; font-weight: 600; src: url(https://x/all.ttf) format('truetype'); }",
    ].join("\n");
    const faces = latinFontFaces(css);
    expect(faces.map((f) => f.url)).toEqual(["https://x/lat.woff2", "https://x/all.ttf"]);
    expect(faces[0].rule).toContain("font-weight: 400");
  });
});
