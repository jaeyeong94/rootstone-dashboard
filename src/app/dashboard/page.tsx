import { HeroZone } from "@/components/dashboard/HeroZone";
import { LiveTickerStrip } from "@/components/dashboard/LiveTickerStrip";
import { LivePositionBar } from "@/components/dashboard/LivePositionBar";
import { ExecutionsFeed } from "@/components/dashboard/ExecutionsFeed";
import { RiskGauge } from "@/components/dashboard/RiskGauge";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { MonthlyReturnsHeatmap } from "@/components/dashboard/MonthlyReturnsHeatmap";
import { BenchmarkCompare } from "@/components/dashboard/BenchmarkCompare";
import { DrawdownChart } from "@/components/dashboard/DrawdownChart";
import { RollingMetrics } from "@/components/dashboard/RollingMetrics";
import { PnLDistribution } from "@/components/dashboard/PnLDistribution";
import { TodayStats } from "@/components/dashboard/TodayStats";
import { ExecutionsSidebar } from "@/components/dashboard/ExecutionsSidebar";
import { ScrollSection } from "@/components/dashboard/ScrollSection";
import { MarketMiniCharts } from "@/components/dashboard/MarketMiniCharts";
import { CandlestickGrid } from "@/components/dashboard/CandlestickGrid";

export default function OverviewPage() {
  return (
    <div className="min-h-screen">
      {/* ─── Zone 1: Hero ─── */}
      <HeroZone />

      {/* LiveTickerStrip: sticky */}
      <div className="sticky top-0 z-20 border-b border-border-subtle bg-bg-primary/95 backdrop-blur-sm">
        <LiveTickerStrip />
      </div>

      {/* ─── Zone 2: Intelligence Feed ─── */}
      <div className="space-y-12 px-6 py-12 lg:px-12">

        {/* Section 0: Market Overview */}
        <ScrollSection label="Market Overview">
          <MarketMiniCharts />
        </ScrollSection>

        {/* Section 0-1: Market Charts */}
        <ScrollSection label="Market Charts" delay={100}>
          <CandlestickGrid />
        </ScrollSection>

        {/* Section 1: Live Activity */}
        <ScrollSection label="Live Activity">
          <div className="grid gap-4 lg:grid-cols-3">
            <LivePositionBar />
            <ExecutionsFeed />
            <RiskGauge />
          </div>
        </ScrollSection>

        {/* Section 2: Performance */}
        <ScrollSection label="Performance" delay={100}>
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <PerformanceChart />
            <MonthlyReturnsHeatmap />
          </div>
        </ScrollSection>

        {/* Section 3: Market Context */}
        <ScrollSection label="Market Context" delay={100}>
          <div className="grid gap-4 lg:grid-cols-2">
            <BenchmarkCompare />
            <DrawdownChart />
          </div>
        </ScrollSection>

        {/* Section 4: Strategy Intelligence */}
        <ScrollSection label="Strategy Intelligence" delay={100}>
          <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
            {/* Left: stacked charts */}
            <div className="space-y-4">
              <RollingMetrics />
              <PnLDistribution />
            </div>
            {/* Right: sidebar */}
            <div className="flex flex-col gap-3">
              <TodayStats />
              <ExecutionsSidebar />
            </div>
          </div>
        </ScrollSection>

      </div>
    </div>
  );
}
