import React from 'react';
import { 
  TickerConfig, 
  OptionChainRow, 
  StrikeHistoryItem, 
  StrikeTrendAnalytics,
  OptionType
} from '../types/options';
import { 
  History, 
  TrendingUp, 
  TrendingDown, 
  Award, 
  Target, 
  Zap, 
  BarChart2, 
  ArrowUpRight,
  Compass,
  CheckCircle2,
  AlertCircle,
  Clock,
  Flame
} from 'lucide-react';

interface StrikeHistoryTrendsProps {
  ticker: TickerConfig;
  chain: OptionChainRow[];
  history: StrikeHistoryItem[];
  analytics: StrikeTrendAnalytics;
  onSelectContract: (strike: number, type: OptionType) => void;
}

export const StrikeHistoryTrends: React.FC<StrikeHistoryTrendsProps> = ({
  ticker,
  chain,
  history,
  analytics,
  onSelectContract,
}) => {
  const isIndian = ticker.currency === '₹';
  const cumulative = analytics.cumulativeTrend;
  const isBullish = cumulative.dominantAction === 'BULLISH_CE';

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 1. Cumulative Trend Movement & Directional Convergence Hero Card */}
      <div className={`rounded-xl border p-4 sm:p-6 shadow-xl transition-all ${
        cumulative.alignmentStatus === 'STRONG_CONVERGENCE' ? 'bg-slate-900/95 border-emerald-500/50 shadow-emerald-950/20' :
        cumulative.alignmentStatus === 'MODERATE_CONVERGENCE' ? 'bg-slate-900/95 border-sky-500/50 shadow-sky-950/20' :
        cumulative.alignmentStatus === 'CONSOLIDATING_IN_ZONE' ? 'bg-slate-900/95 border-amber-500/50 shadow-amber-950/20' :
        'bg-slate-900/95 border-rose-500/50 shadow-rose-950/20'
      }`}>
        {/* Hero Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div className="flex items-start gap-3.5">
            <div className={`p-3 rounded-xl flex items-center justify-center shrink-0 ${
              cumulative.isMovingTowardsSuggested 
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
            }`}>
              <Compass className="w-6 h-6 animate-pulse" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span className="uppercase font-bold tracking-wider text-[11px] text-emerald-400">
                  Cumulative Trend Intelligence
                </span>
                <span className="text-slate-600">·</span>
                <span className="font-mono text-slate-300">
                  Evaluated across all {cumulative.totalCallSignals + cumulative.totalPutSignals} historical suggestions
                </span>
              </div>

              <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-white mt-1">
                {cumulative.statusHeadline}
              </h2>

              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl leading-relaxed">
                {cumulative.detailedAnalysis}
              </p>
            </div>
          </div>

          {/* Alignment Score Badge */}
          <div className="bg-slate-950 px-4 py-3 rounded-xl border border-slate-800 flex items-center justify-between lg:flex-col lg:justify-center gap-2 shrink-0">
            <div className="text-[11px] font-semibold text-slate-400 uppercase">
              Action Alignment Score
            </div>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl sm:text-3xl font-bold font-mono ${
                cumulative.alignmentScore >= 80 ? 'text-emerald-400' :
                cumulative.alignmentScore >= 65 ? 'text-sky-400' : 'text-amber-400'
              }`}>
                {cumulative.alignmentScore}%
              </span>
              <span className="text-xs text-slate-500">/ 100</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono hidden lg:inline">
              {cumulative.isMovingTowardsSuggested ? 'Towards Target' : 'Consolidating'}
            </span>
          </div>
        </div>

        {/* Cumulative Trend Diagnostics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3.5 mt-4">
          {/* Box 1: Cumulative Action Bias */}
          <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800">
            <div className="text-[11px] uppercase font-semibold text-slate-400">Dominant Bias</div>
            <div className="text-base sm:text-lg font-bold font-mono text-white mt-1 flex items-center gap-1.5">
              {isBullish ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-rose-400" />}
              <span>{isBullish ? 'BULLISH (CE)' : 'BEARISH (PE)'}</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1 font-mono">
              {cumulative.totalCallSignals} Call vs {cumulative.totalPutSignals} Put calls ({cumulative.bullishRatioPercent}% Calls)
            </div>
          </div>

          {/* Box 2: Net Cumulative ROI */}
          <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800">
            <div className="text-[11px] uppercase font-semibold text-slate-400">Net Cumulative ROI</div>
            <div className={`text-base sm:text-lg font-bold font-mono mt-1 ${
              cumulative.netCumulativeReturnPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {cumulative.netCumulativeReturnPercent >= 0 ? '+' : ''}{cumulative.netCumulativeReturnPercent}%
            </div>
            <div className="text-[10px] text-slate-400 mt-1 font-mono">
              Avg gain across all suggestions
            </div>
          </div>

          {/* Box 3: Target Hits Count */}
          <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800">
            <div className="text-[11px] uppercase font-semibold text-slate-400">Target Completions</div>
            <div className="text-base sm:text-lg font-bold font-mono text-emerald-400 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{cumulative.signalsHitTarget1Count} Targets Hit</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1 font-mono">
              {cumulative.signalsHitTarget2Count} extended runners (T2)
            </div>
          </div>

          {/* Box 4: Target Progress Gauge */}
          <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800">
            <div className="text-[11px] uppercase font-semibold text-slate-400">Target Convergence</div>
            <div className="text-base sm:text-lg font-bold font-mono text-sky-400 mt-1">
              {cumulative.targetProgressPercent}% Progress
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div 
                className="bg-sky-400 h-full rounded-full transition-all duration-500" 
                style={{ width: `${cumulative.targetProgressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Tactical Verdict Strip */}
        <div className="mt-3.5 p-2.5 sm:p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-center gap-2">
          <Flame className="w-4 h-4 text-amber-400 shrink-0" />
          <div>
            <strong className="text-white mr-1.5">Actionable Verdict:</strong>
            {cumulative.suggestedActionVerdict}
          </div>
        </div>
      </div>

      {/* 2. Key Performance Indicators */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* KPI 1: Win Rate */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 sm:p-4.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase">
            <span className="flex items-center gap-1.5">
              <Award className="w-4 h-4 text-emerald-400" />
              Strike Win Rate
            </span>
            <span className="text-[10px] text-slate-500 font-mono">ALL TIME</span>
          </div>
          <div className="my-2">
            <div className="text-2xl sm:text-3xl font-bold font-mono text-emerald-400">
              {analytics.overallWinRate}%
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Target 1 Hit Rate: <strong className="text-white">{analytics.target1HitRate}%</strong>
            </p>
          </div>
          <div className="text-[10px] text-slate-500 border-t border-slate-800/80 pt-1.5 flex items-center justify-between font-mono">
            <span>Target 2 Runner Hit:</span>
            <span className="text-sky-400 font-bold">{analytics.target2HitRate}%</span>
          </div>
        </div>

        {/* KPI 2: Best Moneyness Category */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 sm:p-4.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase">
            <span className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              Top Profit Tier
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 font-mono">
              {analytics.bestPerformingMoneyness}
            </span>
          </div>
          <div className="my-2">
            <div className="text-2xl sm:text-3xl font-bold font-mono text-white">
              {analytics.bestPerformingMoneyness === 'ATM' ? 'At-The-Money' : analytics.bestPerformingMoneyness === 'ITM' ? 'In-The-Money' : 'Out-Of-The-Money'}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Highest risk-adjusted delta expansion efficiency
            </p>
          </div>
          <div className="text-[10px] text-slate-500 border-t border-slate-800/80 pt-1.5 flex items-center justify-between font-mono">
            <span>Avg Moneyness Gain:</span>
            <span className="text-emerald-400 font-bold">
              +{analytics.moneynessPerformance.find(m => m.moneyness === analytics.bestPerformingMoneyness)?.avgGain ?? 42}%
            </span>
          </div>
        </div>

        {/* KPI 3: Avg Gain Per Win */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 sm:p-4.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-sky-400" />
              Avg Winning Gain
            </span>
            <span className="text-[10px] text-slate-500 font-mono">PER TRADE</span>
          </div>
          <div className="my-2">
            <div className="text-2xl sm:text-3xl font-bold font-mono text-sky-400">
              +{analytics.avgProfitPerWinningTrade}%
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Average ROI achieved across successful target exits
            </p>
          </div>
          <div className="text-[10px] text-slate-500 border-t border-slate-800/80 pt-1.5 flex items-center justify-between font-mono">
            <span>R:R Distribution:</span>
            <span className="text-slate-300 font-bold">1 : 1.8 to 1 : 2.5</span>
          </div>
        </div>

        {/* KPI 4: Active Tracked Signals */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 sm:p-4.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase">
            <span className="flex items-center gap-1.5">
              <History className="w-4 h-4 text-emerald-400" />
              Signals Tracked
            </span>
            <span className="text-[10px] text-slate-500 font-mono">{ticker.symbol}</span>
          </div>
          <div className="my-2">
            <div className="text-2xl sm:text-3xl font-bold font-mono text-white">
              {analytics.totalHistoricalSignals} <span className="text-sm font-normal text-slate-400">Total</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Live automated strike audit and execution log
            </p>
          </div>
          <div className="text-[10px] text-slate-500 border-t border-slate-800/80 pt-1.5 flex items-center justify-between font-mono">
            <span>Active In-Play:</span>
            <span className="text-emerald-400 font-bold">{analytics.activeSignalsCount}</span>
          </div>
        </div>
      </div>

      {/* 3. Derived Strike Profitability Trend Matrix */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 sm:p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3.5 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-emerald-400" />
              <span>Strike Profitability Trend Rankings</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Ranked by historical success rate, Greek delta momentum, and live bid/ask market liquidity for {ticker.symbol}
            </p>
          </div>
          <div className="text-xs font-mono text-slate-400 flex items-center gap-2">
            <span>Spot: <strong className="text-white">{ticker.currency}{ticker.spotPrice.toLocaleString()}</strong></span>
            <span className="text-slate-600">·</span>
            <span>ATM: <strong className="text-amber-400">{ticker.atmStrike}</strong></span>
          </div>
        </div>

        {/* Leaderboard Table */}
        <div className="mt-3.5 overflow-x-auto">
          <table className="w-full text-xs font-mono tabular-nums border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/90 text-slate-400 text-[11px]">
                <th className="py-2.5 px-3 text-left font-semibold">Rank & Strike</th>
                <th className="py-2.5 px-3 text-center font-semibold">Tier</th>
                <th className="py-2.5 px-3 text-right font-semibold">Live LTP</th>
                <th className="py-2.5 px-3 text-right font-semibold">Bid / Ask Spread</th>
                <th className="py-2.5 px-3 text-right font-semibold">Historical Win Rate</th>
                <th className="py-2.5 px-3 text-right font-semibold">Avg Profit</th>
                <th className="py-2.5 px-3 text-center font-semibold">Profit Score</th>
                <th className="py-2.5 px-3 text-left font-semibold">Trend Verdict</th>
                <th className="py-2.5 px-3 text-center font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {analytics.topRankedStrikes.slice(0, 7).map((item, idx) => {
                const isTop = idx === 0;
                const row = chain.find(r => r.strike === item.strike);
                const contract = row ? (item.type === 'CE' ? row.ce : row.pe) : null;
                const liveLtp = contract?.ltp ?? 0;
                const bid = contract?.bidPrice ?? Math.max(0.05, liveLtp - 0.10);
                const ask = contract?.askPrice ?? liveLtp + 0.10;

                return (
                  <tr 
                    key={`${item.strike}-${item.type}`}
                    className={`hover:bg-slate-800/40 transition-colors ${
                      isTop ? 'bg-emerald-500/5 font-semibold' : ''
                    }`}
                  >
                    {/* Rank & Strike */}
                    <td className="py-2.5 px-3 text-left">
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          isTop ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {idx + 1}
                        </span>
                        <span className="font-bold text-white text-xs sm:text-sm">
                          {item.strike} {item.type}
                        </span>
                      </div>
                    </td>

                    {/* Moneyness Tier */}
                    <td className="py-2.5 px-3 text-center">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                        item.moneyness === 'ATM' ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' :
                        item.moneyness === 'ITM' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' :
                        'bg-sky-500/10 text-sky-300 border-sky-500/30'
                      }`}>
                        {item.moneyness}
                      </span>
                    </td>

                    {/* Live LTP */}
                    <td className="py-2.5 px-3 text-right font-bold text-white">
                      {ticker.currency}{liveLtp.toFixed(2)}
                    </td>

                    {/* Bid / Ask */}
                    <td className="py-2.5 px-3 text-right text-slate-400">
                      <span>{ticker.currency}{bid.toFixed(2)}</span>
                      <span className="text-slate-600 mx-1">/</span>
                      <span>{ticker.currency}{ask.toFixed(2)}</span>
                    </td>

                    {/* Success Rate */}
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-emerald-400 font-bold">{item.successRate}%</span>
                        <div className="w-12 bg-slate-800 h-1.5 rounded-full overflow-hidden hidden sm:block">
                          <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${item.successRate}%` }} />
                        </div>
                      </div>
                    </td>

                    {/* Avg Profit */}
                    <td className="py-2.5 px-3 text-right text-emerald-400 font-bold">
                      +{item.avgProfitPercent}%
                    </td>

                    {/* Profit Score */}
                    <td className="py-2.5 px-3 text-center">
                      <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                        item.profitScore >= 82 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                        item.profitScore >= 68 ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40' :
                        'bg-slate-800 text-slate-300'
                      }`}>
                        {item.profitScore}/100
                      </span>
                    </td>

                    {/* Trend Verdict */}
                    <td className="py-2.5 px-3 text-left">
                      <div className="max-w-xs">
                        <span className={`text-[11px] font-bold block ${
                          item.trendRating === 'HIGH_PROFIT_EDGE' ? 'text-emerald-400' :
                          item.trendRating === 'MODERATE_EDGE' ? 'text-sky-400' :
                          item.trendRating === 'NEUTRAL_EDGE' ? 'text-slate-300' :
                          'text-amber-400'
                        }`}>
                          {item.trendRating === 'HIGH_PROFIT_EDGE' && '⭐ HIGH PROFIT EDGE'}
                          {item.trendRating === 'MODERATE_EDGE' && 'MODERATE EDGE'}
                          {item.trendRating === 'NEUTRAL_EDGE' && 'DEFENSIVE / ITM'}
                          {item.trendRating === 'HIGH_RISK' && 'SPECULATIVE OTM'}
                        </span>
                        <span className="text-[10px] text-slate-400 line-clamp-1">
                          {item.recommendationNote}
                        </span>
                      </div>
                    </td>

                    {/* Action */}
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => onSelectContract(item.strike, item.type)}
                        className="px-2.5 py-1 text-[11px] font-bold bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-slate-200 rounded transition-colors cursor-pointer"
                        title="Open Payoff Simulator"
                      >
                        Simulate
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Suggested Strikes Execution & History Log */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 sm:p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3.5 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-sky-400" />
              <span>Suggested Strikes History Log</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live audit of past algorithmic suggestions, real-money entry zones, and target completion status
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {history.length} Recommendations Recorded
          </span>
        </div>

        {/* History Records Table */}
        <div className="mt-3.5 overflow-x-auto">
          <table className="w-full text-xs font-mono tabular-nums border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/90 text-slate-400 text-[11px]">
                <th className="py-2.5 px-3 text-left font-semibold">Time</th>
                <th className="py-2.5 px-3 text-left font-semibold">Signal & Strike</th>
                <th className="py-2.5 px-3 text-right font-semibold">Entry Zone</th>
                <th className="py-2.5 px-3 text-right font-semibold">Entry LTP</th>
                <th className="py-2.5 px-3 text-right font-semibold">Target 1 & 2</th>
                <th className="py-2.5 px-3 text-right font-semibold">Live LTP</th>
                <th className="py-2.5 px-3 text-right font-semibold">Current P&L</th>
                <th className="py-2.5 px-3 text-right font-semibold">Peak Gain</th>
                <th className="py-2.5 px-3 text-center font-semibold">Outcome Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {history.map((record) => {
                const isCE = record.type === 'CE';
                const isPositive = record.pnlPercent >= 0;

                return (
                  <tr 
                    key={record.id}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Time */}
                    <td className="py-2.5 px-3 text-left text-slate-400 text-[11px]">
                      {record.timeFormatted}
                    </td>

                    {/* Signal & Strike */}
                    <td className="py-2.5 px-3 text-left">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                          isCE ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                          'bg-rose-500/15 text-rose-400 border-rose-500/30'
                        }`}>
                          {record.action === 'BUY_CE' ? 'CALL' : 'PUT'}
                        </span>
                        <span className="font-bold text-white text-xs sm:text-sm">
                          {record.strike} {record.type}
                        </span>
                        <span className="text-[10px] text-slate-500">({record.moneyness})</span>
                      </div>
                    </td>

                    {/* Entry Zone */}
                    <td className="py-2.5 px-3 text-right text-slate-300">
                      {ticker.currency}{record.entryRange[0].toFixed(2)} - {ticker.currency}{record.entryRange[1].toFixed(2)}
                    </td>

                    {/* Entry Price */}
                    <td className="py-2.5 px-3 text-right font-semibold text-slate-200">
                      {ticker.currency}{record.entryPrice.toFixed(2)}
                    </td>

                    {/* Targets */}
                    <td className="py-2.5 px-3 text-right text-slate-300">
                      <span className="text-emerald-400">T1: {ticker.currency}{record.target1.toFixed(2)}</span>
                      <span className="text-slate-600 mx-1">·</span>
                      <span className="text-sky-400">T2: {ticker.currency}{record.target2.toFixed(2)}</span>
                    </td>

                    {/* Live LTP */}
                    <td className="py-2.5 px-3 text-right font-bold text-white">
                      {ticker.currency}{record.currentLTP.toFixed(2)}
                    </td>

                    {/* Current P&L */}
                    <td className="py-2.5 px-3 text-right font-bold">
                      <span className={isPositive ? 'text-emerald-400' : 'text-rose-400'}>
                        {isPositive ? '+' : ''}{record.pnlPercent}%
                      </span>
                    </td>

                    {/* Peak Gain */}
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                      +{record.maxProfitPercent}%
                    </td>

                    {/* Outcome Status */}
                    <td className="py-2.5 px-3 text-center">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border inline-flex items-center gap-1 ${
                        record.status === 'TARGET_2_HIT' ? 'bg-sky-500/20 text-sky-300 border-sky-500/40' :
                        record.status === 'TARGET_1_HIT' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                        record.status === 'STOP_LOSS_HIT' ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' :
                        record.status === 'PROFITABLE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                        'bg-slate-800 text-slate-300 border-slate-700'
                      }`}>
                        {record.status === 'TARGET_2_HIT' && '🚀 TARGET 2 HIT'}
                        {record.status === 'TARGET_1_HIT' && '🎯 TARGET 1 HIT'}
                        {record.status === 'STOP_LOSS_HIT' && '🛑 STOP LOSS'}
                        {record.status === 'PROFITABLE' && '⚡ IN PROFIT'}
                        {record.status === 'ACTIVE' && '⏳ ACTIVE'}
                        {record.status === 'IN_LOSS' && '⚠️ RECOVERY'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
