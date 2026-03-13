"use client";
import { TodayStats } from "./TodayStats";
import { OrdersPanel } from "./OrdersPanel";
import { ExecutionsSidebar } from "./ExecutionsSidebar";

export function RightFixedPanel() {
  return (
    <div className="fixed right-0 top-0 z-30 hidden h-screen w-[280px] flex-col gap-3 border-l border-border-subtle bg-bg-primary px-3 py-4 xl:flex">
      <div className="shrink-0">
        <TodayStats />
      </div>
      <OrdersPanel />
      <ExecutionsSidebar />
    </div>
  );
}
