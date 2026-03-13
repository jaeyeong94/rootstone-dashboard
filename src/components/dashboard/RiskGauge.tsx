"use client";

import { usePositionStore } from "@/stores/usePositionStore";
import type { Position } from "@/types";

function ArcGauge({ pct }: { pct: number }) {
  const R = 54;
  const circumference = Math.PI * R;
  const filled = (pct / 100) * circumference;
  const gap = circumference - filled;

  const riskColor =
    pct < 30 ? "#10B981" : pct < 70 ? "#C5A049" : "#EF4444";
  const riskLabel =
    pct < 30 ? "LOW" : pct < 70 ? "MEDIUM" : "HIGH";

  return (
    <svg viewBox="0 0 128 80" className="w-full max-w-[180px]">
      <path
        d="M 10,70 A 54,54 0 0,1 118,70"
        fill="none"
        stroke="#1C1C1C"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <path
        d="M 10,70 A 54,54 0 0,1 118,70"
        fill="none"
        stroke={riskColor}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${gap}`}
        style={{ transition: "stroke-dasharray 0.8s ease, stroke 0.5s ease" }}
      />
      <text
        x="64"
        y="58"
        textAnchor="middle"
        fill="white"
        fontSize="18"
        fontFamily="JetBrains Mono"
      >
        {pct.toFixed(0)}%
      </text>
      <text
        x="64"
        y="73"
        textAnchor="middle"
        fill={riskColor}
        fontSize="9"
        fontFamily="Inter"
        letterSpacing="1.5"
      >
        {riskLabel}
      </text>
    </svg>
  );
}

/**
 * Heuristic risk % based on average leverage and position count.
 * No wallet balance available from the API — uses leverage as a proxy.
 *
 * Scale:
 *   avgLev <= 1  → ~0%   base
 *   avgLev == 5  → ~50%
 *   avgLev >= 10 → ~100%
 * Additional 5% per open position (capped at 20%).
 */
function calcRiskPct(positions: Position[]): number {
  if (positions.length === 0) return 0;

  const avgLev =
    positions.reduce((sum, p) => sum + (parseFloat(p.leverage) || 1), 0) /
    positions.length;

  // Leverage contributes up to 80%: scale 1x→0, 10x→80
  const levPct = Math.min(((avgLev - 1) / 9) * 80, 80);

  // Position count contributes up to 20%: each position adds 5%
  const posPct = Math.min(positions.length * 5, 20);

  return Math.min(levPct + posPct, 100);
}

export function RiskGauge() {
  const positions = usePositionStore((s) => s.positions);
  const marginPct = calcRiskPct(positions);

  const avgLev =
    positions.length > 0
      ? positions.reduce((sum, p) => sum + (parseFloat(p.leverage) || 1), 0) /
        positions.length
      : 0;

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-5">
      <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">
        Risk Gauge
      </span>

      <div className="mt-4 flex flex-col items-center gap-3">
        <ArcGauge pct={marginPct} />

        <div className="w-full space-y-2 text-[10px]">
          <div className="flex justify-between text-text-muted">
            <span>Positions</span>
            <span className="font-[family-name:var(--font-mono)] text-text-secondary">
              {positions.length}
            </span>
          </div>
          <div className="flex justify-between text-text-muted">
            <span>Avg Leverage</span>
            <span className="font-[family-name:var(--font-mono)] text-text-secondary">
              {positions.length > 0 ? `${avgLev.toFixed(1)}x` : "—"}
            </span>
          </div>
          <div className="flex justify-between text-text-muted">
            <span>Risk Score</span>
            <span className="font-[family-name:var(--font-mono)] text-text-secondary">
              {marginPct.toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between text-text-muted">
            <span>Strategy</span>
            <span className="font-[family-name:var(--font-mono)] text-bronze">
              Rebeta v3.1
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
