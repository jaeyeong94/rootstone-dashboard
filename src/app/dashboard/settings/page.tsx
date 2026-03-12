"use client";

import { Header } from "@/components/layout/Header";
import { useSession } from "next-auth/react";

export default function SettingsPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string })?.role === "admin";

  return (
    <div>
      <Header title="Settings" />
      <div className="space-y-6 p-6">
        {/* Account Info */}
        <div className="rounded-sm border border-border-subtle bg-bg-card p-6">
          <span className="text-xs uppercase tracking-[1px] text-bronze">
            Account
          </span>
          <div className="mt-4 space-y-4">
            <div>
              <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">
                Username
              </span>
              <p className="mt-1 font-[family-name:var(--font-mono)] text-sm text-text-primary">
                {session?.user?.name ?? "-"}
              </p>
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">
                Role
              </span>
              <p className="mt-1 font-[family-name:var(--font-mono)] text-sm text-text-primary">
                {isAdmin ? "Administrator" : "Viewer"}
              </p>
            </div>
          </div>
        </div>

        {/* API Status */}
        <div className="rounded-sm border border-border-subtle bg-bg-card p-6">
          <span className="text-xs uppercase tracking-[1px] text-bronze">
            API Connection
          </span>
          <div className="mt-4 space-y-4">
            <div>
              <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">
                Exchange
              </span>
              <p className="mt-1 font-[family-name:var(--font-mono)] text-sm text-text-primary">
                Bybit (Unified Account)
              </p>
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-[1px] text-text-secondary">
                Permission
              </span>
              <p className="mt-1 font-[family-name:var(--font-mono)] text-sm text-status-live">
                Read-only
              </p>
            </div>
          </div>
        </div>

        {/* Admin Section */}
        {isAdmin && (
          <div className="rounded-sm border border-border-subtle bg-bg-card p-6">
            <span className="text-xs uppercase tracking-[1px] text-bronze">
              Administration
            </span>
            <p className="mt-4 text-xs text-text-muted">
              User management and API configuration will be available in a future update.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
