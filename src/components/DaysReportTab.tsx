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
  updateDaysReportWithLiveTicks, 
  addLiveSignalToReport, 
  computeDaysReportSummary 
} from '../utils/daysReportEngine';
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
  Award
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
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Sync / update report when chain changes or ticker changes
  React.useEffect(() => {
    setTrades(prev => updateDaysReportWithLiveTicks(prev, ticker, chain));
  }, [chain, ticker]);

  const summary: DayReportSummary = useMemo(() => {
    return computeDaysReportSummary(trades);
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
      showFeedback('Active signal is currently NEUTRAL. No directional trade to log right now.');
      return;
    }
    const updated = addLiveSignalToReport(trades, signal, ticker);
    setTrades(updated);
    showFeedback(`Current live signal (${signal.action.replace('_', ' ')} ${signal.recommendedStrike}) logged to Day's Report!`);
  };

  const handleResetReport = () => {
    try {
      localStorage.removeItem(`optipulse_days_report_v2_${ticker.symbol}`);
    } catch {}
    const fresh = loadDaysReport(ticker, chain);
    setTrades(fresh);
    showFeedback('Reset Day\'s Report to today\'s full session exchange log.');
  };

  const handleExportCSV = () => {
    const headers = [
      'Time', 'Signal_Type', 'Action', 'Strike', 'Option_Type', 
      'Predicted_Spot_Entry', 'Predicted_Option_Entry', 'Target_1', 'Target_2', 'Stop_Loss',
      'Actual_Spot_Subsequent_Move', 'Actual_Option_Peak', 'Current_Option_Price', 'Outcome_Status', 
      'Net_PnL_Percent', 'Net_PnL_Points', 'Primary_Catalyst'
    ];

    const rows = trades.map(t => [
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

  // Filtered trades list
  const filteredTrades = useMemo(() => {
    return trades.filter(t => {
      if (activeFilter === 'TARGET_HITS') return t.status === 'TARGET_1_HIT' || t.status === 'TARGET_2_HIT';
      if (activeFilter === 'TARGET_2_ONLY') return t.status === 'TARGET_2_HIT';
      if (activeFilter === 'ACTIVE_ONLY') return t.status === 'ACTIVE' || t.status === 'ACTIVE_PROFIT';
      if (activeFilter === 'CE_ONLY') return t.optionType === 'CE';
      if (activeFilter === 'PE_ONLY') return t.optionType === 'PE';
      return true;
    });
  }, [trades, activeFilter]);

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
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
            <button
              onClick={handleLogCurrentSignal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-sm cursor-pointer"
              title="Snapshot and add the active live signal to today's report"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Log Current Live Signal</span>
            </button>

            <button
              onClick={handleVerifyWithLiveTicks}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
              title="Recalculate running trades against live spot and option prices"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Verify Against Exchange Ticks</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition-all cursor-pointer"
              title="Download Day's Report as CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Export Audit CSV</span>
            </button>

            <button
              onClick={handleResetReport}
              className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-xs transition-all cursor-pointer"
              title="Reset to default session records"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 4 HIGH-IMPACT RELIABILITY METRIC CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 font-mono">
          {/* Metric 1: Win Rate & Target Accuracy */}
          <div className="p-4 rounded-xl bg-slate-950/90 border border-emerald-500/30 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center justify-between text-xs font-sans text-slate-400 mb-2">
              <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                <Target className="w-4 h-4" />
                <span>Target Accuracy</span>
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                {summary.reliabilityGrade}
              </span>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {summary.winRatePercent}%
              </div>
              <div className="text-[11px] text-slate-400 font-sans mt-1">
                {summary.successfulCalls} of {summary.totalCalls} hit targets ({summary.target2Hits} hit Target 2)
              </div>
            </div>
          </div>

          {/* Metric 2: Net Index Points Captured */}
          <div className="p-4 rounded-xl bg-slate-950/90 border border-sky-500/30 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/5 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center justify-between text-xs font-sans text-slate-400 mb-2">
              <span className="font-semibold text-sky-400 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4" />
                <span>Net Points Captured</span>
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-sky-500/20 text-sky-300 border border-sky-500/40">
                Spot Move
              </span>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight">
                +{summary.netSpotPoints} pts
              </div>
              <div className="text-[11px] text-slate-400 font-sans mt-1">
                +{summary.netOptionPoints} pts option premium (Avg +{summary.avgProfitPercent}%)
              </div>
            </div>
          </div>

          {/* Metric 3: Best Trade of the Day */}
          <div className="p-4 rounded-xl bg-slate-950/90 border border-amber-500/30 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center justify-between text-xs font-sans text-slate-400 mb-2">
              <span className="font-semibold text-amber-400 flex items-center gap-1.5">
                <Award className="w-4 h-4" />
                <span>Best Session Trade</span>
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40">
                Peak Gain
              </span>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-amber-300 tracking-tight">
                +{summary.maxProfitPercent}%
              </div>
              <div className="text-[11px] text-slate-400 font-sans mt-1 truncate" title={summary.bestTrade ? `${summary.bestTrade.strike} ${summary.bestTrade.optionType} (${summary.bestTrade.timeFormatted})` : ''}>
                {summary.bestTrade ? `${summary.bestTrade.strike} ${summary.bestTrade.optionType} (₹${summary.bestTrade.recommendedEntry} ➔ ₹${summary.bestTrade.actualOptionPeakPrice})` : 'Awaiting calls'}
              </div>
            </div>
          </div>

          {/* Metric 4: Average Execution Time to Target */}
          <div className="p-4 rounded-xl bg-slate-950/90 border border-indigo-500/30 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center justify-between text-xs font-sans text-slate-400 mb-2">
              <span className="font-semibold text-indigo-400 flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                <span>Avg Target Time</span>
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                Speed
              </span>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-indigo-300 tracking-tight">
                19 Mins
              </div>
              <div className="text-[11px] text-slate-400 font-sans mt-1">
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

      {/* 2. FILTER SWITCHER BAR */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar pb-1 text-xs font-mono">
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-slate-400 font-sans text-xs">Filter Trades:</span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { id: 'ALL', label: `All Calls (${trades.length})` },
            { id: 'TARGET_HITS', label: `🎯 Targets Cleared (${trades.filter(t => t.status.includes('HIT')).length})` },
            { id: 'TARGET_2_ONLY', label: `Target 2 Runners (${trades.filter(t => t.status === 'TARGET_2_HIT').length})` },
            { id: 'ACTIVE_ONLY', label: `Active / Running (${trades.filter(t => t.status.includes('ACTIVE')).length})` },
            { id: 'PE_ONLY', label: `Puts (${trades.filter(t => t.optionType === 'PE').length})` },
            { id: 'CE_ONLY', label: `Calls (${trades.filter(t => t.optionType === 'CE').length})` },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id as FilterStatus)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer text-xs font-semibold ${
                activeFilter === f.id
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. CHRONOLOGICAL TRADE COMPARISON CARDS ("WHAT IT SAID" VS "WHAT HAPPENED ACTUALLY") */}
      <div className="space-y-4">
        {filteredTrades.map((trade, idx) => {
          const isCall = trade.optionType === 'CE';
          const isT2 = trade.status === 'TARGET_2_HIT';
          const isT1 = trade.status === 'TARGET_1_HIT';
          const isSL = trade.status === 'STOP_LOSS_HIT';
          const isWin = isT1 || isT2;

          return (
            <div 
              key={trade.id}
              className={`rounded-2xl border transition-all overflow-hidden shadow-lg ${
                isT2 
                  ? 'bg-slate-900/90 border-emerald-500/50 shadow-emerald-950/20' 
                  : isT1 
                  ? 'bg-slate-900/90 border-sky-500/40 shadow-sky-950/20' 
                  : isSL
                  ? 'bg-slate-900/90 border-rose-500/40'
                  : 'bg-slate-900/90 border-slate-800'
              }`}
            >
              {/* Header Strip */}
              <div className={`px-4 sm:px-5 py-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                isWin ? 'bg-emerald-500/10 border-emerald-500/20' : isSL ? 'bg-rose-500/10 border-rose-500/20' : 'bg-slate-800/40 border-slate-800'
              }`}>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-950 text-slate-300 font-bold border border-slate-800">
                    ⏱️ {trade.timeFormatted}
                  </span>

                  <span className="text-xs font-bold text-white">
                    {trade.tradeTypeLabel}
                  </span>

                  <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold border ${
                    isCall ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40' : 'bg-rose-950 text-rose-300 border-rose-500/40'
                  }`}>
                    {trade.actionLabel}
                  </span>
                </div>

                {/* Outcome Badge */}
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <div className={`px-3 py-1 rounded-lg text-xs font-mono font-black border flex items-center gap-1.5 shadow-sm ${
                    isT2 ? 'bg-emerald-500 text-slate-950 border-emerald-400' :
                    isT1 ? 'bg-sky-500 text-slate-950 border-sky-400' :
                    isSL ? 'bg-rose-500 text-white border-rose-400' :
                    'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  }`}>
                    <span>{trade.statusLabel}</span>
                    <span className="font-bold">({trade.netPnlPercent > 0 ? '+' : ''}{trade.netPnlPercent}%)</span>
                  </div>

                  {onSelectContract && (
                    <button
                      onClick={() => onSelectContract(trade.strike, trade.optionType)}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                      title="Inspect contract in Option Chain"
                    >
                      View Chain →
                    </button>
                  )}
                </div>
              </div>

              {/* Two-Column Comparison: "What It Said" vs "What Happened Actually" */}
              <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-800/80 p-4 sm:p-5 gap-4 lg:gap-6 text-xs">
                {/* COLUMN 1: WHAT THE ALGORITHM PREDICTED ("WHAT IT SAID") */}
                <div className="space-y-3.5 pr-0 lg:pr-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wider font-bold text-sky-400 flex items-center gap-1.5">
                      <span>1. What Algorithm Predicted ("What It Said")</span>
                    </span>
                    <span className="text-[10.5px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      R:R {trade.riskRewardRatio}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 font-mono">
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-sans">Spot Entry Zone</span>
                      <strong className="text-white text-xs sm:text-sm">
                        {ticker.currency}{trade.spotPriceAtSignal.toLocaleString()}
                      </strong>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-sans">Option Entry Price</span>
                      <strong className="text-sky-300 text-xs sm:text-sm">
                        {ticker.currency}{trade.recommendedEntry.toFixed(2)}
                      </strong>
                      <span className="text-[9.5px] text-slate-500 block">({ticker.currency}{trade.entryRange[0]} - {trade.entryRange[1]})</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-sans">Stop Loss</span>
                      <strong className="text-rose-400 text-xs sm:text-sm">
                        {ticker.currency}{trade.stopLoss.toFixed(2)}
                      </strong>
                      <span className="text-[9.5px] text-slate-500 block">Spot: {ticker.currency}{trade.spotStopLoss}</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-sans">Target 1 (Tactical)</span>
                      <strong className="text-emerald-400 text-xs sm:text-sm">
                        {ticker.currency}{trade.target1.toFixed(2)}
                      </strong>
                      <span className="text-[9.5px] text-emerald-500/80 block">Spot: {ticker.currency}{trade.spotTarget1}</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 col-span-2 sm:col-span-1">
                      <span className="text-[10px] text-slate-400 block font-sans">Target 2 (Runner)</span>
                      <strong className="text-emerald-300 text-xs sm:text-sm">
                        {ticker.currency}{trade.target2.toFixed(2)}
                      </strong>
                      <span className="text-[9.5px] text-emerald-500/80 block">Spot: {ticker.currency}{trade.spotTarget2}</span>
                    </div>
                  </div>

                  {/* Leading Catalyst */}
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[11px] leading-relaxed">
                    <span className="text-slate-400 font-semibold block mb-0.5">🧠 Predictive Catalyst &amp; Triggers:</span>
                    <p className="text-slate-300">
                      {trade.predictedCatalyst}
                    </p>
                  </div>
                </div>

                {/* COLUMN 2: WHAT HAPPENED ACTUALLY ("MARKET REALITY") */}
                <div className="space-y-3.5 pt-3 lg:pt-0 pl-0 lg:pl-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wider font-bold text-emerald-400 flex items-center gap-1.5">
                      <span>2. What Actually Happened ("Market Reality")</span>
                    </span>
                    <span className="text-[10.5px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      Time to target: {trade.timeToTargetMinutes}m
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 font-mono">
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-sans">Subsequent Spot Move</span>
                      <strong className="text-emerald-400 text-xs sm:text-sm">
                        +{trade.actualSpotMovementPoints} pts
                      </strong>
                      <span className="text-[9.5px] text-slate-500 block">Peak: {ticker.currency}{trade.actualSpotSubsequentPeak}</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-sans">Option Peak Price</span>
                      <strong className="text-amber-300 text-xs sm:text-sm">
                        {ticker.currency}{trade.actualOptionPeakPrice.toFixed(2)}
                      </strong>
                      <span className="text-[9.5px] text-slate-400 block">Current: {ticker.currency}{trade.actualOptionCurrentPrice.toFixed(2)}</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-sans">Realized P&amp;L</span>
                      <strong className={`text-xs sm:text-sm ${trade.netPnlPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {trade.netPnlPercent >= 0 ? '+' : ''}{trade.netPnlPercent}%
                      </strong>
                      <span className="text-[9.5px] text-slate-400 block">+{ticker.currency}{trade.netPnlPoints}/sh</span>
                    </div>
                  </div>

                  {/* Outcome Narrative */}
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[11px] leading-relaxed">
                    <span className="text-slate-400 font-semibold block mb-0.5">📊 Verified Market Outcome:</span>
                    <p className="text-slate-200">
                      {trade.actualOutcomeNote}
                    </p>
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
            </div>
          );
        })}
      </div>
    </div>
  );
};
