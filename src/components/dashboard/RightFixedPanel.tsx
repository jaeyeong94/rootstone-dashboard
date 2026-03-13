"use client";
import { TodayStats } from "./TodayStats";
import { ExecutionsSidebar } from "./ExecutionsSidebar";

export function RightFixedPanel() {
  return (
    <div className="fixed right-0 top-0 z-30 flex h-screen w-[280px] flex-col gap-3 overflow-y-auto border-l border-border-subtle bg-bg-primary p-4">
      <TodayStats />
      <ExecutionsSidebar />
    </div>
  );
}
