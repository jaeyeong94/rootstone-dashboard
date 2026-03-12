import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary">
      <div className="text-center">
        <h1 className="font-[family-name:var(--font-heading)] text-6xl font-light text-text-primary">
          404
        </h1>
        <p className="mt-4 text-sm text-text-secondary">Page not found</p>
        <Link href="/dashboard" className="btn-bracket mt-8 inline-flex">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
