"use client";

import { useEffect } from "react";
import useSWR from "swr";
import { useTickerStore } from "@/stores/useTickerStore";
import { useOrdersStore } from "@/stores/useOrdersStore";
import { useConnectionStore } from "@/stores/useConnectionStore";
import type { TickerData } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/**
 * Server-side REST polling provider.
 * Replaces direct client→Bybit WebSocket with Vercel API proxy.
 * Ensures all clients work regardless of geo-restriction.
 */
function DataPollingProvider({ children }: { children: React.ReactNode }) {
  // ── Ticker polling (5s) ──
  const { data: tickerData, error: tickerError } = useSWR<{
    tickers: TickerData[];
    ts: number;
  }>("/api/bybit/tickers", fetcher, {
    refreshInterval: 5000,
    dedupingInterval: 5000,
  });

  const updateTicker = useTickerStore((s) => s.updateTicker);

  useEffect(() => {
    if (tickerData?.tickers) {
      for (const t of tickerData.tickers) {
        updateTicker(t);
      }
      useConnectionStore.getState().setPolled();
    }
  }, [tickerData, updateTicker]);

  useEffect(() => {
    if (tickerError) {
      useConnectionStore.getState().setError();
    }
  }, [tickerError]);

  // ── Orders polling (5s) ──
  const { data: ordersData } = useSWR<{
    orders: Array<{
      orderId: string;
      symbol: string;
      side: string;
      orderType: string;
      price: string;
      qty: string;
      cumExecQty: string;
      orderStatus: string;
      createdTime: string;
    }>;
  }>("/api/bybit/orders", fetcher, {
    refreshInterval: 5000,
    dedupingInterval: 5000,
  });

  useEffect(() => {
    if (ordersData?.orders) {
      useOrdersStore.getState().setOrders(ordersData.orders);
    }
  }, [ordersData]);

  return <>{children}</>;
}

// Keep legacy export name for layout.tsx compatibility
export { DataPollingProvider as WebSocketProvider };
