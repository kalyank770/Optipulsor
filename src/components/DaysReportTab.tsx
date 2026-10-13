import React, { useState, useMemo, useEffect } from 'react';
import { 
  TickerConfig, 
  OptionChainRow, 
  TradeSignal,
  OptionType 
} from '../types/options';
import { 
  DayReportTrade, 
  DayReportSummary,
  loadDaysReport, 
  saveDaysReport, 
  updateDaysReportWithLiveTicks, 
  addLiveSignalToReport, 
  computeDaysReportSummary,
  getTradeDateKey,
  formatTradeDateDisplay,
  deduplicateTrades
} from '../utils/daysReportEngine';
import { isMarketAutoRefreshActive } from '../utils/marketHours';
import { MoneynessBadge } from './MoneynessBadge';
import { 
  Target, 
  TrendingUp, 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  ArrowUpRight, 
  ArrowDownRight, 
  CheckCircle2, 
  Activity, 
  FileCheck2, 
  Clock, 
  ArrowRight, 
  ShieldCheck
} from 'lucide-react';

interface DaysReportTabProps {
  ticker: TickerConfig;
  chain: OptionChainRow[];
  signal: TradeSignal;
  onSelectContract?: (strike: number, type: OptionType) => void;
  onSyncLiveExchange?: () => void;
  isSyncing?: boolean;
}

interface DateGroup {
  dateKey: string;
  displayLabel: string;
  relativeLabel: string;
  trades: DayReportTrade[];
  summary: {
    total: number;
    ceCount: number;
    peCount: number;
    targetsHit: number;
    winRate: number;
    netSpotPoints: number;
    netOptionPoints: number;
    avgProfitPercent: number;
    marketProgression: {
      open: number;
      high: number;
      low: number;
      close: number;
      netChange: number;
      netChangePct: number;
      trendSummary: string;
    };
  };
}

export const DaysReportTab: React.FC<DaysReportTabProps> = ({
  ticker,
  chain,
  signal,
  onSelectContract,
  onSyncLiveExchange,
}) => {
  const [trades, setTrades] = useState<DayReportTrade[]>(() => loadDaysReport(ticker, chain));
  const [expandedTradeIds, setExpandedTradeIds] = useState<Record<string, boolean>>({});
  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({});

  const toggleTradeDetails = (tradeId: string) => {
    setExpandedTradeIds(prev => ({
      ...prev,
      [tradeId]: !prev[tradeId]
    }));
  };

  const toggleDate = (dateKey: string) => {
    setCollapsedDates(prev => ({
      ...prev,
      [dateKey]: !prev[dateKey]
    }));
  };

  // Reload report when active ticker changes
  useEffect(() => {
    const loaded = loadDaysReport(ticker, chain);
    setTrades(loaded);
  }, [ticker.symbol]);

  // Sync / update report when chain changes or ticker spot ticks
  useEffect(() => {
    setTrades(prev => deduplicateTrades(updateDaysReportWithLiveTicks(prev, ticker, chain), ticker));
  }, [chain, ticker.spotPrice]);

  // Automatically record live predictions from the engine in real-time strictly during active market hours
  useEffect(() => {
    const marketStatus = isMarketAutoRefreshActive(ticker);
    if (marketStatus.isActive && signal && signal.recommendedStrike && signal.action !== 'WAIT_NEUTRAL') {
      setTrades(prev => {
        const updated = addLiveSignalToReport(prev, signal, ticker);
        saveDaysReport(ticker.symbol, updated);
        return updated;
      });
    }
  }, [signal.recommendedStrike, signal.action, ticker.symbol, ticker]);

  // Active Market Session Auto-Refresh Loop
  useEffect(() => {
    const runAutoRefresh = () => {
      const status = isMarketAutoRefreshActive(ticker);
      if (status.isActive) {
        if (onSyncLiveExchange) {
          onSyncLiveExchange();
        }
        setTrades(prev => {
          const updated = deduplicateTrades(updateDaysReportWithLiveTicks(prev, ticker, chain), ticker);
          saveDaysReport(ticker.symbol, updated);
          return updated;
        });
      }
    };

    runAutoRefresh();
    const timer = setInterval(runAutoRefresh, 5000);
    return () => clearInterval(timer);
  }, [ticker, chain, onSyncLiveExchange]);

  // Compute aggregate summary metrics
  const summary: DayReportSummary = useMemo(() => {
    return computeDaysReportSummary(trades);
  }, [trades]);

  // Clean, deduplicated trades list
  const cleanTrades = useMemo(() => {
    return deduplicateTrades(trades, ticker);
  }, [trades, ticker]);

  // Group trade predictions by date, ordered by latest date on top
  const groupedTrades: DateGroup[] = useMemo(() => {
    const sorted = [...cleanTrades].sort((a, b) => b.timestamp - a.timestamp);
    
    const map = new Map<string, DayReportTrade[]>();
    for (const trade of sorted) {
      const key = trade.dateKey || getTradeDateKey(trade.timestamp);
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(trade);
    }

    const sortedKeys = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));

    return sortedKeys.map(dateKey => {
      const groupTrades = map.get(dateKey)!;
      const firstTrade = groupTrades[0];
      const isIndian = !ticker.symbol.includes('SPY') && !ticker.symbol.includes('QQQ') && !ticker.symbol.includes('AAPL') && !ticker.symbol.includes('NVDA');
      const dateInfo = formatTradeDateDisplay(firstTrade.timestamp, isIndian);

      const ceCount = groupTrades.filter(t => t.optionType === 'CE').length;
      const peCount = groupTrades.filter(t => t.optionType === 'PE').length;
      const targetsHit = groupTrades.filter(t => t.status === 'TARGET_1_HIT' || t.status === 'TARGET_2_HIT').length;
      const completed = groupTrades.filter(t => t.status === 'TARGET_1_HIT' || t.status === 'TARGET_2_HIT' || t.status === 'STOP_LOSS_HIT');
      const winRate = completed.length > 0 
        ? Number(((targetsHit / completed.length) * 100).toFixed(1))
        : Number(((targetsHit / Math.max(1, groupTrades.length)) * 100).toFixed(1));

      const netSpotPoints = Number(groupTrades.reduce((acc, t) => acc + (t.actualSpotMovementPoints || 0), 0).toFixed(1));
      const netOptionPoints = Number(groupTrades.reduce((acc, t) => acc + (t.netPnlPoints || 0), 0).toFixed(1));
      const totalProfitPct = groupTrades.reduce((acc, t) => acc + (t.netPnlPercent || 0), 0);
      const avgProfitPercent = Number((totalProfitPct / Math.max(1, groupTrades.length)).toFixed(1));

      // Market progression for the session
      const spotValues = groupTrades.map(t => t.spotPriceAtSignal);
      const peakValues = groupTrades.map(t => t.actualSpotSubsequentPeak);
      const allSpots = [...spotValues, ...peakValues];
      const dayHigh = Number(Math.max(...allSpots).toFixed(2));
      const dayLow = Number(Math.min(...allSpots).toFixed(2));
      const earliestTrade = groupTrades[groupTrades.length - 1];
      const latestTrade = groupTrades[0];
      const dayOpen = Number(earliestTrade.spotPriceAtSignal.toFixed(2));
      const dayClose = Number(latestTrade.actualSpotSubsequentPeak.toFixed(2));
      const netChange = Number((dayClose - dayOpen).toFixed(2));
      const netChangePct = Number(((netChange / dayOpen) * 100).toFixed(2));

      let trendSummary = '';
      if (netChange >= 0) {
        trendSummary = `Rallied +${netChange} pts (+${netChangePct}%) off morning low to close near highs.`;
      } else {
        trendSummary = `Corrected ${netChange} pts (${netChangePct}%) from morning resistance to test support floor.`;
      }

      return {
        dateKey,
        displayLabel: dateInfo.display,
        relativeLabel: dateInfo.relative,
        trades: groupTrades,
        summary: {
          total: groupTrades.length,
          ceCount,
          peCount,
          targetsHit,
          winRate,
          netSpotPoints,
          netOptionPoints,
          avgProfitPercent,
          marketProgression: {
            open: dayOpen,
            high: dayHigh,
            low: dayLow,
            close: dayClose,
            netChange,
            netChangePct,
            trendSummary
          }
        }
      };
    });
  }, [cleanTrades, ticker]);

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in pb-12 font-sans">
      {/* 1. HERO AUDIT HEADER & STATS RIBBON */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shrink-0">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  <span>Suggested vs. Actual Trade History</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Strictly read-only 1-week audit trail comparing model trade recommendations against realized market execution.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono self-start lg:self-center">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Verified Exchange Data Source: <strong className="text-slate-200">NSE India</strong></span>
          </div>
        </div>

        {/* 4 HIGH-IMPACT METRIC CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 font-mono">
          {/* Card 1: Total Trades Logged */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between gap-1 text-xs font-sans text-slate-400 mb-2">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5 min-w-0">
                <Clock className="w-4 h-4 text-sky-400 shrink-0" />
                <span className="truncate text-[11px] sm:text-xs">Trades Logged</span>
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                1 WEEK
              </span>
            </div>
            <div>
              <div className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight my-1">
                {summary.totalCalls} Trades
              </div>
              <div className="text-[11px] text-slate-400 font-sans leading-tight">
                Across past 7 trading sessions
              </div>
            </div>
          </div>

          {/* Card 2: Target Win Rate */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-950/90 border border-emerald-500/30 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between gap-1 text-xs font-sans text-slate-400 mb-2">
              <span className="font-semibold text-emerald-400 flex items-center gap-1.5 min-w-0">
                <Target className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="truncate text-[11px] sm:text-xs">Target Win Rate</span>
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                {summary.reliabilityGrade}
              </span>
            </div>
            <div>
              <div className="text-xl sm:text-2xl lg:text-3xl font-black text-emerald-400 tracking-tight my-1">
                {summary.winRatePercent}%
              </div>
              <div className="text-[11px] text-slate-400 font-sans leading-tight">
                {summary.successfulCalls} of {summary.totalCalls} recommendations hit targets ({summary.target2Hits} hit Target 2)
              </div>
            </div>
          </div>

          {/* Card 3: Net Index Spot Points */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-950/90 border border-sky-500/30 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between gap-1 text-xs font-sans text-slate-400 mb-2">
              <span className="font-semibold text-sky-400 flex items-center gap-1.5 min-w-0">
                <TrendingUp className="w-4 h-4 text-sky-400 shrink-0" />
                <span className="truncate text-[11px] sm:text-xs">Net Spot Move</span>
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40 font-sans">
                Index Points
              </span>
            </div>
            <div>
              <div className="text-xl sm:text-2xl lg:text-3xl font-black text-sky-300 tracking-tight my-1">
                +{summary.netSpotPoints} pts
              </div>
              <div className="text-[11px] text-slate-400 font-sans leading-tight">
                Cumulative directional index movement captured
              </div>
            </div>
          </div>

          {/* Card 4: Net Option Premium P&L */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-950/90 border border-amber-500/30 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between gap-1 text-xs font-sans text-slate-400 mb-2">
              <span className="font-semibold text-amber-400 flex items-center gap-1.5 min-w-0">
                <Activity className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="truncate text-[11px] sm:text-xs">Option Premium P&amp;L</span>
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 font-sans">
                Premium
              </span>
            </div>
            <div>
              <div className="text-xl sm:text-2xl lg:text-3xl font-black text-amber-300 tracking-tight my-1">
                +{summary.netOptionPoints} pts
              </div>
              <div className="text-[11px] text-slate-400 font-sans leading-tight">
                Avg +{summary.avgProfitPercent}% return per contract trade
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. DATE-GROUPED HISTORY LIST */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 text-xs text-slate-400 font-mono px-1">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-slate-200 font-sans text-sm">
              Trade History Grouped by Date (Current Day On Top)
            </span>
          </div>

          {groupedTrades.length > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCollapsedDates({})}
                className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                Expand All
              </button>
              <span className="text-slate-700">·</span>
              <button
                onClick={() => {
                  const all: Record<string, boolean> = {};
                  groupedTrades.forEach(g => { all[g.dateKey] = true; });
                  setCollapsedDates(all);
                }}
                className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                Collapse All
              </button>
            </div>
          )}
        </div>

        {groupedTrades.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/60 border border-slate-800 rounded-2xl">
            <p className="text-sm font-semibold text-slate-300">No trade history logged for {ticker.symbol}</p>
          </div>
        ) : (
          groupedTrades.map((group, groupIdx) => {
            // Default rule: First group (Current Day / Today) is expanded by default (idx === 0)
            const isExplicitlySet = group.dateKey in collapsedDates;
            const isCollapsed = isExplicitlySet ? collapsedDates[group.dateKey] : groupIdx > 0;
            const isIndian = !ticker.symbol.includes('SPY') && !ticker.symbol.includes('QQQ') && !ticker.symbol.includes('AAPL') && !ticker.symbol.includes('NVDA');
            const todayKey = getTradeDateKey(Date.now(), isIndian);
            const isToday = group.dateKey === todayKey || group.relativeLabel === 'Today';

            return (
              <div 
                key={group.dateKey} 
                className={`rounded-2xl border transition-all overflow-hidden shadow-xl ${
                  isToday 
                    ? 'border-emerald-500/40 bg-slate-950/70' 
                    : 'border-slate-800/90 bg-slate-950/40'
                }`}
              >
                {/* Date Group Header Banner */}
                <div 
                  onClick={() => toggleDate(group.dateKey)}
                  className={`w-full flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 sm:p-4 transition-all cursor-pointer select-none border-b ${
                    isToday
                      ? 'bg-gradient-to-r from-emerald-950/50 via-slate-900/90 to-slate-900/80 border-emerald-500/30 hover:border-emerald-500/50'
                      : 'bg-slate-900/80 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <div className={`p-2 rounded-lg border ${
                        isToday 
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        <Calendar className="w-4 h-4" />
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm sm:text-base font-black text-white tracking-tight font-sans">
                            {group.displayLabel}
                          </h3>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider border ${
                            isToday 
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}>
                            {isToday ? 'LIVE TODAY' : group.relativeLabel.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                          Session Open: {ticker.currency}{group.summary.marketProgression.open.toLocaleString()} · Close: {ticker.currency}{group.summary.marketProgression.close.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Summary Badges & Chevron Toggle */}
                  <div className="flex items-center gap-2 self-start md:self-center flex-wrap">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-950 text-slate-300 border border-slate-800 font-mono text-xs font-semibold flex items-center gap-1.5">
                      <span>{group.trades.length} {group.trades.length === 1 ? 'Trade' : 'Trades'}</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-emerald-400 font-bold">{group.summary.ceCount} CE</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-rose-400 font-bold">{group.summary.peCount} PE</span>
                    </span>

                    <span className="px-2.5 py-1 rounded-lg bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 font-mono text-xs font-bold">
                      🎯 {group.summary.winRate}% Win
                    </span>

                    <span className="px-2.5 py-1 rounded-lg bg-sky-950/80 text-sky-300 border border-sky-500/40 font-mono text-xs font-bold">
                      +{group.summary.netSpotPoints} pts Spot
                    </span>

                    <div className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors ml-1">
                      {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Date Group Trades List */}
                {!isCollapsed && (
                  <div className="p-3 sm:p-4 space-y-3">
                    {group.trades.map((trade) => {
                      const isCall = trade.optionType === 'CE';
                      const isT2 = trade.status === 'TARGET_2_HIT';
                      const isT1 = trade.status === 'TARGET_1_HIT';
                      const isSL = trade.status === 'STOP_LOSS_HIT';
                      const isWin = isT1 || isT2;
                      const isDetailedOpen = Boolean(expandedTradeIds[trade.id]);

                      return (
                        <div 
                          key={trade.id}
                          className={`rounded-xl border transition-all overflow-hidden ${
                            isT2 
                              ? 'bg-slate-900/90 border-emerald-500/40' 
                              : isT1 
                              ? 'bg-slate-900/90 border-sky-500/40' 
                              : isSL
                              ? 'bg-slate-900/90 border-rose-500/40'
                              : 'bg-slate-900/90 border-slate-800'
                          }`}
                        >
                          {/* Trade Header Strip */}
                          <div className={`px-3.5 sm:px-4 py-2.5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                            isWin ? 'bg-emerald-500/10 border-emerald-500/20' : isSL ? 'bg-rose-500/10 border-rose-500/20' : 'bg-slate-800/40 border-slate-800'
                          }`}>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-950 text-slate-300 font-bold border border-slate-800 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                <span>{trade.timeFormatted}</span>
                              </span>

                              <span className={`px-2.5 py-0.5 rounded text-xs font-mono font-black border flex items-center gap-1 ${
                                isCall ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40' : 'bg-rose-950 text-rose-300 border-rose-500/40'
                              }`}>
                                {isCall ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                                <span>{trade.actionLabel}</span>
                              </span>

                              <span className="text-xs sm:text-sm font-bold text-white">
                                {ticker.symbol} {trade.strike} {trade.optionType}
                              </span>

                              <MoneynessBadge moneyness={trade.moneyness} size="xs" />
                            </div>

                            {/* Status & Contract Link */}
                            <div className="flex items-center gap-2 self-start sm:self-auto">
                              <div className={`px-2.5 py-1 rounded-lg text-xs font-mono font-black border flex items-center gap-1.5 ${
                                isT2 ? 'bg-emerald-500 text-slate-950 border-emerald-400' :
                                isT1 ? 'bg-sky-500 text-slate-950 border-sky-400' :
                                isSL ? 'bg-rose-500 text-white border-rose-400' :
                                'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              }`}>
                                <span>{trade.statusLabel}</span>
                                <span className="font-extrabold">({trade.netPnlPercent >= 0 ? '+' : ''}{trade.netPnlPercent}%)</span>
                              </div>

                              {onSelectContract && (
                                <button
                                  onClick={() => onSelectContract(trade.strike, trade.optionType)}
                                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 border border-slate-700"
                                  title="View option contract"
                                >
                                  <span>Chain</span>
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Suggested vs Actual Comparison Grid */}
                          <div className="p-3 sm:p-4 space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
                              {/* Column 1: Suggested Trade */}
                              <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1">
                                <span className="text-[10px] font-sans font-bold text-sky-400 block uppercase tracking-wider">
                                  1. Suggested Trade
                                </span>
                                <div className="text-sm font-black text-white">
                                  Entry LTP: {ticker.currency}{trade.recommendedEntry.toFixed(2)}
                                </div>
                                <div className="text-[11px] text-slate-400 font-sans space-y-0.5">
                                  <div>Spot at Signal: <strong className="text-slate-200">{ticker.currency}{trade.spotPriceAtSignal.toLocaleString()}</strong></div>
                                  <div>Target 1: <strong className="text-emerald-400">{ticker.currency}{trade.target1.toFixed(2)}</strong> · Target 2: <strong className="text-emerald-300">{ticker.currency}{trade.target2.toFixed(2)}</strong></div>
                                  <div>Stop Loss: <strong className="text-rose-400">{ticker.currency}{trade.stopLoss.toFixed(2)}</strong></div>
                                </div>
                              </div>

                              {/* Column 2: Actual Market Execution */}
                              <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1">
                                <span className="text-[10px] font-sans font-bold text-amber-400 block uppercase tracking-wider">
                                  2. Actual Market Peak
                                </span>
                                <div className="text-sm font-black text-amber-300">
                                  Peak Option LTP: {ticker.currency}{trade.actualOptionPeakPrice.toFixed(2)}
                                </div>
                                <div className="text-[11px] text-slate-400 font-sans space-y-0.5">
                                  <div>Peak Spot Reached: <strong className="text-emerald-400">{ticker.currency}{trade.actualSpotSubsequentPeak.toLocaleString()}</strong></div>
                                  <div>Time to Target: <strong className="text-slate-200">{trade.timeToTargetMinutes} mins</strong></div>
                                  <div>Current LTP: <strong className="text-slate-300">{ticker.currency}{trade.actualOptionCurrentPrice.toFixed(2)}</strong></div>
                                </div>
                              </div>

                              {/* Column 3: Realized Net P&L */}
                              <div className={`p-3 rounded-lg border space-y-1 ${
                                isWin ? 'bg-emerald-950/30 border-emerald-500/40' : isSL ? 'bg-rose-950/30 border-rose-500/40' : 'bg-slate-950/80 border-slate-800'
                              }`}>
                                <span className="text-[10px] font-sans font-bold text-slate-300 block uppercase tracking-wider">
                                  3. Net Realized P&amp;L
                                </span>
                                <div className={`text-sm font-black ${trade.netPnlPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {trade.netPnlPercent >= 0 ? '+' : ''}{trade.netPnlPercent}% ({trade.netPnlPoints >= 0 ? '+' : ''}{trade.netPnlPoints} pts/sh)
                                </div>
                                <div className="text-[11px] text-slate-400 font-sans space-y-0.5">
                                  <div>Net Spot Move: <strong className="text-emerald-400">+{trade.actualSpotMovementPoints} pts</strong></div>
                                  <div className="line-clamp-1">{trade.actualOutcomeNote}</div>
                                </div>
                              </div>
                            </div>

                            {/* Details Toggle Bar */}
                            <div className="flex items-center justify-between text-xs pt-1">
                              <span className="text-[11px] text-slate-400 font-sans italic">
                                {trade.predictedCatalyst}
                              </span>

                              <button
                                onClick={() => toggleTradeDetails(trade.id)}
                                className="text-[11px] font-bold text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-1 cursor-pointer shrink-0 ml-2"
                              >
                                <span>{isDetailedOpen ? 'Hide Technical Proof' : 'View Technical Proof'}</span>
                                {isDetailedOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                            </div>

                            {/* Expandable Technical Proof */}
                            {isDetailedOpen && (
                              <div className="pt-3 border-t border-slate-800 text-xs font-sans space-y-2 animate-fade-in">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800">
                                  <div>
                                    <span className="text-[10px] font-mono text-slate-400 block uppercase">Algorithmic Spot Targets:</span>
                                    <p className="text-slate-200 text-[11px] mt-0.5">
                                      Spot Entry: {ticker.currency}{trade.spotPriceAtSignal} · Spot Target 1: {ticker.currency}{trade.spotTarget1} · Spot Target 2: {ticker.currency}{trade.spotTarget2} · Spot SL: {ticker.currency}{trade.spotStopLoss}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-mono text-slate-400 block uppercase">Verification Takeaway:</span>
                                    <p className="text-slate-200 text-[11px] mt-0.5 flex items-start gap-1">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                      <span>{trade.assuranceTakeaway}</span>
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
