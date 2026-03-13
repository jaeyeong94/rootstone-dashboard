"use client";

import { useEffect, useRef } from "react";
import { useOrdersStore } from "@/stores/useOrdersStore";

const WS_URL = "wss://stream.bybit.com/v5/private";
const ACTIVE_STATUSES = new Set(["New", "PartiallyFilled"]);

export function useOrdersWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let destroyed = false;

    async function connect() {
      if (destroyed) return;

      // cleanup
      if (pingRef.current) { clearInterval(pingRef.current); pingRef.current = null; }
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
      useOrdersStore.getState().setConnected(false);

      try {
        // 1) 초기 오더 REST 조회
        const initRes = await fetch("/api/bybit/orders");
        const initData = await initRes.json();
        if (!destroyed) useOrdersStore.getState().setOrders(initData.orders ?? []);

        if (destroyed) return;

        // 2) WS 인증 크레덴셜 획득
        const authRes = await fetch("/api/bybit/ws-auth");
        const { apiKey, expires, signature } = await authRes.json();

        if (destroyed) return;

        // 3) 프라이빗 WS 연결
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          ws.send(JSON.stringify({ op: "auth", args: [apiKey, expires, signature] }));
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data as string);

            if (msg.op === "pong") return;

            if (msg.op === "auth") {
              if (msg.success) {
                ws.send(JSON.stringify({ op: "subscribe", args: ["order"] }));
                useOrdersStore.getState().setConnected(true);
                pingRef.current = setInterval(() => {
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ op: "ping" }));
                  }
                }, 20000);
              }
              return;
            }

            if (msg.topic === "order" && Array.isArray(msg.data)) {
              const { upsertOrder, removeOrder } = useOrdersStore.getState();
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              msg.data.forEach((order: any) => {
                if (ACTIVE_STATUSES.has(order.orderStatus)) {
                  upsertOrder({
                    orderId: order.orderId,
                    symbol: order.symbol,
                    side: order.side,
                    orderType: order.orderType,
                    price: order.price,
                    qty: order.qty,
                    cumExecQty: order.cumExecQty ?? "0",
                    orderStatus: order.orderStatus,
                    createdTime: order.createdTime,
                  });
                } else {
                  removeOrder(order.orderId);
                }
              });
            }
          } catch {
            // ignore parse errors
          }
        };

        ws.onclose = () => {
          useOrdersStore.getState().setConnected(false);
          if (!destroyed) {
            reconnectRef.current = setTimeout(connect, 5000);
          }
        };

        ws.onerror = () => ws.close();
      } catch {
        if (!destroyed) {
          reconnectRef.current = setTimeout(connect, 5000);
        }
      }
    }

    connect();

    return () => {
      destroyed = true;
      if (pingRef.current) clearInterval(pingRef.current);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
      useOrdersStore.getState().setConnected(false);
    };
  }, []); // 마운트 시 1회만 실행
}
