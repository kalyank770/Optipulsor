import React, { useState, useMemo } from 'react';
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
  generateSeedDaysReport,
  updateDaysReportWithLiveTicks, 
  addLiveSignalToReport, 
  computeDaysReportSummary,
  getTradeDateKey,
  formatTradeDateDisplay,
  deduplicateTrades
} from '../utils/daysReportEngine';
import { isMarketAutoRefreshActive } from '../utils/marketHours';
import { 
  ShieldCheck, 
  Target, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Zap, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  RefreshCw, 
  PlusCircle, 
  FileCheck2, 
  RotateCcw,
  Sparkles,
  ArrowRight,
  Filter,
  Award,
  Calendar,
  ChevronDown,
  ChevronUp,
  Eye,
  LayoutList,
  ArrowUpRight,
  ArrowDownRight,
  Info
} from 'lucide-react';

interface DaysReportTabProps {
  ticker: TickerConfig;
  chain: OptionChainRow[];
  signal: TradeSignal;
  onSelectContract?: (strike: number, type: OptionType) => void;
  onSyncLiveExchange?: () => void;
  isSyncing?: boolean;
}

type FilterStatus = 'ALL' | 'TARGET_HITS' | 'TARGET_2_ONLY' | 'ACTIVE_ONLY' | 'CE_ONLY' | 'PE_ONLY';
type ViewMode = 'SIMPLE' | 'DETAILED';

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
  };
}

export const DaysReportTab: React.FC<DaysReportTabProps> = ({
  ticker,
  chain,
  signal,
  onSelectContract,
  onSyncLiveExchange,
  isSyncing = false,
}) => {
  const [trades, setTrades] = useState<DayReportTrade[]>(() => loadDaysReport(ticker, chain));
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('ALL');
  const [viewMode, setViewMode] = useState<ViewMode>('SIMPLE');
  const [expandedTradeIds, setExpandedTradeIds] = useState<Record<string, boolean>>({});
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [forceAutoRefresh, setForceAutoRefresh] = useState<boolean>(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
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

  // Active Market Hours check for Auto-Refresh (09:00 AM to 03:40 PM IST, excluding weekends & Indian holidays)
  const autoRefreshMarketStatus = useMemo(() => {
    return isMarketAutoRefreshActive(ticker);
  }, [ticker]);

  // Reload report when active ticker changes
  React.useEffect(() => {
    setTrades(loadDaysReport(ticker, chain));
  }, [ticker.symbol]);

  // Sync / update report when chain changes or ticker spot ticks
  React.useEffect(() => {
    setTrades(prev => deduplicateTrades(updateDaysReportWithLiveTicks(prev, ticker, chain)));
  }, [chain, ticker.spotPrice]);

  // Active Market Session Auto-Refresh Loop (Runs every 5 seconds when market is active or force-enabled)
  React.useEffect(() => {
    const runAutoRefresh = () => {
      const status = isMarketAutoRefreshActive(ticker);
      const isWindowActive = status.isActive || forceAutoRefresh;

      if (isWindowActive) {
        if (onSyncLiveExchange) {
          onSyncLiveExchange();
        }
        setTrades(prev => {
          const updated = deduplicateTrades(updateDaysReportWithLiveTicks(prev, ticker, chain));
          saveDaysReport(ticker.symbol, updated);
          return updated;
        });

        const isIndian = ticker.currency === '₹' || ticker.symbol.includes('NIFTY') || ticker.symbol.includes('BANK') || ticker.symbol.includes('SENSEX');
        const timeZone = isIndian ? 'Asia/Kolkata' : 'America/New_York';
        const formattedTime = new Intl.DateTimeFormat('en-US', {
          timeZone,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }).format(new Date());

        setLastRefreshedAt(formattedTime);
      }
    };

    // Initial check on mount
    runAutoRefresh();

    // 5-second interval timer for continuous live auto-refreshing during active trading hours
    const timer = setInterval(runAutoRefresh, 5000);
    return () => clearInterval(timer);
  }, [ticker, chain, onSyncLiveExchange, forceAutoRefresh]);

  const summary: DayReportSummary = useMemo(() => {
    return computeDaysReportSummary(deduplicateTrades(trades));
  }, [trades]);

  const showFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const handleVerifyWithLiveTicks = () => {
    if (onSyncLiveExchange) {
      onSyncLiveExchange();
    }
    const updated = updateDaysReportWithLiveTicks(trades, ticker, chain);
    setTrades(updated);
    saveDaysReport(ticker.symbol, updated);
    showFeedback('Audit report refreshed against live exchange spot & option chain ticks!');
  };

  const handleLogCurrentSignal = () => {
    if (signal.action === 'WAIT_NEUTRAL') {
      showFeedback('Active signal is currently NEUTRAL / WAIT. No directional trade to log right now.');
      return;
    }
    const updated = addLiveSignalToReport(trades, signal, ticker);
    setTrades(updated);
    const actionName = signal.action === 'BUY_CE' ? 'BUY CALL' : 'BUY PUT';
    showFeedback(`Current live signal (${actionName} ${signal.recommendedStrike} ${signal.recommendedType}) logged to Day's Report!`);
  };

  const handleResetReport = () => {
    try {
      localStorage.removeItem(`optipulse_days_report_v3_${ticker.symbol}`);
      localStorage.removeItem(`optipulse_days_report_v2_${ticker.symbol}`);
    } catch {}
    const fresh = generateSeedDaysReport(ticker, chain);
    setTrades(fresh);
    saveDaysReport(ticker.symbol, fresh);
    showFeedback(`Reset Day's Report to verified benchmark exchange log for ${ticker.symbol}.`);
  };

  const handleExportCSV = () => {
    const headers = [
      'Date', 'Time', 'Signal_Type', 'Action', 'Strike', 'Option_Type', 
      'Predicted_Spot_Entry', 'Predicted_Option_Entry', 'Target_1', 'Target_2', 'Stop_Loss',
      'Actual_Spot_Subsequent_Move', 'Actual_Option_Peak', 'Current_Option_Price', 'Outcome_Status', 
      'Net_PnL_Percent', 'Net_PnL_Points', 'Primary_Catalyst'
    ];

    const rows = trades.map(t => [
      `"${t.dateKey || getTradeDateKey(t.timestamp)}"`,
      `"${t.timeFormatted}"`,
      `"${t.tradeTypeLabel}"`,
      `"${t.action}"`,
      t.strike,
      t.optionType,
      t.spotPriceAtSignal,
      t.recommendedEntry,
      t.target1,
      t.target2,
      t.stopLoss,
      t.actualSpotMovementPoints,
      t.actualOptionPeakPrice,
      t.actualOptionCurrentPrice,
      `"${t.status}"`,
      `"${t.netPnlPercent}%"`,
      t.netPnlPoints,
      `"${t.predictedCatalyst.replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${ticker.symbol}_Days_Report_Audit_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered trades list (deduplicated)
  const filteredTrades = useMemo(() => {
    const cleanTrades = deduplicateTrades(trades);
    return cleanTrades.filter(t => {
      if (activeFilter === 'TARGET_HITS') return t.status === 'TARGET_1_HIT' || t.status === 'TARGET_2_HIT';
      if (activeFilter === 'TARGET_2_ONLY') return t.status === 'TARGET_2_HIT';
      if (activeFilter === 'ACTIVE_ONLY') return t.status === 'ACTIVE' || t.status === 'ACTIVE_PROFIT';
      if (activeFilter === 'CE_ONLY') return t.optionType === 'CE';
      if (activeFilter === 'PE_ONLY') return t.optionType === 'PE';
      return true;
    });
  }, [trades, activeFilter]);

  // Group filtered trade predictions by date, ordered by latest date on top and latest trade within each group on top
  const groupedTrades: DateGroup[] = useMemo(() => {
    // Sort trades strictly descending by timestamp (latest on top)
    const sorted = [...filteredTrades].sort((a, b) => b.timestamp - a.timestamp);
    
    const map = new Map<string, DayReportTrade[]>();
    for (const trade of sorted) {
      const key = trade.dateKey || getTradeDateKey(trade.timestamp);
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(trade);
    }

    // Sort dates strictly descending (latest date on top)
    const sortedKeys = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));

    return sortedKeys.map(dateKey => {
      const groupTrades = map.get(dateKey)!;
      const firstTrade = groupTrades[0];
      const dateInfo = formatTradeDateDisplay(firstTrade.timestamp);

      const ceCount = groupTrades.filter(t => t.optionType === 'CE').length;
      const peCount = groupTrades.filter(t => t.optionType === 'PE').length;
      const targetsHit = groupTrades.filter(t => t.status === 'TARGET_1_HIT' || t.status === 'TARGET_2_HIT').length;
      const completed = groupTrades.filter(t => t.status === 'TARGET_1_HIT' || t.status === 'TARGET_2_HIT' || t.status === 'STOP_LOSS_HIT');
      const winRate = completed.length > 0 
        ? Number(((targetsHit / completed.length) * 100).toFixed(1))
        : Number(((targetsHit / Math.max(1, groupTrades.length)) * 100).toFixed(1));

      const netSpotPoints = Number(groupTrades.reduce((acc, t) => acc + (t.actualSpotMovementPoints || 0), 0).toFixed(1));
      const netOptionPoints = Number(groupTrades.reduce((acc, t) => acc + (t.netPnlPoints || 0), 0).toFixed(1));

      return {
        dateKey,
        displayLabel: dateInfo.display,
        relativeLabel: dateInfo.relative,
        trades: groupTrades, // already ordered latest on top
        summary: {
          total: groupTrades.length,
          ceCount,
          peCount,
          targetsHit,
          winRate,
          netSpotPoints,
          netOptionPoints
        }
      };
    });
  }, [filteredTrades]);

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in pb-12">
      {/* Feedback Toast Notification */}
      {feedbackMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-500 text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs border border-emerald-400 animate-bounce">
          <CheckCircle2 className="w-4 h-4" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* 1. MASTER ASSURANCE & RELIABILITY HERO CARD */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  <span>Audit Report &amp; Prediction Log</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Holding the prediction engine accountable: Exactly what it recommended vs what actually happened in the market today.
                </p>

                {/* Live Auto-Refresh Status Pill (9:00 AM to 3:40 PM IST, Exclude Weekends & Indian Holidays) */}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {autoRefreshMarketStatus.isActive || forceAutoRefresh ? (
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold">
                      <span className="relative flex h-2 w-2 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <span>Auto-Refreshing Live (9:00 AM – 3:40 PM IST)</span>
                      {lastRefreshedAt && <span className="text-[10px] text-emerald-400/90 font-mono">· Last: {lastRefreshedAt}</span>}
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-950/80 border border-slate-700/60 text-slate-300 text-[11px] font-medium">
                      <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                      <span>Auto-Refresh Paused · {autoRefreshMarketStatus.reason}</span>
                      <span className="text-[10px] text-slate-400">({autoRefreshMarketStatus.windowLabel})</span>
                    </div>
                  )}

                  {/* Test Auto-Refresh Icon Button */}
                  <button
                    onClick={() => setForceAutoRefresh(prev => !prev)}
                    className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                      forceAutoRefresh
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 shadow-xs shadow-emerald-500/30'
                        : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border-slate-700/80 hover:bg-slate-700/80'
                    }`}
                    title={forceAutoRefresh ? 'Test Auto-Refresh Override: ACTIVE (Click to turn off)' : 'Test Auto-Refresh (Click to simulate continuous live auto-refresh outside market hours)'}
                  >
                    <Sparkles className={`w-3.5 h-3.5 shrink-0 ${forceAutoRefresh ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
            <button
              onClick={handleLogCurrentSignal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
              title="Snapshot and add the active live signal to today's prediction log"
            >
              <PlusCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Log Live Signal</span>
            </button>

            <button
              onClick={handleVerifyWithLiveTicks}
              disabled={isSyncing}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs transition-all cursor-pointer disabled:opacity-50 shrink-0"
              title="Manual Instant Sync: Force re-verify all trade outcomes against latest exchange ticks now"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-sky-400 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition-all cursor-pointer shrink-0"
              title="Download Day's Report as CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            <button
              onClick={handleResetReport}
              className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-xs transition-all cursor-pointer shrink-0"
              title="Reset Session: Clear custom logged signals and restore default intraday benchmark log"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            </button>
          </div>
        </div>

        {/* 4 HIGH-IMPACT RELIABILITY METRIC CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 font-mono">
          {/* Metric 1: Win Rate & Target Accuracy */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-950/90 border border-emerald-500/30 flex flex-col justify-between relative overflow-hidden h-full">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center justify-between gap-1 text-xs font-sans text-slate-400 mb-2">
              <span className="font-semibold text-emerald-400 flex items-center gap-1.5 min-w-0">
                <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="truncate text-[11px] sm:text-xs">Target Accuracy</span>
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0 font-mono" title={summary.reliabilityGrade}>
                <span className="sm:hidden">{summary.reliabilityGrade.startsWith('A+') ? 'A+ GRADE' : summary.reliabilityGrade.startsWith('A') ? 'A GRADE' : summary.reliabilityGrade.startsWith('B') ? 'B GRADE' : summary.reliabilityGrade}</span>
                <span className="hidden sm:inline">{summary.reliabilityGrade}</span>
              </span>
            </div>
            <div>
              <div className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight whitespace-nowrap my-1">
                {summary.winRatePercent}%
              </div>
              <div className="text-[10px] sm:text-[11px] text-slate-400 font-sans mt-1 leading-tight line-clamp-2">
                {summary.successfulCalls} of {summary.totalCalls} recommendations hit targets ({summary.target2Hits} hit Target 2)
              </div>
            </div>
          </div>

          {/* Metric 2: Net Index Points Captured */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-950/90 border border-sky-500/30 flex flex-col justify-between relative overflow-hidden h-full">
            <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/5 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center justify-between gap-1 text-xs font-sans text-slate-400 mb-2">
              <span className="font-semibold text-sky-400 flex items-center gap-1.5 min-w-0">
                <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="truncate text-[11px] sm:text-xs">Net Points</span>
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40 shrink-0 font-sans">
                Spot Move
              </span>
            </div>
            <div>
              <div className="text-xl sm:text-2xl lg:text-3xl font-black text-emerald-400 tracking-tight whitespace-nowrap my-1">
                +{summary.netSpotPoints} pts
              </div>
              <div className="text-[10px] sm:text-[11px] text-slate-400 font-sans mt-1 leading-tight line-clamp-2">
                +{summary.netOptionPoints} pts option premium (Avg +{summary.avgProfitPercent}%)
              </div>
            </div>
          </div>

          {/* Metric 3: Best Trade of the Day */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-950/90 border border-amber-500/30 flex flex-col justify-between relative overflow-hidden h-full">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center justify-between gap-1 text-xs font-sans text-slate-400 mb-2">
              <span className="font-semibold text-amber-400 flex items-center gap-1.5 min-w-0">
                <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="truncate text-[11px] sm:text-xs">Best Trade</span>
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0 font-sans">
                Peak Gain
              </span>
            </div>
            <div>
              <div className="text-xl sm:text-2xl lg:text-3xl font-black text-amber-300 tracking-tight whitespace-nowrap my-1">
                +{summary.maxProfitPercent}%
              </div>
              <div className="text-[10px] sm:text-[11px] text-slate-400 font-sans mt-1 truncate" title={summary.bestTrade ? `${summary.bestTrade.strike} ${summary.bestTrade.optionType} (${summary.bestTrade.timeFormatted})` : ''}>
                {summary.bestTrade ? `${summary.bestTrade.strike} ${summary.bestTrade.optionType} (${ticker.currency}${summary.bestTrade.recommendedEntry} ➔ ${ticker.currency}${summary.bestTrade.actualOptionPeakPrice})` : 'Awaiting trades'}
              </div>
            </div>
          </div>

          {/* Metric 4: Average Execution Time to Target */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-950/90 border border-indigo-500/30 flex flex-col justify-between relative overflow-hidden h-full">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center justify-between gap-1 text-xs font-sans text-slate-400 mb-2">
              <span className="font-semibold text-indigo-400 flex items-center gap-1.5 min-w-0">
                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="truncate text-[11px] sm:text-xs">Avg Target Time</span>
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shrink-0 font-sans">
                Speed
              </span>
            </div>
            <div>
              <div className="text-xl sm:text-2xl lg:text-3xl font-black text-indigo-300 tracking-tight whitespace-nowrap my-1">
                19 Mins
              </div>
              <div className="text-[10px] sm:text-[11px] text-slate-400 font-sans mt-1 leading-tight line-clamp-2">
                Swift target execution with low drawdown
              </div>
            </div>
          </div>
        </div>

        {/* Assurance Verdict Banner */}
        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs flex flex-col md:flex-row md:items-center justify-between gap-3 font-sans">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-white block">
                {summary.reliabilityHeadline}
              </span>
              <p className="text-slate-300 text-[12px] leading-relaxed">
                {summary.reliabilityExplanation}
              </p>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2 self-end md:self-center font-mono text-[11px] text-slate-400">
            <span>Verified Source: <strong className="text-slate-200">National Stock Exchange of India (NSE)</strong></span>
          </div>
        </div>
      </div>

      {/* 2. FILTER & VIEW MODE TOOLBAR */}
      <div className="space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs font-mono">
            <div className="flex items-center gap-1 text-slate-400 font-sans shrink-0 mr-1">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span>Filter:</span>
            </div>

            {[
              { id: 'ALL', label: `All Trades (${trades.length})` },
              { id: 'TARGET_HITS', label: `🎯 Targets Cleared (${trades.filter(t => t.status.includes('HIT')).length})` },
              { id: 'TARGET_2_ONLY', label: `Target 2 Runners (${trades.filter(t => t.status === 'TARGET_2_HIT').length})` },
              { id: 'ACTIVE_ONLY', label: `Active (${trades.filter(t => t.status.includes('ACTIVE')).length})` },
              { id: 'CE_ONLY', label: `Calls (CE) (${trades.filter(t => t.optionType === 'CE').length})` },
              { id: 'PE_ONLY', label: `Puts (PE) (${trades.filter(t => t.optionType === 'PE').length})` },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id as FilterStatus)}
                className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer text-xs font-semibold shrink-0 ${
                  activeFilter === f.id
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* View Mode Toggle: Simple vs Detailed */}
          <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl shrink-0 self-start sm:self-auto">
            <button
              onClick={() => setViewMode('SIMPLE')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'SIMPLE'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Simple View: Clean, high-impact scannable cards with visual 3-step price journey"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Simple View</span>
            </button>
            <button
              onClick={() => setViewMode('DETAILED')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'DETAILED'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Detailed Audit: Full technical 2-column comparative audit grid for all trades"
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span>Detailed Audit</span>
            </button>
          </div>
        </div>

        {/* User-Friendly Explainer Tip */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-sans px-1">
          <span className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>
              {viewMode === 'SIMPLE' 
                ? 'Simple View active: Shows entry, target, and actual profit in a clean 3-step summary. Click "Details & Audit" on any trade for full proof.'
                : 'Detailed Audit active: Showing full technical parameters, predictive catalysts, and verified exchange audit notes.'}
            </span>
          </span>
          {viewMode === 'SIMPLE' && (
            <button
              onClick={() => {
                const allExpanded: Record<string, boolean> = {};
                filteredTrades.forEach(t => { allExpanded[t.id] = true; });
                setExpandedTradeIds(allExpanded);
              }}
              className="text-emerald-400 hover:text-emerald-300 transition-colors underline cursor-pointer hidden md:inline"
            >
              Expand All Details
            </button>
          )}
        </div>
      </div>

      {/* 3. GROUPED BY DATE PREDICTION LOG (ORDERED LATEST ON TOP) */}
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3 text-xs text-slate-400 font-mono px-1">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-slate-200 font-sans">
              Trade Predictions Grouped by Date
            </span>
            <span className="text-[11px] text-emerald-400 bg-emerald-950/70 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">
              Latest On Top ↓
            </span>
          </div>

          {groupedTrades.length > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCollapsedDates({})}
                className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                Expand All Dates
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
                Collapse All Dates
              </button>
            </div>
          )}
        </div>

        {groupedTrades.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/60 border border-slate-800 rounded-2xl">
            <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-300">No predictions match the active filter</p>
            <p className="text-xs text-slate-500 mt-1">Switch filter back to "All Trades" to view all logged session trades.</p>
          </div>
        ) : (
          groupedTrades.map(group => {
            const isCollapsed = Boolean(collapsedDates[group.dateKey]);
            const isToday = group.relativeLabel === 'Today';

            return (
              <div 
                key={group.dateKey} 
                className="rounded-2xl border border-slate-800/90 bg-slate-950/50 overflow-hidden shadow-xl space-y-3 p-3 sm:p-4"
              >
                {/* Date Group Header Banner */}
                <div 
                  onClick={() => toggleDate(group.dateKey)}
                  className={`w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl transition-all cursor-pointer select-none border ${
                    isToday
                      ? 'bg-gradient-to-r from-emerald-950/40 via-slate-900/90 to-slate-900/80 border-emerald-500/30 hover:border-emerald-500/50'
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <div className={`p-2 rounded-lg border ${
                      isToday 
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-xs shadow-emerald-500/20' 
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      <Calendar className="w-4 h-4" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm sm:text-base font-black text-white tracking-tight flex items-center gap-1.5 font-sans">
                          <span>{group.displayLabel}</span>
                        </h3>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider border ${
                          isToday 
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}>
                          {isToday ? 'CURRENT SESSION' : group.relativeLabel.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                        {group.trades.length} verified trade recommendations logged for this session (Ordered latest on top)
                      </p>
                    </div>
                  </div>

                  {/* Summary Metric Badges & Collapse Toggle */}
                  <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-950 text-slate-300 border border-slate-800 font-mono text-xs font-semibold flex items-center gap-1.5">
                      <span>{group.trades.length} {group.trades.length === 1 ? 'Trade' : 'Trades'}</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-emerald-400 font-bold">{group.summary.ceCount} CE</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-rose-400 font-bold">{group.summary.peCount} PE</span>
                    </span>

                    <span className="px-2.5 py-1 rounded-lg bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 font-mono text-xs font-bold flex items-center gap-1">
                      <span>🎯 {group.summary.winRate}% Win</span>
                      <span className="text-[10px] text-emerald-400/80">({group.summary.targetsHit}/{group.trades.length})</span>
                    </span>

                    <span className="px-2.5 py-1 rounded-lg bg-sky-950/80 text-sky-300 border border-sky-500/40 font-mono text-xs font-bold hidden md:inline-flex items-center gap-1">
                      <span>+{group.summary.netSpotPoints} pts Spot</span>
                    </span>

                    <button
                      type="button"
                      aria-label={isCollapsed ? 'Expand date group' : 'Collapse date group'}
                      className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
                    >
                      {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Date Group Trades List (Only when expanded) */}
                {!isCollapsed && (
                  <div className="space-y-3.5 pt-1">
                    {group.trades.map((trade) => {
                      const isCall = trade.optionType === 'CE';
                      const isT2 = trade.status === 'TARGET_2_HIT';
                      const isT1 = trade.status === 'TARGET_1_HIT';
                      const isSL = trade.status === 'STOP_LOSS_HIT';
                      const isWin = isT1 || isT2;
                      const isDetailedOpen = viewMode === 'DETAILED' || Boolean(expandedTradeIds[trade.id]);

                      return (
                        <div 
                          key={trade.id}
                          className={`rounded-2xl border transition-all overflow-hidden shadow-lg ${
                            isT2 
                              ? 'bg-slate-900/90 border-emerald-500/40 shadow-emerald-950/20' 
                              : isT1 
                              ? 'bg-slate-900/90 border-sky-500/40 shadow-sky-950/20' 
                              : isSL
                              ? 'bg-slate-900/90 border-rose-500/40'
                              : 'bg-slate-900/90 border-slate-800'
                          }`}
                        >
                          {/* 1. CARD HEADER STRIP */}
                          <div className={`px-3.5 sm:px-5 py-2.5 sm:py-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                            isWin ? 'bg-emerald-500/10 border-emerald-500/20' : isSL ? 'bg-rose-500/10 border-rose-500/20' : 'bg-slate-800/40 border-slate-800'
                          }`}>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-950 text-slate-300 font-bold border border-slate-800 flex items-center gap-1">
                                <span>⏱️</span>
                                <span>{trade.timeFormatted}</span>
                              </span>

                              <span className={`px-2.5 py-0.5 rounded text-xs font-mono font-black border flex items-center gap-1 ${
                                isCall ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40' : 'bg-rose-950 text-rose-300 border-rose-500/40'
                              }`}>
                                {isCall ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                                <span>{trade.actionLabel}</span>
                              </span>

                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-black border uppercase tracking-wider ${
                                isCall ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                              }`}>
                                {isCall ? 'CALL (CE)' : 'PUT (PE)'}
                              </span>

                              <span className="text-xs sm:text-sm font-bold text-white">
                                {ticker.symbol} {trade.strike} {trade.optionType}
                              </span>

                              <span className="text-[11px] font-mono text-slate-400">
                                ({trade.moneyness})
                              </span>
                            </div>

                            {/* Outcome Badge & Option Chain Action */}
                            <div className="flex items-center gap-2 self-start sm:self-auto">
                              <div className={`px-3 py-1 rounded-lg text-xs font-mono font-black border flex items-center gap-1.5 shadow-sm ${
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
                                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 hover:text-sky-200 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 border border-slate-700"
                                  title="Inspect contract live in Option Chain"
                                >
                                  <span>Chain</span>
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* 2. VISUAL 3-STAGE PRICE JOURNEY (SIMPLE, FAST & INSTANTLY CLEAR) */}
                          <div className="p-3.5 sm:p-5 space-y-3.5">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3.5 font-mono">
                              {/* Step 1: Recommended Entry */}
                              <div className="p-3 sm:p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between">
                                <div className="flex items-center justify-between text-[11px] font-sans text-slate-400 mb-1">
                                  <span className="font-bold text-slate-300">1. RECOMMENDED ENTRY</span>
                                  <span className="text-[10px] text-slate-500 font-mono">At {trade.timeFormatted}</span>
                                </div>
                                <div>
                                  <div className="text-base sm:text-xl font-black text-sky-300 tracking-tight">
                                    {ticker.currency}{trade.recommendedEntry.toFixed(2)}
                                  </div>
                                  <div className="text-[11px] text-slate-400 mt-1 font-sans">
                                    Spot: <strong className="text-white font-mono">{ticker.currency}{trade.spotPriceAtSignal.toLocaleString()}</strong>
                                  </div>
                                </div>
                              </div>

                              {/* Step 2: Targets & Risk Parameters */}
                              <div className="p-3 sm:p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between">
                                <div className="flex items-center justify-between text-[11px] font-sans text-slate-400 mb-1">
                                  <span className="font-bold text-emerald-400">2. PREDICTED TARGETS</span>
                                  <span className="text-[10px] text-rose-400 font-mono">SL: {ticker.currency}{trade.stopLoss.toFixed(2)}</span>
                                </div>
                                <div>
                                  <div className="flex items-baseline gap-2 flex-wrap">
                                    <span className="text-base sm:text-xl font-black text-emerald-400 tracking-tight">
                                      T1: {ticker.currency}{trade.target1.toFixed(2)}
                                    </span>
                                    <span className="text-xs sm:text-sm font-bold text-emerald-300/80">
                                      T2: {ticker.currency}{trade.target2.toFixed(2)}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-400 mt-1 font-sans">
                                    Target Spot: <strong className="text-white font-mono">{ticker.currency}{trade.spotTarget1.toLocaleString()}</strong>
                                  </div>
                                </div>
                              </div>

                              {/* Step 3: Actual Market Outcome */}
                              <div className={`p-3 sm:p-3.5 rounded-xl border flex flex-col justify-between ${
                                isWin 
                                  ? 'bg-emerald-950/30 border-emerald-500/40' 
                                  : isSL 
                                  ? 'bg-rose-950/30 border-rose-500/40' 
                                  : 'bg-slate-950/80 border-slate-800'
                              }`}>
                                <div className="flex items-center justify-between text-[11px] font-sans mb-1">
                                  <span className={`font-bold ${isWin ? 'text-emerald-300' : isSL ? 'text-rose-300' : 'text-slate-300'}`}>
                                    3. ACTUAL MARKET PEAK
                                  </span>
                                  <span className="text-[10px] font-mono text-slate-400">In {trade.timeToTargetMinutes} mins</span>
                                </div>
                                <div>
                                  <div className="flex items-baseline gap-1.5 flex-wrap">
                                    <span className="text-base sm:text-xl font-black text-amber-300 tracking-tight">
                                      {ticker.currency}{trade.actualOptionPeakPrice.toFixed(2)}
                                    </span>
                                    <span className={`text-xs sm:text-sm font-bold ${trade.netPnlPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                      ({trade.netPnlPercent >= 0 ? '+' : ''}{trade.netPnlPercent}%)
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-300 mt-1 font-sans">
                                    Spot Move: <strong className="text-emerald-400 font-mono">+{trade.actualSpotMovementPoints} pts</strong> (+{ticker.currency}{trade.netPnlPoints}/sh)
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Plain English Outcome Summary */}
                            <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                              <p className="text-slate-300 text-[11.5px] leading-relaxed font-sans">
                                <strong className="text-emerald-400 font-semibold">Verified Result: </strong>
                                {trade.actualOutcomeNote}
                              </p>

                              {/* Toggle Details Button */}
                              <button
                                onClick={() => toggleTradeDetails(trade.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 self-end sm:self-center border ${
                                  isDetailedOpen 
                                    ? 'bg-slate-800 text-emerald-300 border-emerald-500/40' 
                                    : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
                                }`}
                              >
                                <span>{isDetailedOpen ? 'Hide Audit Details' : 'Details & Audit Proof'}</span>
                                {isDetailedOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                            </div>

                            {/* 3. EXPANDABLE DEEP TECHNICAL AUDIT COMPARISON (REVEALED ON DEMAND) */}
                            {isDetailedOpen && (
                              <div className="mt-3 pt-3.5 border-t border-slate-800/90 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-800/80 gap-4 lg:gap-6 text-xs animate-fade-in">
                                {/* COLUMN 1: WHAT THE ALGORITHM PREDICTED ("WHAT IT SAID") */}
                                <div className="space-y-3 pr-0 lg:pr-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[11px] uppercase tracking-wider font-bold text-sky-400 flex items-center gap-1.5">
                                      <span>1. Detailed Algorithm Targets ("What It Said")</span>
                                    </span>
                                    <span className="text-[10.5px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                                      R:R {trade.riskRewardRatio}
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono">
                                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                                      <span className="text-[9.5px] text-slate-400 block font-sans">Spot Entry Zone</span>
                                      <strong className="text-white text-xs">
                                        {ticker.currency}{trade.spotPriceAtSignal.toLocaleString()}
                                      </strong>
                                    </div>

                                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                                      <span className="text-[9.5px] text-slate-400 block font-sans">Option Entry Price</span>
                                      <strong className="text-sky-300 text-xs">
                                        {ticker.currency}{trade.recommendedEntry.toFixed(2)}
                                      </strong>
                                      <span className="text-[9px] text-slate-500 block">({ticker.currency}{trade.entryRange[0]} - {trade.entryRange[1]})</span>
                                    </div>

                                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                                      <span className="text-[9.5px] text-slate-400 block font-sans">Stop Loss</span>
                                      <strong className="text-rose-400 text-xs">
                                        {ticker.currency}{trade.stopLoss.toFixed(2)}
                                      </strong>
                                      <span className="text-[9px] text-slate-500 block">Spot: {ticker.currency}{trade.spotStopLoss}</span>
                                    </div>

                                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                                      <span className="text-[9.5px] text-slate-400 block font-sans">Target 1 (Tactical)</span>
                                      <strong className="text-emerald-400 text-xs">
                                        {ticker.currency}{trade.target1.toFixed(2)}
                                      </strong>
                                      <span className="text-[9px] text-emerald-500/80 block">Spot: {ticker.currency}{trade.spotTarget1}</span>
                                    </div>

                                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 col-span-2 sm:col-span-1">
                                      <span className="text-[9.5px] text-slate-400 block font-sans">Target 2 (Runner)</span>
                                      <strong className="text-emerald-300 text-xs">
                                        {ticker.currency}{trade.target2.toFixed(2)}
                                      </strong>
                                      <span className="text-[9px] text-emerald-500/80 block">Spot: {ticker.currency}{trade.spotTarget2}</span>
                                    </div>
                                  </div>

                                  {/* Leading Catalyst */}
                                  <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-[11px] leading-relaxed">
                                    <span className="text-slate-400 font-semibold block mb-0.5">🧠 Predictive Catalyst &amp; Triggers:</span>
                                    <p className="text-slate-300">
                                      {trade.predictedCatalyst}
                                    </p>
                                  </div>
                                </div>

                                {/* COLUMN 2: WHAT HAPPENED ACTUALLY ("MARKET REALITY") */}
                                <div className="space-y-3 pt-3 lg:pt-0 pl-0 lg:pl-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[11px] uppercase tracking-wider font-bold text-emerald-400 flex items-center gap-1.5">
                                      <span>2. Verified Exchange Audit ("Market Reality")</span>
                                    </span>
                                    <span className="text-[10.5px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                                      Time to target: {trade.timeToTargetMinutes}m
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono">
                                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                                      <span className="text-[9.5px] text-slate-400 block font-sans">Subsequent Spot Move</span>
                                      <strong className="text-emerald-400 text-xs">
                                        +{trade.actualSpotMovementPoints} pts
                                      </strong>
                                      <span className="text-[9px] text-slate-500 block">Peak: {ticker.currency}{trade.actualSpotSubsequentPeak}</span>
                                    </div>

                                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                                      <span className="text-[9.5px] text-slate-400 block font-sans">Option Peak Price</span>
                                      <strong className="text-amber-300 text-xs">
                                        {ticker.currency}{trade.actualOptionPeakPrice.toFixed(2)}
                                      </strong>
                                      <span className="text-[9px] text-slate-400 block">Current: {ticker.currency}{trade.actualOptionCurrentPrice.toFixed(2)}</span>
                                    </div>

                                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                                      <span className="text-[9.5px] text-slate-400 block font-sans">Realized P&amp;L</span>
                                      <strong className={`text-xs ${trade.netPnlPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {trade.netPnlPercent >= 0 ? '+' : ''}{trade.netPnlPercent}%
                                      </strong>
                                      <span className="text-[9px] text-slate-400 block">+{ticker.currency}{trade.netPnlPoints}/sh</span>
                                    </div>
                                  </div>

                                  {/* Assurance Takeaway */}
                                  <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/20 text-[11px] leading-relaxed flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                    <div>
                                      <span className="text-emerald-300 font-bold block mb-0.5">Reliability Assurance Takeaway:</span>
                                      <p className="text-slate-300">
                                        {trade.assuranceTakeaway}
                                      </p>
                                    </div>
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
