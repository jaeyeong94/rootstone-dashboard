"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid credentials");
      setIsLoading(false);
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary">
      <div className="w-full max-w-md px-8">
        {/* Logo */}
        <div className="mb-16 text-center">
          <h1 className="font-[family-name:var(--font-heading)] text-2xl font-light tracking-wide text-text-primary">
            ROOTSTONE
          </h1>
          <p className="mt-2 text-xs uppercase tracking-[3px] text-text-secondary">
            Dashboard
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="username"
              className="mb-2 block text-xs uppercase tracking-[1px] text-text-secondary"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border-b border-border bg-transparent px-0 py-3 text-sm text-text-primary outline-none transition-colors focus:border-bronze"
              placeholder="Enter username"
              required
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-xs uppercase tracking-[1px] text-text-secondary"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border-b border-border bg-transparent px-0 py-3 text-sm text-text-primary outline-none transition-colors focus:border-bronze"
              placeholder="Enter password"
              required
            />
          </div>

          {error && (
            <p className="text-sm text-pnl-negative">{error}</p>
          )}

          <div className="pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="btn-bracket w-full disabled:opacity-50"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
          </div>
        </form>

        {/* Footer */}
        <p className="mt-16 text-center text-xs text-text-muted">
          Powered by Rootstone
        </p>
      </div>
    </div>
  );
}
