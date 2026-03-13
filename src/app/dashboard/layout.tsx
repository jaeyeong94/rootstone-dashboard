"use client";

import { SessionProvider } from "next-auth/react";
import { Sidebar } from "@/components/layout/Sidebar";
import { WebSocketProvider } from "@/components/providers/WebSocketProvider";
import { PositionsProvider } from "@/components/providers/PositionsProvider";
import { Agentation } from "agentation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <WebSocketProvider>
        <PositionsProvider>
          <div className="flex h-screen bg-bg-primary">
            <Sidebar />
            <main className="flex-1 overflow-auto">{children}</main>
          </div>
          {process.env.NODE_ENV === "development" && <Agentation />}
        </PositionsProvider>
      </WebSocketProvider>
    </SessionProvider>
  );
}
