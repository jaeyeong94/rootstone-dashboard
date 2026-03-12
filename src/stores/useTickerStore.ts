import { create } from "zustand";
import type { TickerData } from "@/types";

interface TickerState {
  tickers: Record<string, TickerData>;
  updateTicker: (data: TickerData) => void;
  getPrice: (symbol: string) => string | null;
  getChange24h: (symbol: string) => string | null;
}

export const useTickerStore = create<TickerState>((set, get) => ({
  tickers: {},

  updateTicker: (data: TickerData) => {
    set((state) => ({
      tickers: {
        ...state.tickers,
        [data.symbol]: {
          ...state.tickers[data.symbol],
          ...data,
        },
      },
    }));
  },

  getPrice: (symbol: string) => {
    return get().tickers[symbol]?.lastPrice ?? null;
  },

  getChange24h: (symbol: string) => {
    return get().tickers[symbol]?.price24hPcnt ?? null;
  },
}));
