"use client";

import type { EquityCurvePoint } from "@/types";

interface Props {
  data: EquityCurvePoint[];
}

export function AnimatedSparkline({ data }: Props) {
  if (data.length < 2) return null;

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const W = 1200;
  const H = 400;
  const pad = 24;

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - pad - ((d.value - min) / range) * (H - pad * 2);
    return `${x},${y}`;
  });
  const d = `M ${points.join(" L ")}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="block h-56 w-full"
      style={{ animation: "fadeIn 1.5s ease-in-out" }}
    >
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C5A049" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#C5A049" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${d} L ${W},${H} L 0,${H} Z`}
        fill="url(#sparkFill)"
        opacity="0.5"
      />
      <path
        d={d}
        fill="none"
        stroke="#C5A049"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
