import { describe, it, expect } from "vitest";
import { formatPnlPercent, formatNumber, getPnlColor, formatRelativeTime } from "@/lib/utils";

describe("formatPnlPercent", () => {
  it("formats positive values with + sign", () => {
    expect(formatPnlPercent(0.0534)).toBe("+5.34%");
  });

  it("formats negative values with - sign", () => {
    expect(formatPnlPercent(-0.0212)).toBe("-2.12%");
  });

  it("formats zero", () => {
    expect(formatPnlPercent(0)).toBe("+0.00%");
  });

  it("respects decimal places", () => {
    expect(formatPnlPercent(0.123456, 4)).toBe("+12.3456%");
  });
});

describe("formatNumber", () => {
  it("formats with commas", () => {
    expect(formatNumber(1234567.89)).toBe("1,234,567.89");
  });

  it("formats small numbers", () => {
    expect(formatNumber(0.12, 2)).toBe("0.12");
  });
});

describe("getPnlColor", () => {
  it("returns positive color for gains", () => {
    expect(getPnlColor(100)).toBe("text-pnl-positive");
  });

  it("returns negative color for losses", () => {
    expect(getPnlColor(-50)).toBe("text-pnl-negative");
  });

  it("returns secondary for zero", () => {
    expect(getPnlColor(0)).toBe("text-text-secondary");
  });
});

describe("formatRelativeTime", () => {
  it("formats seconds ago", () => {
    const date = new Date(Date.now() - 30 * 1000);
    expect(formatRelativeTime(date)).toBe("30s ago");
  });

  it("formats minutes ago", () => {
    const date = new Date(Date.now() - 5 * 60 * 1000);
    expect(formatRelativeTime(date)).toBe("5m ago");
  });

  it("formats hours ago", () => {
    const date = new Date(Date.now() - 3 * 60 * 60 * 1000);
    expect(formatRelativeTime(date)).toBe("3h ago");
  });
});
