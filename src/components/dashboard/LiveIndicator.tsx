"use client";

import { useConnectionStore } from "@/stores/useConnectionStore";
import { cn } from "@/lib/utils";

function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export function LiveIndicator() {
  const { status, lastPollAt } = useConnectionStore();

  const statusConfig = {
    connected: {
      color: "bg-status-live",
      text: "LIVE",
      textColor: "text-status-live",
    },
    stale: {
      color: "bg-status-warn",
      text: "STALE",
      textColor: "text-status-warn",
    },
    disconnected: {
      color: "bg-status-error",
      text: "OFFLINE",
      textColor: "text-status-error",
    },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-3">
      {lastPollAt && (
        <span className="font-[family-name:var(--font-mono)] text-xs text-text-muted">
          {formatTime(lastPollAt)}
        </span>
      )}
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "h-2 w-2 rounded-full",
            config.color,
            status === "connected" && "animate-live-pulse"
          )}
        />
        <span
          className={cn(
            "text-[11px] tracking-[1px]",
            config.textColor
          )}
        >
          {config.text}
        </span>
      </div>
    </div>
  );
}
