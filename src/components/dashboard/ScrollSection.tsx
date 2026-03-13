"use client";

import { cn } from "@/lib/utils";
import { useInView } from "@/hooks/useInView";

interface Props {
  children: React.ReactNode;
  className?: string;
  label?: string;
  delay?: number;
}

export function ScrollSection({ children, className, label, delay = 0 }: Props) {
  const [ref, inView] = useInView();

  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-700 ease-out",
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5",
        className
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {label && (
        <p className="mb-3 text-[10px] uppercase tracking-[2px] text-text-dim">
          {label}
        </p>
      )}
      {children}
    </div>
  );
}
