"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { cn } from "@/lib/utils";

const DISCLAIMERS = [
  "All data displayed on this dashboard is for informational purposes only and may differ from actual operational data.",
  "Past performance does not guarantee future results. Loss of principal may occur.",
  "This material does not constitute investment advice or a recommendation to buy or sell any financial product.",
  "Investment decisions should be made based on your own judgment and responsibility. We assume no legal liability for any investment outcomes based on information provided in this dashboard.",
  "Displayed returns may not fully reflect fees, slippage, taxes, or other costs.",
];

export default function LoginPage() {
  const [phase, setPhase] = useState<"disclaimer" | "email">("disclaimer");
  const [agreed, setAgreed] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleEnter(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setIsLoading(true);

    const result = await signIn("credentials", {
      email: trimmed,
      redirect: false,
    });

    if (result?.error) {
      setError("Failed to enter. Please try again.");
      setIsLoading(false);
    } else {
      window.location.href = "/dashboard";
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary">
      <div className="w-full max-w-lg px-8">
        {/* Logo */}
        <div className="mb-12 text-center">
          <h1 className="font-[family-name:var(--font-heading)] text-2xl font-light tracking-wide text-text-primary">
            ROOTSTONE
          </h1>
          <p className="mt-2 text-xs uppercase tracking-[3px] text-text-secondary">
            Dashboard
          </p>
        </div>

        {/* Phase 1: Disclaimer */}
        {phase === "disclaimer" && (
          <div className="space-y-6">
            <div className="rounded-sm border border-border-subtle bg-bg-card p-6">
              <span className="text-[11px] font-medium uppercase tracking-[2px] text-bronze">
                Disclaimer
              </span>
              <div className="mt-4 space-y-3">
                {DISCLAIMERS.map((text, i) => (
                  <p
                    key={i}
                    className="flex gap-2 text-[13px] leading-relaxed text-text-secondary"
                  >
                    <span className="mt-0.5 shrink-0 text-text-muted">•</span>
                    {text}
                  </p>
                ))}
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 appearance-none rounded-sm border border-border bg-bg-elevated checked:border-bronze checked:bg-bronze"
              />
              <span className="text-sm text-text-secondary">
                I have read and agree to the above disclaimer.
              </span>
            </label>

            <button
              onClick={() => setPhase("email")}
              disabled={!agreed}
              className={cn(
                "btn-bracket w-full",
                !agreed && "opacity-30 cursor-not-allowed"
              )}
            >
              Continue
            </button>
          </div>
        )}

        {/* Phase 2: Email */}
        {phase === "email" && (
          <form onSubmit={handleEnter} className="space-y-6">
            <div className="rounded-sm border border-border-subtle bg-bg-card p-6">
              <span className="text-[11px] font-medium uppercase tracking-[2px] text-bronze">
                Enter Your Email
              </span>
              <p className="mt-2 text-xs text-text-muted">
                Please enter your email to access the dashboard.
              </p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-4 w-full border-b border-border bg-transparent px-0 py-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-bronze"
                placeholder="name@company.com"
                autoFocus
                required
              />
            </div>

            {error && (
              <p className="text-sm text-pnl-negative">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPhase("disclaimer")}
                className="btn-bracket flex-1 text-text-muted"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="btn-bracket flex-1 disabled:opacity-50"
              >
                {isLoading ? "Loading..." : "Enter Dashboard"}
              </button>
            </div>
          </form>
        )}

        {/* Footer */}
        <p className="mt-16 text-center text-[10px] text-text-muted">
          © {new Date().getFullYear()} Rootstone. All rights reserved.
        </p>
      </div>
    </div>
  );
}
