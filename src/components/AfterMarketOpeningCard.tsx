import React from 'react';
import { 
  Moon, 
  TrendingUp, 
  TrendingDown, 
  ShieldAlert, 
  Zap, 
  Layers, 
  ArrowUpRight, 
  ArrowDownRight,
  Clock,
  Briefcase,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';
import { AfterMarketOpeningAnalytics } from '../utils/afterMarketEngine';
import { TickerConfig } from '../types/options';

interface AfterMarketOpeningCardProps {
  analytics?: AfterMarketOpeningAnalytics;
  ticker: TickerConfig;
  theme?: 'dark' | 'light';
  giftNiftyLastSynced?: Date;
  isGiftNiftySyncing?: boolean;
  onRefreshGiftNifty?: () => void;
}

export const AfterMarketOpeningCard: React.FC<AfterMarketOpeningCardProps> = ({
  analytics,
  ticker,
  theme = 'dark',
  giftNiftyLastSynced,
  isGiftNiftySyncing = false,
  onRefreshGiftNifty,
}) => {
  if (!analytics || !analytics.isAfterMarketMode) return null;

  const isLight = theme === 'light';
  const {
    sessionStateLabel,
    lastSpotClose,
    vwapDeltaPoints,
    vwapDeltaLabel,
    giftNiftyPrice,
    giftNiftyChangePoints,
    giftNiftyChangePercent,
    fiiDiiNetFlow,
    predictedOpeningSpot,
    predictedOpeningGapPoints,
    predictedOpeningGapPercent,
    predictedOpeningType,
    openingStrategyPlaybook
  } = analytics;

  const isGapUp = predictedOpeningType === 'GAP_UP_OPENING';
  const isGapDown = predictedOpeningType === 'GAP_DOWN_OPENING';

  return (
    <div className={`rounded-xl border p-3 sm:p-3.5 shadow-lg space-y-2.5 font-sans transition-all ${
      isLight 
        ? 'bg-gradient-to-br from-indigo-50/90 via-white to-sky-50/90 border-indigo-200 text-slate-900' 
        : 'bg-gradient-to-br from-slate-950 via-indigo-950/20 to-slate-950 border-indigo-500/30 text-slate-100'
    }`}>
      {/* 1. COMPACT HEADER BAR */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-500/20 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 shrink-0">
            <Moon className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white">
              After-Market & Pre-Market Analytics
            </h3>
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-bold">
              {sessionStateLabel?.replace(/_/g, ' ') || 'OVERNIGHT'}
            </span>
          </div>
        </div>

        {/* Predicted Opening Gap Badge */}
        <div className="flex items-center gap-2 font-mono ml-auto">
          <span className="text-[11px] text-slate-400">Predicted Open:</span>
          <span className={`px-2.5 py-0.5 rounded text-xs font-extrabold flex items-center gap-1 border ${
            isGapUp 
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
              : isGapDown 
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' 
              : 'bg-slate-800 text-slate-300 border-slate-700'
          }`}>
            {isGapUp ? <ArrowUpRight className="w-3.5 h-3.5" /> : isGapDown ? <ArrowDownRight className="w-3.5 h-3.5" /> : null}
            <span>{ticker.currency}{predictedOpeningSpot.toLocaleString()}</span>
            <span className="text-[10px] font-medium opacity-90">
              ({predictedOpeningGapPoints >= 0 ? '+' : ''}{predictedOpeningGapPoints} pts · {predictedOpeningGapPercent}%)
            </span>
          </span>
        </div>
      </div>

      {/* 2. HIGH-DENSITY 4-PILLAR METRICS STRIP */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
        {/* A. Closing Spot vs VWAP Delta */}
        <div className={`p-2 rounded-lg border ${
          isLight ? 'bg-white border-slate-200' : 'bg-slate-900/80 border-slate-800/80'
        }`}>
          <div className="text-[10px] text-slate-400 font-bold uppercase font-sans flex items-center justify-between">
            <span>Close vs VWAP</span>
            <Clock className="w-3 h-3 text-indigo-400" />
          </div>
          <div className="text-xs font-extrabold text-white mt-0.5">
            {ticker.currency}{lastSpotClose.toLocaleString()}
          </div>
          <p className={`text-[10.5px] font-semibold truncate ${vwapDeltaPoints >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {vwapDeltaLabel}
          </p>
        </div>

        {/* B. GIFT Nifty Overnight Trading */}
        <div className={`p-2.5 rounded-lg border flex flex-col justify-between ${
          isLight ? 'bg-white border-slate-200' : 'bg-slate-900/80 border-slate-800/80'
        }`}>
          <div className="text-[10px] text-slate-400 font-bold uppercase font-sans flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span>GIFT Nifty</span>
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-sky-500"></span>
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Layers className="w-3 h-3 text-sky-400 shrink-0" />
              {onRefreshGiftNifty && (
                <button
                  onClick={onRefreshGiftNifty}
                  disabled={isGiftNiftySyncing}
                  className="p-0.5 hover:bg-slate-800 rounded transition-colors text-slate-400 hover:text-sky-300 cursor-pointer"
                  title="Force Instant GIFT Nifty Refresh"
                >
                  <RefreshCw className={`w-3 h-3 ${isGiftNiftySyncing ? 'animate-spin text-sky-400' : ''}`} />
                </button>
              )}
            </div>
          </div>

          <div className="text-xs font-extrabold text-sky-300 mt-1 flex items-baseline justify-between">
            <span>₹{giftNiftyPrice.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}</span>
            <span className={`text-[10.5px] font-semibold ${giftNiftyChangePoints >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {giftNiftyChangePoints >= 0 ? '+' : ''}{giftNiftyChangePoints.toFixed(1)} ({giftNiftyChangePercent >= 0 ? '+' : ''}{giftNiftyChangePercent.toFixed(2)}%)
            </span>
          </div>

          <div className="mt-1 pt-1 border-t border-slate-800/60 flex items-center justify-between text-[9px] text-slate-400 font-mono">
            <span className="flex items-center gap-1 text-slate-400">
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
              <span>Synced:</span>
            </span>
            <span className="text-emerald-300 font-bold">
              {(giftNiftyLastSynced || new Date()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
            </span>
          </div>
        </div>

        {/* C. FII / DII After-Market Net Flow */}
        <div className={`p-2 rounded-lg border ${
          isLight ? 'bg-white border-slate-200' : 'bg-slate-900/80 border-slate-800/80'
        }`}>
          <div className="text-[10px] text-slate-400 font-bold uppercase font-sans flex items-center justify-between">
            <span>FII Flow</span>
            <Briefcase className="w-3 h-3 text-emerald-400" />
          </div>
          <div className="text-xs font-extrabold text-emerald-300 mt-0.5">
            {fiiDiiNetFlow.fiiNetCashCr >= 0 ? `+₹${fiiDiiNetFlow.fiiNetCashCr} Cr` : `-₹${Math.abs(fiiDiiNetFlow.fiiNetCashCr)} Cr`}
          </div>
          <p className="text-[10.5px] text-slate-300 truncate">
            {fiiDiiNetFlow.netFlowSentiment?.replace(/_/g, ' ') || 'BALANCED'}
          </p>
        </div>

        {/* D. Global Macro Score */}
        <div className={`p-2 rounded-lg border ${
          isLight ? 'bg-white border-slate-200' : 'bg-slate-900/80 border-slate-800/80'
        }`}>
          <div className="text-[10px] text-slate-400 font-bold uppercase font-sans flex items-center justify-between">
            <span>Global Macro</span>
            <Zap className="w-3 h-3 text-amber-400" />
          </div>
          <div className="text-xs font-extrabold text-amber-300 mt-0.5">
            {predictedOpeningType?.replace(/_/g, ' ') || 'FLAT OPEN'}
          </div>
          <p className="text-[10.5px] text-slate-300 truncate">
            Score: {analytics.globalMacroCompositeScore > 0 ? `+${analytics.globalMacroCompositeScore}` : analytics.globalMacroCompositeScore}/100
          </p>
        </div>
      </div>
    </div>
  );
};
