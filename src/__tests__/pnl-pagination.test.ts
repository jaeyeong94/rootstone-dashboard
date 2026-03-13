import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Test the time-windowed pagination logic for Bybit Closed PnL API.
 *
 * Bybit rules:
 *  - Without startTime/endTime → returns last 7 days only
 *  - endTime - startTime must be ≤ 7 days
 *  - Max 2 years of history
 *  - Cursor paginates within a 7-day window
 *
 * Our API needs to:
 *  1. Always return nextEndTime when there could be more history
 *  2. Handle empty windows (no trades in a 7-day period)
 *  3. Stop at V31_START (2024-11-17)
 */

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const V31_START_MS = new Date("2024-11-17").getTime();

// ─── Extract the server-side pagination logic ───
function computeNextPage(
  list: unknown[],
  nextCursor: string,
  startTime: number
) {
  // Current (buggy) logic:
  // const nextEndTime = !nextCursor && list.length > 0 ? startTime : null;

  // What it SHOULD be: always advance to next window when cursor is exhausted,
  // regardless of whether this window had results, as long as we haven't gone past V31_START
  const nextEndTime =
    !nextCursor && startTime > V31_START_MS ? startTime : null;

  return { nextEndTime };
}

// ─── Extract the client-side window transition logic ───
function computeClientState(response: {
  list: unknown[];
  nextPageCursor: string;
  nextEndTime: number | null;
}) {
  if (response.nextPageCursor) {
    return { hasMore: true, advanceWindow: false };
  }
  if (response.nextEndTime && response.nextEndTime > V31_START_MS) {
    return { hasMore: true, advanceWindow: true };
  }
  return { hasMore: false, advanceWindow: false };
}

describe("PnL Pagination - Server Logic", () => {
  it("returns nextEndTime when window has results and no cursor", () => {
    const startTime = Date.now() - SEVEN_DAYS_MS;
    const result = computeNextPage([{ id: 1 }], "", startTime);
    expect(result.nextEndTime).toBe(startTime);
  });

  it("BUG: returns nextEndTime even when window has ZERO results", () => {
    // This is the core bug - empty windows should still advance
    const startTime = Date.now() - SEVEN_DAYS_MS;
    const result = computeNextPage([], "", startTime);
    // With the fix, this should NOT be null
    expect(result.nextEndTime).toBe(startTime);
  });

  it("returns null nextEndTime when cursor exists (more pages in window)", () => {
    const startTime = Date.now() - SEVEN_DAYS_MS;
    const result = computeNextPage([{ id: 1 }], "some-cursor", startTime);
    expect(result.nextEndTime).toBeNull();
  });

  it("returns null nextEndTime when past V31_START", () => {
    const startTime = V31_START_MS - 1000; // before v3.1 inception
    const result = computeNextPage([{ id: 1 }], "", startTime);
    expect(result.nextEndTime).toBeNull();
  });

  it("correctly calculates window boundaries", () => {
    const now = Date.now();
    const endTime = now;
    const startTime = endTime - SEVEN_DAYS_MS;

    expect(endTime - startTime).toBe(SEVEN_DAYS_MS);

    // Next window
    const nextEndTime = startTime;
    const nextStartTime = nextEndTime - SEVEN_DAYS_MS;
    expect(nextEndTime - nextStartTime).toBe(SEVEN_DAYS_MS);
  });

  it("walks backwards from now to V31_START in 7-day steps", () => {
    let endTime = Date.now();
    const windows: number[] = [];

    while (endTime > V31_START_MS) {
      const startTime = endTime - SEVEN_DAYS_MS;
      windows.push(endTime);
      endTime = startTime;
    }

    // Should cover ~68 weeks (2024-11-17 to 2026-03-13 ≈ 487 days ≈ ~70 windows)
    expect(windows.length).toBeGreaterThan(60);
    expect(windows.length).toBeLessThan(80);
  });
});

describe("PnL Pagination - Client Logic", () => {
  it("continues paginating when cursor exists", () => {
    const state = computeClientState({
      list: [{ id: 1 }],
      nextPageCursor: "cursor123",
      nextEndTime: null,
    });
    expect(state.hasMore).toBe(true);
    expect(state.advanceWindow).toBe(false);
  });

  it("advances to next window when cursor exhausted", () => {
    const state = computeClientState({
      list: [{ id: 1 }],
      nextPageCursor: "",
      nextEndTime: Date.now() - SEVEN_DAYS_MS,
    });
    expect(state.hasMore).toBe(true);
    expect(state.advanceWindow).toBe(true);
  });

  it("BUG: advances window even when list is empty", () => {
    const state = computeClientState({
      list: [],
      nextPageCursor: "",
      nextEndTime: Date.now() - SEVEN_DAYS_MS,
    });
    // Empty window should still advance — NOT stop
    expect(state.hasMore).toBe(true);
    expect(state.advanceWindow).toBe(true);
  });

  it("stops when nextEndTime is null (past V31_START)", () => {
    const state = computeClientState({
      list: [],
      nextPageCursor: "",
      nextEndTime: null,
    });
    expect(state.hasMore).toBe(false);
  });

  it("simulates full pagination across multiple windows", () => {
    // Simulate: window1 has 100+27 records, window2 empty, window3 has 50 records
    const responses = [
      { list: new Array(100), nextPageCursor: "c1", nextEndTime: null },
      { list: new Array(27), nextPageCursor: "", nextEndTime: Date.now() - SEVEN_DAYS_MS },
      { list: [], nextPageCursor: "", nextEndTime: Date.now() - 2 * SEVEN_DAYS_MS },
      { list: new Array(50), nextPageCursor: "", nextEndTime: Date.now() - 3 * SEVEN_DAYS_MS },
    ];

    let totalRecords = 0;
    let windowAdvances = 0;

    for (const resp of responses) {
      totalRecords += resp.list.length;
      const state = computeClientState(resp);
      if (state.advanceWindow) windowAdvances++;
      if (!state.hasMore) break;
    }

    expect(totalRecords).toBe(177); // 100 + 27 + 0 + 50
    expect(windowAdvances).toBe(3);
  });

  it("auto-fetches next window when current returns empty", () => {
    // The client should NOT wait for user scroll when a window is empty
    // It should immediately fetch the next window
    const emptyWindowResponse = {
      list: [],
      nextPageCursor: "",
      nextEndTime: Date.now() - SEVEN_DAYS_MS,
    };

    const state = computeClientState(emptyWindowResponse);
    // Key assertion: hasMore=true + advanceWindow=true means fetch immediately
    expect(state.hasMore).toBe(true);
    expect(state.advanceWindow).toBe(true);
  });
});
