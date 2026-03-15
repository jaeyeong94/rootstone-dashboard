"use client";

import { useEffect } from "react";
import useSWR from "swr";
import { usePositionStore } from "@/stores/usePositionStore";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function PositionsProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useSWR("/api/bybit/positions", fetcher, {
    refreshInterval: 5000,
  });

  const setPositions = usePositionStore((s) => s.setPositions);
  const setLoading = usePositionStore((s) => s.setLoading);

  useEffect(() => {
    setLoading(isLoading);
  }, [isLoading, setLoading]);

  useEffect(() => {
    if (data) {
      setPositions(data.positions ?? [], data.count ?? 0, data.totalEquity);
    }
  }, [data, setPositions]);

  return <>{children}</>;
}
