"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface NavAlert {
  id: number;
  date: string;
  type: string;
  message: string;
}

export function NavAlertBanner() {
  const { data } = useSWR<{ alerts: NavAlert[]; hasUnresolved: boolean }>(
    "/api/admin/nav-alerts",
    fetcher,
    { refreshInterval: 300000 } // 5분마다 체크
  );

  if (!data?.hasUnresolved) return null;

  const latestAlert = data.alerts[0];
  if (!latestAlert) return null;

  const typeLabels: Record<string, string> = {
    api_error: "DATA COLLECTION ERROR",
    gap_detected: "DATA GAP DETECTED",
    verification_mismatch: "VERIFICATION MISMATCH",
  };

  return (
    <div className="border-b border-pnl-negative/30 bg-pnl-negative/10 px-4 py-2.5">
      <div className="flex items-center gap-3">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-pnl-negative" />
        <div>
          <span className="text-[10px] font-medium uppercase tracking-[1px] text-pnl-negative">
            {typeLabels[latestAlert.type] || "ALERT"}
          </span>
          <p className="mt-0.5 text-xs text-text-secondary">
            {latestAlert.message}
          </p>
          {data.alerts.length > 1 && (
            <p className="mt-0.5 text-[10px] text-text-muted">
              +{data.alerts.length - 1} more alert(s)
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
