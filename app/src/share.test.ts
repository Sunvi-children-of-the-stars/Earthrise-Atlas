import { describe, expect, test } from "vitest";
import { readShareState, shareUrl, writeShareState } from "./share";

describe("lien partageable", () => {
  const t = Date.UTC(2026, 10, 14, 16, 0);
  test("écriture lisible et aller-retour", () => {
    const h = writeShareState({ siteId: "malapert-massif", start: t, hours: 708.7 });
    expect(h).toBe("#site=malapert-massif&t=2026-11-14T16:00Z&d=708.7");
    expect(readShareState(h)).toEqual({ siteId: "malapert-massif", start: t, hours: 708.7 });
  });
  test("un site personnalisé l'emporte sur le site nommé", () => {
    expect(readShareState("#lat=-85.5&lon=15&site=x&c=42&d=168")).toEqual({ lat: -85.5, lon: 15, hours: 168, cursor: 42 });
  });
  test("les champs invalides sont ignorés sans erreur", () => {
    expect(readShareState("#lat=-95&lon=15&site=apollo-11")).toEqual({ siteId: "apollo-11" });
    expect(readShareState("#site=<script>&t=nope&d=-3&region=pole&profile=lander")).toEqual({ region: "pole", profile: "lander" });
    expect(readShareState("")).toEqual({});
  });
  test("l'URL complète garde le chemin et la requête", () => {
    expect(shareUrl({ siteId: "apollo-11" }, "https://x.app/sub/?q=1#old")).toBe("https://x.app/sub/?q=1#site=apollo-11");
  });
});
