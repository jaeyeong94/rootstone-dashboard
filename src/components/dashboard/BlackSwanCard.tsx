"use client";

import { cn } from "@/lib/utils";
import {
  blackSwansV1,
  blackSwansV31,
  crisisStats,
  type BlackSwanEvent,
} from "@/lib/strategy-data";

function EventRow({ e }: { e: BlackSwanEvent }) {
  const rebetaNum = parseFloat(e.rebeta);
  const btcNum = parseFloat(e.btc);

  return (
    <div className="flex items-center gap-4 border-b border-border-subtle px-4 py-3 last:border-0 transition-colors hover:bg-bg-elevated">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-text-primary">{e.event}</p>
        <p className="text-[10px] text-text-muted">{e.period}</p>
      </div>
      <div className="w-16 shrink-0 text-center">
        <span
          className={cn(
            "font-[family-name:var(--font-mono)] text-xs",
            rebetaNum >= 0 ? "text-pnl-positive" : "text-pnl-negative"
          )}
        >
          {e.rebeta}
        </span>
      </div>
      <div className="w-16 shrink-0 text-center">
        <span
          className={cn(
            "font-[family-name:var(--font-mono)] text-xs",
            btcNum >= 0 ? "text-pnl-positive" : "text-pnl-negative"
          )}
        >
          {e.btc}
        </span>
      </div>
      <div className="w-20 shrink-0 text-center">
        <span className="font-[family-name:var(--font-mono)] text-xs font-semibold text-text-primary">
          {e.alpha}
        </span>
      </div>
    </div>
  );
}

export function BlackSwanCard() {
  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card">
      {/* Header */}
      <div className="border-b border-border-subtle px-5 py-4">
        <p className="text-[10px] font-medium uppercase tracking-[2px] text-bronze">
          Black Swan Survival
        </p>
        <p className="mt-1 text-xs text-text-muted">
          7 crises survived, average +21.63%p outperformance vs BTC
        </p>
      </div>

      {/* Crisis Summary Stats */}
      <div className="grid grid-cols-2 gap-px border-b border-border-subtle bg-border-subtle xl:grid-cols-4">
        {crisisStats.map((s) => (
          <div key={s.label} className="bg-bg-card px-3 py-3 text-center">
            <p className="font-[family-name:var(--font-mono)] text-base font-semibold text-text-primary">
              {s.value}
            </p>
            <p className="mt-0.5 text-[9px] uppercase tracking-[0.5px] text-text-muted">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* Events Table Header */}
      <div className="flex gap-4 border-b border-border-subtle bg-bg-elevated px-4 py-2">
        <div className="min-w-0 flex-1 text-[10px] uppercase tracking-[1px] text-text-secondary">
          Event
        </div>
        <div className="w-16 shrink-0 text-center text-[10px] uppercase tracking-[1px] text-text-secondary">
          Rebeta
        </div>
        <div className="w-16 shrink-0 text-center text-[10px] uppercase tracking-[1px] text-text-secondary">
          BTC
        </div>
        <div className="w-20 shrink-0 text-center text-[10px] uppercase tracking-[1px] text-text-secondary">
          Alpha
        </div>
      </div>

      {/* v1 Events */}
      <div>
        <p className="bg-bg-primary px-4 py-1.5 text-[9px] uppercase tracking-[1px] text-text-muted">
          Phase 1 · v1 (2021~2024)
        </p>
        {blackSwansV1.map((e) => (
          <EventRow key={e.event} e={e} />
        ))}
      </div>

      {/* v3.1 Events */}
      <div>
        <p className="bg-bg-primary px-4 py-1.5 text-[9px] uppercase tracking-[1px] text-text-muted">
          Phase 2 · v3.1 (2024~Current)
        </p>
        {blackSwansV31.map((e) => (
          <EventRow key={e.event} e={e} />
        ))}
      </div>
    </div>
  );
}
