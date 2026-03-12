"use client";

import { useConnectionStore } from "@/stores/useConnectionStore";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils";

export function LiveIndicator() {
  const { status, lastMessageAt } = useConnectionStore();

  const statusConfig = {
    connected: {
      color: "bg-status-live",
      text: "LIVE",
      textColor: "text-status-live",
    },
    reconnecting: {
      color: "bg-status-warn",
      text: "RECONNECTING",
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
      {lastMessageAt && (
        <span className="text-xs text-text-muted">
          {formatRelativeTime(lastMessageAt)}
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
