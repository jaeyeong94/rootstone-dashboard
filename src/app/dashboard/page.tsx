import { HeroZone } from "@/components/dashboard/HeroZone";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { MonthlyReturnsHeatmap } from "@/components/dashboard/MonthlyReturnsHeatmap";
import { BenchmarkCompare } from "@/components/dashboard/BenchmarkCompare";
import { DrawdownChart } from "@/components/dashboard/DrawdownChart";
import { RollingMetrics } from "@/components/dashboard/RollingMetrics";
import { PnLDistribution } from "@/components/dashboard/PnLDistribution";
import { ScrollSection } from "@/components/dashboard/ScrollSection";
import { RightFixedPanel } from "@/components/dashboard/RightFixedPanel";
import { BlackSwanCard } from "@/components/dashboard/BlackSwanCard";
import { YearlyReturnsChart } from "@/components/dashboard/YearlyReturnsChart";
import { CandlestickGrid } from "@/components/dashboard/CandlestickGrid";

export default function OverviewPage() {
  return (
    <div className="min-h-screen xl:pr-[280px]">
      <RightFixedPanel />
      {/* ─── Zone 1: Hero ─── */}
      <HeroZone />

      {/* ─── Zone 2: Intelligence Feed ─── */}
      <div className="space-y-12 px-6 py-12 xl:px-12">

        {/* Section 2: Performance */}
        <ScrollSection label="Performance" delay={100}>
          <div className="space-y-4">
            <PerformanceChart />
            <CandlestickGrid />
            <MonthlyReturnsHeatmap />
          </div>
        </ScrollSection>

        {/* Section 3: Strategy Highlights */}
        <ScrollSection label="Strategy Highlights" delay={100}>
          <div className="grid gap-4 xl:grid-cols-2">
            <BlackSwanCard />
            <YearlyReturnsChart />
          </div>
        </ScrollSection>

        {/* Section 6: Market Context */}
        <ScrollSection label="Market Context" delay={100}>
          <div className="grid gap-4 xl:grid-cols-2">
            <BenchmarkCompare />
            <DrawdownChart />
          </div>
        </ScrollSection>

        {/* Section 7: Strategy Intelligence */}
        <ScrollSection label="Strategy Intelligence" delay={100}>
          <div className="space-y-4">
            <RollingMetrics />
            <PnLDistribution />
          </div>
        </ScrollSection>

      </div>
    </div>
  );
}
