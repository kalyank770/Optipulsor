import React, { useState } from 'react';
import { 
  AdvanceTradeSetup, 
  TickerConfig, 
  MarketMetrics, 
  OptionChainRow,
  LeadingPredictorFactor,
  TradeSignal
} from '../types/options';
import { MarketHoursStatus } from '../utils/marketHours';
import { 
  Zap, 
  ShieldCheck, 
  Target, 
  ArrowUpRight, 
  ArrowDownRight, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Layers, 
  Gauge, 
  ChevronDown, 
  ChevronUp, 
  PlayCircle, 
  Globe,
  FileCheck2,
  Copy,
  CheckCircle2,
  Minus,
  Circle,
  Power
} from 'lucide-react';

interface AdvanceTradeCardProps {
  setup: AdvanceTradeSetup;
  signal?: TradeSignal;
  ticker: TickerConfig;
  metrics: MarketMetrics;
  chain?: OptionChainRow[];
  marketStatus?: MarketHoursStatus;
  usePreMarket?: boolean;
  onTogglePreMarket?: () => void;
  onSelectContractForSimulation: (strike: number, type: 'CE' | 'PE') => void;
  onSelectTab?: (tab: string) => void;
  theme?: 'dark' | 'light';
  isCompact?: boolean;
}

export const AdvanceTradeCard: React.FC<AdvanceTradeCardProps> = ({
  setup,
  signal,
  ticker,
  metrics,
  chain,
  marketStatus,
  usePreMarket = false,
  onTogglePreMarket,
  onSelectContractForSimulation,
  onSelectTab,
  theme = 'dark',
  isCompact = false,
}) => {
  const isLight = theme === 'light';
  // Collapsed by default as requested
  const [showRadarDetails, setShowRadarDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  const isBull = setup.anticipatedAction === 'BUY_CE';
  const isBear = setup.anticipatedAction === 'BUY_PE';
  const isWait = setup.anticipatedAction === 'WAIT_NEUTRAL';
  const isSideways = !isBull && !isBear && (Boolean(signal?.sidewaysMarketAnalysis?.isSideways) || isWait);

  // Find live option LTP
  const contractRow = chain?.find(r => r.strike === setup.recommendedStrike);
  const liveOption = setup.recommendedType === 'CE' ? contractRow?.ce : contractRow?.pe;
  const currentLTP = liveOption && liveOption.ltp > 0.05
    ? liveOption.ltp
    : setup.advanceEntryOptionRange[0] || 105;

  // Synchronize Option Entry Range, Stop Loss, and Targets directly with currentLTP of the active recommended contract
  const isUSD = ticker.currency === '$';
  const isBankNifty = ticker.symbol.includes('BANK');
  const roundToTick = (val: number) => Math.max(0.05, Math.round(val * 20) / 20);
  const spreadBuf = isUSD ? 0.05 : (isBankNifty ? 1.50 : 0.75);

  const optEntryLow = roundToTick(Math.max(0.05, currentLTP - spreadBuf));
  const optEntryHigh = roundToTick(currentLTP + spreadBuf);
  const optStopLoss = roundToTick(Math.max(0.05, currentLTP * 0.85));
  const optTarget1 = roundToTick(currentLTP * 1.35);
  const optTarget2 = roundToTick(currentLTP * 1.70);
  const optRisk = Math.max(0.5, currentLTP - optStopLoss);
  const optReward = optTarget1 - currentLTP;
  const optRR = `1 : ${(optReward / optRisk).toFixed(1)}`;

  const handleCopy = () => {
    const text = `OptiPulse Signal: ${isBull ? 'CALL (CE)' : isBear ? 'PUT (PE)' : 'NEUTRAL'}\nTicker: ${ticker.symbol} (Spot: ${ticker.currency}${ticker.spotPrice.toLocaleString()})\nRecommended: ${setup.recommendedStrike} ${setup.recommendedType} @ ${ticker.currency}${currentLTP.toFixed(2)}\nConfidence: ${setup.probabilityScore}%\nTarget 1: ${ticker.currency}${optTarget1.toFixed(2)}\nTarget 2: ${ticker.currency}${optTarget2.toFixed(2)}\nStop Loss: ${ticker.currency}${optStopLoss.toFixed(2)}\nR:R: ${optRR}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getFactorBadgeColor = (state: LeadingPredictorFactor['state']) => {
    switch (state) {
      case 'STRONG_BULLISH':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'MODERATE_BULLISH':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'STRONG_BEARISH':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'MODERATE_BEARISH':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className={`rounded-xl border p-4 sm:p-5 transition-all shadow-lg relative overflow-hidden ${
      isLight 
        ? 'bg-gradient-to-br from-indigo-50/50 via-white to-amber-50/30 border-indigo-200 text-slate-900' 
        : 'bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-950 border-indigo-500/30 text-slate-100'
    }`}>
      {/* Background Ambient Glow */}
      <div className={`absolute top-0 right-0 w-80 h-80 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20 ${
        isBull ? 'bg-emerald-500/10' : isBear ? 'bg-rose-500/10' : 'bg-indigo-500/10'
      }`} />

      {/* Unified Top Header & Recommendation Area */}
      <div className="flex flex-col gap-2.5 pb-3.5 border-b border-indigo-500/20 relative z-10">
        {/* Top Metadata Row: Mode Title, Copy, Spot Price & Confidence */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold font-mono uppercase tracking-wider text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800/60">
              {marketStatus?.isHoliday 
                ? `Next Trading Session Prediction (${marketStatus.nextTradingDayName || 'Monday'} Open)`
                : marketStatus && !marketStatus.isOpen 
                ? "Next Session Opening Prediction" 
                : 'Institutional Early-Anticipation Engine'}
            </span>

            {/* Compact Copy Button */}
            <button
              onClick={handleCopy}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer flex items-center justify-center shrink-0"
              title="Copy Trade Recommendation Details"
            >
              {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400 hover:text-slate-200" />}
            </button>

            <span className="text-slate-600">·</span>
            <span className="font-mono text-slate-300">
              {marketStatus?.isOpen && !marketStatus?.isHoliday ? 'Live Spot:' : 'Spot:'} <strong className="text-white">{ticker.currency}{ticker.spotPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            </span>
          </div>

          <span className="text-xs text-slate-300 font-mono">
            Confidence: <strong className="text-emerald-400 font-bold">{setup.probabilityScore}%</strong>
          </span>
        </div>

        {/* Main Recommendation Row: Directional Icon, Headline, Regime Badge & Action Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1">
          <div className="flex items-start sm:items-center gap-3">
            {/* Directional Icon Box: Upward Green Arrow (Bullish), Downward Red Arrow (Bearish), 'O' Orange (Sideways), '-' Grey (Wait/Neutral) */}
            <div className={`p-2.5 sm:p-3 rounded-lg flex items-center justify-center shrink-0 border ${
              isBull ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-xs shadow-emerald-500/20' :
              isBear ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 shadow-xs shadow-rose-500/20' :
              isSideways ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-xs shadow-amber-500/20' :
              'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              {isBull ? (
                <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400 stroke-[2.5] shrink-0" />
              ) : isBear ? (
                <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6 text-rose-400 stroke-[2.5] shrink-0" />
              ) : isSideways ? (
                <Circle className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 stroke-[2.5] shrink-0" />
              ) : (
                <Minus className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400 stroke-[2.5] shrink-0" />
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-white flex flex-wrap items-center gap-2">
                  {isBull && <span className="text-emerald-400">BUY CALL — {setup.recommendedStrike} CE</span>}
                  {isBear && <span className="text-rose-400">BUY PUT — {setup.recommendedStrike} PE</span>}
                  {isWait && <span className="text-amber-400">STAY NEUTRAL / WAIT {signal?.afterMarketAnalytics?.predictedOpeningType === 'FLAT_OPENING' ? '(FLAT OPEN)' : ''}</span>}
                </h2>

                {/* Dynamic Regime & Momentum Badge */}
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded border flex items-center gap-1.5 font-mono shadow-xs ${
                  isBull
                    ? 'border-emerald-500/50 bg-emerald-950/70 text-emerald-300'
                    : isBear
                    ? 'border-rose-500/50 bg-rose-950/70 text-rose-300'
                    : 'border-amber-500/50 bg-amber-950/70 text-amber-300'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                    isBull ? 'bg-emerald-400' : isBear ? 'bg-rose-400' : 'bg-amber-400'
                  }`} />
                  <span>
                    {isBull
                      ? `BULLISH EXPANSION (${setup.probabilityScore}% MOMENTUM)`
                      : isBear
                      ? `BEARISH BREAKDOWN (${setup.probabilityScore}% MOMENTUM)`
                      : signal?.afterMarketAnalytics?.predictedOpeningType === 'FLAT_OPENING'
                      ? `FLAT OPEN (${signal.afterMarketAnalytics.predictedOpeningGapPoints >= 0 ? '+' : ''}${signal.afterMarketAnalytics.predictedOpeningGapPoints} pts) · WAIT 15M ORB`
                      : `SIDEWAYS / RANGE CHOP (${signal?.sidewaysMarketAnalysis?.compressionPercentage || 64}% SQUEEZE)`}
                  </span>
                </span>

                {/* Pre-Market Predictor Active Badge */}
                {(usePreMarket || ticker.isUsingPreMarket) && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-amber-500/50 bg-amber-950/60 text-amber-300 text-[11px] font-mono font-bold shadow-xs">
                    <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                    <span>Pre-Market Predictor Active</span>
                    {onTogglePreMarket && (
                      <button
                        onClick={onTogglePreMarket}
                        className="ml-1 px-1.5 py-0.5 rounded bg-amber-500/25 hover:bg-rose-500/30 hover:text-rose-200 text-amber-200 transition-colors cursor-pointer flex items-center gap-1 border border-amber-500/40 text-[10px] font-sans"
                        title="Turn Off Pre-Market Predictor & Return to Regular Spot Feed"
                      >
                        <Power className="w-3 h-3 text-rose-400" />
                        <span>Turn Off</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Simulate Contract Icon Button */}
            {!isWait && (
              <button
                onClick={() => onSelectContractForSimulation(setup.recommendedStrike, setup.recommendedType)}
                className="p-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold transition-all cursor-pointer shadow-sm shadow-emerald-500/20 flex items-center justify-center shrink-0"
                title="Simulate Payoff"
              >
                <PlayCircle className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Subtitle */}
      <p className="text-xs text-slate-300 font-sans mt-2.5 leading-relaxed relative z-10">
        <strong className="text-amber-300">Predictive Trigger: </strong>
        {setup.primaryLeadingCatalyst}
      </p>

      {/* PRIMARY SETUP HIGHLIGHT CARDS GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mt-3 relative z-10">
        {/* Card 1: Action & Recommended Strike */}
        <div className={`p-3 rounded-lg border flex flex-col justify-between ${
          isBull ? 'bg-emerald-950/40 border-emerald-500/40' :
          isBear ? 'bg-rose-950/40 border-rose-500/40' :
          'bg-slate-900/80 border-slate-800'
        }`}>
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>{isWait ? 'REFERENCE STRIKE (ORB)' : 'RECOMMENDED STRIKE'}</span>
            <span className={`font-bold text-[10px] px-1.5 py-0.2 rounded border ${
              isBull ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40' :
              isBear ? 'bg-rose-950 text-rose-300 border-rose-500/40' :
              'bg-amber-950 text-amber-300 border-amber-500/40'
            }`}>
              {isWait ? 'STAND ASIDE' : setup.anticipatedAction.replace('_', ' ')}
            </span>
          </div>
          <div className="mt-1">
            <div className={`text-base sm:text-xl font-bold font-mono flex items-center gap-1.5 ${
              isBull ? 'text-emerald-300' : isBear ? 'text-rose-300' : 'text-slate-300'
            }`}>
              {isBull && <ArrowUpRight className="w-4 h-4 text-emerald-400 shrink-0" />}
              {isBear && <ArrowDownRight className="w-4 h-4 text-rose-400 shrink-0" />}
              <span>{setup.recommendedStrike} {setup.recommendedType}</span>
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
              Live LTP: <strong className="text-white">{ticker.currency}{currentLTP.toFixed(2)}</strong>
            </div>
          </div>
        </div>

        {/* Card 2: Entry Zone (Spot & Option) */}
        <div className="p-3 rounded-lg border bg-slate-900/80 border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>ENTRY ZONE</span>
            <span className="text-emerald-400 font-bold text-[10px]">BASE SUPPORT</span>
          </div>
          <div className="mt-1">
            <div className="text-xs sm:text-sm font-bold font-mono text-amber-300">
              {ticker.currency}{setup.advanceEntryZoneSpot[0].toLocaleString()} – {ticker.currency}{setup.advanceEntryZoneSpot[1].toLocaleString()}
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
              Option: <span className="text-slate-200">{ticker.currency}{optEntryLow.toFixed(2)} – {ticker.currency}{optEntryHigh.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Invalidation Stop-Loss */}
        <div className="p-3 rounded-lg border bg-slate-900/80 border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>STRICT STOP-LOSS</span>
            <span className="text-rose-400 font-bold text-[10px]">PROTECTED</span>
          </div>
          <div className="mt-1">
            <div className="text-xs sm:text-sm font-bold font-mono text-rose-300">
              Spot: {ticker.currency}{setup.advanceStopLossSpot.toLocaleString()}
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
              Option SL: <strong className="text-rose-400">{ticker.currency}{optStopLoss.toFixed(2)}</strong>
            </div>
          </div>
        </div>

        {/* Card 4: Targets & Risk-Reward */}
        <div className="p-3 rounded-lg border bg-slate-900/80 border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>TARGETS</span>
            <span className="text-emerald-400 font-bold text-[10px]">R:R {optRR}</span>
          </div>
          <div className="mt-1">
            <div className="text-xs sm:text-sm font-bold font-mono text-emerald-300">
              T1: {ticker.currency}{optTarget1.toFixed(2)} <span className="text-[10px] text-emerald-400">(+{Math.max(1, Math.round(((optTarget1 - currentLTP) / Math.max(0.05, currentLTP)) * 100))}%)</span>
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
              T2: <span className="text-emerald-400">{ticker.currency}{optTarget2.toFixed(2)}</span> (+{Math.max(2, Math.round(((optTarget2 - currentLTP) / Math.max(0.05, currentLTP)) * 100))}%)
            </div>
          </div>
        </div>
      </div>

      {/* 5+ LEADING PREDICTORS RADAR (COLLAPSED BY DEFAULT) */}
      <div className="mt-3 relative z-10">
        <button
          onClick={() => setShowRadarDetails(prev => !prev)}
          className="w-full flex items-center justify-between p-2.5 rounded-lg bg-slate-900/80 hover:bg-slate-850 text-slate-200 border border-slate-800 text-xs font-mono transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-indigo-400" />
            <span className="font-bold">5 Institutional Leading Predictors Radar</span>
            <span className="text-[10px] text-slate-400">({setup.leadingPredictorFactors.length} factors evaluated)</span>
          </div>
          <div className="flex items-center gap-1.5 text-indigo-400 text-[11px]">
            <span>{showRadarDetails ? 'Hide Radar' : 'View Live Radar'}</span>
            {showRadarDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {showRadarDetails && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-2 pt-1 animate-fade-in">
            {setup.leadingPredictorFactors.map((factor, idx) => (
              <div 
                key={idx} 
                className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 flex flex-col justify-between space-y-1.5"
              >
                <div className="flex items-start justify-between gap-1.5">
                  <span className="text-xs font-bold text-slate-200 leading-tight">
                    {factor.name}
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${getFactorBadgeColor(factor.state)}`}>
                    {factor.state.replace(/_/g, ' ')}
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 leading-normal font-sans">
                  {factor.valueDescription}
                </p>

                <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-850">
                  <span>Confidence: <strong className="text-slate-300">{factor.confidenceScore}%</strong></span>
                  <span className="text-emerald-400/90 font-semibold">Active Vector</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
