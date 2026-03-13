"use client";

import { useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function SectionCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-sm border border-border-subtle bg-bg-card p-6">
      <span className="text-xs uppercase tracking-[1px] text-bronze">
        {label}
      </span>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border-subtle last:border-0">
      <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">
        {label}
      </span>
      <div className="font-[family-name:var(--font-mono)] text-sm text-text-primary">
        {children}
      </div>
    </div>
  );
}

function ApiConnectionSection() {
  const [status, setStatus] = useState<"idle" | "testing" | "ok" | "error">(
    "idle"
  );
  const [latency, setLatency] = useState<number | null>(null);

  async function testConnection() {
    setStatus("testing");
    const start = Date.now();
    try {
      const res = await fetch("/api/bybit/balance?period=24h");
      const elapsed = Date.now() - start;
      if (res.ok) {
        setLatency(elapsed);
        setStatus("ok");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <SectionCard label="API Connection">
      <div className="space-y-0">
        <Row label="Exchange">Bybit (Unified Account)</Row>
        <Row label="Permission">
          <span className="text-status-live">Read-only</span>
        </Row>
        <Row label="Status">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "font-[family-name:var(--font-mono)] text-xs",
                status === "ok" && "text-pnl-positive",
                status === "error" && "text-pnl-negative",
                status === "idle" && "text-text-muted",
                status === "testing" && "text-text-secondary"
              )}
            >
              {status === "idle" && "—"}
              {status === "testing" && "Testing..."}
              {status === "ok" && `Connected (${latency}ms)`}
              {status === "error" && "Failed"}
            </span>
            <button
              onClick={testConnection}
              disabled={status === "testing"}
              className="px-3 py-1 text-[10px] uppercase tracking-[1px] border border-border-subtle text-text-secondary hover:border-bronze hover:text-bronze transition-colors disabled:opacity-40"
            >
              {status === "testing" ? "..." : "Test"}
            </button>
          </div>
        </Row>
      </div>
    </SectionCard>
  );
}

function SnapshotManagerSection() {
  const { data, mutate, isLoading } = useSWR("/api/admin/stats", fetcher);
  const [snapping, setSnapping] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  async function takeSnapshot() {
    setSnapping(true);
    setLastResult(null);
    try {
      const res = await fetch("/api/admin/snapshot", { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        setLastResult("Snapshot created");
        mutate(); // refresh stats
      } else {
        setLastResult(json.error ?? "Failed");
      }
    } catch {
      setLastResult("Network error");
    } finally {
      setSnapping(false);
    }
  }

  function formatDate(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <SectionCard label="Snapshot Manager">
      <div className="space-y-0">
        <Row label="Total Snapshots">
          {isLoading ? (
            <span className="text-text-muted">—</span>
          ) : (
            <span>{(data?.snapshotCount ?? 0).toLocaleString()}</span>
          )}
        </Row>
        <Row label="Oldest">
          <span className="text-text-secondary text-xs">
            {isLoading ? "—" : formatDate(data?.oldestSnapshot)}
          </span>
        </Row>
        <Row label="Latest">
          <span className="text-text-secondary text-xs">
            {isLoading ? "—" : formatDate(data?.latestSnapshot)}
          </span>
        </Row>
        <Row label="Manual Snapshot">
          <div className="flex items-center gap-3">
            {lastResult && (
              <span
                className={cn(
                  "text-[10px]",
                  lastResult === "Snapshot created"
                    ? "text-pnl-positive"
                    : "text-pnl-negative"
                )}
              >
                {lastResult}
              </span>
            )}
            <button
              onClick={takeSnapshot}
              disabled={snapping}
              className="px-3 py-1 text-[10px] uppercase tracking-[1px] border border-border-subtle text-text-secondary hover:border-bronze hover:text-bronze transition-colors disabled:opacity-40"
            >
              {snapping ? "..." : "Take Now"}
            </button>
          </div>
        </Row>
      </div>
    </SectionCard>
  );
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const isAdmin =
    session?.user?.role === "admin";

  return (
    <div>
      <Header title="Settings" />
      <div className="space-y-4 p-6 max-w-2xl">
        {/* Account */}
        <SectionCard label="Account">
          <div className="space-y-0">
            <Row label="Username">
              {session?.user?.name ?? "—"}
            </Row>
            <Row label="Role">
              <span
                className={cn(
                  isAdmin ? "text-bronze" : "text-text-secondary"
                )}
              >
                {isAdmin ? "Administrator" : "Viewer"}
              </span>
            </Row>
            <Row label="Session">
              <span className="text-pnl-positive">Active (24h)</span>
            </Row>
          </div>
        </SectionCard>

        {/* API Connection */}
        <ApiConnectionSection />

        {/* Cron Schedule */}
        <SectionCard label="Automation">
          <div className="space-y-0">
            <Row label="Cron Schedule">Daily 00:00 UTC</Row>
            <Row label="Provider">Vercel Cron (Hobby)</Row>
            <Row label="Next Run">
              <span className="text-text-secondary text-xs">
                {(() => {
                  const now = new Date();
                  const next = new Date(now);
                  next.setUTCHours(24, 0, 0, 0);
                  const diffH = Math.floor(
                    (next.getTime() - now.getTime()) / (1000 * 60 * 60)
                  );
                  const diffM = Math.floor(
                    ((next.getTime() - now.getTime()) % (1000 * 60 * 60)) /
                      (1000 * 60)
                  );
                  return `in ${diffH}h ${diffM}m`;
                })()}
              </span>
            </Row>
          </div>
        </SectionCard>

        {/* Admin Only: Snapshot Manager */}
        {isAdmin && <SnapshotManagerSection />}
      </div>
    </div>
  );
}
