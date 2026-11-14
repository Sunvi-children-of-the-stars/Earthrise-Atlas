import { describe, expect, test } from "vitest";
import { mask, site, useHorizonsTable } from "../test/data";
import { PROFILES, type Criterion } from "../optim/score";
import { SYNODIC_DAYS } from "./analysis";
import { bestMonth, calendar, cellGrade, type CalendarCell } from "./calendar";

const cell = (o: Partial<CalendarCell>): CalendarCell => ({ start: 0, hours: SYNODIC_DAYS * 24, sunPct: 50, longestNightH: 0,
  earthPct: 50, longestNoEarthH: 0, bothPct: 25, meanFlux: 680, ...o });

describe("calendrier site × mois", () => {
  test("la note suit les poids du profil, critères de terrain ignorés", () => {
    const sunOnly = Object.fromEntries(Object.keys(PROFILES[0].weights).map((k) => [k, k === "sun" ? 1 : 0])) as Record<Criterion, number>;
    expect(cellGrade(cell({ sunPct: 80 }), sunOnly)).toBeCloseTo(80, 6);
    expect(cellGrade(cell({ sunPct: 80 }), { ...sunOnly, ice: 5, warm: 5, subice: 5 })).toBeCloseTo(80, 6);
  });

  test("13 mois lunaires par site, et Chang'e-6 ne voit jamais la Terre", () => {
    useHorizonsTable();
    const ids = ["malapert-massif", "change-6"];
    const cal = calendar(ids.map((id) => ({ id, site: site(id), mask: mask(id) })), Date.UTC(2026, 10, 1), 13);
    expect(cal.monthStarts).toHaveLength(13);
    expect(cal.rows.map((r) => r.cells.length)).toEqual([13, 13]);
    expect(cal.rows[1].cells.every((c) => c.earthPct === 0)).toBe(true);
    const lander = PROFILES.find((p) => p.id === "lander")!;
    expect(bestMonth(cal.rows[0], lander.weights)).toBeGreaterThanOrEqual(0);
  });
});
