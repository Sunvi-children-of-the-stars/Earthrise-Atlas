import { describe, expect, test } from "vitest";
import { loadScenarios, saveScenarios, scenarioKey, type Scenario } from "./scenarios";

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe("scénarios du comparatif", () => {
  test("stockage absent ou contenu illisible : liste vide, sans erreur", () => {
    expect(loadScenarios(null)).toEqual([]);
    expect(loadScenarios({ getItem: () => "not json" })).toEqual([]);
    expect(loadScenarios({ getItem: () => JSON.stringify({ not: "a list" }) })).toEqual([]);
    expect(loadScenarios({ getItem: () => { throw new Error("blocked"); } })).toEqual([]);
  });

  test("clé unique par site, date et durée", () => {
    const s: Scenario = { key: "", siteId: "malapert-massif", start: 1, hours: 2 };
    expect(scenarioKey(s)).toBe("malapert-massif@1@2");
    expect(scenarioKey({ ...s, siteId: "custom", custom: { lat: -85.5, lon: 15 } })).toBe("custom:-85.5000,15.0000@1@2");
  });

  test("aller-retour par le stockage, entrées mal formées écartées", () => {
    const st = memory();
    const s: Scenario = { key: "malapert-massif@1@2", siteId: "malapert-massif", start: 1, hours: 2 };
    saveScenarios([s], st);
    expect(loadScenarios(st)).toEqual([s]);
    st.setItem("earthrise.scenarios", JSON.stringify([s, { siteId: 3 }, null]));
    expect(loadScenarios(st)).toEqual([s]);
  });
});
