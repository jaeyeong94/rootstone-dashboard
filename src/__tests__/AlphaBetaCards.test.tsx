import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AlphaBetaCards } from "@/components/dashboard/AlphaBetaCards";

// Mock SWR to return test benchmark data
vi.mock("swr", () => ({
  default: () => ({
    data: {
      rebeta: { symbol: "Rebeta", name: "Rebeta", sharpe: 1.91, volatility: 0.257, correlationWithRebeta: 1 },
      benchmarks: [
        { symbol: "BTC", name: "BTC", sharpe: 0.41, volatility: 0.567, correlationWithRebeta: 0.14 },
      ],
    },
    isLoading: false,
  }),
}));

describe("AlphaBetaCards", () => {
  it("renders the section title", () => {
    render(<AlphaBetaCards />);
    expect(screen.getByText(/market independence/i)).toBeInTheDocument();
  });

  it("displays live Correlation value", () => {
    render(<AlphaBetaCards />);
    expect(screen.getByText("+0.14")).toBeInTheDocument();
    expect(screen.getByText("Correlation")).toBeInTheDocument();
  });

  it("renders exactly 3 metric cards", () => {
    render(<AlphaBetaCards />);
    const cards = screen.getAllByTestId(/^metric-card-/);
    expect(cards.length).toBe(3);
  });
});
