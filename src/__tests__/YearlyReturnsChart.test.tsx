import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { YearlyReturnsChart } from "@/components/dashboard/YearlyReturnsChart";

// Mock SWR to return test data
vi.mock("swr", () => ({
  default: () => ({
    data: {
      yearlyReturns: [
        { year: 2021, return: 86.6 },
        { year: 2022, return: 26.2 },
        { year: 2023, return: 77.9 },
      ],
    },
    isLoading: false,
  }),
}));

describe("YearlyReturnsChart", () => {
  it("renders the section title", () => {
    render(<YearlyReturnsChart />);
    expect(screen.getByText(/yearly returns/i)).toBeInTheDocument();
  });

  it("shows return values from API", () => {
    render(<YearlyReturnsChart />);
    expect(screen.getByText("+86.6%")).toBeInTheDocument();
    expect(screen.getByText("+26.2%")).toBeInTheDocument();
    expect(screen.getByText("+77.9%")).toBeInTheDocument();
  });

  it("renders bar elements for each year", () => {
    render(<YearlyReturnsChart />);
    const bars = screen.getAllByTestId(/^bar-/);
    expect(bars.length).toBe(3);
  });
});
