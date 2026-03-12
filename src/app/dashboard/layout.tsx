"use client";

import { SessionProvider } from "next-auth/react";
import { Sidebar } from "@/components/layout/Sidebar";
import { WebSocketProvider } from "@/components/providers/WebSocketProvider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <WebSocketProvider>
        <div className="flex h-screen bg-bg-primary">
          <Sidebar />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </WebSocketProvider>
    </SessionProvider>
  );
}
