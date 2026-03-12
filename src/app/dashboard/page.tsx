import { Header } from "@/components/layout/Header";
import { HeroStats } from "@/components/dashboard/HeroStats";
import { LiveTickerStrip } from "@/components/dashboard/LiveTickerStrip";
import { StrategyMetricsBar } from "@/components/dashboard/StrategyMetricsBar";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { MonthlyReturnsHeatmap } from "@/components/dashboard/MonthlyReturnsHeatmap";
import { DrawdownChart } from "@/components/dashboard/DrawdownChart";
import { PnLDistribution } from "@/components/dashboard/PnLDistribution";
import { RollingMetrics } from "@/components/dashboard/RollingMetrics";
import { PositionCards } from "@/components/dashboard/PositionCards";
import { TradesFeed } from "@/components/dashboard/TradesFeed";

export default function OverviewPage() {
  return (
    <div>
      <Header title="Overview" />
      <div className="space-y-4 p-6">
        {/* Hero Zone: Cumulative Return + Live Market Tickers */}
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <HeroStats />
          <LiveTickerStrip />
        </div>

        {/* Strategy Metrics Bar */}
        <StrategyMetricsBar />

        {/* Main Performance Chart */}
        <PerformanceChart />

        {/* Analytics Grid: 2x2 */}
        <div className="grid gap-4 lg:grid-cols-2">
          <MonthlyReturnsHeatmap />
          <DrawdownChart />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <PnLDistribution />
          <RollingMetrics />
        </div>

        {/* Live Activity: Positions + Trade Feed */}
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <PositionCards />
          <TradesFeed />
        </div>
      </div>
    </div>
  );
}
