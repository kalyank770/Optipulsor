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
  Briefcase
} from 'lucide-react';
import { AfterMarketOpeningAnalytics } from '../utils/afterMarketEngine';
import { TickerConfig } from '../types/options';

interface AfterMarketOpeningCardProps {
  analytics?: AfterMarketOpeningAnalytics;
  ticker: TickerConfig;
  theme?: 'dark' | 'light';
}

export const AfterMarketOpeningCard: React.FC<AfterMarketOpeningCardProps> = ({
  analytics,
  ticker,
  theme = 'dark'
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
        <div className={`p-2 rounded-lg border ${
          isLight ? 'bg-white border-slate-200' : 'bg-slate-900/80 border-slate-800/80'
        }`}>
          <div className="text-[10px] text-slate-400 font-bold uppercase font-sans flex items-center justify-between">
            <span>GIFT Nifty</span>
            <Layers className="w-3 h-3 text-sky-400" />
          </div>
          <div className="text-xs font-extrabold text-sky-300 mt-0.5">
            {giftNiftyPrice.toLocaleString()}
          </div>
          <p className={`text-[10.5px] font-semibold ${giftNiftyChangePoints >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {giftNiftyChangePoints >= 0 ? '+' : ''}{giftNiftyChangePoints} pts ({giftNiftyChangePercent}%)
          </p>
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

      {/* 3. COMPACT NEXT DAY OPENING PLAYBOOK */}
      <div className={`p-2.5 sm:p-3 rounded-lg border ${
        openingStrategyPlaybook.openingBias === 'BULLISH_GAP_MOMENTUM'
          ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-100'
          : openingStrategyPlaybook.openingBias === 'BEARISH_GAP_BREAKDOWN'
          ? 'bg-rose-950/30 border-rose-500/30 text-rose-100'
          : 'bg-amber-950/30 border-amber-500/30 text-amber-100'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-2">
          <div className="flex items-center gap-1.5">
            <span className="p-1 rounded bg-white/10 shrink-0">
              {openingStrategyPlaybook.openingOptionType === 'CE' ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> : <TrendingDown className="w-3.5 h-3.5 text-rose-400" />}
            </span>
            <span className="font-bold text-[11px] sm:text-xs uppercase tracking-wider text-white">
              Opening Playbook: {openingStrategyPlaybook.strategyTitle}
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs ml-auto">
            <span className="text-[10px] text-slate-300">Target Strike:</span>
            <span className="px-2 py-0.5 rounded font-extrabold bg-white/20 border border-white/20 text-white">
              {openingStrategyPlaybook.recommendedOpeningOption === 'BUY_CE' 
                ? `BUY ${openingStrategyPlaybook.openingStrike} CE` 
                : openingStrategyPlaybook.recommendedOpeningOption === 'BUY_PE' 
                ? `BUY ${openingStrategyPlaybook.openingStrike} PE` 
                : 'WAIT FOR 15M ORB'}
            </span>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mt-2">
          <p className="text-[11px] leading-relaxed font-sans text-slate-200 flex-1">
            <strong className="text-white">Strategy:</strong> {openingStrategyPlaybook.playbookDescription}
          </p>

          {openingStrategyPlaybook.recommendedOpeningOption !== 'WAIT_FIRST_15M' && (
            <div className="flex items-center justify-around sm:justify-end gap-3 font-mono text-xs shrink-0 bg-black/20 px-2.5 py-1 rounded border border-white/5">
              <div className="text-center">
                <span className="text-[9px] text-slate-300 block">TARGET 1</span>
                <strong className="text-emerald-400 text-xs">₹{openingStrategyPlaybook.openingContractTarget1.toFixed(2)}</strong>
              </div>
              <div className="text-center border-l border-white/10 pl-3">
                <span className="text-[9px] text-slate-300 block">TARGET 2</span>
                <strong className="text-sky-400 text-xs">₹{openingStrategyPlaybook.openingContractTarget2.toFixed(2)}</strong>
              </div>
              <div className="text-center border-l border-white/10 pl-3">
                <span className="text-[9px] text-slate-300 block">STOP LOSS</span>
                <strong className="text-rose-400 text-xs">₹{openingStrategyPlaybook.openingContractStopLoss.toFixed(2)}</strong>
              </div>
            </div>
          )}
        </div>

        <div className="mt-2 pt-1.5 border-t border-white/10 text-[10.5px] font-mono text-slate-300 flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-300 shrink-0" />
          <span><strong className="text-white">Trigger:</strong> {openingStrategyPlaybook.openingExecutionTrigger}</span>
        </div>
      </div>
    </div>
  );
};
