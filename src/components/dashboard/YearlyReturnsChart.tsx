"use client";

import { cn } from "@/lib/utils";
import { yearlyReturns } from "@/lib/strategy-data";

function formatReturn(v: number): string {
  return (v >= 0 ? "+" : "") + v.toFixed(1) + "%";
}

export function YearlyReturnsChart() {
  const maxVal = Math.max(
    ...yearlyReturns.map((y) => Math.abs(y.rebeta)),
    ...yearlyReturns.map((y) => Math.abs(y.btc))
  );

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[2px] text-bronze">
            Yearly Returns
          </p>
          <p className="mt-0.5 text-xs text-text-muted">
            Rebeta vs BTC annual performance comparison
          </p>
        </div>
        <div className="flex items-center gap-4 text-[10px]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-gold/70" /> REBETA
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-text-muted/40" /> BTC
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {yearlyReturns.map((y) => (
          <div key={y.year} className="flex items-center gap-3">
            <span className="w-10 shrink-0 font-[family-name:var(--font-mono)] text-xs text-text-secondary">
              {y.year}
            </span>
            <div className="flex flex-1 flex-col gap-1">
              {/* Rebeta bar */}
              <div className="flex items-center gap-2">
                <div className="relative h-6 flex-1 rounded-sm bg-bg-elevated overflow-hidden">
                  <div
                    data-testid={`bar-rebeta-${y.year}`}
                    className={cn(
                      "absolute top-0 h-full rounded-sm transition-all duration-500",
                      y.rebeta >= 0
                        ? "left-1/2 bg-gold/70"
                        : "right-1/2 bg-pnl-negative/50"
                    )}
                    style={{
                      width: `${(Math.abs(y.rebeta) / maxVal) * 50}%`,
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-[family-name:var(--font-mono)] text-[11px] text-text-primary/80">
                      {formatReturn(y.rebeta)}
                    </span>
                  </div>
                </div>
                <span className="w-14 text-right text-[10px] text-gold">REBETA</span>
              </div>
              {/* BTC bar */}
              <div className="flex items-center gap-2">
                <div className="relative h-6 flex-1 rounded-sm bg-bg-elevated overflow-hidden">
                  <div
                    data-testid={`bar-btc-${y.year}`}
                    className={cn(
                      "absolute top-0 h-full rounded-sm transition-all duration-500",
                      y.btc >= 0
                        ? "left-1/2 bg-text-muted/40"
                        : "right-1/2 bg-pnl-negative/30"
                    )}
                    style={{
                      width: `${(Math.abs(y.btc) / maxVal) * 50}%`,
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-[family-name:var(--font-mono)] text-[11px] text-text-secondary/70">
                      {formatReturn(y.btc)}
                    </span>
                  </div>
                </div>
                <span className="w-14 text-right text-[10px] text-text-muted">BTC</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
