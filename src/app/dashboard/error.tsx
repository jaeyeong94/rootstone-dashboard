"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <h2 className="font-[family-name:var(--font-heading)] text-xl font-light text-text-primary">
          Something went wrong
        </h2>
        <p className="mt-2 text-sm text-text-secondary">
          {error.message || "An unexpected error occurred"}
        </p>
        <button
          onClick={reset}
          className="btn-bracket mt-6"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
