"use client";

import { LiveIndicator } from "@/components/dashboard/LiveIndicator";

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border-subtle px-6">
      <h1 className="font-[family-name:var(--font-heading)] text-xl font-light text-text-primary">
        {title}
      </h1>
      <LiveIndicator />
    </header>
  );
}
