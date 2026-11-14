import { describe, expect, test } from "vitest";
import { initialPlayState, playHref, stepFor } from "./state";

const ids = ["connecting-ridge", "malapert-massif"];
const now = Date.UTC(2026, 10, 14, 16, 25);

describe("état initial de Play", () => {
  test("sans lien : crête de liaison, heure courante arrondie, un jour lunaire", () => {
    expect(initialPlayState("", ids, now)).toEqual({ siteId: "connecting-ridge", start: Date.UTC(2026, 10, 14, 16), hours: 708.7, cursor: 0 });
  });

  test("un lien partagé fixe le site, la date et la durée", () => {
    expect(initialPlayState("#site=malapert-massif&t=2027-01-02T00:00Z&d=168", ids, now))
      .toMatchObject({ siteId: "malapert-massif", start: Date.UTC(2027, 0, 2), hours: 168 });
  });

  test("un lien abîmé retombe sur les valeurs par défaut", () => {
    expect(initialPlayState("#site=unknown&d=99999", ids, now)).toMatchObject({ siteId: "connecting-ridge", hours: 708.7 });
    expect(initialPlayState("#t=garbage", ids, now).start).toBe(Date.UTC(2026, 10, 14, 16));
  });

  test("un point personnalisé est gardé", () => {
    const s = initialPlayState("#lat=-85.5&lon=15&c=12", ids, now);
    expect(s.custom).toEqual({ lat: -85.5, lon: 15 });
    expect(s.cursor).toBe(12);
  });

  test("pas de simulation : environ 1 500 points par période", () => {
    expect(stepFor(708.7)).toBe(30);
    expect(stepFor(72)).toBe(10);
  });

  test("l'adresse garde la page courante (la base du site est la racine)", () => {
    const st = { siteId: "malapert-massif", start: Date.UTC(2026, 10, 14, 16), hours: 708.7, cursor: 5 };
    expect(playHref("/play", st)).toBe("/play#site=malapert-massif&t=2026-11-14T16:00Z&d=708.7");
    expect(playHref("/play", { ...st, custom: { lat: -85.5, lon: 15 } })).toBe("/play#lat=-85.5000&lon=15.0000&t=2026-11-14T16:00Z&d=708.7");
  });
});
