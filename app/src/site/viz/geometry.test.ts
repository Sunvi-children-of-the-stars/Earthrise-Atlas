import { describe, expect, test } from "vitest";
import { azToX, lrocPixel, lrocXY, niceTicks } from "./geometry";

describe("géométrie des graphiques", () => {
  test("panorama centré sur le sud : 180° au milieu, le nord sur les bords", () => {
    expect(azToX(180, 360)).toBeCloseTo(180, 9);
    expect(azToX(0, 360)).toBeCloseTo(0, 9);
    expect(azToX(359.9, 360)).toBeLessThan(360);
    expect(azToX(90, 360)).toBeCloseTo(90, 9);
    expect(azToX(-90, 360)).toBeCloseTo(270, 9);
  });

  test("panorama centré sur le nord (sites de la face visible)", () => {
    expect(azToX(0, 360, 0)).toBeCloseTo(180, 9);
    expect(azToX(180, 360, 0)).toBeCloseTo(0, 9);
  });

  test("grille de la photo LROC : le pôle est au centre et l'aller-retour est exact", () => {
    const [c, r] = lrocPixel(0, 0);
    expect(c).toBeCloseTo(1142.95, 2);
    expect(r).toBeCloseTo(1142.95, 2);
    const [x, y] = lrocXY(...lrocPixel(12_345, -67_890));
    expect(x).toBeCloseTo(12_345, 6);
    expect(y).toBeCloseTo(-67_890, 6);
  });

  test("graduations lisibles", () => {
    expect(niceTicks(-3, 4)).toEqual([-2, 0, 2, 4]);
    expect(niceTicks(-10, 60)).toEqual([0, 15, 30, 45, 60]);
  });
});
