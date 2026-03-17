"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  BarChart3,
  TrendingUp,
  GitCompareArrows,
  LogOut,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "OVERVIEW", href: "/dashboard", icon: LayoutDashboard },
  { name: "PERFORMANCE", href: "/dashboard/performance", icon: TrendingUp },
  { name: "TRADES", href: "/dashboard/positions", icon: BarChart3 },
  { name: "CORRELATION", href: "/dashboard/correlation", icon: GitCompareArrows },
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const navContent = (
    <>
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-6">
        <span className="font-[family-name:var(--font-heading)] text-lg font-light tracking-wide text-text-primary">
          ROOTSTONE
        </span>
        {/* Close button - mobile only */}
        <button
          onClick={() => setOpen(false)}
          className="text-text-muted xl:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Strategy Selector */}
      <div className="mx-3 mb-2">
        <button className="flex w-full items-center justify-between rounded-sm border border-border-subtle bg-bg-card px-3 py-2 transition-colors hover:border-bronze/40">
          <div className="flex flex-col items-start">
            <span className="text-[9px] uppercase tracking-[1px] text-text-muted">Strategy</span>
            <span className="font-[family-name:var(--font-mono)] text-xs font-medium text-bronze">
              Rebeta v3.1
            </span>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 pt-2">
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
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed left-0 right-0 top-0 z-40 flex h-12 items-center border-b border-border-subtle bg-bg-primary px-4 xl:hidden">
        <button onClick={() => setOpen(true)} className="text-text-secondary">
          <Menu className="h-5 w-5" />
        </button>
        <span className="ml-3 font-[family-name:var(--font-heading)] text-sm font-light tracking-wide text-text-primary">
          ROOTSTONE
        </span>
      </div>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 xl:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar - desktop: static, mobile: slide-over */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 flex h-screen w-60 flex-col border-r border-border-subtle bg-bg-primary transition-transform duration-200 xl:static xl:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {navContent}
      </aside>
    </>
  );
}
