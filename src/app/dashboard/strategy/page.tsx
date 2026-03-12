import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";

/* ───── Data from Rebeta v3.1 Strategy Introduction ───── */

const heroMetrics = [
  { value: "872%", label: "Total Return", sub: "(v1~v3.1 Sum)" },
  { value: "1,813+", label: "Days Live", sub: "as of Feb 15, 2025" },
  { value: "7", label: "Outperformed in", sub: "Black Swans" },
  { value: "+51.8%", label: "CAGR", sub: "(v3.1)" },
  { value: "-4.1%", label: "MDD", sub: "(v3.1)" },
];

const performanceMetrics = [
  { label: "CAGR", v1: "59.8%", v31: "51.8%" },
  { label: "Sharpe (rf=0%, 365.25d)", v1: "1.95", v31: "1.75" },
  { label: "Sortino", v1: "2.88", v31: "9.86" },
  { label: "MDD", v1: "-22.0% (FTX)", v31: "-4.1%" },
  { label: "Calmar", v1: "2.71", v31: "12.58" },
  { label: "Cumulative", v1: "470.0%", v31: "68.2%" },
];

const blackSwansV1 = [
  { event: "Luna-Terra Collapse", period: "22.05.04~22.05.12", rebeta: "+9.06%", btc: "-23.05%", alpha: "+32.11%p" },
  { event: "Celsius/3AC Bankruptcy", period: "22.06.06~22.06.18", rebeta: "+8.51%", btc: "-36.61%", alpha: "+45.12%p" },
  { event: "FTX Collapse", period: "22.11.05~22.11.13", rebeta: "-4.88%", btc: "-22.79%", alpha: "+17.91%p" },
  { event: "Macro Triple Pressure", period: "24.07.29~24.08.05", rebeta: "-0.20%", btc: "-19.20%", alpha: "+19.00%p" },
];

const blackSwansV31 = [
  { event: "Bybit Hack", period: "25.02.20~25.02.28", rebeta: "+0.49%", btc: "-12.74%", alpha: "+13.23%p" },
  { event: "Tariff War", period: "25.04.01~25.04.08", rebeta: "+8.37%", btc: "-7.54%", alpha: "+15.91%p" },
  { event: "Large-Scale Liquidation", period: "25.10.10~25.10.10", rebeta: "+0.89%", btc: "-7.26%", alpha: "+8.15%p" },
];

const crisisStats = [
  { value: "+3.18%", label: "Avg Rebeta Return" },
  { value: "-18.46%", label: "Avg BTC Return" },
  { value: "+21.63%p", label: "Avg Outperformance" },
  { value: "5/7", label: "Positive Return Events" },
];

const edgePillars = [
  {
    num: "1",
    title: "Non-Linear Feature Extraction",
    desc: "Deep neural networks extract latent features from raw market data that are invisible to linear models. These features capture regime shifts, reflexive dynamics, and structural breaks in real-time.",
    highlight: "Captures what linear models structurally cannot see.",
  },
  {
    num: "2",
    title: "Counter-Cyclical Architecture",
    desc: "Rebeta v3.1 employs a Counter-Cyclical Architecture designed to capture alpha during market dislocations. Unlike trend-following systems, our mean-reversion engine activates precisely during 'oversold' inefficiencies.",
    highlight: "Performs when traditional strategies break down.",
  },
  {
    num: "3",
    title: "Adaptive Risk Framework",
    desc: "Position sizing and exposure dynamically adjust based on real-time volatility regimes and model confidence. The system scales down before drawdowns deepen \u2014 not after.",
    highlight: "-4.1% MDD in v3.1 \u2014 risk-adjusted alpha, not just returns.",
  },
];

const architectureStages = [
  {
    stage: "STAGE A",
    title: "Understanding",
    desc: "Deep learning models analyze market microstructure, order flow, and cross-asset signals to generate daily probability distributions of expected closing prices.",
    dark: true,
  },
  {
    stage: "STAGE B",
    title: "Action",
    desc: "Portfolio optimizer translates signals into positions with strict risk constraints: position sizing, exposure limits, and execution timing.",
    dark: false,
  },
];

const regimes = [
  {
    icon: "\u25CB",
    type: "PRIMARY",
    name: "Core",
    pct: "~70% of time",
    desc: "Normal trending and mean-reverting markets. Full signal deployment with standard position sizing and risk parameters.",
  },
  {
    icon: "\u26A0",
    type: "DEFENSIVE",
    name: "Crisis",
    pct: "~10% of time",
    desc: "Extreme volatility and correlation breakdown. Reduced exposure, tighter stops, and defensive positioning to preserve capital.",
    dark: true,
  },
  {
    icon: "\u2731",
    type: "ADAPTIVE",
    name: "Challenging",
    pct: "~20% of time",
    desc: "Choppy, low-conviction environments. Reduced position sizes and increased selectivity. Wait for clearer signals before committing capital.",
  },
];

const riskLayers = [
  { num: "1", title: "Asset & Exposure Control", desc: "Strictly limited to verified, high-liquidity blue-chip assets (BTC, ETH, XRP, LTC). Max gross/net exposure capped at x3." },
  { num: "2", title: "Portfolio Exposure", desc: "Gross and net exposure enforced at the portfolio/risk-engine level with regime-aware scaling rules." },
  { num: "3", title: "Drawdown Hard Stop", desc: "Risk budget calibrated to 10% monthly realized DD constraint (P[DD\u226510%] \u2264 1%). If breached, trading stops with two-key restart." },
  { num: "4", title: "Execution Cost Management", desc: "Layering/laddering orders across wide price range. VWAP-style unwinds with time-staggered entries. Gross PnL exceeds trading costs by >10x." },
  { num: "5", title: "Monitoring & Redundancy", desc: "Independent monitoring server with 1-5 min health checks. Validates NAV limits, exposure caps, open order limits." },
];

const riskParams = [
  { param: "Max Gross Exposure", threshold: "x3", action: "Portfolio-level enforcement" },
  { param: "Monthly Drawdown", threshold: "-10% hard limit on realized", action: "Trading stops + two-key restart" },
  { param: "Holding Period", threshold: "Max 24.5 hours", action: "Avg 12h, systematic close" },
];

const comparisonDimensions = [
  { dim: "Approach", trad: "Rule-based / Traditional factors", rebeta: "Deep learning latent features" },
  { dim: "Alpha Type", trad: "Momentum / Beta", rebeta: "Mean-reversion / Crisis alpha" },
  { dim: "Crisis Behavior", trad: "Correlated decline with market", rebeta: "Counter-cyclical returns" },
  { dim: "Track Record", trad: "Backtest or short live record", rebeta: "1,813 days + 7 black swan survival" },
  { dim: "Prediction", trad: "Point prediction", rebeta: "High accuracy probability distribution" },
];

const marketEnv = [
  { env: "Strong Uptrend", momentum: "Profitable", rebeta: "Conservative participation" },
  { env: "Sideways / Mixed", momentum: "Passive", rebeta: "Primary return zone", highlight: true },
  { env: "Sharp Decline / Crisis", momentum: "Loss amplification", rebeta: "Counter-cyclical alpha", highlight: true },
];

const infra = [
  { title: "Cloud Infrastructure", desc: "AWS EC2 + PostgreSQL. Strict prod/research isolation with independent databases & data pipelines." },
  { title: "Monitoring", desc: "Independent server health checks every 1-5 min. Real-time alerts on exposure breaches." },
  { title: "Security", desc: "Environment separation & redundancy by design. Two-key authorization for risk event restarts." },
  { title: "Execution", desc: "Bybit, OKX, Binance. Fully systematic VWAP-style execution with 90:10 Maker/Taker ratio." },
  { title: "ML Ops", desc: "MLflow model tracking, FastAPI on Kubernetes for versioned deployments & controlled rollouts." },
  { title: "Observability", desc: "Sentry structured error monitoring. Defined incident response for exchange instability & service failures." },
];

const operationDetails = [
  { label: "Assets", value: "BTC, ETH, XRP, LTC (USDT Perpetual)" },
  { label: "Rebalance", value: "Every 1 hour" },
  { label: "Avg Hold", value: "12 hours (max 24h)" },
  { label: "Daily Turnover", value: "~10%" },
  { label: "Max Gross Exposure", value: "x3" },
  { label: "Monthly DD Limit", value: "-10% hard stop" },
];

/* ───── Helper Components ───── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-medium uppercase tracking-[2px] text-bronze">
      {children}
    </span>
  );
}

function ReturnColor({ value }: { value: string }) {
  const isPositive = value.startsWith("+") || (!value.startsWith("-") && parseFloat(value) > 0);
  const isNegative = value.startsWith("-");
  return (
    <span className={cn(
      "font-[family-name:var(--font-mono)]",
      isPositive && "text-pnl-positive",
      isNegative && "text-pnl-negative",
      !isPositive && !isNegative && "text-text-primary",
    )}>
      {value}
    </span>
  );
}

/* ───── Page ───── */

export default function StrategyPage() {
  return (
    <div>
      <Header title="Strategy" />
      <div className="space-y-10 p-6">

        {/* ━━━ HERO ━━━ */}
        <div>
          <div className="mb-2 h-[2px] w-10 bg-bronze" />
          <h2 className="font-[family-name:var(--font-heading)] text-4xl font-light text-text-primary">
            Rebeta v3.1
          </h2>
          <p className="mt-2 font-[family-name:var(--font-heading)] text-lg text-gold">
            When Markets Break, Alpha Begins.
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            Deep learning crypto absolute return strategy.<br />
            5 years live, 7 black swan events survived.
          </p>

          {/* Hero Metric Strip */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {heroMetrics.map((m) => (
              <div key={m.label} className="rounded-sm border border-border-subtle bg-bg-card p-4">
                <div className="font-[family-name:var(--font-mono)] text-2xl font-semibold text-text-primary">
                  {m.value}
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-[0.5px] text-text-secondary">
                  {m.label}
                </div>
                <div className="text-[10px] text-text-muted">{m.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ━━━ EXECUTIVE SUMMARY - Version Comparison ━━━ */}
        <div>
          <SectionLabel>Performance Metrics</SectionLabel>
          <div className="mt-4 overflow-hidden rounded-sm border border-border-subtle bg-bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle bg-bg-elevated">
                  <th className="px-4 py-3 text-left text-[11px] uppercase tracking-[1px] text-text-secondary font-normal">Metric</th>
                  <th className="px-4 py-3 text-left text-[11px] uppercase tracking-[1px] text-text-secondary font-normal">v1 (Mar 2021 ~ Nov 2024)</th>
                  <th className="px-4 py-3 text-left text-[11px] uppercase tracking-[1px] text-bronze font-normal">v3.1 (Nov 2024 ~ Current)</th>
                </tr>
              </thead>
              <tbody>
                {performanceMetrics.map((m) => (
                  <tr key={m.label} className="border-b border-border-subtle last:border-0 transition-colors hover:bg-bg-elevated">
                    <td className="px-4 py-2.5 text-text-secondary">{m.label}</td>
                    <td className="px-4 py-2.5 font-[family-name:var(--font-mono)] text-text-primary">{m.v1}</td>
                    <td className="px-4 py-2.5 font-[family-name:var(--font-mono)] text-text-primary font-medium">{m.v31}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ━━━ BLACK SWAN PERFORMANCE ━━━ */}
        <div>
          <SectionLabel>Battle-Tested: 7 Black Swans, 7 Survivals</SectionLabel>
          <p className="mt-2 text-sm text-text-secondary">
            During events where BTC fell an average of -18.46%, Rebeta averaged +3.18%.
          </p>

          {/* Phase 1 */}
          <div className="mt-6">
            <span className="text-xs text-text-muted">Phase 1 | Rebeta v1 (2021.03.01 ~ 2024.11.16)</span>
            <div className="mt-2 overflow-hidden rounded-sm border border-border-subtle bg-bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-subtle bg-bg-elevated">
                    <th className="px-4 py-2.5 text-left text-[11px] uppercase tracking-[1px] text-text-secondary font-normal">Event</th>
                    <th className="px-4 py-2.5 text-right text-[11px] uppercase tracking-[1px] text-text-secondary font-normal">Rebeta</th>
                    <th className="px-4 py-2.5 text-right text-[11px] uppercase tracking-[1px] text-text-secondary font-normal">BTC</th>
                    <th className="px-4 py-2.5 text-right text-[11px] uppercase tracking-[1px] text-text-secondary font-normal">Alpha</th>
                  </tr>
                </thead>
                <tbody>
                  {blackSwansV1.map((e) => (
                    <tr key={e.event} className="border-b border-border-subtle last:border-0 transition-colors hover:bg-bg-elevated">
                      <td className="px-4 py-2.5">
                        <div className="text-text-primary">{e.event}</div>
                        <div className="text-[10px] text-text-muted">{e.period}</div>
                      </td>
                      <td className="px-4 py-2.5 text-right"><ReturnColor value={e.rebeta} /></td>
                      <td className="px-4 py-2.5 text-right"><ReturnColor value={e.btc} /></td>
                      <td className="px-4 py-2.5 text-right font-[family-name:var(--font-mono)] font-semibold text-text-primary">{e.alpha}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Phase 2 */}
          <div className="mt-4">
            <span className="text-xs text-text-muted">Phase 2 | Rebeta v3.1 (2024.11.17 ~ Current)</span>
            <div className="mt-2 overflow-hidden rounded-sm border border-border-subtle bg-bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-subtle bg-bg-elevated">
                    <th className="px-4 py-2.5 text-left text-[11px] uppercase tracking-[1px] text-text-secondary font-normal">Event</th>
                    <th className="px-4 py-2.5 text-right text-[11px] uppercase tracking-[1px] text-text-secondary font-normal">Rebeta</th>
                    <th className="px-4 py-2.5 text-right text-[11px] uppercase tracking-[1px] text-text-secondary font-normal">BTC</th>
                    <th className="px-4 py-2.5 text-right text-[11px] uppercase tracking-[1px] text-text-secondary font-normal">Alpha</th>
                  </tr>
                </thead>
                <tbody>
                  {blackSwansV31.map((e) => (
                    <tr key={e.event} className="border-b border-border-subtle last:border-0 transition-colors hover:bg-bg-elevated">
                      <td className="px-4 py-2.5">
                        <div className="text-text-primary">{e.event}</div>
                        <div className="text-[10px] text-text-muted">{e.period}</div>
                      </td>
                      <td className="px-4 py-2.5 text-right"><ReturnColor value={e.rebeta} /></td>
                      <td className="px-4 py-2.5 text-right"><ReturnColor value={e.btc} /></td>
                      <td className="px-4 py-2.5 text-right font-[family-name:var(--font-mono)] font-semibold text-text-primary">{e.alpha}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Crisis Summary Stats */}
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {crisisStats.map((s) => (
              <div key={s.label} className="rounded-sm border border-border-subtle bg-bg-card p-4 text-center">
                <div className="font-[family-name:var(--font-mono)] text-xl font-semibold text-text-primary">
                  {s.value}
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.5px] text-text-muted">
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {/* Key Insight */}
          <div className="mt-4 rounded-sm border-l-2 border-gold bg-bg-elevated px-5 py-4">
            <span className="text-[10px] font-medium uppercase tracking-[2px] text-gold">Key Insight</span>
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">
              During the Celsius/3AC bankruptcy &mdash; the single largest crypto credit crisis &mdash; Rebeta delivered +8.51% while BTC fell -36.61%.
              This +45.12%p outperformance demonstrates that the strategy&apos;s edge is strongest precisely when markets are most distressed.
            </p>
          </div>
        </div>

        {/* ━━━ OUR EDGE ━━━ */}
        <div>
          <SectionLabel>Our Edge</SectionLabel>
          <h3 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-light text-text-primary">
            Deep Learning Meets Market Structure
          </h3>
          <p className="mt-1 text-sm text-text-secondary">
            Rebeta doesn&apos;t predict prices. It detects structural dislocations &mdash; moments where market microstructure reveals exploitable inefficiency.
          </p>

          <div className="mt-6 space-y-3">
            {edgePillars.map((p) => (
              <div key={p.num} className="rounded-sm border border-border-subtle bg-bg-card p-5">
                <div className="flex items-start gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold text-sm font-semibold text-bg-primary">
                    {p.num}
                  </span>
                  <div>
                    <h4 className="font-[family-name:var(--font-heading)] text-base font-medium text-text-primary">
                      {p.title}
                    </h4>
                    <p className="mt-2 text-xs leading-relaxed text-text-secondary">{p.desc}</p>
                    <p className="mt-2 text-xs font-medium text-gold">{p.highlight}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ━━━ ARCHITECTURE ━━━ */}
        <div>
          <SectionLabel>Architecture</SectionLabel>
          <h3 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-light text-text-primary">
            Separation of Understanding and Action
          </h3>
          <p className="mt-1 text-sm text-text-secondary">
            Independently Optimized, Independently Validated
          </p>

          <div className="mt-6 grid gap-3 lg:grid-cols-2">
            {architectureStages.map((s) => (
              <div
                key={s.stage}
                className={cn(
                  "rounded-sm border p-6",
                  s.dark
                    ? "border-border-subtle bg-[#1A1A1A]"
                    : "border-border-subtle bg-bg-card"
                )}
              >
                <span className="text-[10px] font-medium uppercase tracking-[2px] text-bronze">
                  {s.stage}
                </span>
                <h4 className="mt-2 font-[family-name:var(--font-heading)] text-xl font-light text-text-primary">
                  {s.title}
                </h4>
                <p className="mt-3 text-xs leading-relaxed text-text-secondary">{s.desc}</p>
              </div>
            ))}
          </div>

          {/* Operation Params */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { value: "1 hour", label: "Rebalance" },
              { value: "12 hours", label: "Avg Hold (max 24h)" },
              { value: "~10%", label: "Daily Turnover" },
            ].map((p) => (
              <div key={p.label} className="rounded-sm border border-border-subtle bg-bg-card p-4 text-center">
                <div className="font-[family-name:var(--font-mono)] text-lg font-semibold text-text-primary">{p.value}</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.5px] text-text-muted">{p.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ━━━ MARKET REGIME ━━━ */}
        <div>
          <SectionLabel>Market Regime Detection</SectionLabel>
          <h3 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-light text-text-primary">
            Three Market States, Three Strategy Profiles
          </h3>

          <div className="mt-6 grid gap-3 lg:grid-cols-3">
            {regimes.map((r) => (
              <div
                key={r.name}
                className={cn(
                  "rounded-sm border p-5",
                  r.dark
                    ? "border-border-subtle bg-[#1A1A1A]"
                    : "border-border-subtle bg-bg-card"
                )}
              >
                <span className="text-[10px] font-medium uppercase tracking-[2px] text-bronze">
                  {r.icon} {r.type}
                </span>
                <h4 className="mt-3 font-[family-name:var(--font-heading)] text-xl font-light text-text-primary">
                  {r.name}
                </h4>
                <span className="text-sm text-bronze">{r.pct}</span>
                <p className="mt-3 text-xs leading-relaxed text-text-secondary">{r.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-2">
            <div className="rounded-sm border-l-2 border-gold bg-bg-elevated px-5 py-3">
              <span className="text-[10px] font-medium uppercase tracking-[2px] text-gold">Regime Transition</span>
              <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                Regime detection updates every rebalance cycle. Transitions are gradual &mdash; the system blends exposure between regimes
                rather than making abrupt switches, reducing whipsaw risk during ambiguous market conditions.
              </p>
            </div>
          </div>
        </div>

        {/* ━━━ RISK MANAGEMENT ━━━ */}
        <div>
          <SectionLabel>Risk Management</SectionLabel>
          <h3 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-light text-text-primary">
            Multi-Layered Risk Framework
          </h3>
          <p className="mt-1 text-sm text-text-secondary">
            Systematic Risk Controls at Every Level
          </p>

          <div className="mt-6 space-y-3">
            {riskLayers.map((l) => (
              <div key={l.num} className="rounded-sm border border-border-subtle bg-bg-card p-5">
                <div className="flex items-start gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bronze text-sm font-semibold text-bg-primary">
                    {l.num}
                  </span>
                  <div>
                    <h4 className="text-sm font-medium text-text-primary">{l.title}</h4>
                    <p className="mt-1 text-xs leading-relaxed text-text-secondary">{l.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Risk Params Table */}
          <div className="mt-4 overflow-hidden rounded-sm border border-border-subtle bg-bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle bg-pnl-negative/10">
                  <th className="px-4 py-2.5 text-left text-[11px] uppercase tracking-[1px] text-text-primary font-normal">Risk Parameter</th>
                  <th className="px-4 py-2.5 text-left text-[11px] uppercase tracking-[1px] text-text-primary font-normal">Threshold</th>
                  <th className="px-4 py-2.5 text-left text-[11px] uppercase tracking-[1px] text-text-primary font-normal">Action</th>
                </tr>
              </thead>
              <tbody>
                {riskParams.map((r) => (
                  <tr key={r.param} className="border-b border-border-subtle last:border-0 transition-colors hover:bg-bg-elevated">
                    <td className="px-4 py-2.5 text-text-primary">{r.param}</td>
                    <td className="px-4 py-2.5 font-[family-name:var(--font-mono)] text-text-secondary">{r.threshold}</td>
                    <td className="px-4 py-2.5 text-text-secondary">{r.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ━━━ PORTFOLIO FIT - COMPARISON ━━━ */}
        <div>
          <SectionLabel>Portfolio Fit</SectionLabel>
          <h3 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-light text-text-primary">
            The Structural Complement
          </h3>
          <p className="mt-1 text-sm text-text-secondary">
            Rebeta doesn&apos;t compete with your existing crypto exposure &mdash; it structurally complements it.
          </p>

          {/* Market Environment */}
          <div className="mt-6 overflow-hidden rounded-sm border border-border-subtle bg-bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle bg-bg-elevated">
                  <th className="px-4 py-2.5 text-left text-[11px] uppercase tracking-[1px] text-text-secondary font-normal">Market Environment</th>
                  <th className="px-4 py-2.5 text-left text-[11px] uppercase tracking-[1px] text-text-secondary font-normal">Momentum Strategies</th>
                  <th className="px-4 py-2.5 text-left text-[11px] uppercase tracking-[1px] text-bronze font-normal">Rebeta</th>
                </tr>
              </thead>
              <tbody>
                {marketEnv.map((m) => (
                  <tr key={m.env} className="border-b border-border-subtle last:border-0 transition-colors hover:bg-bg-elevated">
                    <td className="px-4 py-2.5 text-text-primary">{m.env}</td>
                    <td className={cn("px-4 py-2.5", m.momentum === "Loss amplification" ? "text-pnl-negative" : "text-text-secondary")}>
                      {m.momentum}
                    </td>
                    <td className={cn("px-4 py-2.5 font-medium", m.highlight ? "text-text-primary" : "text-text-secondary")}>
                      {m.rebeta}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Dimension Comparison */}
          <div className="mt-4 overflow-hidden rounded-sm border border-border-subtle bg-bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle bg-bg-elevated">
                  <th className="px-4 py-2.5 text-left text-[11px] uppercase tracking-[1px] text-text-secondary font-normal">Dimension</th>
                  <th className="px-4 py-2.5 text-left text-[11px] uppercase tracking-[1px] text-text-secondary font-normal">Typical Crypto Quant Fund</th>
                  <th className="px-4 py-2.5 text-left text-[11px] uppercase tracking-[1px] text-bronze font-normal">Rootstone Rebeta</th>
                </tr>
              </thead>
              <tbody>
                {comparisonDimensions.map((c) => (
                  <tr key={c.dim} className="border-b border-border-subtle last:border-0 transition-colors hover:bg-bg-elevated">
                    <td className="px-4 py-2.5 text-text-primary">{c.dim}</td>
                    <td className="px-4 py-2.5 text-text-secondary">{c.trad}</td>
                    <td className="px-4 py-2.5 font-medium text-text-primary">{c.rebeta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Key Insight */}
          <div className="mt-4 rounded-sm border-l-2 border-gold bg-bg-elevated px-5 py-4">
            <span className="text-[10px] font-medium uppercase tracking-[2px] text-gold">Key Insight</span>
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">
              If your portfolio already holds momentum-based crypto strategies, Rebeta is not a competing allocation.
              It is the structural complement those strategies need.
            </p>
          </div>
        </div>

        {/* ━━━ INFRASTRUCTURE ━━━ */}
        <div>
          <SectionLabel>Infrastructure</SectionLabel>
          <h3 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-light text-text-primary">
            How We Manage Infrastructure
          </h3>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {infra.map((i) => (
              <div key={i.title} className="rounded-sm border border-border-subtle bg-bg-card p-5">
                <h4 className="text-sm font-medium text-text-primary">{i.title}</h4>
                <p className="mt-2 text-xs leading-relaxed text-text-secondary">{i.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ━━━ STRATEGY DETAILS ━━━ */}
        <div>
          <SectionLabel>Strategy Details</SectionLabel>
          <div className="mt-4 rounded-sm border border-border-subtle bg-bg-card p-6">
            <div className="grid gap-6 lg:grid-cols-3">
              {operationDetails.map((d) => (
                <div key={d.label}>
                  <h4 className="text-[11px] uppercase tracking-[1px] text-text-secondary">{d.label}</h4>
                  <p className="mt-1 font-[family-name:var(--font-mono)] text-sm text-text-primary">{d.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ━━━ FOOTER NOTE ━━━ */}
        <div className="border-t border-border-subtle pt-6 pb-2 text-center">
          <p className="text-xs italic text-text-muted">
            &ldquo;The best time to add a structural hedge is before you need it.&rdquo;
          </p>
          <p className="mt-3 text-[10px] uppercase tracking-[2px] text-text-muted">
            Confidential | For Qualified SMA Clients Only
          </p>
        </div>

      </div>
    </div>
  );
}
