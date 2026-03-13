"use client";

import { useBybitWebSocket } from "@/hooks/useBybitWebSocket";
import { useOrdersWebSocket } from "@/hooks/useOrdersWebSocket";

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  useBybitWebSocket();
  useOrdersWebSocket();
  return <>{children}</>;
}
