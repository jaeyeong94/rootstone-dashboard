import { HeroZone } from "@/components/dashboard/HeroZone";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { MonthlyReturnsHeatmap } from "@/components/dashboard/MonthlyReturnsHeatmap";
import { BenchmarkCompare } from "@/components/dashboard/BenchmarkCompare";
import { DrawdownChart } from "@/components/dashboard/DrawdownChart";
import { RollingMetrics } from "@/components/dashboard/RollingMetrics";
import { PnLDistribution } from "@/components/dashboard/PnLDistribution";
import { ScrollSection } from "@/components/dashboard/ScrollSection";
import { RightFixedPanel } from "@/components/dashboard/RightFixedPanel";
import { GrowthSimulator } from "@/components/dashboard/GrowthSimulator";
import { BlackSwanCard } from "@/components/dashboard/BlackSwanCard";
import { YearlyReturnsChart } from "@/components/dashboard/YearlyReturnsChart";
import { AlphaBetaCards } from "@/components/dashboard/AlphaBetaCards";

export default function OverviewPage() {
  return (
    <div className="min-h-screen lg:pr-[280px]">
      <RightFixedPanel />
      {/* ─── Zone 1: Hero ─── */}
      <HeroZone />

      {/* ─── Zone 2: Intelligence Feed ─── */}
      <div className="space-y-12 px-6 py-12 lg:px-12">

        {/* Section 2: Performance */}
        <ScrollSection label="Performance" delay={100}>
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <PerformanceChart />
            <MonthlyReturnsHeatmap />
          </div>
        </ScrollSection>

        {/* Section 3: Growth Simulation */}
        <ScrollSection label="Growth Simulation" delay={100}>
          <GrowthSimulator />
        </ScrollSection>

        {/* Section 4: Strategy Highlights */}
        <ScrollSection label="Strategy Highlights" delay={100}>
          <div className="grid gap-4 lg:grid-cols-2">
            <BlackSwanCard />
            <YearlyReturnsChart />
          </div>
        </ScrollSection>

        {/* Section 5: Risk Profile */}
        <ScrollSection label="Risk Profile" delay={100}>
          <AlphaBetaCards />
        </ScrollSection>

        {/* Section 6: Market Context */}
        <ScrollSection label="Market Context" delay={100}>
          <div className="grid gap-4 lg:grid-cols-2">
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
