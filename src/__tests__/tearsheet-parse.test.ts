/**
 * Tests for tearsheet parsing logic.
 * Verifies data extraction and conversion correctness.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const TEARSHEET_PATH = path.resolve(__dirname, "../../ref/Rebeta_v1-3.1_tearsheet_260215.html");

describe("tearsheet HTML parsing", () => {
  const html = fs.readFileSync(TEARSHEET_PATH, "utf-8");

  it("contains cumulative-returns-plot div", () => {
    expect(html).toContain("cumulative-returns-plot");
  });

  it("extracts Plotly data with correct regex", () => {
    const plotRegex = /cumulative-returns-plot[\s\S]*?var plotly_data = ({[\s\S]*?});\s*\n/;
    const match = html.match(plotRegex);
    expect(match).not.toBeNull();

    const plotData = JSON.parse(match![1]);
    expect(plotData).toHaveProperty("data");
    expect(Array.isArray(plotData.data)).toBe(true);
  });

  it("finds daily_return trace", () => {
    const plotRegex = /cumulative-returns-plot[\s\S]*?var plotly_data = ({[\s\S]*?});\s*\n/;
    const plotData = JSON.parse(html.match(plotRegex)![1]);

    const trace = plotData.data.find((t: { name?: string }) =>
      t.name && t.name.includes("daily_return")
    );

    expect(trace).toBeDefined();
    expect(trace.x).toBeDefined();
    expect(trace.y).toBeDefined();
  });

  it("has correct number of data points (1813)", () => {
    const plotRegex = /cumulative-returns-plot[\s\S]*?var plotly_data = ({[\s\S]*?});\s*\n/;
    const plotData = JSON.parse(html.match(plotRegex)![1]);
    const trace = plotData.data.find((t: { name?: string }) =>
      t.name && t.name.includes("daily_return")
    );

    expect(trace.x.length).toBe(1813);
    expect(trace.y.length).toBe(1813);
  });

  it("date range starts at 2021-03-02 and ends at 2026-02-16", () => {
    const plotRegex = /cumulative-returns-plot[\s\S]*?var plotly_data = ({[\s\S]*?});\s*\n/;
    const plotData = JSON.parse(html.match(plotRegex)![1]);
    const trace = plotData.data.find((t: { name?: string }) =>
      t.name && t.name.includes("daily_return")
    );

    expect(trace.x[0]).toContain("2021-03-02");
    expect(trace.x[trace.x.length - 1]).toContain("2026-02-16");
  });

  it("cumulative return starts at 0 and ends around 872%", () => {
    const plotRegex = /cumulative-returns-plot[\s\S]*?var plotly_data = ({[\s\S]*?});\s*\n/;
    const plotData = JSON.parse(html.match(plotRegex)![1]);
    const trace = plotData.data.find((t: { name?: string }) =>
      t.name && t.name.includes("daily_return")
    );

    expect(trace.y[0]).toBe(0);
    expect(trace.y[trace.y.length - 1]).toBeCloseTo(8.72, 0);
  });

  it("all y values are finite numbers", () => {
    const plotRegex = /cumulative-returns-plot[\s\S]*?var plotly_data = ({[\s\S]*?});\s*\n/;
    const plotData = JSON.parse(html.match(plotRegex)![1]);
    const trace = plotData.data.find((t: { name?: string }) =>
      t.name && t.name.includes("daily_return")
    );

    for (const y of trace.y) {
      expect(typeof y).toBe("number");
      expect(Number.isFinite(y)).toBe(true);
    }
  });

  it("dates are in ascending order", () => {
    const plotRegex = /cumulative-returns-plot[\s\S]*?var plotly_data = ({[\s\S]*?});\s*\n/;
    const plotData = JSON.parse(html.match(plotRegex)![1]);
    const trace = plotData.data.find((t: { name?: string }) =>
      t.name && t.name.includes("daily_return")
    );

    for (let i = 1; i < trace.x.length; i++) {
      expect(trace.x[i] > trace.x[i - 1]).toBe(true);
    }
  });
});

describe("navIndex conversion from tearsheet cumulative returns", () => {
  it("navIndex = 1 + cumReturn", () => {
    const cumReturns = [0, 0.01, 0.025, -0.005, 0.05];
    const navIndices = cumReturns.map((y) => 1 + y);

    expect(navIndices[0]).toBe(1.0);
    expect(navIndices[1]).toBe(1.01);
    expect(navIndices[2]).toBe(1.025);
    expect(navIndices[3]).toBe(0.995);
    expect(navIndices[4]).toBe(1.05);
  });

  it("dailyReturn derived from consecutive navIndex values", () => {
    const cumReturns = [0, 0.01, 0.025, -0.005, 0.05];
    const navIndices = cumReturns.map((y) => 1 + y);

    const dailyReturns: number[] = [0]; // First day = 0
    for (let i = 1; i < navIndices.length; i++) {
      dailyReturns.push((navIndices[i] - navIndices[i - 1]) / navIndices[i - 1]);
    }

    // Verify reconstruction: compounding daily returns should give back cumulative
    let reconstructedNav = 1.0;
    for (let i = 1; i < dailyReturns.length; i++) {
      reconstructedNav *= (1 + dailyReturns[i]);
    }
    expect(reconstructedNav).toBeCloseTo(navIndices[navIndices.length - 1], 10);
  });

  it("no NaN or Infinity in daily return computation", () => {
    // navIndex should never be 0 (that would mean total loss)
    const cumReturns = [0, 0.5, -0.3, 0.8, -0.5]; // Even -50% cumReturn gives navIndex = 0.5
    const navIndices = cumReturns.map((y) => 1 + y);

    for (let i = 1; i < navIndices.length; i++) {
      const dr = (navIndices[i] - navIndices[i - 1]) / navIndices[i - 1];
      expect(Number.isFinite(dr)).toBe(true);
      expect(Number.isNaN(dr)).toBe(false);
    }
  });
});

describe("BTC benchmark trace", () => {
  it("also present in tearsheet with same date range", () => {
    const html = fs.readFileSync(TEARSHEET_PATH, "utf-8");
    const plotRegex = /cumulative-returns-plot[\s\S]*?var plotly_data = ({[\s\S]*?});\s*\n/;
    const plotData = JSON.parse(html.match(plotRegex)![1]);

    const btcTrace = plotData.data.find((t: { name?: string }) =>
      t.name && t.name.includes("BTC")
    );

    expect(btcTrace).toBeDefined();
    expect(btcTrace.x.length).toBe(1813);
  });
});
