import { create } from "zustand";
import type { Position } from "@/types";

interface PositionState {
  positions: Position[];
  count: number;
  isLoading: boolean;
  lastUpdatedAt: Date | null;
  setPositions: (positions: Position[], count: number) => void;
  setLoading: (loading: boolean) => void;
}

export const usePositionStore = create<PositionState>((set) => ({
  positions: [],
  count: 0,
  isLoading: true,
  lastUpdatedAt: null,
  setPositions: (positions, count) =>
    set({ positions, count, isLoading: false, lastUpdatedAt: new Date() }),
  setLoading: (loading) => set({ isLoading: loading }),
}));
