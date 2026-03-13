"use client";

import { useTickerStore } from "@/stores/useTickerStore";
import { usePositionStore } from "@/stores/usePositionStore";
import { cn, formatNumber, formatPnlPercent, getPnlColor } from "@/lib/utils";
import type { Position } from "@/types";

function PositionRow({ pos }: { pos: Position }) {
  const livePrice = useTickerStore((s) => s.getPrice(pos.symbol));
  const currentPrice = parseFloat(livePrice ?? pos.markPrice);
  const entryPrice = parseFloat(pos.entryPrice);
  const isLong = pos.side === "Buy";

  const pnlPct = isLong
    ? (currentPrice - entryPrice) / entryPrice
    : (entryPrice - currentPrice) / entryPrice;

  const barPct = Math.min(Math.abs(pnlPct) * 10 * 100, 100);

  return (
    <div className="space-y-1.5 py-3 border-b border-border-subtle last:border-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-[family-name:var(--font-mono)] text-sm font-medium text-text-primary">
            {pos.symbol.replace("USDT", "")}
          </span>
          <span
            className={cn(
              "text-[9px] uppercase tracking-[1.5px] px-1.5 py-0.5 rounded-sm",
              isLong
                ? "bg-pnl-positive/15 text-pnl-positive"
                : "bg-pnl-negative/15 text-pnl-negative"
            )}
          >
            {isLong ? "Long" : "Short"}
          </span>
          <span className="text-[10px] text-text-dim">{pos.leverage}×</span>
        </div>
        <span
          className={cn(
            "font-[family-name:var(--font-mono)] text-sm font-medium",
            getPnlColor(pnlPct)
          )}
        >
          {formatPnlPercent(pnlPct)}
        </span>
      </div>

      <div className="h-1 w-full rounded-full bg-bg-elevated overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            pnlPct >= 0 ? "bg-pnl-positive/60" : "bg-pnl-negative/60"
          )}
          style={{ width: `${barPct}%` }}
        />
      </div>

      <div className="flex justify-between text-[10px] text-text-dim">
        <span>Entry {formatNumber(entryPrice)}</span>
        <span className={getPnlColor(pnlPct)}>{formatNumber(currentPrice)}</span>
      </div>
    </div>
  );
}

export function LivePositionBar() {
  const positions = usePositionStore((s) => s.positions);
  const isLoading = usePositionStore((s) => s.isLoading);

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">
          Open Positions
        </span>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-[live-pulse_2s_ease-in-out_infinite] rounded-full bg-status-live" />
          <span className="font-[family-name:var(--font-mono)] text-xs text-text-secondary">
            {positions.length}
          </span>
        </div>
      </div>

      <div className="mt-2">
        {isLoading ? (
          <div className="space-y-3 pt-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded bg-bg-elevated" />
            ))}
          </div>
        ) : positions.length === 0 ? (
          <div className="flex h-32 items-center justify-center">
            <div className="text-center">
              <div className="text-2xl text-text-dim mb-1">◎</div>
              <p className="text-xs text-text-muted">Waiting for signal</p>
            </div>
          </div>
        ) : (
          <div className="divide-border-subtle">
            {positions.map((pos) => (
              <PositionRow key={`${pos.symbol}-${pos.side}`} pos={pos} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
