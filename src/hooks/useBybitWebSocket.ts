"use client";

import { useEffect, useRef, useCallback } from "react";
import { useTickerStore } from "@/stores/useTickerStore";
import { useConnectionStore } from "@/stores/useConnectionStore";
import type { TickerData } from "@/types";

const WS_URL = "wss://stream.bybit.com/v5/public/linear";
const SYMBOLS = ["BTCUSDT", "ETHUSDT", "XRPUSDT", "LTCUSDT"];
const PING_INTERVAL = 20000;
const MAX_RECONNECT_DELAY = 30000;

export function useBybitWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectRef = useRef<(() => void) | null>(null);

  const updateTicker = useTickerStore((s) => s.updateTicker);

  const cleanup = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    cleanup();

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      useConnectionStore.getState().setStatus("connected");
      useConnectionStore.getState().resetReconnect();

      // Subscribe to tickers
      ws.send(
        JSON.stringify({
          op: "subscribe",
          args: SYMBOLS.map((s) => `tickers.${s}`),
        })
      );

      // Start ping/pong
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ op: "ping" }));
        }
      }, PING_INTERVAL);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.op === "pong") return;

        if (msg.topic?.startsWith("tickers.") && msg.data) {
          const tickerData: TickerData = msg.data;
          updateTicker(tickerData);
          useConnectionStore.getState().setLastMessage();
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      useConnectionStore.getState().setStatus("reconnecting");
      // Schedule reconnect via ref to avoid circular dependency
      const store = useConnectionStore.getState();
      store.incrementReconnect();
      const count = useConnectionStore.getState().reconnectCount;
      const delay = Math.min(1000 * Math.pow(2, count), MAX_RECONNECT_DELAY);
      reconnectTimeoutRef.current = setTimeout(() => {
        connectRef.current?.();
      }, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [cleanup, updateTicker]);

  // Keep ref in sync for reconnection
  connectRef.current = connect;

  useEffect(() => {
    connect();
    return cleanup;
  }, [connect, cleanup]);

  return { reconnect: connect };
}
