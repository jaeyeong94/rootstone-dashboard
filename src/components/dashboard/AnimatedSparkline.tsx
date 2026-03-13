"use client";

import { useEffect, useRef } from "react";
import type { EquityCurvePoint } from "@/types";

interface Props {
  data: EquityCurvePoint[];
}

export function AnimatedSparkline({ data }: Props) {
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const path = pathRef.current;
    if (!path || data.length < 2) return;
    const length = path.getTotalLength();
    path.style.strokeDasharray = String(length);
    path.style.strokeDashoffset = String(length);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        path.style.transition = "stroke-dashoffset 2s ease-in-out";
        path.style.strokeDashoffset = "0";
      });
    });
  }, [data]);

  if (data.length < 2) return null;

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const W = 1200;
  const H = 60;
  const pad = 4;

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
      className="h-12 w-full"
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
        ref={pathRef}
        d={d}
        fill="none"
        stroke="#C5A049"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
