import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AlphaBetaCards } from "@/components/dashboard/AlphaBetaCards";

describe("AlphaBetaCards", () => {
  it("renders the section title", () => {
    render(<AlphaBetaCards />);
    expect(screen.getByText(/market independence/i)).toBeInTheDocument();
  });

  it("displays Alpha value", () => {
    render(<AlphaBetaCards />);
    expect(screen.getByText("0.0249")).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
  });

  it("displays Beta value", () => {
    render(<AlphaBetaCards />);
    expect(screen.getByText("0.0637")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("displays Correlation value", () => {
    render(<AlphaBetaCards />);
    expect(screen.getByText("0.14")).toBeInTheDocument();
    expect(screen.getByText("Correlation")).toBeInTheDocument();
  });

  it("shows tooltips/descriptions for each metric", () => {
    render(<AlphaBetaCards />);
    expect(screen.getByText(/excess return/i)).toBeInTheDocument();
    expect(screen.getByText(/market sensitivity/i)).toBeInTheDocument();
    expect(screen.getByText(/correlation with BTC/i)).toBeInTheDocument();
  });

  it("renders exactly 3 metric cards", () => {
    render(<AlphaBetaCards />);
    const cards = screen.getAllByTestId(/^metric-card-/);
    expect(cards.length).toBe(3);
  });

  it("shows BTC comparison values", () => {
    render(<AlphaBetaCards />);
    // BTC Alpha = 0.00
    expect(screen.getByText(/BTC: 0\.00/)).toBeInTheDocument();
    // BTC Beta = 1.00, BTC Correlation = 1.00 (two matches)
    const btcOnes = screen.getAllByText(/BTC: 1\.00/);
    expect(btcOnes.length).toBe(2);
  });
});
