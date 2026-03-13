import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GrowthSimulator } from "@/components/dashboard/GrowthSimulator";

// Mock SWR
vi.mock("swr", () => ({
  default: vi.fn(() => ({
    data: {
      curve: [
        { time: "2024-11-17", value: 0 },
        { time: "2024-12-17", value: 5.2 },
        { time: "2025-01-17", value: 12.8 },
        { time: "2025-02-17", value: 68.2 },
      ],
    },
    error: undefined,
    isLoading: false,
  })),
}));

describe("GrowthSimulator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the section title", () => {
    render(<GrowthSimulator />);
    expect(screen.getByText(/if you invested/i)).toBeInTheDocument();
  });

  it("shows default $10,000 investment amount", () => {
    render(<GrowthSimulator />);
    expect(screen.getByText("$10,000")).toBeInTheDocument();
  });

  it("displays the current value based on cumulative return", () => {
    render(<GrowthSimulator />);
    // With 68.2% return on $10,000 → $16,820
    const currentValue = screen.getByTestId("current-value");
    expect(currentValue).toBeInTheDocument();
    expect(currentValue.textContent).toMatch(/\$16,820/);
  });

  it("has a range slider for investment amount", () => {
    render(<GrowthSimulator />);
    const slider = screen.getByRole("slider");
    expect(slider).toBeInTheDocument();
  });

  it("updates displayed value when slider changes", () => {
    render(<GrowthSimulator />);
    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "50000" } });
    // $50,000 input text should appear
    expect(screen.getByText("$50,000")).toBeInTheDocument();
  });

  it("shows the return percentage", () => {
    render(<GrowthSimulator />);
    const returnPct = screen.getByTestId("return-pct");
    expect(returnPct).toBeInTheDocument();
    expect(returnPct.textContent).toMatch(/68\.2%/);
  });

  it("shows profit amount", () => {
    render(<GrowthSimulator />);
    const profit = screen.getByTestId("profit-amount");
    expect(profit).toBeInTheDocument();
    // $10,000 * 68.2% = $6,820
    expect(profit.textContent).toMatch(/\$6,820/);
  });

  it("renders preset buttons", () => {
    render(<GrowthSimulator />);
    expect(screen.getByText("$10K")).toBeInTheDocument();
    expect(screen.getByText("$50K")).toBeInTheDocument();
    expect(screen.getByText("$100K")).toBeInTheDocument();
  });

  it("updates amount when preset button is clicked", () => {
    render(<GrowthSimulator />);
    fireEvent.click(screen.getByText("$100K"));
    expect(screen.getByText("$100,000")).toBeInTheDocument();
  });
});
