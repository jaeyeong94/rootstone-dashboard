import { create } from "zustand";

type ConnectionStatus = "connected" | "stale" | "disconnected";

interface ConnectionState {
  status: ConnectionStatus;
  lastPollAt: Date | null;
  errorCount: number;
  setPolled: () => void;
  setError: () => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: "disconnected",
  lastPollAt: null,
  errorCount: 0,

  setPolled: () =>
    set({ status: "connected", lastPollAt: new Date(), errorCount: 0 }),

  setError: () =>
    set((state) => {
      const count = state.errorCount + 1;
      return {
        errorCount: count,
        status: count >= 3 ? "disconnected" : "stale",
      };
    }),
}));
