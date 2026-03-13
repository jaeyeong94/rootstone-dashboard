import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BlackSwanCard } from "@/components/dashboard/BlackSwanCard";

describe("BlackSwanCard", () => {
  it("renders the section title", () => {
    render(<BlackSwanCard />);
    expect(screen.getByText(/black swan/i)).toBeInTheDocument();
  });

  it("displays all 7 black swan events", () => {
    render(<BlackSwanCard />);
    // v1 events
    expect(screen.getByText("Luna-Terra Collapse")).toBeInTheDocument();
    expect(screen.getByText("Celsius/3AC Bankruptcy")).toBeInTheDocument();
    expect(screen.getByText("FTX Collapse")).toBeInTheDocument();
    expect(screen.getByText("Macro Triple Pressure")).toBeInTheDocument();
    // v3.1 events
    expect(screen.getByText("Bybit Hack")).toBeInTheDocument();
    expect(screen.getByText("Tariff War")).toBeInTheDocument();
    expect(screen.getByText("Large-Scale Liquidation")).toBeInTheDocument();
  });

  it("shows Rebeta return for each event", () => {
    render(<BlackSwanCard />);
    expect(screen.getByText("+9.06%")).toBeInTheDocument();
    expect(screen.getByText("+8.51%")).toBeInTheDocument();
    expect(screen.getByText("-4.88%")).toBeInTheDocument();
  });

  it("shows BTC return for each event", () => {
    render(<BlackSwanCard />);
    expect(screen.getByText("-23.05%")).toBeInTheDocument();
    expect(screen.getByText("-36.61%")).toBeInTheDocument();
  });

  it("shows alpha outperformance for each event", () => {
    render(<BlackSwanCard />);
    expect(screen.getByText("+32.11%p")).toBeInTheDocument();
    expect(screen.getByText("+45.12%p")).toBeInTheDocument();
  });

  it("displays crisis summary stats", () => {
    render(<BlackSwanCard />);
    expect(screen.getByText("+3.18%")).toBeInTheDocument();
    expect(screen.getByText("-18.46%")).toBeInTheDocument();
    expect(screen.getByText("+21.63%p")).toBeInTheDocument();
    expect(screen.getByText("5/7")).toBeInTheDocument();
  });

  it("shows labels for crisis stats", () => {
    render(<BlackSwanCard />);
    expect(screen.getByText("Avg Rebeta Return")).toBeInTheDocument();
    expect(screen.getByText("Avg BTC Return")).toBeInTheDocument();
    expect(screen.getByText("Avg Outperformance")).toBeInTheDocument();
    expect(screen.getByText("Positive Return Events")).toBeInTheDocument();
  });

  it("shows event periods", () => {
    render(<BlackSwanCard />);
    expect(screen.getByText("22.05.04~22.05.12")).toBeInTheDocument();
  });

  it("distinguishes v1 and v3.1 phases", () => {
    render(<BlackSwanCard />);
    expect(screen.getByText(/v1/)).toBeInTheDocument();
    expect(screen.getByText(/v3\.1/)).toBeInTheDocument();
  });
});
