"use client";

import { useBybitWebSocket } from "@/hooks/useBybitWebSocket";

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  useBybitWebSocket();
  return <>{children}</>;
}
