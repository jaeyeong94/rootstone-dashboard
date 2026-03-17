"use client";

import { useOrdersStore } from "@/stores/useOrdersStore";
import { usePositionStore } from "@/stores/usePositionStore";
import { cn } from "@/lib/utils";

function timeAgo(createdTime: string): string {
  const ms = Date.now() - parseInt(createdTime);
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export function OrdersPanel() {
  const orders = useOrdersStore((s) => s.orders);
  const connected = useOrdersStore((s) => s.connected);
  const totalEquity = usePositionStore((s) => s.totalEquity);

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-sm border border-border-subtle bg-bg-card">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border-subtle px-4 py-3">
        <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">
          Open Orders
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              connected
                ? "animate-[live-pulse_2s_ease-in-out_infinite] bg-status-live"
                : "bg-text-dim"
            )}
          />
          <span
            className={cn(
              "text-[10px]",
              connected ? "text-status-live" : "text-text-dim"
            )}
          >
            {connected ? "Live" : "—"}
          </span>
        </span>
      </div>

      {/* Scrollable list */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {orders.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <span className="text-xs text-text-muted">No open orders</span>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle/50">
            {orders.map((order) => {
              const isBuy = order.side === "Buy";
              const price = parseFloat(order.price);
              const qty = parseFloat(order.qty);
              const notional = price * qty;
              const exposurePct = totalEquity > 0 ? (notional / totalEquity) * 100 : 0;
              const elapsed = order.createdTime ? timeAgo(order.createdTime) : "--";

              return (
                <div
                  key={order.orderId}
                  className="px-4 py-2 transition-colors hover:bg-bg-elevated"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={cn(
                          "shrink-0 rounded-sm px-1 py-0.5 text-[9px] uppercase tracking-[1px]",
                          isBuy
                            ? "bg-pnl-positive/15 text-pnl-positive"
                            : "bg-pnl-negative/15 text-pnl-negative"
                        )}
                      >
                        {isBuy ? "L" : "S"}
                      </span>
                      <div className="min-w-0">
                        <span className="block truncate font-[family-name:var(--font-mono)] text-xs text-text-primary">
                          {order.symbol.replace("USDT", "")}
                        </span>
                        <span className="font-[family-name:var(--font-mono)] text-[9px] text-text-muted">
                          {exposurePct > 0 ? `${exposurePct.toFixed(1)}% NAV` : "--"} · LMT
                        </span>
                      </div>
                    </div>
                    <span className="shrink-0 font-[family-name:var(--font-mono)] text-[10px] text-text-muted">
                      {elapsed}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
