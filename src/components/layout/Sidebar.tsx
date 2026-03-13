"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  BarChart3,
  History,
  BookOpen,
  TrendingUp,
  Settings,
  LogOut,
  ShieldAlert,
  Activity,
  CalendarDays,
  FileBarChart,
  GitCompareArrows,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "OVERVIEW", href: "/dashboard", icon: LayoutDashboard },
  { name: "POSITIONS", href: "/dashboard/positions", icon: BarChart3 },
  { name: "HISTORY", href: "/dashboard/history", icon: History },
  { name: "RISK", href: "/dashboard/risk", icon: ShieldAlert },
  { name: "REGIME", href: "/dashboard/regime", icon: Activity },
  { name: "CALENDAR", href: "/dashboard/calendar", icon: CalendarDays },
  { name: "REPORTS", href: "/dashboard/reports", icon: FileBarChart },
  { name: "CORRELATION", href: "/dashboard/correlation", icon: GitCompareArrows },
  { name: "STRATEGY", href: "/dashboard/strategy", icon: BookOpen },
  { name: "PERFORMANCE", href: "/dashboard/performance", icon: TrendingUp },
  { name: "SETTINGS", href: "/dashboard/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-border-subtle bg-bg-primary">
      {/* Logo */}
      <div className="flex h-16 items-center px-6">
        <span className="font-[family-name:var(--font-heading)] text-lg font-light tracking-wide text-text-primary">
          ROOTSTONE
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 pt-4">
        <ul className="space-y-1">
          {navigation.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);

            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-sm px-3 py-2.5 text-[13px] tracking-[1px] transition-colors",
                    isActive
                      ? "bg-bg-elevated text-bronze"
                      : "text-text-secondary hover:bg-bg-card hover:text-text-primary"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Logout */}
      <div className="border-t border-border-subtle p-3">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-[13px] tracking-[1px] text-text-muted transition-colors hover:text-pnl-negative"
        >
          <LogOut className="h-4 w-4" />
          LOGOUT
        </button>
      </div>
    </aside>
  );
}
