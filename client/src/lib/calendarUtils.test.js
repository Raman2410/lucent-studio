import { describe, it, expect, vi, afterEach } from "vitest";
import {
  WEEKDAYS,
  getMonthKey,
  isBeforeCurrentMonth,
  isCurrentMonth,
  stepMonth,
  getMonthLabel,
  getLeadingBlanks,
} from "./calendarUtils";

describe("WEEKDAYS", () => {
  it("has 7 entries starting on Sunday", () => {
    expect(WEEKDAYS).toHaveLength(7);
    expect(WEEKDAYS[0]).toBe("Sun");
    expect(WEEKDAYS[6]).toBe("Sat");
  });
});

describe("getMonthKey", () => {
  it("pads single-digit months with a leading zero", () => {
    expect(getMonthKey(2026, 3)).toBe("2026-03");
  });

  it("leaves two-digit months untouched", () => {
    expect(getMonthKey(2026, 12)).toBe("2026-12");
  });
});

describe("stepMonth", () => {
  it("steps forward within the same year", () => {
    expect(stepMonth({ year: 2026, month: 5 }, 1)).toEqual({ year: 2026, month: 6 });
  });

  it("steps backward within the same year", () => {
    expect(stepMonth({ year: 2026, month: 5 }, -1)).toEqual({ year: 2026, month: 4 });
  });

  it("rolls over into the next year past December", () => {
    expect(stepMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
  });

  it("rolls back into the previous year before January", () => {
    expect(stepMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });
});

describe("getMonthLabel", () => {
  it("formats a full month name and year", () => {
    expect(getMonthLabel(2026, 8)).toBe("August 2026");
  });

  it("formats January correctly (0-index pitfall)", () => {
    expect(getMonthLabel(2026, 1)).toBe("January 2026");
  });
});

describe("getLeadingBlanks", () => {
  it("returns the weekday index (0-6) of the 1st of the month", () => {
    // Jan 1 2026 is a Thursday -> getDay() === 4
    expect(getLeadingBlanks(2026, 1)).toBe(new Date(2026, 0, 1).getDay());
  });
});

describe("isCurrentMonth / isBeforeCurrentMonth", () => {
  const REAL_DATE = Date;

  function mockNow(year, month /* 1-indexed */, day = 15) {
    const fixed = new REAL_DATE(year, month - 1, day);
    vi.setSystemTime(fixed);
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it("isCurrentMonth is true for this month/year", () => {
    vi.useFakeTimers();
    mockNow(2026, 7);
    expect(isCurrentMonth(2026, 7)).toBe(true);
    expect(isCurrentMonth(2026, 8)).toBe(false);
    expect(isCurrentMonth(2025, 7)).toBe(false);
  });

  it("isBeforeCurrentMonth is true for earlier months in the same year", () => {
    vi.useFakeTimers();
    mockNow(2026, 7);
    expect(isBeforeCurrentMonth(2026, 6)).toBe(true);
    expect(isBeforeCurrentMonth(2026, 7)).toBe(false);
    expect(isBeforeCurrentMonth(2026, 8)).toBe(false);
  });

  it("isBeforeCurrentMonth is true for any earlier year regardless of month", () => {
    vi.useFakeTimers();
    mockNow(2026, 1);
    expect(isBeforeCurrentMonth(2025, 12)).toBe(true);
  });

  it("isBeforeCurrentMonth is false for a later year", () => {
    vi.useFakeTimers();
    mockNow(2026, 12);
    expect(isBeforeCurrentMonth(2027, 1)).toBe(false);
  });
});
