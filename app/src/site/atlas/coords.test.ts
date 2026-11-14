import { describe, expect, test } from "vitest";
import { parseCoords } from "./coords";

describe("saisie de coordonnées", () => {
  test("degrés décimaux, point ou virgule", () => {
    expect(parseCoords("-85.5", "15")).toEqual({ lat: -85.5, lon: 15 });
    expect(parseCoords("-85,5", "15,25")).toEqual({ lat: -85.5, lon: 15.25 });
  });
  test("longitudes 0 à 360 ramenées entre -180 et 180", () => {
    expect(parseCoords("-89", "200")).toEqual({ lat: -89, lon: -160 });
  });
  test("lettres S, N, E, W ou O", () => {
    expect(parseCoords("85.5 S", "15 W")).toEqual({ lat: -85.5, lon: -15 });
    expect(parseCoords("0.67N", "23.47E")).toEqual({ lat: 0.67, lon: 23.47 });
    expect(parseCoords("12 s", "30 o")).toEqual({ lat: -12, lon: -30 });
  });
  test("saisies invalides refusées", () => {
    expect(parseCoords("", "15")).toBeNull();
    expect(parseCoords("-95", "15")).toBeNull();
    expect(parseCoords("abc", "15")).toBeNull();
    expect(parseCoords("-85", "400")).toBeNull();
  });
});
