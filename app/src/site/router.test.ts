import { describe, expect, test } from "vitest";
import { pageFromPath, pathOf } from "./router";

describe("routage par chemin", () => {
  test("chaque chemin connu donne sa page", () => {
    expect(pageFromPath("/")).toBe("story");
    expect(pageFromPath("/atlas")).toBe("atlas");
    expect(pageFromPath("/play")).toBe("play");
    expect(pageFromPath("/lab/")).toBe("lab");
    expect(pageFromPath("/method")).toBe("method");
  });
  test("un chemin inconnu retombe sur l'accueil", () => {
    expect(pageFromPath("/nope")).toBe("story");
    expect(pageFromPath("")).toBe("story");
  });
  test("chemin de chaque page", () => {
    expect(pathOf("story")).toBe("/");
    expect(pathOf("method")).toBe("/method");
    expect(pageFromPath(pathOf("play"))).toBe("play");
  });
});
