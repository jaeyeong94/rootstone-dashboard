import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { YearlyReturnsChart } from "@/components/dashboard/YearlyReturnsChart";

describe("YearlyReturnsChart", () => {
  it("renders the section title", () => {
    render(<YearlyReturnsChart />);
    expect(screen.getByText(/yearly returns/i)).toBeInTheDocument();
  });

  it("displays all years from 2021 to 2026", () => {
    render(<YearlyReturnsChart />);
    expect(screen.getByText("2021")).toBeInTheDocument();
    expect(screen.getByText("2022")).toBeInTheDocument();
    expect(screen.getByText("2023")).toBeInTheDocument();
    expect(screen.getByText("2024")).toBeInTheDocument();
    expect(screen.getByText("2025")).toBeInTheDocument();
    expect(screen.getByText("2026")).toBeInTheDocument();
  });

  it("shows Rebeta return values with sign", () => {
    render(<YearlyReturnsChart />);
    expect(screen.getByText("+86.6%")).toBeInTheDocument();
    expect(screen.getByText("+26.2%")).toBeInTheDocument();
    expect(screen.getByText("+77.9%")).toBeInTheDocument();
  });

  it("shows BTC return values with sign", () => {
    render(<YearlyReturnsChart />);
    expect(screen.getByText("-5.0%")).toBeInTheDocument();
    expect(screen.getByText("-64.2%")).toBeInTheDocument();
    expect(screen.getByText("+155.9%")).toBeInTheDocument();
  });

  it("has REBETA and BTC labels", () => {
    render(<YearlyReturnsChart />);
    const rebetaLabels = screen.getAllByText("REBETA");
    const btcLabels = screen.getAllByText("BTC");
    expect(rebetaLabels.length).toBeGreaterThan(0);
    expect(btcLabels.length).toBeGreaterThan(0);
  });

  it("renders bar elements for each year", () => {
    render(<YearlyReturnsChart />);
    const bars = screen.getAllByTestId(/^bar-/);
    // 6 years × 2 (rebeta + btc) = 12 bars
    expect(bars.length).toBe(12);
  });

  it("shows all Rebeta years as positive", () => {
    render(<YearlyReturnsChart />);
    // All 6 rebeta values are positive
    expect(screen.getByText("+86.6%")).toBeInTheDocument();
    expect(screen.getByText("+26.2%")).toBeInTheDocument();
    expect(screen.getByText("+77.9%")).toBeInTheDocument();
    expect(screen.getByText("+41.7%")).toBeInTheDocument();
    expect(screen.getByText("+46.0%")).toBeInTheDocument();
    expect(screen.getByText("+12.5%")).toBeInTheDocument();
  });
});
